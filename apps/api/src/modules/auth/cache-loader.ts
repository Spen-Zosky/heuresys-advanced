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

/** Minimal logger surface so the retry helper stays testable without Fastify. */
export interface BootRetryLogger {
  warn: (obj: unknown, msg?: string) => void;
}

/**
 * D-20 — boot resilience. A transient pool-establishment timeout through the
 * SSH tunnel (OCI free-tier jitter) must not kill the API at start (observed
 * S980: 4 consecutive boot failures, ok at the 5th, while single-shot psql
 * worked — it is the pool establishment that times out, not the forward).
 * Retries with capped exponential backoff. A *successful* query that yields an
 * empty cache is a seed/migration defect, not jitter — that error fails fast.
 */
export async function loadRolePermissionCacheWithRetry(
  log: BootRetryLogger,
  loader: () => Promise<CacheLoadResult> = loadRolePermissionCache,
  backoffMs: readonly number[] = [1_000, 2_000, 4_000, 8_000],
): Promise<CacheLoadResult> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await loader();
    } catch (err) {
      const isEmptyCacheDefect =
        err instanceof Error && err.message.startsWith("RBAC permission cache is empty");
      if (isEmptyCacheDefect || attempt >= backoffMs.length) throw err;
      const delayMs = backoffMs[attempt] ?? 0;
      log.warn(
        { err, attempt: attempt + 1, maxAttempts: backoffMs.length + 1, delayMs },
        "RBAC cache boot load failed; retrying after backoff",
      );
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
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
