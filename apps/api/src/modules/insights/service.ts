/**
 * apps/api/src/modules/insights/service.ts
 * Cap③ data-mining — in-platform flight-risk scoring.
 *
 * The "model" is a DETERMINISTIC, documented weighted-linear rule (NO ML, NO
 * external service): each feature is normalized to a 0..100 risk orientation,
 * then blended with the weights signed off by the PM (data-mining spec §9.1):
 *   tenure .15 · attendance/OT .20 · KPI .25 · engagement .25 · comp .10 · promo .05
 * Missing-feature handling: a feature with no data for a subject is DROPPED and
 * the remaining weights are re-normalized to sum 1.0 (recorded in payload). The
 * score is reproducible from features + this rule + model_version.
 *
 * Scope tiering (PLATFORM / TENANT / TEAM) mirrors analytics/dashboard. Flight-risk
 * is sensitive → admin/manager-only (D-6); RBAC gates the routes to insights:view.
 */
import { pool } from "../../db/client.js";
import { scopeTierOf } from "../../lib/scope/domains.js";
import type { ActorContext } from "../../lib/actor.js";

export type { ActorContext };
import { NotFoundError } from "../../errors/index.js";
import type {
  FlightRiskBand,
  FlightRiskFeatureContribution,
  FlightRiskScore,
  FlightRiskListResponse,
  InsightsRecomputeResponse,
  InsightsScopeKind,
  SuccessionReadinessHorizon,
  SuccessionReadinessScore,
  SuccessionReadinessListResponse,
  SkillGapSegment,
  SkillGapScore,
  SkillGapListResponse,
} from "@heuresys/shared";
import * as repo from "./repository.js";
import { posizioniNelPerimetroOrganizzativo } from "../dashboard/repository.js";
import { emitNotificationsBulk } from "../../lib/notifications/emit.js";
import { resolveOrgReadScope, canReadOrgTarget, type OrgReadScope } from "../../lib/scope/resolver.js";
import { masksUnderPlatformMandate, maskFields } from "../../lib/scope/mask.js";

/**
 * #124 D4 / ADR-0032 — cosa se ne va quando un punteggio di insight e' letto
 * sotto il solo mandato piattaforma.
 *
 * Su questi tre modelli la spiegazione e' piu' pericolosa del punteggio, ed e'
 * il motivo per cui `features` non poteva restare:
 *  - il modello e' DETERMINISTICO e la regola e' pubblica (pesi in questo file),
 *    quindi da `features` il punteggio si ricalcola esattamente: mascherarlo
 *    lasciando la spiegazione sarebbe stato un mask solo apparente;
 *  - `features[].raw` porta i valori GREZZI dei fattori, fra cui
 *    `kpiAchievement`, `engagementAvg` e **`compBandPct`** — il percentile della
 *    banda retributiva. Cioe' la spiegazione di un punteggio EVALUATION fa
 *    passare dati COMPENSATION per la porta di servizio.
 * Le tre etichette (`band`, `horizon`, `segment`) sono derivate dal valore e se
 * ne vanno con lui: «CRITICAL» o «MAJOR_GAP» sono la conclusione, non un
 * dettaglio.
 *
 * Cosa RESTA: la persona, la posizione candidata (con codice e titolo), la
 * versione del modello e la data. Che una valutazione esista, e su cosa, resta
 * visibile — che e' esattamente il confine di ADR-0032.
 */
const FLIGHT_RISK_JUDGMENT_FIELDS = ["score", "band", "features"] as const;
const READINESS_JUDGMENT_FIELDS = ["value", "horizon", "features"] as const;
const SKILL_GAP_JUDGMENT_FIELDS = ["value", "segment", "features"] as const;

