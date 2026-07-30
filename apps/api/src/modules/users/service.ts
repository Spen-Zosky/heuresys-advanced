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
  UserDossier,
  UserListQuery,
  UserListResponse,
  CreateUserBody,
  UpdateUserBody,
  RoleGrant,
} from "@heuresys/shared";
import { NON_PRIVILEGED_UPDATABLE_FIELDS } from "@heuresys/shared";
import * as repo from "./repository.js";
// #81 — il dossier non riscrive le letture per-persona: riusa QUELLE del portale
// personale, che sono gia' parametrizzate sull'utente. Una sola implementazione
// per ogni dimensione, cosi' la vista di se' e quella di chi ha titolo non
// possono divergere.
import * as meRepo from "../me/repository.js";
import { resolveOrgReadScope, canReadOrgTarget } from "../../lib/scope/resolver.js";

const NON_PRIVILEGED_FIELDS = new Set<string>(NON_PRIVILEGED_UPDATABLE_FIELDS);

function isPlatformAdmin(a: ActorContext): boolean {
  return a.roles.includes("PLATFORM_ADMIN");
}
function isTenantAdmin(a: ActorContext): boolean {
  return a.roles.includes("TENANT_ADMIN");
}
function requireOwnTenant(a: ActorContext): string {
  if (!a.tenantId) throw new ForbiddenError("Tenant context required");
  return a.tenantId;
}

/**
 * The actor's organizational read scope, mapped to the users-repo filter shape.
 * Delegates to the shared resolver (ADR-0027 F1): PLATFORM_ADMIN → all; HR-mandated
 * (TENANT_ADMIN, HRMS_MANAGER) → whole tenant; anyone with reports → their TRANSITIVE
 * org sub-tree; everyone else → self. (Was a one-hop MANAGER-team walk.)
 */
async function resolveReadScope(actor: ActorContext): Promise<{
  tenantId?: string;
  userIdAllowList?: string[];
}> {
  const scope = await resolveOrgReadScope(pool, actor);
  switch (scope.kind) {
    case "all":
      return {};
    case "tenant":
      return { tenantId: scope.tenantId };
    case "subtree":
    case "self":
      return { tenantId: scope.tenantId, userIdAllowList: scope.userIdAllowList };
  }
}

async function canActOnTarget(
  actor: ActorContext,
  target: User,
  intent: "read" | "update" | "delete",
): Promise<boolean> {
  if (intent === "delete") {
    // Delete stays admin-only — no axis grants it.
    if (isPlatformAdmin(actor)) return true;
    if (!actor.tenantId || target.tenantId !== actor.tenantId) return false;
    return isTenantAdmin(actor);
  }
  // read / update: self, HR-mandate, or the actor's TRANSITIVE org sub-tree (ADR-0027 F1).
  // Field-level limits for non-admins are enforced separately by ensureFieldsAllowed.
  return canReadOrgTarget(pool, actor, target.userId, target.tenantId);
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

  /**
   * #81 — il DOSSIER della persona: cio' che la scheda deve saper raccontare.
   *
   * Stesso cancello della lettura anagrafica (`canActOnTarget(read)` →
   * `canReadOrgTarget`): sono dati SENSIBILI e passano dalla catena
   * ORGANIZZATIVA, mai dall'appartenenza a un team (I18, regola cardinale).
   * Come per `getById`, un soggetto fuori portata risponde 404 e non 403: un
   * 403 confermerebbe che quella persona esiste.
   *
   * Le sezioni si caricano in parallelo perche' sono indipendenti fra loro.
   */
  async getDossier(actor: ActorContext, id: string): Promise<UserDossier> {
    const target = await repo.findUserById(pool, id);
    if (!target) throw new NotFoundError("User");
    if (!(await canActOnTarget(actor, target, "read"))) {
      throw new NotFoundError("User");
    }

    // I ruoli che contano per la vista sono quelli del SOGGETTO (loadProfileFull
    // li usa per decidere cosa il profilo espone di se'), non quelli di chi guarda.
    const targetRoles = (await repo.listRoleGrantsForUser(pool, id)).map((g) => g.roleCode);

    // alcune letture rendono gia' {items,total}, altre l'array nudo: si
    // normalizza qui, una volta sola, invece di piegare lo schema
    const [
      profile, positionsRes, contracts, paySlips, performance,
      attendance, skillsRes, learningRes, certificationsRes, goals, careerTargetsRes,
    ] = await Promise.all([
      meRepo.loadProfileFull(pool, id, targetRoles),
      meRepo.listMyPositions(pool, id),
      meRepo.loadContracts(pool, id),
      meRepo.loadPaySlips(pool, id),
      meRepo.loadPerformance(pool, id),
      meRepo.loadAttendance(pool, id),
      meRepo.listMySkills(pool, id),
      meRepo.listMyLearning(pool, id),
      meRepo.listMyCertifications(pool, id),
      meRepo.loadMyGoals(pool, id),
      meRepo.listMyCareerTargets(pool, id),
    ]);
    const positions = positionsRes.items;
    const skills = skillsRes.items;
    const learning = learningRes.items;
    const certifications = certificationsRes.items;
    const careerTargets = careerTargetsRes.items;
    if (!profile) throw new NotFoundError("User");

    return {
      profile, positions, contracts, paySlips, performance,
      attendance, skills, learning, certifications, goals, careerTargets,
    };
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
