/**
 * apps/api/src/modules/predictions/service.ts
 * PredictionsML read-model with tenant-only visibility scope (no global rows).
 * READ-ONLY: legacy precomputed predictive-analytics values exposed as-is. No writes.
 * PLATFORM_ADMIN: unfiltered. Others: limited to own tenant; not-visible rows surface as 404 (no leak).
 */
import { pool } from "../../db/client.js";
import { isPlatform, type ActorContext } from "../../lib/actor.js";

export type { ActorContext };
import { NotFoundError } from "../../errors/index.js";
import type {
  PredictiveModelListQuery, ModelPredictionListQuery,
} from "@heuresys/shared";
import * as repo from "./repository.js";
import { resolveOrgReadScope, canReadOrgTarget } from "../../lib/scope/resolver.js";
import { masksUnderPlatformMandate, maskFields } from "../../lib/scope/mask.js";

const ZERO_UUID = "00000000-0000-0000-0000-000000000000";

/**
 * #124 / ADR-0032 — cosa se ne va quando una predizione e' letta sotto il solo
 * mandato piattaforma. Il verdetto (`value`), l'etichetta che lo riassume
 * (`label`), quanto ci si crede (`confidence`) e la spiegazione INTERA
 * (`details`), che porta `is_high_potential`, `risk_factors` e un
 * `feature_importance` con dentro `performance_rating` e `salary_percentile`:
 * lasciarla mentre si toglie il punteggio pubblicherebbe gli addendi dopo aver
 * tolto la somma.
 *
 * Cosa RESTA, e non per distrazione: il soggetto, il tipo, il modello, le date e
 * `metadata` — che qui e' solo lineage di ingestione (verificato chiave per
 * chiave sulle 468 righe live). L'amministratore tecnico continua a sapere che la
 * predizione esiste, su chi, di che tipo, quando e da quale importazione viene.
 */
const PREDICTION_JUDGMENT_FIELDS = ["value", "label", "confidence", "details"] as const;

/** List-scope filter: undefined = no filter (PLATFORM_ADMIN); else own tenant (zero-uuid if tenantless → 0 rows). */
function listTenantFilter(a: ActorContext): string | undefined {
  if (isPlatform(a)) return undefined;
  return a.tenantId ?? ZERO_UUID;
}

/** Throw 404 (not 403, to avoid tenant enumeration) when a row is outside the actor's scope. */
function assertVisible(a: ActorContext, rowTenantId: string, resource: string): void {
  if (isPlatform(a)) return;
  if (a.tenantId === null || rowTenantId !== a.tenantId) throw new NotFoundError(resource);
}

export const predictionsService = {
  // ── Models ──
  async listModels(a: ActorContext, query: PredictiveModelListQuery) {
    return repo.listModels(pool, listTenantFilter(a), query);
  },
  async getModel(a: ActorContext, id: string) {
    const m = await repo.findModelById(pool, id);
    if (!m) throw new NotFoundError("Predictive model");
    assertVisible(a, m.tenantId, "Predictive model");
    return m;
  },

  // ── Predictions ──
  async listPredictions(a: ActorContext, query: ModelPredictionListQuery) {
    // ADR-0027 F3 (D-50): filter per-person predictions by the actor's ORGANIZATIONAL read
    // scope (self / HR-mandate / transitive org sub-tree), not by tenant alone. PLATFORM_ADMIN
    // (kind "all") stays unfiltered; HR-mandated (kind "tenant") stays tenant-wide.
    const scope = await resolveOrgReadScope(pool, a);
    const tenantId = scope.kind === "all" ? undefined : scope.tenantId;
    const userIdAllowList =
      scope.kind === "subtree" || scope.kind === "self" ? scope.userIdAllowList : undefined;
    const page = await repo.listPredictions(pool, tenantId, query, userIdAllowList);

    // #124 — pre-check a costo zero: con soggetto null la domanda diventa «questo
    // attore legge per solo mandato piattaforma?», cosi' un chiamante normale non
    // paga nulla. Il soggetto vero e' gia' su ogni riga: nessuna query in piu'.
    if (!masksUnderPlatformMandate(a, "EVALUATION", null)) return page;
    return {
      ...page,
      items: page.items.map((p) =>
        masksUnderPlatformMandate(a, "EVALUATION", p.subjectUserId)
          ? maskFields(p, PREDICTION_JUDGMENT_FIELDS)
          : p,
      ),
    };
  },
  async getPrediction(a: ActorContext, id: string) {
    const p = await repo.findPredictionById(pool, id);
    if (!p) throw new NotFoundError("Prediction");
    assertVisible(a, p.tenantId, "Prediction");
    // ADR-0027 F3 (D-50): a per-person prediction is org-gated — the actor must be able to read
    // the subject's sensitive data (self / HR-mandate / transitive org sub-tree). 404 (not 403)
    // to avoid existence enumeration across the org boundary.
    if (p.subjectUserId && !(await canReadOrgTarget(pool, a, p.subjectUserId, p.tenantId))) {
      throw new NotFoundError("Prediction");
    }
    // #124 — il soggetto e' sulla riga: I17 (la predizione su di me la vedo) costa zero.
    return masksUnderPlatformMandate(a, "EVALUATION", p.subjectUserId)
      ? maskFields(p, PREDICTION_JUDGMENT_FIELDS)
      : p;
  },
};