/**
 * Applica il mask agli `items` di una lista di insight, lasciando intatti
 * scope/total — **e neutralizza l'ORDINE**.
 *
 * Perche' l'ordine conta quanto i campi. Queste tre liste tornano ordinate per
 * punteggio decrescente: e' il loro servizio, «chi rischia di piu' per primo».
 * Ma togliere il punteggio e consegnare la lista nello stesso ordine lascia in
 * mano al lettore la GRADUATORIA COMPLETA delle persone — piu' informativa, in
 * molti usi, del numero che si e' tolto. E' precisamente la
 * «order-preserving truncation» che il vincolo 4 di `lib/scope/mask.ts` vieta
 * («nothing left to sort by»), e sarebbe sopravvissuta a un test che guarda solo
 * i campi.
 *
 * Quando il mask morde, le righe si riordinano quindi per `userId`: un ordine
 * stabile, riproducibile e che non dice niente. Chi legge in chiaro continua a
 * ricevere la classifica vera.
 */
function maskItems<T extends { userId: string }, L extends { items: T[] }>(
  actor: ActorContext,
  lista: L,
  fields: readonly string[],
): L {
  if (!masksUnderPlatformMandate(actor, "EVALUATION", null)) return lista;
  const items = lista.items.map((r) =>
    masksUnderPlatformMandate(actor, "EVALUATION", r.userId) ? maskFields(r, fields) : r,
  );
  // Si riordina solo se qualcosa e' stato davvero mascherato: un attore che legge
  // in chiaro (o che vede solo le proprie righe per I17) tiene la sua classifica.
  const mascherate = items.filter((r) => "masked" in r).length;
  if (mascherate === 0) return { ...lista, items };
  return { ...lista, items: [...items].sort((x, y) => x.userId.localeCompare(y.userId)) };
}

/**
 * 3.4 GAP_CLOSURE_DUE producer — notify the highest-gap subjects of an open
 * skill gap after a recompute. Best-effort (a notification failure must never
 * break the recompute) and dedupe-on (collapses to one UNREAD per user, so
 * repeated recomputes don't flood the inbox). Capped at the top 50 by gap value.
 */
async function notifySkillGaps(toStore: repo.SubjectPositionScoreToStore[]): Promise<void> {
  const top = [...toStore].sort((a, b) => b.value - a.value).slice(0, 50);
  if (top.length === 0) return;
  try {
    // One round-trip instead of 50 sequential emitNotification calls (3 queries
    // each with dedupe = ~150 serialised round-trips per recompute). This is the
    // very anti-pattern emitNotificationsBulk was introduced for (QW-B1); the
    // recompute producer had simply never been moved over, and it was pushing the
    // "recompute twice + assert dedupe" test past its 20s budget.
    await emitNotificationsBulk(
      pool,
      top.map((t) => ({
        userId: t.userId,
        tenantId: t.tenantId,
        body: `È stato rilevato un gap di competenze per la tua posizione (priorità ${t.category}).`,
      })),
      {
        type: "GAP_CLOSURE_DUE",
        subject: "Gap di competenze da colmare",
        priority: "MEDIUM",
        resourceType: "SKILL",
        actionUrl: "/me/gaps",
      },
      { dedupe: true },
    );
  } catch {
    /* best-effort */
  }
}

export const MODEL_VERSION = "flight-risk-v1";
const RULE_ID = "weighted-linear-flight-risk";

/** PM-signed-off weights (data-mining spec §9.1). Σ = 1.0. */
export const FLIGHT_RISK_WEIGHTS = {
  tenure: 0.15,
  attendance: 0.2,
  kpi: 0.25,
  engagement: 0.25,
  comp: 0.1,
  promotion: 0.05,
} as const;

/* --- scope (mirror analytics/service.ts) --------------------------------- */
// #119 — le tre costanti di fascia stavano qui, identiche in tre moduli.
// La definizione unica vive in lib/scope/domains.ts.
/** #119 — one definition (lib/scope/domains.ts), and a loud failure instead of
 *  the silent `return "TEAM"` that used to render an empty page. */
function scopeKind(a: ActorContext): Promise<InsightsScopeKind> {
  return scopeTierOf(pool, a, "insights");
}

