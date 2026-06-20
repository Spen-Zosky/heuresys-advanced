/**
 * @heuresys/shared — capability-composition (MLCE Phase-1) schemas.
 * Backs /v1/capability/composition over sys.sys_capability_scores (+ lineage).
 *
 * MULTI-LEVEL CAPABILITY ENGINE (MLCE): a deterministic, in-platform composite
 * capability score 0..100 per subject at four levels — EMPLOYEE → POSITION →
 * ORG_UNIT → ORG — derived bottom-up from live sys.* data (required skills,
 * held skill-evidence, position/OU hierarchy) via a documented rule (NO ML, NO
 * external service). Every aggregated score is reproducible from its children +
 * the aggregation mode: the per-arc lineage is the audit trail. This is the
 * numeric spine the Maturity scorecard (Phase-2) consumes.
 *
 * Mirrors the insights (cap③) score schema shape. Zod v4 API.
 */
import { z } from "zod";

/** The four roll-up levels. subject_id is polymorphic (employee=user, etc.). */
export const CapabilitySubjectTypeEnum = z.enum(["EMPLOYEE", "POSITION", "ORG_UNIT", "ORG"]);
export type CapabilitySubjectType = z.infer<typeof CapabilitySubjectTypeEnum>;

/** How children combine into a parent score. v1 computes WEIGHTED_AVG; the others
 *  are reserved (RD-08 varchar+CHECK domain) for future override. */
export const CapabilityAggregationModeEnum = z.enum([
  "WEIGHTED_AVG", "SIMPLE_AVG", "MIN", "WORST_CRITICAL", "COVERAGE",
]);
export type CapabilityAggregationMode = z.infer<typeof CapabilityAggregationModeEnum>;

/** Read scope (capability:read is admin/org-director/HR — no TEAM/ESS self-view). */
export const CapabilityScopeKindEnum = z.enum(["PLATFORM", "TENANT"]);
export const CapabilityScopeSchema = z.object({
  kind: CapabilityScopeKindEnum,
  tenantId: z.uuid().nullable(),
});
export type CapabilityScope = z.infer<typeof CapabilityScopeSchema>;

/** One child's frozen contribution to an aggregated score (the audit arc). */
export const CapabilityLineageEntrySchema = z.object({
  childType: CapabilitySubjectTypeEnum,
  childId: z.uuid(),
  childLabel: z.string().nullable(),
  /** child value frozen at compute time (0..100). */
  childValue: z.number(),
  /** effective (re-normalized) weight of this child in the parent. */
  weight: z.number(),
});
export type CapabilityLineageEntry = z.infer<typeof CapabilityLineageEntrySchema>;

export const CapabilityScoreSchema = z.object({
  subjectType: CapabilitySubjectTypeEnum,
  subjectId: z.uuid(),
  tenantId: z.uuid(),
  /** Human label (employee display name / position title / OU name / tenant name). */
  label: z.string().nullable(),
  /** Composite capability 0..100. */
  value: z.number(),
  /** Required-skill coverage 0..100 (fraction of required skills with held evidence,
   *  or for aggregates the weighted child coverage). */
  coverage: z.number(),
  aggregationMode: CapabilityAggregationModeEnum,
  modelVersion: z.string(),
  /** Number of children that contributed (0 for a leaf EMPLOYEE / a childless aggregate). */
  childCount: z.number().int().min(0),
  computedAt: z.iso.datetime(),
  /** Per-child lineage. Populated on the single-subject GET; empty ([]) on the list GET. */
  lineage: z.array(CapabilityLineageEntrySchema),
});
export type CapabilityScore = z.infer<typeof CapabilityScoreSchema>;

/** GET /composition?subjectType=  — list of active scores at one level (or all). */
export const CapabilityCompositionListQuerySchema = z.object({
  subjectType: CapabilitySubjectTypeEnum.optional(),
});
export type CapabilityCompositionListQuery = z.infer<typeof CapabilityCompositionListQuerySchema>;

/** GET /composition/:subjectType/:subjectId — single subject. */
export const CapabilitySubjectParamSchema = z.object({
  subjectType: CapabilitySubjectTypeEnum,
  subjectId: z.uuid(),
});

export const CapabilityScoreListResponseSchema = z.object({
  scope: CapabilityScopeSchema,
  items: z.array(CapabilityScoreSchema),
  total: z.number().int().min(0),
  generatedAt: z.iso.datetime(),
});
export type CapabilityScoreListResponse = z.infer<typeof CapabilityScoreListResponseSchema>;

/** POST /composition/recompute — bottom-up recompute for the caller's scope. */
export const CapabilityRecomputeResponseSchema = z.object({
  accepted: z.literal(true),
  scored: z.object({
    employee: z.number().int().min(0),
    position: z.number().int().min(0),
    orgUnit: z.number().int().min(0),
    org: z.number().int().min(0),
    total: z.number().int().min(0),
  }),
  modelVersion: z.string(),
  computedAt: z.iso.datetime(),
});
export type CapabilityRecomputeResponse = z.infer<typeof CapabilityRecomputeResponseSchema>;
