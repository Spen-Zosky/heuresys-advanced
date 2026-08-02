/**
 * apps/api/src/modules/org-health/service.ts
 * #57 F3 — organizational health index. Deterministic, declared composite; no ML.
 *
 * The composite is the weighted mean of the dimensions that HAVE data, with the declared
 * weights renormalized over exactly those. A missing dimension leaves the denominator; it
 * is never counted as zero, which would punish a unit for a hole in its instrumentation
 * rather than in its health. `coverage` reports how much of the model was available, and a
 * unit below ORG_HEALTH_MIN_COVERAGE gets no band at all — an index computed from a
 * sliver of the model is not a weak score, it is an unknown one.
 */
import { ForbiddenError } from "../../errors/index.js";
import type { ActorContext } from "../../lib/actor.js";
import { isPlatform } from "../../lib/actor.js";
import type {
  OrgHealthScorecard, OrgHealthUnit, OrgHealthDimension, OrgHealthDimensionScore, OrgHealthStatus,
} from "@heuresys/shared";
import {
  ORG_HEALTH_WEIGHTS as W,
  ORG_HEALTH_BANDS as B,
  ORG_HEALTH_MIN_COVERAGE,
  ORG_HEALTH_DIMENSIONS,
} from "@heuresys/shared";
import * as repo from "./repository.js";

export type { ActorContext };

const round2 = (x: number): number => Math.round(x * 100) / 100;
const round4 = (x: number): number => Math.round(x * 10000) / 10000;

function tenantScope(actor: ActorContext): string | null {
  if (isPlatform(actor)) return null;
  if (!actor.tenantId) throw new ForbiddenError("Tenant context required", "TENANT_REQUIRED");
  return actor.tenantId;
}

function bandFor(index: number): OrgHealthStatus {
  if (index >= B.strong) return "STRONG";
  if (index >= B.healthy) return "HEALTHY";
  if (index >= B.watch) return "WATCH";
  return "CRITICAL";
}

/** Pure: turns one repository row into a scored unit. No I/O, no clock. */
export function scoreUnit(row: repo.OrgHealthUnitRow): OrgHealthUnit {
  const raw: Record<OrgHealthDimension, { score: number | null; sample: number }> = {
    engagement: { score: row.engagementScore, sample: row.engagementSample },
    execution: { score: row.executionScore, sample: row.executionSample },
    retention: { score: row.retentionScore, sample: row.retentionSample },
    stability: { score: row.stabilityScore, sample: row.stabilitySample },
    performance: { score: row.performanceScore, sample: row.performanceSample },
    maturity: { score: row.maturityScore, sample: row.maturitySample },
  };

  // Weight actually available for this unit — the renormalization base.
  const availableWeight = ORG_HEALTH_DIMENSIONS.reduce(
    (acc, d) => acc + (raw[d].score === null ? 0 : W[d]),
    0,
  );
  const totalWeight = ORG_HEALTH_DIMENSIONS.reduce((acc, d) => acc + W[d], 0);
  const coverage = totalWeight > 0 ? availableWeight / totalWeight : 0;

  const dimensions: OrgHealthDimensionScore[] = ORG_HEALTH_DIMENSIONS.map((d) => {
    const { score, sample } = raw[d];
    return {
      dimension: d,
      score: score === null ? null : round4(Math.min(1, Math.max(0, score))),
      sampleSize: sample,
      effectiveWeight: score === null || availableWeight <= 0 ? 0 : round4(W[d] / availableWeight),
    };
  });

  let index: number | null = null;
  if (availableWeight > 0) {
    const weighted = ORG_HEALTH_DIMENSIONS.reduce((acc, d) => {
      const s = raw[d].score;
      return s === null ? acc : acc + W[d] * Math.min(1, Math.max(0, s));
    }, 0);
    index = round2(100 * (weighted / availableWeight));
  }

  // Too little of the model available -> the honest answer is "we don't know".
  const status: OrgHealthStatus =
    index === null || coverage < ORG_HEALTH_MIN_COVERAGE ? "INSUFFICIENT_DATA" : bandFor(index);

  return {
    orgUnitId: row.orgUnitId,
    orgUnitName: row.orgUnitName,
    headcount: row.headcount,
    // The index is reported even when coverage is too low to band it: the reader sees both
    // the number and the fact that it is not trustworthy yet.
    index,
    status,
    // Filled by rankUnits once the whole cohort is known — a rank needs the others.
    standing: "UNRANKED",
    percentile: null,
    coverage: round4(coverage),
    dimensions,
  };
}

