/**
 * @heuresys/shared — insights (cap③ data-mining) schemas.
 * Backs /v1/insights/* over sys.sys_flight_risk_scores.
 *
 * IN-PLATFORM DERIVED: a per-subject flight-risk score computed from live sys.*
 * features via a documented, transparent weighted-linear rule (NO ML, NO external
 * service). Every feature's contribution is exposed in `features[]` so the score
 * is fully explainable. Distinct from the imported /v1/predictions read-model
 * (PredictionsML) — see the data-mining design spec §2.
 *
 * Sensitive (D-6): admin/manager-only surface; no ESS self-view of flight-risk.
 * Zod v4 API (z.uuid()/z.iso.datetime()).
 */
import { z } from "zod";

export const FlightRiskBandEnum = z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);
export type FlightRiskBand = z.infer<typeof FlightRiskBandEnum>;

export const InsightsScopeKindEnum = z.enum(["PLATFORM", "TENANT", "TEAM"]);
export type InsightsScopeKind = z.infer<typeof InsightsScopeKindEnum>;

/** One feature's audited contribution to the score (explainability). */
export const FlightRiskFeatureContributionSchema = z.object({
  /** Stable feature key, e.g. "tenure", "attendance", "kpi", "engagement", "comp", "promotion". */
  feature: z.string(),
  /** Raw measured value for the subject (null = no data → dropped + weights re-normalized). */
  raw: z.number().nullable(),
  /** 0..100 risk-oriented normalization (null when the feature is absent). */
  normalized: z.number().nullable(),
  /** Effective weight after re-normalizing over the present features (sums to 1.0). */
  weight: z.number(),
  /** weight × normalized (0 when absent). */
  contribution: z.number(),
});
export type FlightRiskFeatureContribution = z.infer<typeof FlightRiskFeatureContributionSchema>;

export const FlightRiskScoreSchema = z.object({
  userId: z.uuid(),
  tenantId: z.uuid(),
  displayName: z.string().nullable(),
  /** 0..100, higher = higher attrition risk. */
  score: z.number(),
  band: FlightRiskBandEnum,
  modelVersion: z.string(),
  computedAt: z.iso.datetime(),
  /** Per-feature breakdown — the human-auditable explanation of the score. */
  features: z.array(FlightRiskFeatureContributionSchema),
});
export type FlightRiskScore = z.infer<typeof FlightRiskScoreSchema>;

export const InsightsScopeSchema = z.object({
  kind: InsightsScopeKindEnum,
  tenantId: z.uuid().nullable(),
});
export type InsightsScope = z.infer<typeof InsightsScopeSchema>;

export const FlightRiskListResponseSchema = z.object({
  scope: InsightsScopeSchema,
  items: z.array(FlightRiskScoreSchema),
  total: z.number().int().min(0),
  generatedAt: z.iso.datetime(),
});
export type FlightRiskListResponse = z.infer<typeof FlightRiskListResponseSchema>;

export const FlightRiskUserIdParamSchema = z.object({ userId: z.uuid() });

export const InsightsRecomputeResponseSchema = z.object({
  accepted: z.literal(true),
  scored: z.number().int().min(0),
  modelVersion: z.string(),
  computedAt: z.iso.datetime(),
});
export type InsightsRecomputeResponse = z.infer<typeof InsightsRecomputeResponseSchema>;

// ─────────────────── P2 · Slice B — succession-readiness ───────────────────
export const SuccessionReadinessHorizonEnum = z.enum(["READY_NOW", "READY_6_MONTHS", "READY_1_YEAR", "READY_2_YEARS", "NOT_READY"]);
export type SuccessionReadinessHorizon = z.infer<typeof SuccessionReadinessHorizonEnum>;

/** Per (subject, candidate target position) readiness — same explainable shape as flight-risk. */
export const SuccessionReadinessScoreSchema = z.object({
  userId: z.uuid(),
  tenantId: z.uuid(),
  displayName: z.string().nullable(),
  positionId: z.uuid(),
  positionCode: z.string().nullable(),
  positionTitle: z.string().nullable(),
  /** 0..100, higher = more ready to step into the target position. */
  value: z.number(),
  horizon: SuccessionReadinessHorizonEnum,
  modelVersion: z.string(),
  computedAt: z.iso.datetime(),
  features: z.array(FlightRiskFeatureContributionSchema),
});
export type SuccessionReadinessScore = z.infer<typeof SuccessionReadinessScoreSchema>;

export const SuccessionReadinessListResponseSchema = z.object({
  scope: InsightsScopeSchema,
  items: z.array(SuccessionReadinessScoreSchema),
  total: z.number().int().min(0),
  generatedAt: z.iso.datetime(),
});
export type SuccessionReadinessListResponse = z.infer<typeof SuccessionReadinessListResponseSchema>;

// ─────────────────── P2 · Slice C — skill-gap ───────────────────
export const SkillGapSegmentEnum = z.enum(["ALIGNED", "MINOR_GAP", "MODERATE_GAP", "MAJOR_GAP"]);
export type SkillGapSegment = z.infer<typeof SkillGapSegmentEnum>;

/** Per-subject skill-gap vs the CURRENT position's role — same explainable shape. */
export const SkillGapScoreSchema = z.object({
  userId: z.uuid(),
  tenantId: z.uuid(),
  displayName: z.string().nullable(),
  positionId: z.uuid(),
  positionCode: z.string().nullable(),
  positionTitle: z.string().nullable(),
  /** 0..100, higher = larger skill gap for the current role. */
  value: z.number(),
  segment: SkillGapSegmentEnum,
  modelVersion: z.string(),
  computedAt: z.iso.datetime(),
  features: z.array(FlightRiskFeatureContributionSchema),
});
export type SkillGapScore = z.infer<typeof SkillGapScoreSchema>;

export const SkillGapListResponseSchema = z.object({
  scope: InsightsScopeSchema,
  items: z.array(SkillGapScoreSchema),
  total: z.number().int().min(0),
  generatedAt: z.iso.datetime(),
});
export type SkillGapListResponse = z.infer<typeof SkillGapListResponseSchema>;
