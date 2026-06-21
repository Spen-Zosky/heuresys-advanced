/**
 * apps/api/src/modules/capability-maturity/rubric.ts
 * Versioned Maturity rubric registry — the single, reviewable source of the L0..L5
 * gate thresholds (extracted from the previously hard-coded `deriveLevel` ladder so
 * the rubric can be reviewed and versioned, not edited as magic numbers in the
 * engine). Behaviour is unchanged: `v1-full` reproduces the exact thresholds.
 *
 * To revise the rubric: add a NEW entry to RUBRICS (e.g. `v2-...`) and flip
 * ACTIVE_RUBRIC_VERSION. The two versions coexist; every score records the
 * `rubric_version` + the per-gate `criteria` it was derived from, so changing the
 * active rubric never rewrites the audit trail of past scores. The engine derives
 * the same gated-climb level from whichever rubric it is given (deterministic).
 */
import type { MaturityLevel } from "@heuresys/shared";

/** Gate metrics — a subset of MaturityMetrics keys (composite is 0..100, the rest 0..1). */
export type GateMetric = "composite" | "skillCoverage" | "kpiAchievement" | "readinessCoverage" | "majorGapRatio";
export type GateOperator = ">=" | "==";

export interface RubricGate {
  metric: GateMetric;
  operator: GateOperator;
  threshold: number;
}
export interface RubricRung {
  level: MaturityLevel;
  /** All gates must pass to achieve the level (AND). L0 is the gate-less floor. */
  gates: RubricGate[];
}
export interface MaturityRubric {
  version: string;
  /** Ordered low→high (L0..L5). The achieved level is the highest contiguous rung whose gates all pass. */
  ladder: RubricRung[];
}

/** v1-full — the original rubric (bands + gate criteria), thresholds verbatim. */
export const V1_FULL: MaturityRubric = {
  version: "v1-full",
  ladder: [
    { level: "L0", gates: [] },
    { level: "L1", gates: [{ metric: "composite", operator: ">=", threshold: 20 }] },
    { level: "L2", gates: [{ metric: "composite", operator: ">=", threshold: 40 }, { metric: "skillCoverage", operator: ">=", threshold: 0.4 }] },
    { level: "L3", gates: [{ metric: "composite", operator: ">=", threshold: 55 }, { metric: "kpiAchievement", operator: ">=", threshold: 0.7 }, { metric: "skillCoverage", operator: ">=", threshold: 0.6 }] },
    { level: "L4", gates: [{ metric: "composite", operator: ">=", threshold: 70 }, { metric: "kpiAchievement", operator: ">=", threshold: 0.85 }, { metric: "readinessCoverage", operator: ">=", threshold: 0.5 }] },
    { level: "L5", gates: [{ metric: "composite", operator: ">=", threshold: 85 }, { metric: "kpiAchievement", operator: ">=", threshold: 0.85 }, { metric: "readinessCoverage", operator: ">=", threshold: 0.5 }, { metric: "majorGapRatio", operator: "==", threshold: 0 }] },
  ],
};

/** All known rubric versions. Add a new entry to author a revision (e.g. `v2-strict`). */
export const RUBRICS: Record<string, MaturityRubric> = {
  "v1-full": V1_FULL,
};

/** The rubric the engine scores with today. Flip to a new version to revise the rubric. */
export const ACTIVE_RUBRIC_VERSION = "v1-full";

export function getRubric(version: string): MaturityRubric {
  const r = RUBRICS[version];
  if (!r) throw new Error(`Unknown maturity rubric version: ${version}`);
  return r;
}
