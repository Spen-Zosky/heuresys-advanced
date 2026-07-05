/**
 * apps/api/src/middleware/rbac.ts
 * `requirePermission(code)` preHandler factory. Reads req.user.roles and
 * checks against an in-memory cache of role → permission codes loaded at
 * server start from sys.sys_auth_role_permissions.
 *
 * For MVP-1 5.1.1 we wire up the structure but the cache load happens in
 * 5.1.3 (auth module). Until then, requirePermission throws on missing
 * cache so it cannot be accidentally bypassed.
 */

import type { FastifyRequest, FastifyReply, preHandlerAsyncHookHandler } from "fastify";
import { UnauthorizedError, ForbiddenError } from "../errors/index.js";
import type { RoleCode } from "../config/constants.js";

/**
 * In-memory permission cache. Populated at server start from
 * sys.sys_auth_role_permissions JOIN sys.sys_auth_roles + sys.sys_auth_permissions.
 * Key = role code, value = set of permission codes granted.
 */
const rolePermissionCache = new Map<RoleCode, Set<string>>();

/** ISO timestamp of the last `setRolePermissionCache` call; null until first load. */
let cacheLoadedAt: string | null = null;

export function setRolePermissionCache(map: Map<RoleCode, Set<string>>): void {
  rolePermissionCache.clear();
  for (const [role, perms] of map.entries()) rolePermissionCache.set(role, perms);
  cacheLoadedAt = new Date().toISOString();
}

export function isRolePermissionCacheLoaded(): boolean {
  return rolePermissionCache.size > 0;
}

/**
 * Runtime stats for the in-memory RBAC cache, consumed by the observability
 * system-health snapshot. Derived synchronously from the live cache — no DB hit.
 * `rolesLoaded` = number of role codes; `mappingsLoaded` = total role×permission
 * entries (sum of each role's permission-set size); `loadedAt` = last load time.
 */
export function rbacCacheStats(): {
  rolesLoaded: number;
  mappingsLoaded: number;
  loadedAt: string | null;
} {
  let mappingsLoaded = 0;
  for (const perms of rolePermissionCache.values()) mappingsLoaded += perms.size;
  return {
    rolesLoaded: rolePermissionCache.size,
    mappingsLoaded,
    loadedAt: cacheLoadedAt,
  };
}

export function userHasPermission(user: { roles: RoleCode[] }, permissionCode: string): boolean {
  for (const role of user.roles) {
    const perms = rolePermissionCache.get(role);
    if (perms?.has(permissionCode)) return true;
  }
  return false;
}

/**
 * Flattened, de-duplicated, sorted set of permission codes the user holds across
 * all their roles. Backs GET /v1/me/permissions, which drives per-item sidebar gating.
 */
export function userPermissionCodes(user: { roles: readonly string[] }): string[] {
  const out = new Set<string>();
  for (const role of user.roles) {
    const perms = rolePermissionCache.get(role as RoleCode);
    if (perms) for (const p of perms) out.add(p);
  }
  return Array.from(out).sort();
}

export function requirePermission(permissionCode: string): preHandlerAsyncHookHandler {
  const handler: preHandlerAsyncHookHandler = async (req: FastifyRequest, _reply: FastifyReply) => {
    if (!isRolePermissionCacheLoaded()) {
      throw new ForbiddenError(
        "RBAC permission cache not loaded — server bootstrap incomplete",
        "RBAC_NOT_LOADED",
      );
    }
    if (!req.user) throw new UnauthorizedError("Authentication required");
    if (!userHasPermission(req.user, permissionCode)) {
      throw new ForbiddenError(`Missing permission: ${permissionCode}`);
    }
  };
  // The permission code rides on the handler so the org-gate boot assertion
  // (lib/scope/gate.ts, D-51) can map every route to its RBAC resource.
  return Object.assign(handler, { permissionCode });
}
