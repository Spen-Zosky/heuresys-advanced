/**
 * @heuresys/shared — capability-maturity (Maturity engine, Gap#1 Step 4) schemas.
 * Backs /v1/capability/maturity over sys.sys_capability_maturity_scores.
 *
 * Read-only L0..L5 scorecard per org-unit that CONSUMES the MLCE composite
 * (capability-composition) plus a CODED rubric (rubric_version) and derives an
 * SQL-auditable maturity level. v1-full = composite bands + gate criteria (the
 * gates are what make the claim audit/AI-Act-defensible). Every level is
 * reproducible from deriveMaturity(composite, metrics, rubricVersion) — the
 * per-level criteria[] (met + metric/value/threshold) is the audit trail.
 * Zod v4 API. Reuses CapabilityScope from capability-composition.
 */
import { z } from "zod";
import { CapabilityScopeSchema } from "./capability-composition.js";

export const MaturityLevelEnum = z.enum(["L0", "L1", "L2", "L3", "L4", "L5"]);
export type MaturityLevel = z.infer<typeof MaturityLevelEnum>;

/** One rubric criterion's audited outcome (the explanation of the level). */
export const MaturityCriterionSchema = z.object({
  level: MaturityLevelEnum,
  label: z.string(),
  met: z.boolean(),
  /** metric key, e.g. "composite" | "skillCoverage" | "kpiAchievement" | "readinessCoverage" | "majorGapRatio". */
  metric: z.string(),
  value: z.number().nullable(),
  threshold: z.number().nullable(),
  /** ">=", ">", "==", "band" */
  operator: z.string(),
});
export type MaturityCriterion = z.infer<typeof MaturityCriterionSchema>;

export const CapabilityMaturityScoreSchema = z.object({
  orgUnitId: z.uuid(),
  tenantId: z.uuid(),
  orgUnitName: z.string().nullable(),
  capabilityRef: z.string(),
  level: MaturityLevelEnum,
  levelLabel: z.string(),
  /** the MLCE composite (0..100) this level derives from — the auditable bridge. */
  composite: z.number(),
  rubricVersion: z.string(),
  modelVersion: z.string(),
  computedAt: z.iso.datetime(),
  criteria: z.array(MaturityCriterionSchema),
});
export type CapabilityMaturityScore = z.infer<typeof CapabilityMaturityScoreSchema>;

export const CapabilityMaturityListResponseSchema = z.object({
  scope: CapabilityScopeSchema,
  items: z.array(CapabilityMaturityScoreSchema),
  total: z.number().int().min(0),
  generatedAt: z.iso.datetime(),
});
export type CapabilityMaturityListResponse = z.infer<typeof CapabilityMaturityListResponseSchema>;

export const CapabilityMaturityOrgUnitParamSchema = z.object({ orgUnitId: z.uuid() });

export const CapabilityMaturityRecomputeResponseSchema = z.object({
  accepted: z.literal(true),
  scored: z.number().int().min(0),
  modelVersion: z.string(),
  rubricVersion: z.string(),
  computedAt: z.iso.datetime(),
});
export type CapabilityMaturityRecomputeResponse = z.infer<typeof CapabilityMaturityRecomputeResponseSchema>;