async function buildScope(
  a: ActorContext,
): Promise<{ kind: InsightsScopeKind; filter: repo.ScopeFilter; tenantId: string | null }> {
  const kind = await scopeKind(a);
  const isPlatform = kind === "PLATFORM";
  const teamPositionIds = kind === "TEAM" ? await posizioniNelPerimetroOrganizzativo(pool, a.userId) : [];
  const tenantId = isPlatform ? null : a.tenantId;
  return { kind, tenantId, filter: { tenantId, teamPositionIds, isPlatformScope: isPlatform } };
}

/**
 * ADR-0027 F3: the actor's ORGANIZATIONAL read allow-list (subject user ids) for the person
 * axis, layered ON TOP of the PLATFORM/TENANT/TEAM scope. `undefined` = no id restriction
 * (PLATFORM_ADMIN → all; HR-mandated TENANT_ADMIN/HRMS_MANAGER → whole tenant); a subtree/self
 * actor is pinned to the exact set of subject user ids they may read (excludes org peers, I18/I19).
 */
function orgAllowList(scope: OrgReadScope): string[] | undefined {
  return scope.kind === "subtree" || scope.kind === "self" ? scope.userIdAllowList : undefined;
}

/* --- normalization (pure; 0..100 risk-oriented; null = absent) ------------ */
const clamp = (x: number): number => Math.max(0, Math.min(100, x));
const round2 = (x: number): number => Math.round(x * 100) / 100;
const round4 = (x: number): number => Math.round(x * 10000) / 10000;

/** 0 at `lo`, 100 at `hi`, linear between. */
function linUp(x: number, lo: number, hi: number): number {
  if (x <= lo) return 0;
  if (x >= hi) return 100;
  return ((x - lo) / (hi - lo)) * 100;
}

function normTenure(y: number | null): number | null {
  if (y === null) return null;
  if (y < 1) return 85; // brand-new → high churn risk
  if (y < 2) return clamp(85 - (y - 1) * 40); // 85 → 45 across [1,2)
  if (y <= 8) return 20; // settled sweet spot → low
  if (y <= 15) return clamp(20 + ((y - 8) / 7) * 20); // 20 → 40 across (8,15]
  return 50; // very long tenure → mild rising risk
}
function normOt(r: number | null): number | null {
  return r === null ? null : clamp(linUp(r, 0, 0.3)); // chronic OT ratio ≥0.30 → max
}
function normAbsence(r: number | null): number | null {
  return r === null ? null : clamp(linUp(r, 0, 0.15)); // absence ratio ≥0.15 → max
}
function normKpi(ach: number | null): number | null {
  if (ach === null) return null;
  if (ach >= 1) return 0; // at/above target → no risk
  if (ach <= 0.5) return 100; // ≤50% of target → max
  return clamp(((1 - ach) / 0.5) * 100);
}
function normEngagement(avg: number | null): number | null {
  return avg === null ? null : clamp(((5 - avg) / 4) * 100); // 1..5 rating; low → high risk
}
function normComp(pct: number | null): number | null {
  return pct === null ? null : clamp((1 - pct) * 100); // lower band percentile in tenant → higher risk
}
function normPromo(days: number | null): number | null {
  return days === null ? null : clamp(linUp(days, 180, 1825)); // ≥5y since last move → max
}

function bandOf(score: number): FlightRiskBand {
  if (score >= 85) return "CRITICAL";
  if (score >= 65) return "HIGH";
  if (score >= 40) return "MEDIUM";
  return "LOW";
}

interface FeatureDef {
  key: string;
  weight: number;
  raw: number | null;
  normalized: number | null;
}

