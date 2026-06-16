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
import type { RoleCode } from "../../config/constants.js";
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
import { findOwnedPositionIds } from "../dashboard/repository.js";
import { emitNotification } from "../../lib/notifications/emit.js";

/**
 * 3.4 GAP_CLOSURE_DUE producer — notify the highest-gap subjects of an open
 * skill gap after a recompute. Best-effort (a notification failure must never
 * break the recompute) and dedupe-on (collapses to one UNREAD per user, so
 * repeated recomputes don't flood the inbox). Capped at the top 50 by gap value.
 */
async function notifySkillGaps(toStore: repo.SubjectPositionScoreToStore[]): Promise<void> {
  const top = [...toStore].sort((a, b) => b.value - a.value).slice(0, 50);
  for (const t of top) {
    try {
      await emitNotification(pool, {
        tenantId: t.tenantId,
        userId: t.userId,
        type: "GAP_CLOSURE_DUE",
        subject: "Gap di competenze da colmare",
        body: `È stato rilevato un gap di competenze per la tua posizione (priorità ${t.category}).`,
        priority: "MEDIUM",
        resourceType: "SKILL",
        actionUrl: "/me/gaps",
        dedupe: true,
      });
    } catch {
      /* best-effort */
    }
  }
}

export interface ActorContext {
  userId: string;
  tenantId: string | null;
  roles: RoleCode[];
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
const PLATFORM_ROLES: RoleCode[] = ["PLATFORM_ADMIN"];
const TENANT_ROLES: RoleCode[] = ["TENANT_ADMIN", "BLUEPRINT_MANAGER", "HRMS_MANAGER", "PROCESS_OWNER"];
const TEAM_ROLES: RoleCode[] = ["MANAGER"];

function scopeKind(a: ActorContext): InsightsScopeKind {
  if (a.roles.some((r) => PLATFORM_ROLES.includes(r))) return "PLATFORM";
  if (a.roles.some((r) => TENANT_ROLES.includes(r))) return "TENANT";
  if (a.roles.some((r) => TEAM_ROLES.includes(r))) return "TEAM";
  // RBAC gates the routes to insights:view (the 6 non-leaf roles); USER/READ_ONLY never reach here.
  return "TEAM";
}

async function buildScope(
  a: ActorContext,
): Promise<{ kind: InsightsScopeKind; filter: repo.ScopeFilter; tenantId: string | null }> {
  const kind = scopeKind(a);
  const isPlatform = kind === "PLATFORM";
  const teamPositionIds = kind === "TEAM" ? await findOwnedPositionIds(pool, a.userId) : [];
  const tenantId = isPlatform ? null : a.tenantId;
  return { kind, tenantId, filter: { tenantId, teamPositionIds, isPlatformScope: isPlatform } };
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
    const rows = await repo.readFlightRiskScores(pool, s.filter);
    const items = rows.map(toFlightRiskScore).sort((x, y) => y.score - x.score);
    return {
      scope: { kind: s.kind, tenantId: s.tenantId },
      items,
      total: items.length,
      generatedAt: new Date().toISOString(),
    };
  },

  /** Single subject (scope-checked). 404 if out of scope or never scored. */
  async userFlightRisk(a: ActorContext, userId: string): Promise<FlightRiskScore> {
    const s = await buildScope(a);
    const row = await repo.readUserFlightRiskScore(pool, s.filter, userId);
    if (!row) throw new NotFoundError("Flight-risk score");
    return toFlightRiskScore(row);
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
    return { accepted: true, scored, modelVersion: MODEL_VERSION, computedAt };
  },

  /* --- P2 slice B: succession-readiness --- */
  async successionReadiness(a: ActorContext): Promise<SuccessionReadinessListResponse> {
    const s = await buildScope(a);
    const rows = await repo.readReadinessScores(pool, s.filter);
    const items = rows.map(toReadinessScore).sort((x, y) => y.value - x.value);
    return { scope: { kind: s.kind, tenantId: s.tenantId }, items, total: items.length, generatedAt: new Date().toISOString() };
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
    const rows = await repo.readSkillGapScores(pool, s.filter);
    const items = rows.map(toSkillGapScore).sort((x, y) => y.value - x.value);
    return { scope: { kind: s.kind, tenantId: s.tenantId }, items, total: items.length, generatedAt: new Date().toISOString() };
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
    await notifySkillGaps(toStore); // 3.4 GAP_CLOSURE_DUE (best-effort, dedupe)
    return { accepted: true, scored, modelVersion: SKILL_GAP_MODEL_VERSION, computedAt };
  },
};
