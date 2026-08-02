/**
 * apps/api/src/modules/user-timeline/service.ts
 * D5 (#49) — la storia di una persona.
 *
 * Il dato è PERSONALE e in parte retributivo (SALARY_CHANGE, LEVEL_CHANGE,
 * REVIEW_COMPLETED): passa quindi dall'asse ORGANIZZATIVO (I18 — mai da quello
 * funzionale) esattamente come le altre letture per-persona.
 * `resolveOrgReadScope` risolve: platform → tutti · mandato HR → tutto il
 * tenant · gerarchia → il proprio sotto-albero transitivo · altrimenti → solo
 * se stessi (I17).
 *
 * Sola lettura: la tabella si popola dall'import brownfield, non dall'API.
 */
import { pool } from "../../db/client.js";
import type { ActorContext } from "../../lib/actor.js";

export type { ActorContext };
import type {
  UserTimelineListQuery, UserTimelineListResponse, UserTimelineSummaryResponse,
} from "@heuresys/shared";
import * as repo from "./repository.js";
import { resolveOrgReadScope } from "../../lib/scope/resolver.js";

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

export const userTimelineService = {
  async list(actor: ActorContext, query: UserTimelineListQuery): Promise<UserTimelineListResponse> {
    return repo.listTimeline(pool, { ...(await orgFilter(actor)), query });
  },

  async summary(actor: ActorContext, query: UserTimelineListQuery): Promise<UserTimelineSummaryResponse> {
    return repo.summarizeTimeline(pool, { ...(await orgFilter(actor)), query });
  },

  /**
   * La propria storia (I17): nessun cancello organizzativo da risolvere, il
   * filtro è l'identità di chi chiede. Passare dal percorso org-gated qui
   * sarebbe un errore — un dipendente senza sottoposti ha un sotto-albero che
   * contiene solo se stesso, ma dipenderne renderebbe il pavimento ESS
   * ostaggio della forma dell'organigramma.
   */
  async listOwn(actor: ActorContext, query: UserTimelineListQuery): Promise<UserTimelineListResponse> {
    return repo.listTimeline(pool, { userIdAllowList: [actor.userId], query });
  },

  async summarizeOwn(actor: ActorContext, query: UserTimelineListQuery): Promise<UserTimelineSummaryResponse> {
    return repo.summarizeTimeline(pool, { userIdAllowList: [actor.userId], query });
  },
};