/** Deterministic scoring: pure function of the raw features (the explainability guarantee). */
export function scoreFlightRisk(raw: repo.RawFeatureRow): {
  score: number;
  band: FlightRiskBand;
  features: FlightRiskFeatureContribution[];
} {
  const otN = normOt(raw.otRatio);
  const absN = normAbsence(raw.absenceRatio);
  // attendance blends overtime (0.7) + absence (0.3); if only one is present, use it.
  let attNorm: number | null;
  if (otN === null && absN === null) attNorm = null;
  else if (otN !== null && absN !== null) attNorm = clamp(otN * 0.7 + absN * 0.3);
  else attNorm = otN ?? absN;

  const defs: FeatureDef[] = [
    { key: "tenure", weight: FLIGHT_RISK_WEIGHTS.tenure, raw: raw.tenureYears, normalized: normTenure(raw.tenureYears) },
    { key: "attendance", weight: FLIGHT_RISK_WEIGHTS.attendance, raw: raw.otRatio, normalized: attNorm },
    { key: "kpi", weight: FLIGHT_RISK_WEIGHTS.kpi, raw: raw.kpiAchievement, normalized: normKpi(raw.kpiAchievement) },
    { key: "engagement", weight: FLIGHT_RISK_WEIGHTS.engagement, raw: raw.engagementAvg, normalized: normEngagement(raw.engagementAvg) },
    { key: "comp", weight: FLIGHT_RISK_WEIGHTS.comp, raw: raw.compBandPct, normalized: normComp(raw.compBandPct) },
    { key: "promotion", weight: FLIGHT_RISK_WEIGHTS.promotion, raw: raw.daysSinceLastMove, normalized: normPromo(raw.daysSinceLastMove) },
  ];

  const present = defs.filter((d) => d.normalized !== null);
  const wsum = present.reduce((s, d) => s + d.weight, 0);

  const features: FlightRiskFeatureContribution[] = defs.map((d) => {
    const effW = d.normalized !== null && wsum > 0 ? d.weight / wsum : 0;
    return {
      feature: d.key,
      raw: d.raw,
      normalized: d.normalized !== null ? round2(d.normalized) : null,
      weight: round4(effW),
      contribution: d.normalized !== null ? round2(effW * d.normalized) : 0,
    };
  });

  const score =
    wsum > 0 ? round2(present.reduce((s, d) => s + (d.weight / wsum) * (d.normalized as number), 0)) : 0;
  return { score, band: bandOf(score), features };
}

function toFlightRiskScore(row: repo.StoredScoreRow): FlightRiskScore {
  const deriv = (row.payload?.derivation ?? {}) as Record<string, unknown>;
  const features = Array.isArray(deriv.features)
    ? (deriv.features as FlightRiskFeatureContribution[])
    : [];
  return {
    userId: row.userId,
    tenantId: row.tenantId,
    displayName: row.displayName,
    score: row.value,
    band: row.band as FlightRiskBand,
    modelVersion: row.modelVersion,
    computedAt: row.computedAt,
    features,
  };
}

/* ======================================================================== */
/* P2 — Slice B: succession-readiness (spec §9.3) — PM tuning delegated.      */
/* Weights Σ=1: position-fit .50 · KPI .30 · tenure .20. (Seniority-gap was   */
/* dropped — data-sparse, 49/227 roles, undefined ordinal scale — and its     */
/* weight redistributed; all 3 retained features are reliably computable.)    */
/* ======================================================================== */
export const SUCCESSION_MODEL_VERSION = "succession-readiness-v1";
const SUCCESSION_RULE_ID = "weighted-linear-succession-readiness";
export const READINESS_TOP_N = 3;
export const READINESS_WEIGHTS = { positionFit: 0.5, kpi: 0.3, tenure: 0.2 } as const;

const normPositionFit = (cos: number | null): number | null => (cos === null ? null : clamp(cos * 100));
const normKpiReadiness = (ach: number | null): number | null => (ach === null ? null : clamp(linUp(ach, 0.4, 1.0)));
const normTenureReadiness = (y: number | null): number | null => (y === null ? null : clamp(linUp(y, 0.5, 5)));

function horizonOf(v: number): SuccessionReadinessHorizon {
  if (v >= 85) return "READY_NOW";
  if (v >= 70) return "READY_6_MONTHS";
  if (v >= 55) return "READY_1_YEAR";
  if (v >= 40) return "READY_2_YEARS";
  return "NOT_READY";
}