/**
 * Assigns each banded unit its percentile and tercile standing among the others, and
 * reports the observed spread. Mutates the units in place and returns the distribution.
 *
 * This exists because the absolute band alone is not actionable: on live data the index
 * spans a narrow range and every unit lands healthy, so "where do I look first" has no
 * answer unless the units are also ranked against each other.
 */
function rankUnits(units: OrgHealthUnit[]): OrgHealthScorecard["distribution"] {
  const banded = units.filter(
    (u): u is OrgHealthUnit & { index: number } =>
      u.status !== "INSUFFICIENT_DATA" && u.index !== null,
  );
  if (banded.length === 0) return { min: null, median: null, max: null, spread: null };

  const sorted = banded.map((u) => u.index).sort((a, b) => a - b);
  const percentileOf = (v: number): number => {
    if (sorted.length <= 1) return 0.5;
    const below = sorted.filter((x) => x < v).length;
    return below / (sorted.length - 1);
  };

  for (const u of units) {
    if (u.status === "INSUFFICIENT_DATA" || u.index === null) {
      u.standing = "UNRANKED";
      u.percentile = null;
      continue;
    }
    const p = percentileOf(u.index);
    u.percentile = round4(p);
    u.standing = p >= 2 / 3 ? "LEADING" : p >= 1 / 3 ? "MIDDLE" : "LAGGING";
  }

  const mid = Math.floor(sorted.length / 2);
  const median =
    sorted.length % 2 === 1
      ? (sorted[mid] as number)
      : ((sorted[mid - 1] as number) + (sorted[mid] as number)) / 2;
  const min = sorted[0] as number;
  const max = sorted[sorted.length - 1] as number;
  return { min: round2(min), median: round2(median), max: round2(max), spread: round2(max - min) };
}

export const orgHealthService = {
  async scorecard(actor: ActorContext): Promise<OrgHealthScorecard> {
    const tenantId = tenantScope(actor);
    const rows = await repo.loadOrgHealthInputs(tenantId);
    const units = rows.map(scoreUnit);
    const distribution = rankUnits(units);

    const summary: OrgHealthScorecard["summary"] = {
      STRONG: 0, HEALTHY: 0, WATCH: 0, CRITICAL: 0, INSUFFICIENT_DATA: 0,
    };
    for (const u of units) summary[u.status] += 1;

    // Organization-level index: headcount-weighted over the units that carry a band.
    // Units with insufficient data are excluded rather than dragged in at face value.
    const banded = units.filter((u) => u.status !== "INSUFFICIENT_DATA" && u.index !== null);
    const mass = banded.reduce((acc, u) => acc + u.headcount, 0);
    const organizationIndex =
      banded.length === 0 ? null
      : mass > 0
        ? round2(banded.reduce((acc, u) => acc + u.headcount * (u.index as number), 0) / mass)
        : round2(banded.reduce((acc, u) => acc + (u.index as number), 0) / banded.length);

    // Weakest first: a health scorecard is read to find what needs attention.
    units.sort((a, b) => {
      if (a.index === null && b.index === null) return a.orgUnitName.localeCompare(b.orgUnitName);
      if (a.index === null) return 1;
      if (b.index === null) return -1;
      return a.index - b.index || a.orgUnitName.localeCompare(b.orgUnitName);
    });

    return {
      units,
      total: units.length,
      organizationIndex,
      summary,
      weights: { ...W },
      bands: { ...B },
      minCoverage: ORG_HEALTH_MIN_COVERAGE,
      distribution,
      generatedAt: new Date().toISOString(),
    };
  },
};
