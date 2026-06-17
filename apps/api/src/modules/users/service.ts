/**
 * apps/api/src/modules/users/service.ts
 * Business logic for the users module. Enforces the 4-tier scope filter
 * (PLATFORM_ADMIN / TENANT_ADMIN / MANAGER team / USER self) per
 * AUTH_SECURITY_PLAN §6 matrix, and the field-level restriction for
 * non-privileged actors on PATCH.
 */

import { pool } from "../../db/client.js";
import type { ActorContext } from "../../lib/actor.js";

export type { ActorContext };
import {
  NotFoundError,
  ConflictError,
  ForbiddenError,
} from "../../errors/index.js";
import type { RoleCode } from "../../config/constants.js";
import type {
  User,
  UserListQuery,
  UserListResponse,
  CreateUserBody,
  UpdateUserBody,
  RoleGrant,
} from "@heuresys/shared";
import { NON_PRIVILEGED_UPDATABLE_FIELDS } from "@heuresys/shared";
import * as repo from "./repository.js";

const NON_PRIVILEGED_FIELDS = new Set<string>(NON_PRIVILEGED_UPDATABLE_FIELDS);

function isPlatformAdmin(a: ActorContext): boolean {
  return a.roles.includes("PLATFORM_ADMIN");
}
function isTenantAdmin(a: ActorContext): boolean {
  return a.roles.includes("TENANT_ADMIN");
}
function isManager(a: ActorContext): boolean {
  return a.roles.includes("MANAGER");
}
function isStandardUser(a: ActorContext): boolean {
  return a.roles.includes("USER") || a.roles.includes("READ_ONLY");
}

function requireOwnTenant(a: ActorContext): string {
  if (!a.tenantId) throw new ForbiddenError("Tenant context required");
  return a.tenantId;
}

/**
 * Decide which user_id allow-list (if any) applies to the actor's reads.
 * - PLATFORM_ADMIN: undefined (no restriction).
 * - TENANT_ADMIN: undefined (tenant filter handled separately).
 * - MANAGER (without higher role): manager team set.
 * - USER / READ_ONLY (without higher role): [self].
 */
async function resolveReadScope(actor: ActorContext): Promise<{
  tenantId?: string;
  userIdAllowList?: string[];
}> {
  if (isPlatformAdmin(actor)) return {};
  if (isTenantAdmin(actor)) return { tenantId: requireOwnTenant(actor) };
  if (isManager(actor)) {
    const team = await repo.getManagerTeamUserIds(pool, actor.userId);
    return { tenantId: requireOwnTenant(actor), userIdAllowList: team };
  }
  if (isStandardUser(actor)) {
    return { tenantId: requireOwnTenant(actor), userIdAllowList: [actor.userId] };
  }
  // Any other authenticated user with no recognised role: see self only.
  return { tenantId: requireOwnTenant(actor), userIdAllowList: [actor.userId] };
}

async function canActOnTarget(
  actor: ActorContext,
  target: User,
  intent: "read" | "update" | "delete",
): Promise<boolean> {
  if (isPlatformAdmin(actor)) return true;
  // Tenant boundary (everything below requires actor.tenantId).
  const ownTenant = actor.tenantId;
  if (!ownTenant || target.tenantId !== ownTenant) return false;

  if (isTenantAdmin(actor)) return true;

  if (intent === "delete") {
    // Only PLATFORM/TENANT admins can delete; we already rejected MANAGER/USER.
    return false;
  }

  if (isManager(actor)) {
    const team = await repo.getManagerTeamUserIds(pool, actor.userId);
    if (team.includes(target.userId)) return true;
    // MANAGER may always read+update themselves via the same logic — team
    // already includes the manager id via UNION in the SQL.
    return false;
  }

  if (isStandardUser(actor)) {
    return target.userId === actor.userId;
  }

  return false;
}

