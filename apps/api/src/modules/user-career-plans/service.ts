/**
 * apps/api/src/modules/user-career-plans/service.ts
 *
 * Tenant-scoped only. FK validation:
 *   - userId: must exist and belong to tenant → 403 USER_NOT_IN_TENANT.
 *   - pathId (optional): must be visible to tenant (global or own) → 404.
 *   - targetPositionId (optional): must exist and be in same tenant → 403 POSITION_NOT_IN_TENANT.
 */

import { pool } from "../../db/client.js";
import { isPlatform, type ActorContext } from "../../lib/actor.js";

export type { ActorContext };
import { NotFoundError, ForbiddenError } from "../../errors/index.js";
import type {
  UserCareerPlan,
  UserCareerPlanListQuery,
  CreateUserCareerPlanBody,
  UpdateUserCareerPlanBody,
} from "@heuresys/shared";
import * as repo from "./repository.js";
import { resolveOrgReadScope, canReadOrgTarget } from "../../lib/scope/resolver.js";

async function validateFks(
  body: { userId: string; pathId?: string | null; targetPositionId?: string | null },
  tenantId: string,
): Promise<void> {
  const u = await repo.getUserTenant(pool, body.userId);
  if (!u) throw new NotFoundError("User");
  if (u.tenantId !== tenantId) {
    throw new ForbiddenError(
      "Plan subject user does not belong to the resolved tenant",
      "USER_NOT_IN_TENANT",
    );
  }
  if (body.pathId) {
    const ok = await repo.careerPathVisibleToTenant(pool, body.pathId, tenantId);
    if (!ok) throw new NotFoundError("CareerPath");
  }
  if (body.targetPositionId) {
    const p = await repo.positionInTenant(pool, body.targetPositionId, tenantId);
    if (!p.exists) throw new NotFoundError("Position");
    if (!p.sameTenant) {
      throw new ForbiddenError(
        "Target position does not belong to the resolved tenant",
        "POSITION_NOT_IN_TENANT",
      );
    }
  }
}

export const userCareerPlansService = {
  async list(actor: ActorContext, query: UserCareerPlanListQuery) {
    // ADR-0027 F3: filter the list by the actor's organizational read scope (D-50).
    const scope = await resolveOrgReadScope(pool, actor);
    const tenantId = scope.kind === "all" ? undefined : scope.tenantId;
    const userIdAllowList =
      scope.kind === "subtree" || scope.kind === "self" ? scope.userIdAllowList : undefined;
    return repo.listPlans(pool, { tenantId, userIdAllowList, query });
  },

  async getById(actor: ActorContext, id: string): Promise<UserCareerPlan> {
    const target = await repo.findPlanById(pool, id);
    if (!target) throw new NotFoundError("UserCareerPlan");
    // ADR-0027 F3: gate the per-target read on the organizational axis (self / HR-mandate /
    // transitive org sub-tree). 404 (not 403) avoids existence enumeration.
    if (!(await canReadOrgTarget(pool, actor, target.userId, target.tenantId))) {
      throw new NotFoundError("UserCareerPlan");
    }
    return target;
  },

  async create(actor: ActorContext, body: CreateUserCareerPlanBody): Promise<UserCareerPlan> {
    let tenantId: string;
    if (isPlatform(actor)) {
      const candidate = body.tenantId ?? actor.tenantId;
      if (!candidate) {
        throw new ForbiddenError(
          "PLATFORM_ADMIN must supply body.tenantId for user career plans",
          "TENANT_ID_REQUIRED",
        );
      }
      tenantId = candidate;
    } else {
      if (!actor.tenantId) throw new ForbiddenError("Tenant context required");
      tenantId = actor.tenantId;
    }
    await validateFks(body, tenantId);
    return repo.insertPlan(pool, tenantId, body, actor.userId);
  },

  async update(actor: ActorContext, id: string, patch: UpdateUserCareerPlanBody): Promise<UserCareerPlan> {
    const target = await repo.findPlanById(pool, id);
    if (!target) throw new NotFoundError("UserCareerPlan");
    if (!isPlatform(actor)) {
      if (!actor.tenantId || target.tenantId !== actor.tenantId) {
        throw new NotFoundError("UserCareerPlan");
      }
    }
    if (patch.pathId !== undefined && patch.pathId !== null) {
      const ok = await repo.careerPathVisibleToTenant(pool, patch.pathId, target.tenantId);
      if (!ok) throw new NotFoundError("CareerPath");
    }
    if (patch.targetPositionId !== undefined && patch.targetPositionId !== null) {
      const p = await repo.positionInTenant(pool, patch.targetPositionId, target.tenantId);
      if (!p.exists) throw new NotFoundError("Position");
      if (!p.sameTenant) {
        throw new ForbiddenError(
          "Target position does not belong to the plan's tenant",
          "POSITION_NOT_IN_TENANT",
        );
      }
    }
    const updated = await repo.updatePlanPartial(pool, id, patch, actor.userId);
    if (!updated) throw new NotFoundError("UserCareerPlan");
    return updated;
  },

  async delete(actor: ActorContext, id: string): Promise<void> {
    const target = await repo.findPlanById(pool, id);
    if (!target) throw new NotFoundError("UserCareerPlan");
    if (!isPlatform(actor)) {
      if (!actor.tenantId || target.tenantId !== actor.tenantId) {
        throw new NotFoundError("UserCareerPlan");
      }
    }
    const ok = await repo.deletePlan(pool, id);
    if (!ok) throw new NotFoundError("UserCareerPlan");
  },
};
