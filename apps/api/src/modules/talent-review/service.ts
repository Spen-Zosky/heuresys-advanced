/**
 * apps/api/src/modules/talent-review/service.ts — A/L3 (#29). READ-only.
 *
 * Talent-intelligence data is EVALUATION (data-classes: `talent`). The 9-box grid,
 * position-fit, readiness and succession scores are person-level → gated by the
 * ORGANIZATIONAL axis (resolveOrgReadScope: HR-mandate tenant / transitive org
 * sub-tree / self / platform all — ADR-0027 F3, I18). Critical positions and
 * critical-role coverage are position-level (no person rows) → tenant-scoped only
 * (routes declare orgGate:"catalog"). Self-view is OFF by product decision (there
 * is no `talent:read:self` permission).
 */
import { pool } from "../../db/client.js";
import { isPlatform, type ActorContext } from "../../lib/actor.js";
import type {
  NineBoxListQuery,
  FitScoreListQuery,
  ReadinessScoreListQuery,
  SuccessionScoreListQuery,
  CriticalPositionListQuery,
  CriticalCoverageListQuery,
} from "@heuresys/shared";
import * as repo from "./repository.js";
import { resolveOrgReadScope } from "../../lib/scope/resolver.js";

/** Reduce an OrgReadScope to the (tenantId?, userIdAllowList?) repo filter. */
async function orgFilter(
  actor: ActorContext,
): Promise<{ tenantId?: string; userIdAllowList?: string[] }> {
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

export const talentReviewService = {
  /** Org-gated 9-box grid (I18). */
  async listNineBox(actor: ActorContext, query: NineBoxListQuery) {
    return repo.listNineBox(pool, { ...(await orgFilter(actor)), query });
  },

  /** Org-gated position-fit scores (I18). */
  async listFit(actor: ActorContext, query: FitScoreListQuery) {
    return repo.listFit(pool, { ...(await orgFilter(actor)), query });
  },

  /** Org-gated readiness scores (I18). */
  async listReadiness(actor: ActorContext, query: ReadinessScoreListQuery) {
    return repo.listReadiness(pool, { ...(await orgFilter(actor)), query });
  },

  /** Org-gated succession scores (I18). */
  async listSuccession(actor: ActorContext, query: SuccessionScoreListQuery) {
    return repo.listSuccession(pool, { ...(await orgFilter(actor)), query });
  },

  /** Critical positions (position-level, no person rows) — tenant-scoped only. */
  async listCriticalPositions(actor: ActorContext, query: CriticalPositionListQuery) {
    const tenantId = isPlatform(actor) ? undefined : actor.tenantId ?? undefined;
    return repo.listCriticalPositions(pool, tenantId, query);
  },

  /** Critical-role coverage (position-level, no person rows) — tenant-scoped only. */
  async listCriticalCoverage(actor: ActorContext, query: CriticalCoverageListQuery) {
    const tenantId = isPlatform(actor) ? undefined : actor.tenantId ?? undefined;
    return repo.listCriticalCoverage(pool, tenantId, query);
  },
};