function ensureFieldsAllowed(actor: ActorContext, patch: UpdateUserBody): void {
  if (isPlatformAdmin(actor) || isTenantAdmin(actor)) return;
  for (const k of Object.keys(patch)) {
    if (!NON_PRIVILEGED_FIELDS.has(k)) {
      throw new ForbiddenError(
        `Field '${k}' cannot be updated at your privilege level`,
        "FIELD_NOT_ALLOWED",
      );
    }
  }
}

export const usersService = {
  async list(actor: ActorContext, query: UserListQuery): Promise<UserListResponse> {
    const scope = await resolveReadScope(actor);
    return repo.listUsers(pool, { ...scope, query });
  },

  async getById(actor: ActorContext, id: string): Promise<User> {
    const target = await repo.findUserById(pool, id);
    if (!target) throw new NotFoundError("User");
    if (!(await canActOnTarget(actor, target, "read"))) {
      // 404 to prevent existence enumeration across tenant / team boundary.
      throw new NotFoundError("User");
    }
    return target;
  },

  async create(actor: ActorContext, body: CreateUserBody): Promise<User> {
    // Route preHandler gates user:create (PLATFORM/TENANT_ADMIN per matrix).
    // PLATFORM_ADMIN may target any tenant via body.tenantId (and is the only
    // path that can create users in tenants other than its own seat). If
    // body.tenantId is omitted, fall back to actor.tenantId; that requires
    // PLATFORM_ADMIN to have a non-null tenant context (rare since their
    // grants are tenant-NULL — so they typically MUST supply body.tenantId).
    // TENANT_ADMIN: ignore body.tenantId entirely; force actor.tenantId.
    let tenantId: string;
    if (isPlatformAdmin(actor)) {
      if (body.tenantId) {
        tenantId = body.tenantId;
      } else if (actor.tenantId) {
        tenantId = actor.tenantId;
      } else {
        throw new ForbiddenError(
          "PLATFORM_ADMIN must supply body.tenantId when creating outside their own tenant",
          "TENANT_ID_REQUIRED",
        );
      }
    } else {
      tenantId = requireOwnTenant(actor);
    }
    const dup = await repo.findUserByEmailInTenant(pool, tenantId, body.email);
    if (dup) {
      throw new ConflictError(
        `Email '${body.email}' already in use in this tenant`,
        "USER_EMAIL_CONFLICT",
      );
    }
    return repo.insertUser(pool, tenantId, body);
  },

  async update(
    actor: ActorContext,
    id: string,
    patch: UpdateUserBody,
  ): Promise<User> {
    const target = await repo.findUserById(pool, id);
    if (!target) throw new NotFoundError("User");
    if (!(await canActOnTarget(actor, target, "update"))) {
      throw new NotFoundError("User");
    }
    ensureFieldsAllowed(actor, patch);

    // Email uniqueness check on rename (per-tenant unique index).
    if (patch.email && patch.email.toLowerCase() !== target.email.toLowerCase()) {
      const dup = await repo.findUserByEmailInTenant(pool, target.tenantId, patch.email);
      if (dup && dup.userId !== target.userId) {
        throw new ConflictError(
          `Email '${patch.email}' already in use in this tenant`,
          "USER_EMAIL_CONFLICT",
        );
      }
    }

    const updated = await repo.updateUserPartial(pool, id, patch);
    if (!updated) throw new NotFoundError("User");
    return updated;
  },

  async deactivate(actor: ActorContext, id: string): Promise<void> {
    const target = await repo.findUserById(pool, id);
    if (!target) throw new NotFoundError("User");
    if (!(await canActOnTarget(actor, target, "delete"))) {
      throw new NotFoundError("User");
    }
    if (target.userId === actor.userId) {
      throw new ConflictError("Cannot deactivate your own account", "SELF_DEACTIVATE");
    }
    const ok = await repo.deactivateUser(pool, id);
    if (!ok) {
      throw new ConflictError("User already deactivated", "USER_ALREADY_DEACTIVATED");
    }
  },

  /* -------------------------------------------------- role grants */

  async listRoles(actor: ActorContext, id: string): Promise<RoleGrant[]> {
    // Reading another user's roles requires admin-level scope. MANAGER/USER
    // can read only their own roles.
    const target = await repo.findUserById(pool, id);
    if (!target) throw new NotFoundError("User");
    const isSelf = target.userId === actor.userId;
    if (!(isPlatformAdmin(actor) || isTenantAdmin(actor) || isSelf)) {
      // Hide existence.
      throw new NotFoundError("User");
    }
    return repo.listRoleGrantsForUser(pool, id);
  },

  async grantRole(
    actor: ActorContext,
    id: string,
    roleCode: RoleCode,
    requestedTenantId: string | null | undefined,
  ): Promise<RoleGrant> {
    const target = await repo.findUserById(pool, id);
    if (!target) throw new NotFoundError("User");
    if (!isPlatformAdmin(actor) && !isTenantAdmin(actor)) {
      throw new ForbiddenError("Insufficient privileges to grant roles");
    }
    if (!isPlatformAdmin(actor) && target.tenantId !== actor.tenantId) {
      throw new NotFoundError("User");
    }

    const role = await repo.findRoleByCode(pool, roleCode);
    if (!role) throw new NotFoundError("Role");

    // Resolve grant tenant:
    //   - PLATFORM_ADMIN may grant platform-wide (null) or to any tenant the
    //     body specifies; falls back to target's home tenant if unspecified.
    //   - TENANT_ADMIN may only grant in their own tenant. Platform grants
    //     are rejected (only PLATFORM_ADMIN seeds those).
    let grantTenantId: string | null;
    if (isPlatformAdmin(actor)) {
      if (requestedTenantId === null) {
        if (!role.isPlatform) {
          throw new ConflictError(
            `Role ${roleCode} is not a platform role; tenantId must be provided`,
            "PLATFORM_GRANT_INVALID",
          );
        }
        grantTenantId = null;
      } else {
        grantTenantId = requestedTenantId ?? target.tenantId;
      }
    } else {
      // TENANT_ADMIN path
      if (role.isPlatform) {
        throw new ForbiddenError(
          "TENANT_ADMIN cannot grant platform-scoped roles",
          "PLATFORM_GRANT_FORBIDDEN",
        );
      }
      grantTenantId = actor.tenantId;
    }

    const dup = await repo.findActiveGrant(pool, id, role.id, grantTenantId);
    if (dup) {
      throw new ConflictError(
        `Role ${roleCode} already granted with the same scope`,
        "ROLE_GRANT_DUPLICATE",
      );
    }

    return repo.insertRoleGrant(pool, {
      userId: id,
      roleId: role.id,
      tenantId: grantTenantId,
      grantedBy: actor.userId,
    });
  },

  async revokeRole(
    actor: ActorContext,
    userId: string,
    grantId: string,
  ): Promise<void> {
    if (!isPlatformAdmin(actor) && !isTenantAdmin(actor)) {
      throw new ForbiddenError("Insufficient privileges to revoke roles");
    }
    const grant = await repo.findGrantById(pool, grantId);
    if (!grant || grant.userId !== userId) {
      throw new NotFoundError("RoleGrant");
    }
    if (grant.revokedAt !== null) {
      throw new ConflictError("Role grant already revoked", "ROLE_GRANT_ALREADY_REVOKED");
    }
    // TENANT_ADMIN can only revoke grants in their own tenant. Platform
    // grants (tenantId NULL) are PLATFORM_ADMIN-only.
    if (!isPlatformAdmin(actor)) {
      if (grant.tenantId === null) {
        throw new ForbiddenError(
          "Only PLATFORM_ADMIN can revoke platform-scoped grants",
          "PLATFORM_REVOKE_FORBIDDEN",
        );
      }
      if (grant.tenantId !== actor.tenantId) {
        throw new NotFoundError("RoleGrant");
      }
    }
    await repo.revokeRoleGrant(pool, grantId);
  },
};
