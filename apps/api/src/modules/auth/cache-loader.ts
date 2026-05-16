/**
 * apps/api/src/modules/auth/cache-loader.ts
 * Loads sys.sys_auth_role_permissions into the in-memory RBAC cache used by
 * middleware/rbac.ts. Called once at server start, before app.listen(), so the
 * first request can be properly authorised.
 *
 * Per AUTH_SECURITY_PLAN §6.
 */

import { pool } from "../../db/client.js";
import { ROLE_CODES, type RoleCode } from "../../config/constants.js";
import { setRolePermissionCache } from "../../middleware/rbac.js";

const KNOWN_ROLES = new Set<string>(ROLE_CODES);

export interface CacheLoadResult {
  rolesLoaded: number;
  mappingsLoaded: number;
  unknownRolesSkipped: string[];
}

export async function loadRolePermissionCache(): Promise<CacheLoadResult> {
  const result = await pool.query<{ role_code: string; permission_code: string }>(`
    SELECT r.auth_role_code        AS role_code,
           p.auth_permission_code  AS permission_code
      FROM sys.sys_auth_role_permissions rp
      JOIN sys.sys_auth_roles       r ON r.auth_role_id       = rp.auth_role_id
      JOIN sys.sys_auth_permissions p ON p.auth_permission_id = rp.auth_permission_id
  `);

  const map = new Map<RoleCode, Set<string>>();
  const unknown = new Set<string>();
  let mappingsLoaded = 0;

  for (const row of result.rows) {
    if (!KNOWN_ROLES.has(row.role_code)) {
      unknown.add(row.role_code);
      continue;
    }
    const role = row.role_code as RoleCode;
    let perms = map.get(role);
    if (!perms) {
      perms = new Set<string>();
      map.set(role, perms);
    }
    perms.add(row.permission_code);
    mappingsLoaded++;
  }

  if (map.size === 0) {
    throw new Error(
      "RBAC permission cache is empty — sys.sys_auth_role_permissions returned no rows for any known role. " +
        "Check migration 000005 and the role/permission seeds before starting the API.",
    );
  }

  setRolePermissionCache(map);

  return {
    rolesLoaded: map.size,
    mappingsLoaded,
    unknownRolesSkipped: [...unknown],
  };
}
