/**
 * apps/api/src/modules/goals/service.ts
 * Goals CRUD with tenant-only visibility. PLATFORM_ADMIN unfiltered; others own tenant;
 * not-visible -> 404 (no leak). Mirrors modules/engagement-feedback/service.ts.
 */
import { pool } from "../../db/client.js";
import { isPlatform, type ActorContext } from "../../lib/actor.js";
export type { ActorContext };
import { NotFoundError, ForbiddenError } from "../../errors/index.js";
import type { GoalListQuery, CreateGoalBody, UpdateGoalBody } from "@heuresys/shared";
import * as repo from "./repository.js";
import { resolveOrgReadScope, canReadOrgTarget } from "../../lib/scope/resolver.js";

const ZERO_UUID = "00000000-0000-0000-0000-000000000000";

function listTenantFilter(a: ActorContext): string | undefined {
  if (isPlatform(a)) return undefined;
  return a.tenantId ?? ZERO_UUID;
}
function assertVisible(a: ActorContext, rowTenantId: string, resource: string): void {
  if (isPlatform(a)) return;
  if (a.tenantId === null || rowTenantId !== a.tenantId) throw new NotFoundError(resource);
}
function resolveWriteTenant(a: ActorContext, bodyTenantId?: string): string {
  if (isPlatform(a)) {
    const t = bodyTenantId ?? a.tenantId;
    if (!t) throw new ForbiddenError("PLATFORM_ADMIN must supply tenantId", "TENANT_ID_REQUIRED");
    return t;
  }
  if (!a.tenantId) throw new ForbiddenError("Tenant context required", "TENANT_REQUIRED");
  return a.tenantId;
}

export const goalsService = {
  async listGoals(a: ActorContext, query: GoalListQuery) {
    // ADR-0027 F3: filter the list by the actor's organizational read scope.
    const scope = await resolveOrgReadScope(pool, a);
    const userIdAllowList =
      scope.kind === "subtree" || scope.kind === "self" ? scope.userIdAllowList : undefined;
    return repo.listGoals(pool, listTenantFilter(a), query, userIdAllowList);
  },
  async getGoal(a: ActorContext, id: string) {
    const g = await repo.findGoalById(pool, id);
    if (!g) throw new NotFoundError("Goal");
    assertVisible(a, g.tenantId, "Goal");
    // ADR-0027 F3: a subject-bound goal is org-gated; 404 across the org boundary (no leak).
    if (g.subjectUserId && !(await canReadOrgTarget(pool, a, g.subjectUserId, g.tenantId))) {
      throw new NotFoundError("Goal");
    }
    return g;
  },
  async createGoal(a: ActorContext, body: CreateGoalBody) {
    const tenantId = resolveWriteTenant(a, body.tenantId);
    return repo.insertGoal(pool, tenantId, body);
  },
  async updateGoal(a: ActorContext, id: string, patch: UpdateGoalBody) {
    const g = await repo.findGoalById(pool, id);
    if (!g) throw new NotFoundError("Goal");
    assertVisible(a, g.tenantId, "Goal");
    if (g.subjectUserId && !(await canReadOrgTarget(pool, a, g.subjectUserId, g.tenantId))) {
      throw new NotFoundError("Goal");
    }
    const updated = await repo.updateGoalPartial(pool, id, patch);
    if (!updated) throw new NotFoundError("Goal");
    return updated;
  },
  async deleteGoal(a: ActorContext, id: string): Promise<void> {
    const g = await repo.findGoalById(pool, id);
    if (!g) throw new NotFoundError("Goal");
    assertVisible(a, g.tenantId, "Goal");
    if (g.subjectUserId && !(await canReadOrgTarget(pool, a, g.subjectUserId, g.tenantId))) {
      throw new NotFoundError("Goal");
    }
    await repo.deleteGoal(pool, id);
  },
};