/** Pure, deterministic blend → readiness value + horizon + per-feature explanation. */
export function scoreReadiness(raw: repo.ReadinessFeatureRow): {
  value: number;
  horizon: SuccessionReadinessHorizon;
  features: FlightRiskFeatureContribution[];
} {
  const defs: FeatureDef[] = [
    { key: "position_fit", weight: READINESS_WEIGHTS.positionFit, raw: raw.positionFit, normalized: normPositionFit(raw.positionFit) },
    { key: "kpi", weight: READINESS_WEIGHTS.kpi, raw: raw.kpiAchievement, normalized: normKpiReadiness(raw.kpiAchievement) },
    { key: "tenure", weight: READINESS_WEIGHTS.tenure, raw: raw.tenureYears, normalized: normTenureReadiness(raw.tenureYears) },
  ];
  const present = defs.filter((d) => d.normalized !== null);
  const wsum = present.reduce((s, d) => s + d.weight, 0);
  const features: FlightRiskFeatureContribution[] = defs.map((d) => {
    const effW = d.normalized !== null && wsum > 0 ? d.weight / wsum : 0;
    return {
      feature: d.key,
      raw: d.raw,
      normalized: d.normalized !== null ? round2(d.normalized) : null,
      weight: round4(effW),
      contribution: d.normalized !== null ? round2(effW * d.normalized) : 0,
    };
  });
  const value = wsum > 0 ? round2(present.reduce((s, d) => s + (d.weight / wsum) * (d.normalized as number), 0)) : 0;
  return { value, horizon: horizonOf(value), features };
}

/* ======================================================================== */
/* P2 — Slice C: skill-gap (spec §9.4). Weights Σ=1: role-fit-gap .70 ·       */
/* evidence-sparsity .30. Both always present (cosine + profile count).       */
/* ======================================================================== */
export const SKILL_GAP_MODEL_VERSION = "skill-gap-v1";
const SKILL_GAP_RULE_ID = "weighted-linear-skill-gap";
export const SKILL_GAP_WEIGHTS = { roleFitGap: 0.7, evidenceSparsity: 0.3 } as const;
const EVIDENCE_CAP = 12; // ≥12 distinct skills with evidence → no sparsity gap

const cosineGapNorm = (cos: number | null): number | null => (cos === null ? null : clamp((1 - cos) * 100));
const sparsityGapNorm = (count: number | null): number | null =>
  count === null ? null : clamp((1 - Math.min(count, EVIDENCE_CAP) / EVIDENCE_CAP) * 100);

function segmentOf(v: number): SkillGapSegment {
  if (v >= 65) return "MAJOR_GAP";
  if (v >= 45) return "MODERATE_GAP";
  if (v >= 25) return "MINOR_GAP";
  return "ALIGNED";
}

export function scoreSkillGap(raw: repo.SkillGapFeatureRow): {
  value: number;
  segment: SkillGapSegment;
  features: FlightRiskFeatureContribution[];
} {
  const defs: FeatureDef[] = [
    { key: "role_fit_gap", weight: SKILL_GAP_WEIGHTS.roleFitGap, raw: raw.currentRoleFit, normalized: cosineGapNorm(raw.currentRoleFit) },
    { key: "evidence_sparsity", weight: SKILL_GAP_WEIGHTS.evidenceSparsity, raw: raw.evidenceCount, normalized: sparsityGapNorm(raw.evidenceCount) },
  ];
  const present = defs.filter((d) => d.normalized !== null);
  const wsum = present.reduce((s, d) => s + d.weight, 0);
  const features: FlightRiskFeatureContribution[] = defs.map((d) => {
    const effW = d.normalized !== null && wsum > 0 ? d.weight / wsum : 0;
    return {
      feature: d.key,
      raw: d.raw,
      normalized: d.normalized !== null ? round2(d.normalized) : null,
      weight: round4(effW),
      contribution: d.normalized !== null ? round2(effW * d.normalized) : 0,
    };
  });
  const value = wsum > 0 ? round2(present.reduce((s, d) => s + (d.weight / wsum) * (d.normalized as number), 0)) : 0;
  return { value, segment: segmentOf(value), features };
}

