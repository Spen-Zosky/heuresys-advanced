/**
 * apps/api/test/capability-maturity-rubric.test.ts — unit (no DB).
 * Gap#1 follow-up (c): the Maturity rubric is now a versioned, reviewable registry
 * (./rubric.ts) instead of magic numbers in the engine. These tests pin (a) the
 * faithful extraction of v1-full and (b) that deriveLevel stays behaviour-preserving
 * (explicit "v1-full" === default) so no score changes.
 */
import { describe, it, expect } from "vitest";
import { RUBRICS, V1_FULL, ACTIVE_RUBRIC_VERSION, getRubric } from "../src/modules/capability-maturity/rubric.js";
import { deriveLevel, type MaturityMetrics } from "../src/modules/capability-maturity/service.js";

describe("capability-maturity rubric registry (versioned, reviewable)", () => {
  it("v1-full is the active rubric with the original L0..L5 ladder", () => {
    expect(ACTIVE_RUBRIC_VERSION).toBe("v1-full");
    const r = getRubric("v1-full");
    expect(r.version).toBe("v1-full");
    expect(r.ladder.map((x) => x.level)).toEqual(["L0", "L1", "L2", "L3", "L4", "L5"]);
    expect(r).toBe(V1_FULL);
    expect(RUBRICS["v1-full"]).toBe(V1_FULL);
  });

  it("v1-full thresholds are the exact original bands (extraction is faithful)", () => {
    const byLevel = Object.fromEntries(V1_FULL.ladder.map((r) => [r.level, r.gates]));
    expect(byLevel.L0).toEqual([]);
    expect(byLevel.L1).toEqual([{ metric: "composite", operator: ">=", threshold: 20 }]);
    expect(byLevel.L2).toEqual([
      { metric: "composite", operator: ">=", threshold: 40 },
      { metric: "skillCoverage", operator: ">=", threshold: 0.4 },
    ]);
    expect(byLevel.L3).toEqual([
      { metric: "composite", operator: ">=", threshold: 55 },
      { metric: "kpiAchievement", operator: ">=", threshold: 0.7 },
      { metric: "skillCoverage", operator: ">=", threshold: 0.6 },
    ]);
    expect(byLevel.L4).toEqual([
      { metric: "composite", operator: ">=", threshold: 70 },
      { metric: "kpiAchievement", operator: ">=", threshold: 0.85 },
      { metric: "readinessCoverage", operator: ">=", threshold: 0.5 },
    ]);
    expect(byLevel.L5).toEqual([
      { metric: "composite", operator: ">=", threshold: 85 },
      { metric: "kpiAchievement", operator: ">=", threshold: 0.85 },
      { metric: "readinessCoverage", operator: ">=", threshold: 0.5 },
      { metric: "majorGapRatio", operator: "==", threshold: 0 },
    ]);
  });

  it("getRubric throws on an unknown version", () => {
    expect(() => getRubric("v2-nope")).toThrow(/Unknown maturity rubric version/);
  });

  it("deriveLevel is behaviour-preserving (explicit v1-full === default) + gated-climb", () => {
    const cases: MaturityMetrics[] = [
      { composite: 95, skillCoverage: 1, kpiAchievement: 0.9, readinessCoverage: 0.8, majorGapRatio: 0 },     // L5
      { composite: 95, skillCoverage: 1, kpiAchievement: 0.5, readinessCoverage: 0.8, majorGapRatio: 0 },     // KPI gate fails at L3 → gated downgrade to L2
      { composite: 10, skillCoverage: 0, kpiAchievement: 0, readinessCoverage: 0, majorGapRatio: 0 },         // L0
      { composite: 50, skillCoverage: 0.5, kpiAchievement: 0.6, readinessCoverage: 0.3, majorGapRatio: 0.2 }, // L2
    ];
    for (const m of cases) {
      expect(deriveLevel(m, "v1-full")).toEqual(deriveLevel(m));
    }
    expect(deriveLevel(cases[0]!).level).toBe("L5");
    expect(deriveLevel(cases[1]!).level).toBe("L2");
    expect(deriveLevel(cases[2]!).level).toBe("L0");
    expect(deriveLevel(cases[3]!).level).toBe("L2");
  });
});
