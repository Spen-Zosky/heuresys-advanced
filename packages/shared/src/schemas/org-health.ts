/**
 * packages/shared/src/schemas/org-health.ts — #57 F/F3.
 *
 * Organizational health index per org-unit. Answers "which parts of the company are
 * healthy, and on what evidence?" with a declared composite — no ML, no black box.
 *
 * Six dimensions, each derived from live rows and each normalized to [0,1]:
 *   engagement   mean of the engagement-survey ratings of the unit's people
 *   execution    goals not at risk / cancelled, over the unit's goals
 *   retention    1 − mean flight-risk of the unit's people
 *   stability    attended days (present/remote/training) over recorded days
 *   performance  mean performance-review rating, rescaled from its 1..5 range
 *   maturity     the Maturity engine's composite for the unit, already 0..100
 *
 * The index is the weighted mean of the dimensions THAT HAVE DATA. A dimension without
 * data for a unit leaves the denominator instead of being counted as zero — inventing a
 * zero would punish a unit for a gap in instrumentation rather than in health. How much
 * of the model was actually available is reported as `coverage`, so a high score backed
 * by two dimensions out of six can never be mistaken for a well-evidenced one.
 */
import { z } from "zod";

/** Declared weights of the composite (sum = 1). Renormalized over the available dimensions. */
export const ORG_HEALTH_WEIGHTS = {
  engagement: 0.25,
  execution: 0.2,
  retention: 0.2,
  stability: 0.15,
  performance: 0.1,
  maturity: 0.1,
} as const;

export const ORG_HEALTH_DIMENSIONS = [
  "engagement", "execution", "retention", "stability", "performance", "maturity",
] as const;
export type OrgHealthDimension = (typeof ORG_HEALTH_DIMENSIONS)[number];

/**
 * Bands over the 0-100 index. Declared here so the UI states the rule rather than
 * inventing its own colour cuts.
 */
export const ORG_HEALTH_BANDS = { strong: 75, healthy: 60, watch: 45 } as const;

export const ORG_HEALTH_STATUSES = ["STRONG", "HEALTHY", "WATCH", "CRITICAL", "INSUFFICIENT_DATA"] as const;
export const OrgHealthStatusSchema = z.enum(ORG_HEALTH_STATUSES);
export type OrgHealthStatus = z.infer<typeof OrgHealthStatusSchema>;

/**
 * Where a unit sits RELATIVE to the others, by tercile of the observed index.
 *
 * The absolute band and this answer two different questions, and one cannot replace the
 * other. Measured on live RTL data the index spans 70.8–81.7: every unit is healthy in
 * absolute terms, so the band alone reports "no problem anywhere" and gives a reader
 * nothing to act on. The standing says where to look first — while the band keeps the
 * absolute reading honest, so a merely last-placed unit is never called critical.
 */
export const ORG_HEALTH_STANDINGS = ["LEADING", "MIDDLE", "LAGGING", "UNRANKED"] as const;
export const OrgHealthStandingSchema = z.enum(ORG_HEALTH_STANDINGS);
export type OrgHealthStanding = z.infer<typeof OrgHealthStandingSchema>;

/** Minimum share of the model's weight that must have data before a band is claimed. */
export const ORG_HEALTH_MIN_COVERAGE = 0.5;

/** Performance reviews are scored 1..5; rescaled to [0,1] as (r − 1) / 4. */
export const ORG_HEALTH_REVIEW_SCALE = { min: 1, max: 5 } as const;

export const OrgHealthDimensionScoreSchema = z.object({
  dimension: z.enum(ORG_HEALTH_DIMENSIONS),
  /** null when the unit has no data for this dimension — never silently zero. */
  score: z.number().min(0).max(1).nullable(),
  /** How many underlying rows the score was computed from (0 when absent). */
  sampleSize: z.number().int().min(0),
  /** The weight this dimension carried for THIS unit after renormalization. */
  effectiveWeight: z.number().min(0).max(1),
});
export type OrgHealthDimensionScore = z.infer<typeof OrgHealthDimensionScoreSchema>;

export const OrgHealthUnitSchema = z.object({
  orgUnitId: z.uuid(),
  orgUnitName: z.string(),
  headcount: z.number().int().min(0),
  /** 0-100 composite over the available dimensions; null when coverage is too low to claim one. */
  index: z.number().min(0).max(100).nullable(),
  status: OrgHealthStatusSchema,
  /** Tercile position among the banded units; UNRANKED when the unit carries no index. */
  standing: OrgHealthStandingSchema,
  /** Percentile of this unit's index among the banded units, [0,1]; null when unranked. */
  percentile: z.number().min(0).max(1).nullable(),
  /** Share of the declared model weight that had data for this unit, [0,1]. */
  coverage: z.number().min(0).max(1),
  dimensions: z.array(OrgHealthDimensionScoreSchema),
});
export type OrgHealthUnit = z.infer<typeof OrgHealthUnitSchema>;

export const OrgHealthScorecardSchema = z.object({
  units: z.array(OrgHealthUnitSchema),
  total: z.number().int().min(0),
  /** Weighted mean of the units that carry an index, weighted by headcount. */
  organizationIndex: z.number().min(0).max(100).nullable(),
  summary: z.object({
    STRONG: z.number().int().min(0),
    HEALTHY: z.number().int().min(0),
    WATCH: z.number().int().min(0),
    CRITICAL: z.number().int().min(0),
    INSUFFICIENT_DATA: z.number().int().min(0),
  }),
  weights: z.object({
    engagement: z.number(), execution: z.number(), retention: z.number(),
    stability: z.number(), performance: z.number(), maturity: z.number(),
  }),
  bands: z.object({ strong: z.number(), healthy: z.number(), watch: z.number() }),
  minCoverage: z.number(),
  /**
   * Observed spread of the index across the banded units. Published because a composite of
   * six weakly-correlated dimensions compresses toward the middle: without knowing the
   * range, a reader over-reads a gap of half a point as a real difference.
   */
  distribution: z.object({
    min: z.number().nullable(),
    median: z.number().nullable(),
    max: z.number().nullable(),
    /** max − min. A small spread means the ranking matters more than the band. */
    spread: z.number().nullable(),
  }),
  generatedAt: z.string(),
});
export type OrgHealthScorecard = z.infer<typeof OrgHealthScorecardSchema>;
