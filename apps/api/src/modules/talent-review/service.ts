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
import { masksUnderPlatformMandate, maskFields } from "../../lib/scope/mask.js";

/**
 * #124 D4 / ADR-0032 — cosa se ne va su ciascuna delle quattro famiglie
 * person-level, quando le legge il solo mandato piattaforma.
 *
 * Il criterio e' lo stesso ovunque: **la riga resta, il verdetto no**. Chi
 * amministra continua a sapere che la persona X e' stata valutata per la
 * posizione Y sull'orizzonte Z e quando — non quanto vale.
 *
 * Sul 9-box le BANDE se ne vanno insieme ai punteggi, e non e' una precauzione:
 * `potentialBand`/`performanceBand` sono derivate da `potential`/`performance`,
 * quindi lasciarle pubblicherebbe la casella della griglia, cioe' la conclusione,
 * dopo aver tolto i numeri che la producono.
 */
const NINE_BOX_JUDGMENT_FIELDS = [
  "potential", "performance", "band", "potentialBand", "performanceBand",
] as const;
const SCORE_JUDGMENT_FIELDS = ["score", "payload"] as const;
const VALUE_JUDGMENT_FIELDS = ["value", "payload"] as const;

/**
 * Applica il mask a una pagina di righe person-level.
 *
 * Il pre-check con soggetto `null` risponde «questo attore legge per solo
 * mandato piattaforma?» e costa zero a un chiamante normale; il soggetto vero
 * (`userId`, che ognuna di queste righe porta) serve per l'esenzione self di
 * **I17** — un platform-admin che guarda la propria riga la legge in chiaro.
 */
function maskPage<T extends { userId: string }>(
  actor: ActorContext,
  page: { items: T[]; total: number },
  fields: readonly string[],
): { items: (T | (T & { masked?: string[] }))[]; total: number } {
  if (!masksUnderPlatformMandate(actor, "EVALUATION", null)) return page;
  return {
    ...page,
    items: page.items.map((r) =>
      masksUnderPlatformMandate(actor, "EVALUATION", r.userId) ? maskFields(r, fields) : r,
    ),
  };
}

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
  /** Org-gated 9-box grid (I18), giudizio mascherato al solo mandato piattaforma (#124 D4). */
  async listNineBox(actor: ActorContext, query: NineBoxListQuery) {
    const page = await repo.listNineBox(pool, { ...(await orgFilter(actor)), query });
    return maskPage(actor, page, NINE_BOX_JUDGMENT_FIELDS);
  },

  /** Org-gated position-fit scores (I18), idem. */
  async listFit(actor: ActorContext, query: FitScoreListQuery) {
    const page = await repo.listFit(pool, { ...(await orgFilter(actor)), query });
    return maskPage(actor, page, SCORE_JUDGMENT_FIELDS);
  },

  /** Org-gated readiness scores (I18), idem. */
  async listReadiness(actor: ActorContext, query: ReadinessScoreListQuery) {
    const page = await repo.listReadiness(pool, { ...(await orgFilter(actor)), query });
    return maskPage(actor, page, VALUE_JUDGMENT_FIELDS);
  },

  /** Org-gated succession scores (I18), idem. */
  async listSuccession(actor: ActorContext, query: SuccessionScoreListQuery) {
    const page = await repo.listSuccession(pool, { ...(await orgFilter(actor)), query });
    return maskPage(actor, page, VALUE_JUDGMENT_FIELDS);
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