function readFeatures(payload: Record<string, unknown>): FlightRiskFeatureContribution[] {
  const deriv = (payload?.derivation ?? {}) as Record<string, unknown>;
  return Array.isArray(deriv.features) ? (deriv.features as FlightRiskFeatureContribution[]) : [];
}
function toReadinessScore(row: repo.StoredSubjectPositionRow): SuccessionReadinessScore {
  return {
    userId: row.userId, tenantId: row.tenantId, displayName: row.displayName,
    positionId: row.positionId, positionCode: row.positionCode, positionTitle: row.positionTitle,
    value: row.value, horizon: row.category as SuccessionReadinessHorizon,
    modelVersion: row.modelVersion, computedAt: row.computedAt, features: readFeatures(row.payload),
  };
}
function toSkillGapScore(row: repo.StoredSubjectPositionRow): SkillGapScore {
  return {
    userId: row.userId, tenantId: row.tenantId, displayName: row.displayName,
    positionId: row.positionId, positionCode: row.positionCode, positionTitle: row.positionTitle,
    value: row.value, segment: row.category as SkillGapSegment,
    modelVersion: row.modelVersion, computedAt: row.computedAt, features: readFeatures(row.payload),
  };
}

export const insightsService = {
  /** Scored list (scope-filtered), highest risk first. */
  async flightRisk(a: ActorContext): Promise<FlightRiskListResponse> {
    const s = await buildScope(a);
    const orgScope = await resolveOrgReadScope(pool, a);
    const rows = await repo.readFlightRiskScores(pool, {
      ...s.filter,
      userIdAllowList: orgAllowList(orgScope),
    });
    const items = rows.map(toFlightRiskScore).sort((x, y) => (y.score ?? 0) - (x.score ?? 0));
    return maskItems(a, {
      scope: { kind: s.kind, tenantId: s.tenantId },
      items,
      total: items.length,
      generatedAt: new Date().toISOString(),
    }, FLIGHT_RISK_JUDGMENT_FIELDS);
  },

  /** Single subject (scope-checked). 404 if out of scope or never scored. */
  async userFlightRisk(a: ActorContext, userId: string): Promise<FlightRiskScore> {
    const s = await buildScope(a);
    const row = await repo.readUserFlightRiskScore(pool, s.filter, userId);
    if (!row) throw new NotFoundError("Flight-risk score");
    // ADR-0027 F3: gate the per-subject read by the ORGANIZATIONAL axis (transitive reports-to).
    // 404 (not 403) to avoid existence enumeration across the org boundary.
    if (!(await canReadOrgTarget(pool, a, userId, row.tenantId))) {
      throw new NotFoundError("Flight-risk score");
    }
    const score = toFlightRiskScore(row);
    // #124 D4 — il soggetto e' il parametro stesso della rotta: I17 (il mio
    // punteggio lo vedo) e' gia' coperto da `masksUnderPlatformMandate`.
    return masksUnderPlatformMandate(a, "EVALUATION", userId)
      ? maskFields(score, FLIGHT_RISK_JUDGMENT_FIELDS)
      : score;
  },

  /** Recompute in-platform: extract features → score → append (latest-wins). Admin only. */
  async recompute(a: ActorContext): Promise<InsightsRecomputeResponse> {
    const s = await buildScope(a);
    const raws = await repo.extractFlightRiskFeatures(pool, s.filter);
    const computedAt = new Date().toISOString();
    const toStore: repo.ScoreToStore[] = raws.map((r) => {
      const { score, band, features } = scoreFlightRisk(r);
      return {
        userId: r.userId,
        tenantId: r.tenantId,
        value: score,
        band,
        modelVersion: MODEL_VERSION,
        payload: {
          derivation: { rule_id: RULE_ID, model_version: MODEL_VERSION, computed_at: computedAt, features },
          legacy: null,
        },
      };
    });
    const scored = await repo.upsertFlightRiskScores(pool, toStore);
    if (s.kind === "PLATFORM" && toStore.length > 0) {
      await repo.pruneFlightRiskScoresNotIn(pool, toStore.map((r) => r.userId));
    }
    return { accepted: true, scored, modelVersion: MODEL_VERSION, computedAt };
  },

  /* --- P2 slice B: succession-readiness --- */
  async successionReadiness(a: ActorContext): Promise<SuccessionReadinessListResponse> {
    const s = await buildScope(a);
    const orgScope = await resolveOrgReadScope(pool, a);
    const rows = await repo.readReadinessScores(pool, {
      ...s.filter,
      userIdAllowList: orgAllowList(orgScope),
    });
    const items = rows.map(toReadinessScore).sort((x, y) => (y.value ?? 0) - (x.value ?? 0));
    return maskItems(a, { scope: { kind: s.kind, tenantId: s.tenantId }, items, total: items.length, generatedAt: new Date().toISOString() }, READINESS_JUDGMENT_FIELDS);
  },

  async recomputeReadiness(a: ActorContext): Promise<InsightsRecomputeResponse> {
    const s = await buildScope(a);
    const raws = await repo.extractReadinessFeatures(pool, s.filter, READINESS_TOP_N);
    const computedAt = new Date().toISOString();
    const toStore: repo.SubjectPositionScoreToStore[] = raws.map((r) => {
      const { value, horizon, features } = scoreReadiness(r);
      return {
        userId: r.userId, tenantId: r.tenantId, positionId: r.positionId, value, category: horizon,
        modelVersion: SUCCESSION_MODEL_VERSION,
        payload: { derivation: { rule_id: SUCCESSION_RULE_ID, model_version: SUCCESSION_MODEL_VERSION, computed_at: computedAt, features },
                   position: { id: r.positionId, code: r.positionCode, title: r.positionTitle } },
      };
    });
    const scored = await repo.upsertReadinessScores(pool, toStore);
    return { accepted: true, scored, modelVersion: SUCCESSION_MODEL_VERSION, computedAt };
  },

  /* --- P2 slice C: skill-gap --- */
  async skillGap(a: ActorContext): Promise<SkillGapListResponse> {
    const s = await buildScope(a);
    const orgScope = await resolveOrgReadScope(pool, a);
    const rows = await repo.readSkillGapScores(pool, {
      ...s.filter,
      userIdAllowList: orgAllowList(orgScope),
    });
    const items = rows.map(toSkillGapScore).sort((x, y) => (y.value ?? 0) - (x.value ?? 0));
    return maskItems(a, { scope: { kind: s.kind, tenantId: s.tenantId }, items, total: items.length, generatedAt: new Date().toISOString() }, SKILL_GAP_JUDGMENT_FIELDS);
  },

  async recomputeSkillGap(a: ActorContext): Promise<InsightsRecomputeResponse> {
    const s = await buildScope(a);
    const raws = await repo.extractSkillGapFeatures(pool, s.filter);
    const computedAt = new Date().toISOString();
    const toStore: repo.SubjectPositionScoreToStore[] = raws.map((r) => {
      const { value, segment, features } = scoreSkillGap(r);
      return {
        userId: r.userId, tenantId: r.tenantId, positionId: r.positionId, value, category: segment,
        modelVersion: SKILL_GAP_MODEL_VERSION,
        payload: { derivation: { rule_id: SKILL_GAP_RULE_ID, model_version: SKILL_GAP_MODEL_VERSION, computed_at: computedAt, features },
                   position: { id: r.positionId, code: r.positionCode, title: r.positionTitle } },
      };
    });
    const scored = await repo.upsertSkillGapScores(pool, toStore);
    if (s.kind === "PLATFORM" && toStore.length > 0) {
      await repo.pruneSkillGapScoresNotIn(pool, toStore.map((r) => r.userId));
    }
    await notifySkillGaps(toStore); // 3.4 GAP_CLOSURE_DUE (best-effort, dedupe)
    return { accepted: true, scored, modelVersion: SKILL_GAP_MODEL_VERSION, computedAt };
  },
};
