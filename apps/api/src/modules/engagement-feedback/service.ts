/**
 * apps/api/src/modules/engagement-feedback/service.ts
 * Engagement feedback + action plans CRUD with tenant-only visibility scope (no global rows).
 * PLATFORM_ADMIN: unfiltered. Others: own tenant only; not-visible rows surface as 404 (no leak).
 * Mirrors modules/surveys/service.ts.
 */
import { pool } from "../../db/client.js";
import { isPlatform, type ActorContext } from "../../lib/actor.js";

export type { ActorContext };
import { NotFoundError, ForbiddenError } from "../../errors/index.js";
import type {
  EngagementFeedbackListQuery, CreateEngagementFeedbackBody, UpdateEngagementFeedbackBody,
  EngagementActionPlanListQuery, CreateEngagementActionPlanBody, UpdateEngagementActionPlanBody,
} from "@heuresys/shared";
import * as repo from "./repository.js";

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

export const engagementFeedbackService = {
  // ── Feedback ──
  async listFeedback(a: ActorContext, query: EngagementFeedbackListQuery) {
    return repo.listFeedback(pool, listTenantFilter(a), query);
  },
  async getFeedback(a: ActorContext, id: string) {
    const f = await repo.findFeedbackById(pool, id);
    if (!f) throw new NotFoundError("Engagement feedback");
    assertVisible(a, f.tenantId, "Engagement feedback");
    return f;
  },
  async createFeedback(a: ActorContext, body: CreateEngagementFeedbackBody) {
    const tenantId = resolveWriteTenant(a, body.tenantId);
    return repo.insertFeedback(pool, tenantId, body);
  },
  async updateFeedback(a: ActorContext, id: string, patch: UpdateEngagementFeedbackBody) {
    const f = await repo.findFeedbackById(pool, id);
    if (!f) throw new NotFoundError("Engagement feedback");
    assertVisible(a, f.tenantId, "Engagement feedback");
    const updated = await repo.updateFeedbackPartial(pool, id, patch);
    if (!updated) throw new NotFoundError("Engagement feedback");
    return updated;
  },
  async deleteFeedback(a: ActorContext, id: string): Promise<void> {
    const f = await repo.findFeedbackById(pool, id);
    if (!f) throw new NotFoundError("Engagement feedback");
    assertVisible(a, f.tenantId, "Engagement feedback");
    await repo.deleteFeedback(pool, id);
  },

  // ── Action plans ──
  async listActionPlans(a: ActorContext, query: EngagementActionPlanListQuery) {
    return repo.listActionPlans(pool, listTenantFilter(a), query);
  },
  async getActionPlan(a: ActorContext, id: string) {
    const p = await repo.findActionPlanById(pool, id);
    if (!p) throw new NotFoundError("Action plan");
    assertVisible(a, p.tenantId, "Action plan");
    return p;
  },
  async createActionPlan(a: ActorContext, body: CreateEngagementActionPlanBody) {
    const tenantId = resolveWriteTenant(a, body.tenantId);
    return repo.insertActionPlan(pool, tenantId, body);
  },
  async updateActionPlan(a: ActorContext, id: string, patch: UpdateEngagementActionPlanBody) {
    const p = await repo.findActionPlanById(pool, id);
    if (!p) throw new NotFoundError("Action plan");
    assertVisible(a, p.tenantId, "Action plan");
    const updated = await repo.updateActionPlanPartial(pool, id, patch);
    if (!updated) throw new NotFoundError("Action plan");
    return updated;
  },
  async deleteActionPlan(a: ActorContext, id: string): Promise<void> {
    const p = await repo.findActionPlanById(pool, id);
    if (!p) throw new NotFoundError("Action plan");
    assertVisible(a, p.tenantId, "Action plan");
    await repo.deleteActionPlan(pool, id);
  },
};
