/**
 * apps/api/src/modules/goals/service.ts
 * Goals CRUD with tenant-only visibility. PLATFORM_ADMIN unfiltered; others own tenant;
 * not-visible -> 404 (no leak). Mirrors modules/engagement-feedback/service.ts.
 */
import { pool } from "../../db/client.js";
import { isPlatform, type ActorContext } from "../../lib/actor.js";
export type { ActorContext };
import { NotFoundError, ForbiddenError } from "../../errors/index.js";
import type {
  Goal, GoalListQuery, CreateGoalBody, UpdateGoalBody,
  GoalSubListQuery, GoalTemplateListQuery, GoalTimelineEvent, GoalTimelineResponse,
} from "@heuresys/shared";
import * as repo from "./repository.js";
import { resolveOrgReadScope, canReadOrgTarget } from "../../lib/scope/resolver.js";

const ZERO_UUID = "00000000-0000-0000-0000-000000000000";

function listTenantFilter(a: ActorContext): string | undefined {
  if (isPlatform(a)) return undefined;
  return a.tenantId ?? ZERO_UUID;
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

/**
 * ADR-0027 F3 + F4-contract (S1018 #26): the per-goal read authorization lives in
 * THIS single helper — every sub-resource read flows through loadReadableGoal.
 * W9/F4 (functional axis) will extend the body with the dual-class row-shape rule
 * (subject≠null → org axis; team/process-bound → functional axis; null+null →
 * tenant-visible) WITHOUT touching routes or call sites.
 */
export async function canReadGoal(a: ActorContext, g: Goal): Promise<boolean> {
  if (!isPlatform(a) && (a.tenantId === null || g.tenantId !== a.tenantId)) return false;
  // A subject-bound goal is org-gated (EVALUATION class); cross-boundary = invisible.
  if (g.subjectUserId && !(await canReadOrgTarget(pool, a, g.subjectUserId, g.tenantId))) {
    return false;
  }
  return true;
}

/** Load a goal the actor may read, or throw 404 (no leak across any boundary). */
async function loadReadableGoal(a: ActorContext, id: string): Promise<Goal> {
  const g = await repo.findGoalById(pool, id);
  if (!g || !(await canReadGoal(a, g))) throw new NotFoundError("Goal");
  return g;
}

/**
 * Merged activity timeline for ONE goal (updates ∪ check-ins ∪ milestones),
 * newest first. Shared by the admin route and /v1/me/goals/:id/timeline (the
 * me module does its own self-authorization before calling this).
 */
export async function buildGoalTimeline(g: Goal): Promise<GoalTimelineResponse> {
  const CAP = 200; // per-goal volumes are small (avg <10 rows/table); hard cap for safety
  const [updates, checkIns, milestones] = await Promise.all([
    repo.listGoalUpdates(pool, g.goalId, CAP, 0),
    repo.listGoalCheckIns(pool, g.goalId, CAP, 0),
    repo.listGoalMilestones(pool, g.goalId, CAP, 0),
  ]);
  const events: GoalTimelineEvent[] = [
    ...updates.items.map((u) => ({ kind: "UPDATE" as const, at: u.createdAt, update: u })),
    ...checkIns.items.map((c) => ({ kind: "CHECK_IN" as const, at: c.createdAt, checkIn: c })),
    ...milestones.items.map((m) => ({ kind: "MILESTONE" as const, at: m.updatedAt, milestone: m })),
  ].sort((x, y) => (x.at < y.at ? 1 : x.at > y.at ? -1 : 0)).slice(0, CAP);
  return { goal: g, events };
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
    return loadReadableGoal(a, id);
  },
  async createGoal(a: ActorContext, body: CreateGoalBody) {
    const tenantId = resolveWriteTenant(a, body.tenantId);
    return repo.insertGoal(pool, tenantId, body);
  },
  async updateGoal(a: ActorContext, id: string, patch: UpdateGoalBody) {
    await loadReadableGoal(a, id);
    const updated = await repo.updateGoalPartial(pool, id, patch);
    if (!updated) throw new NotFoundError("Goal");
    return updated;
  },
  async deleteGoal(a: ActorContext, id: string): Promise<void> {
    await loadReadableGoal(a, id);
    await repo.deleteGoal(pool, id);
  },

  // ── #26 (S1018): goal-life sub-resource reads — all gated by loadReadableGoal ──
  async listGoalUpdates(a: ActorContext, goalId: string, q: GoalSubListQuery) {
    await loadReadableGoal(a, goalId);
    return repo.listGoalUpdates(pool, goalId, q.limit, q.offset);
  },
  async listGoalCheckIns(a: ActorContext, goalId: string, q: GoalSubListQuery) {
    await loadReadableGoal(a, goalId);
    return repo.listGoalCheckIns(pool, goalId, q.limit, q.offset);
  },
  async listGoalMilestones(a: ActorContext, goalId: string, q: GoalSubListQuery) {
    await loadReadableGoal(a, goalId);
    return repo.listGoalMilestones(pool, goalId, q.limit, q.offset);
  },
  async listGoalComments(a: ActorContext, goalId: string, q: GoalSubListQuery) {
    await loadReadableGoal(a, goalId);
    // Private comments: author-only, unless the actor reads tenant-wide (all|tenant
    // org scope — HR mandate/platform). Subtree managers do NOT see others' private
    // notes: a private comment is author-audience, not chain-audience.
    const scope = await resolveOrgReadScope(pool, a);
    const includePrivate = scope.kind === "all" || scope.kind === "tenant";
    return repo.listGoalComments(pool, goalId, a.userId, includePrivate, q.limit, q.offset);
  },
  async listGoalAlignments(a: ActorContext, goalId: string, q: GoalSubListQuery) {
    await loadReadableGoal(a, goalId);
    return repo.listGoalAlignments(pool, goalId, q.limit, q.offset);
  },
  async listGoalTemplates(a: ActorContext, query: GoalTemplateListQuery) {
    return repo.listGoalTemplates(pool, listTenantFilter(a), query);
  },
  async getGoalTimeline(a: ActorContext, goalId: string) {
    const g = await loadReadableGoal(a, goalId);
    return buildGoalTimeline(g);
  },
};
