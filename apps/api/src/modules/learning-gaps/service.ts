/**
 * apps/api/src/modules/learning-gaps/service.ts
 *
 * Tenant-scoped only. FK validation:
 *   - userId: must exist and belong to resolved tenant → 403 USER_NOT_IN_TENANT.
 *   - positionId (optional): must exist and belong to resolved tenant → 403 POSITION_NOT_IN_TENANT.
 *   - skillId (optional): must be visible to tenant (global or own) → 404 if missing.
 */

import { pool } from "../../db/client.js";
import { isPlatform, type ActorContext } from "../../lib/actor.js";

export type { ActorContext };
import { NotFoundError, ForbiddenError } from "../../errors/index.js";
import type {
  LearningGap,
  LearningGapListQuery,
  CreateLearningGapBody,
  UpdateLearningGapBody,
  GapClosurePlanListQuery,
  GapAnalysisResultListQuery,
} from "@heuresys/shared";
import * as repo from "./repository.js";
import { resolveOrgReadScope, canReadOrgTarget } from "../../lib/scope/resolver.js";

async function validateFks(
  body: { userId: string; positionId?: string | null; skillId?: string | null },
  tenantId: string,
): Promise<void> {
  const u = await repo.getUserTenant(pool, body.userId);
  if (!u) throw new NotFoundError("User");
  if (u.tenantId !== tenantId) {
    throw new ForbiddenError(
      "Subject user does not belong to the gap's tenant",
      "USER_NOT_IN_TENANT",
    );
  }
  if (body.positionId) {
    const p = await repo.positionInTenant(pool, body.positionId, tenantId);
    if (!p.exists) throw new NotFoundError("Position");
    if (!p.sameTenant) {
      throw new ForbiddenError(
        "Position does not belong to the gap's tenant",
        "POSITION_NOT_IN_TENANT",
      );
    }
  }
  if (body.skillId) {
    const ok = await repo.skillVisibleToTenant(pool, body.skillId, tenantId);
    if (!ok) throw new NotFoundError("Skill");
  }
}

export const learningGapsService = {
  async list(actor: ActorContext, query: LearningGapListQuery) {
    // ADR-0027 F3: resolve the actor's ORGANIZATIONAL read scope once and filter the list by
    // userIdAllowList (self / transitive org sub-tree), not by tenant alone. HR-mandated
    // (TENANT_ADMIN, HRMS_MANAGER) → whole tenant; PLATFORM_ADMIN → all. Mirrors users/service.ts.
    const scope = await resolveOrgReadScope(pool, actor);
    switch (scope.kind) {
      case "all":
        return repo.listGaps(pool, { query });
      case "tenant":
        return repo.listGaps(pool, { tenantId: scope.tenantId, query });
      case "subtree":
      case "self":
        return repo.listGaps(pool, {
          tenantId: scope.tenantId,
          userIdAllowList: scope.userIdAllowList,
          query,
        });
    }
  },

  async getById(actor: ActorContext, id: string): Promise<LearningGap> {
    const target = await repo.findGapById(pool, id);
    if (!target) throw new NotFoundError("LearningGap");
    // ADR-0027 F3: gate the per-target read by the organizational axis (self / HR-mandate /
    // transitive org sub-tree). 404 (not 403) to avoid existence enumeration across the boundary.
    if (!(await canReadOrgTarget(pool, actor, target.userId, target.tenantId))) {
      throw new NotFoundError("LearningGap");
    }
    return target;
  },

  async create(actor: ActorContext, body: CreateLearningGapBody): Promise<LearningGap> {
    let tenantId: string;
    if (isPlatform(actor)) {
      const candidate = body.tenantId ?? actor.tenantId;
      if (!candidate) {
        throw new ForbiddenError(
          "PLATFORM_ADMIN must supply body.tenantId for learning gaps",
          "TENANT_ID_REQUIRED",
        );
      }
      tenantId = candidate;
    } else {
      if (!actor.tenantId) throw new ForbiddenError("Tenant context required");
      tenantId = actor.tenantId;
    }
    await validateFks(body, tenantId);
    return repo.insertGap(pool, tenantId, body);
  },

  async update(actor: ActorContext, id: string, patch: UpdateLearningGapBody): Promise<LearningGap> {
    const target = await repo.findGapById(pool, id);
    if (!target) throw new NotFoundError("LearningGap");
    // ADR-0027 F3: mutating another user's gap requires the organizational axis, not just tenant
    // match (self / HR-mandate / org sub-tree). 404 to avoid existence enumeration.
    if (!(await canReadOrgTarget(pool, actor, target.userId, target.tenantId))) {
      throw new NotFoundError("LearningGap");
    }
    const updated = await repo.updateGapPartial(pool, id, patch);
    if (!updated) throw new NotFoundError("LearningGap");
    return updated;
  },

  async delete(actor: ActorContext, id: string): Promise<void> {
    const target = await repo.findGapById(pool, id);
    if (!target) throw new NotFoundError("LearningGap");
    // ADR-0027 F3: deleting another user's gap requires the organizational axis, not just tenant
    // match (self / HR-mandate / org sub-tree). 404 to avoid existence enumeration.
    if (!(await canReadOrgTarget(pool, actor, target.userId, target.tenantId))) {
      throw new NotFoundError("LearningGap");
    }
    const ok = await repo.deleteGap(pool, id);
    if (!ok) throw new NotFoundError("LearningGap");
  },

  // ── #30 (S1018): gap-closure reads — org axis on the subject user ──
  async listClosurePlans(actor: ActorContext, query: GapClosurePlanListQuery) {
    const scope = await resolveOrgReadScope(pool, actor);
    const userIdAllowList =
      scope.kind === "subtree" || scope.kind === "self" ? scope.userIdAllowList : undefined;
    const tenantId = isPlatform(actor) ? undefined : actor.tenantId ?? undefined;
    return repo.listClosurePlans(pool, tenantId, query, userIdAllowList);
  },
  async listAnalysisResults(actor: ActorContext, query: GapAnalysisResultListQuery) {
    const scope = await resolveOrgReadScope(pool, actor);
    const userIdAllowList =
      scope.kind === "subtree" || scope.kind === "self" ? scope.userIdAllowList : undefined;
    const tenantId = isPlatform(actor) ? undefined : actor.tenantId ?? undefined;
    return repo.listAnalysisResults(pool, tenantId, query, userIdAllowList);
  },
  /** Actions inherit the parent gap's org gate (getById 404s across the boundary). */
  async listClosureActions(actor: ActorContext, gapId: string) {
    await this.getById(actor, gapId);
    return repo.listClosureActionsByGap(pool, gapId);
  },
};
