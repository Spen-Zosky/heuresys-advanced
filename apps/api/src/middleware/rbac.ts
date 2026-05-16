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

export function setRolePermissionCache(map: Map<RoleCode, Set<string>>): void {
  rolePermissionCache.clear();
  for (const [role, perms] of map.entries()) rolePermissionCache.set(role, perms);
}

export function isRolePermissionCacheLoaded(): boolean {
  return rolePermissionCache.size > 0;
}

export function userHasPermission(user: { roles: RoleCode[] }, permissionCode: string): boolean {
  for (const role of user.roles) {
    const perms = rolePermissionCache.get(role);
    if (perms?.has(permissionCode)) return true;
  }
  return false;
}

export function requirePermission(permissionCode: string): preHandlerAsyncHookHandler {
  return async (req: FastifyRequest, _reply: FastifyReply) => {
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
}
