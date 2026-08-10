/**
 * apps/api/src/modules/performance-reviews/service.ts — #92 passo 3/7. READ-only.
 *
 * La valutazione e' EVALUATION per-persona: passa dalla catena ORGANIZZATIVA
 * (resolveOrgReadScope — I18) e sotto il mandato piattaforma i campi-giudizio
 * vengono rimossi e dichiarati (ADR-0032). La riga resta: soggetto, periodo,
 * tipo, stato e le date di workflow.
 *
 * Nota di perimetro dichiarata: il qualificatore «valutazione non comunicata»
 * (ADR-0036 §5, criterio shared_at OR acknowledged_at) e' #99 F5 e si applichera'
 * a TUTTE le superfici EVALUATION insieme, non qui da solo.
 */
import { pool } from "../../db/client.js";
import type { ActorContext } from "../../lib/actor.js";
import { NotFoundError } from "../../errors/index.js";
import { masksUnderPlatformMandate, maskFields, type Masked } from "../../lib/scope/mask.js";
import { resolveOrgReadScope, canReadOrgTarget } from "../../lib/scope/resolver.js";
import type { PerformanceReview, PerformanceReviewListQuery } from "@heuresys/shared";
import * as repo from "./repository.js";

/** L'equivalente di EVALUATION_JUDGMENT_FIELDS per questo schema: tutto cio'
 *  che GIUDICA. Le date di workflow e gli stati non ci sono: raccontano il
 *  percorso, non il merito. */
const REVIEW_JUDGMENT_FIELDS = [
  "areasForImprovement", "calibratedRating", "calibrationNotes",
  "careerAspirations", "competencyRating", "developmentPlan",
  "employeeComments", "goalAchievementRating", "managerComments",
  "overallRating", "performanceBox", "potentialBox", "potentialRating",
  "preCalibrationRating", "selfComments", "selfRating", "strengths",
] as const;

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

function seal(actor: ActorContext, r: PerformanceReview): Masked<PerformanceReview> {
  return masksUnderPlatformMandate(actor, "EVALUATION", r.subjectUserId)
    ? maskFields(r, REVIEW_JUDGMENT_FIELDS)
    : r;
}

export const performanceReviewsService = {
  async list(actor: ActorContext, query: PerformanceReviewListQuery) {
    const filter = await orgFilter(actor);
    // Un filtro esplicito su un soggetto fuori portata risponde pagina vuota,
    // non i dati altrui (specchio del gate per-target di reward-gates).
    if (query.subjectUserId &&
        !(await canReadOrgTarget(pool, actor, query.subjectUserId, filter.tenantId ?? null))) {
      return { items: [], total: 0 };
    }
    const page = await repo.listReviews(pool, { ...filter, query });
    return { ...page, items: page.items.map((r) => seal(actor, r)) };
  },

  async getById(actor: ActorContext, id: string): Promise<Masked<PerformanceReview>> {
    const review = await repo.findReviewById(pool, id);
    if (!review) throw new NotFoundError("PerformanceReview");
    // Fuori portata = 404, non 403: un 403 confermerebbe che la valutazione esiste.
    if (review.subjectUserId &&
        !(await canReadOrgTarget(pool, actor, review.subjectUserId, review.tenantId))) {
      throw new NotFoundError("PerformanceReview");
    }
    return seal(actor, review);
  },
};
