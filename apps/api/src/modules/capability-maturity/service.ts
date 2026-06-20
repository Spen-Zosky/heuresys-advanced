/**
 * apps/api/src/modules/capability-maturity/service.ts
 * Maturity engine Phase-2 — derives an L0..L5 maturity level per org-unit from the
 * MLCE composite + a CODED rubric (rubric_version 'v1-full'). The level is the
 * highest L whose composite band AND all gate criteria pass (gated downgrade →
 * audit-defensible). Every gate metric is live-derived (skill coverage from MLCE,
 * KPI achievement from sys_user_kpi_evidence, readiness from succession scores,
 * major-gap from skill-gap scores), aggregated over each OU's SUBTREE incumbents.
 * Deterministic + reproducible from deriveLevel(composite, metrics, rubricVersion).
 */
import { withTransaction } from "../../db/client.js";
import { ForbiddenError, NotFoundError } from "../../errors/index.js";
import type { ActorContext } from "../../lib/actor.js";
import { isPlatform } from "../../lib/actor.js";
import type {
  CapabilityScope, MaturityLevel, MaturityCriterion,
  CapabilityMaturityScore, CapabilityMaturityListResponse, CapabilityMaturityRecomputeResponse,
} from "@heuresys/shared";
import * as repo from "./repository.js";
import type { MaturityInputs, MaturityRow } from "./repository.js";

export type { ActorContext };

const MODEL_VERSION = "capability-maturity-v1";
const RUBRIC_VERSION = "v1-full";
const LEVEL_LABEL: Record<MaturityLevel, string> = {
  L0: "Ad-hoc", L1: "Initial", L2: "Repeatable", L3: "Defined", L4: "Managed", L5: "Optimizing",
};
const round4 = (x: number): number => Math.round(x * 10000) / 10000;

function buildScope(actor: ActorContext): CapabilityScope {
  if (isPlatform(actor)) return { kind: "PLATFORM", tenantId: null };
  if (!actor.tenantId) throw new ForbiddenError("Tenant context required", "TENANT_REQUIRED");
  return { kind: "TENANT", tenantId: actor.tenantId };
}

export interface MaturityMetrics {
  composite: number;        // 0..100 (MLCE)
  skillCoverage: number;    // 0..1
  kpiAchievement: number;   // 0..1
  readinessCoverage: number;// 0..1
  majorGapRatio: number;    // 0..1
}

interface Gate { metric: string; operator: ">=" | "=="; threshold: number; value: number }
const passes = (g: Gate): boolean => (g.operator === ">=" ? g.value >= g.threshold : g.value === g.threshold);

/** v1-full rubric: bands + gate criteria. Returns the achieved level + the full
 *  audited criteria list (every level's gates with met flags). Deterministic. */
export function deriveLevel(m: MaturityMetrics): { level: MaturityLevel; criteria: MaturityCriterion[] } {
  const ladder: Array<{ level: MaturityLevel; gates: Gate[] }> = [
    { level: "L0", gates: [] },
    { level: "L1", gates: [{ metric: "composite", operator: ">=", threshold: 20, value: m.composite }] },
    { level: "L2", gates: [{ metric: "composite", operator: ">=", threshold: 40, value: m.composite }, { metric: "skillCoverage", operator: ">=", threshold: 0.4, value: m.skillCoverage }] },
    { level: "L3", gates: [{ metric: "composite", operator: ">=", threshold: 55, value: m.composite }, { metric: "kpiAchievement", operator: ">=", threshold: 0.7, value: m.kpiAchievement }, { metric: "skillCoverage", operator: ">=", threshold: 0.6, value: m.skillCoverage }] },
    { level: "L4", gates: [{ metric: "composite", operator: ">=", threshold: 70, value: m.composite }, { metric: "kpiAchievement", operator: ">=", threshold: 0.85, value: m.kpiAchievement }, { metric: "readinessCoverage", operator: ">=", threshold: 0.5, value: m.readinessCoverage }] },
    { level: "L5", gates: [{ metric: "composite", operator: ">=", threshold: 85, value: m.composite }, { metric: "kpiAchievement", operator: ">=", threshold: 0.85, value: m.kpiAchievement }, { metric: "readinessCoverage", operator: ">=", threshold: 0.5, value: m.readinessCoverage }, { metric: "majorGapRatio", operator: "==", threshold: 0, value: m.majorGapRatio }] },
  ];
  const criteria: MaturityCriterion[] = [];
  let achieved: MaturityLevel = "L0";
  let stillClimbing = true;
  for (const rung of ladder) {
    const allMet = rung.gates.every(passes);
    for (const g of rung.gates) {
      criteria.push({ level: rung.level, label: LEVEL_LABEL[rung.level], met: passes(g), metric: g.metric, value: round4(g.value), threshold: g.threshold, operator: g.operator });
    }
    if (rung.level === "L0") { achieved = "L0"; continue; }
    if (stillClimbing && allMet) achieved = rung.level;
    else stillClimbing = false;
  }
  return { level: achieved, criteria };
}

/** Pure compute for one tenant: aggregate gate metrics over each OU's subtree
 *  incumbents, derive the level from its MLCE composite. Deterministic. */
export function computeTenant(inputs: MaturityInputs): MaturityRow[] {
  const ouIds = new Set(inputs.orgUnits.map((o) => o.id));
  const childOus = new Map<string, string[]>();
  for (const o of inputs.orgUnits) {
    if (o.parentId && ouIds.has(o.parentId)) {
      const arr = childOus.get(o.parentId) ?? []; arr.push(o.id); childOus.set(o.parentId, arr);
    }
  }
  const positionsByOu = new Map<string, string[]>();
  for (const p of inputs.positions) {
    if (!p.ouId) continue;
    const arr = positionsByOu.get(p.ouId) ?? []; arr.push(p.positionId); positionsByOu.set(p.ouId, arr);
  }
  const usersByPosition = new Map<string, string[]>();
  for (const a of inputs.assignments) {
    const arr = usersByPosition.get(a.positionId) ?? []; arr.push(a.userId); usersByPosition.set(a.positionId, arr);
  }

  // Subtree incumbents per OU (memoized DFS; cycle-guarded).
  const subtreeUsers = new Map<string, Set<string>>();
  const visiting = new Set<string>();
  function collect(ouId: string): Set<string> {
    const cached = subtreeUsers.get(ouId);
    if (cached) return cached;
    if (visiting.has(ouId)) return new Set();
    visiting.add(ouId);
    const set = new Set<string>();
    for (const posId of positionsByOu.get(ouId) ?? []) for (const u of usersByPosition.get(posId) ?? []) set.add(u);
    for (const child of childOus.get(ouId) ?? []) for (const u of collect(child)) set.add(u);
    visiting.delete(ouId);
    subtreeUsers.set(ouId, set);
    return set;
  }

  const rows: MaturityRow[] = [];
  for (const comp of [...inputs.composites].sort((a, b) => (a.ouId < b.ouId ? -1 : 1))) {
    const incumbents = [...collect(comp.ouId)];
    const n = incumbents.length;
    const kpiVals = incumbents.map((u) => inputs.kpiByUser.get(u)).filter((v): v is number => v !== undefined);
    const kpiAchievement = kpiVals.length > 0 ? kpiVals.reduce((a, b) => a + b, 0) / kpiVals.length : 0;
    const readinessCoverage = n > 0 ? incumbents.filter((u) => inputs.readyUsers.has(u)).length / n : 0;
    const majorGapRatio = n > 0 ? incumbents.filter((u) => inputs.majorGapUsers.has(u)).length / n : 0;
    const metrics: MaturityMetrics = {
      composite: comp.value, skillCoverage: comp.coverage / 100,
      kpiAchievement, readinessCoverage, majorGapRatio,
    };
    const { level, criteria } = deriveLevel(metrics);
    rows.push({
      tenantId: "", // set by recompute() per tenant (computeTenant is tenant-agnostic)
      orgUnitId: comp.ouId, capabilityRef: "OVERALL", level, composite: comp.value,
      rubricVersion: RUBRIC_VERSION, modelVersion: MODEL_VERSION,
      payload: { derivation: { ruleId: "capability-maturity-v1", rubricVersion: RUBRIC_VERSION, composite: comp.value, metrics: { skillCoverage: round4(metrics.skillCoverage), kpiAchievement: round4(kpiAchievement), readinessCoverage: round4(readinessCoverage), majorGapRatio: round4(majorGapRatio), incumbents: n }, criteria } },
    });
  }
  return rows;
}

function toScore(row: repo.ActiveMaturityRow): CapabilityMaturityScore {
  const criteria = Array.isArray((row.payload as { derivation?: { criteria?: MaturityCriterion[] } })?.derivation?.criteria)
    ? ((row.payload as { derivation: { criteria: MaturityCriterion[] } }).derivation.criteria)
    : [];
  return {
    orgUnitId: row.orgUnitId, tenantId: row.tenantId, orgUnitName: row.orgUnitName,
    capabilityRef: row.capabilityRef, level: row.level, levelLabel: LEVEL_LABEL[row.level],
    composite: row.composite, rubricVersion: row.rubricVersion, modelVersion: row.modelVersion,
    computedAt: row.computedAt.toISOString(), criteria,
  };
}

export const capabilityMaturityService = {
  async recompute(actor: ActorContext): Promise<CapabilityMaturityRecomputeResponse> {
    const scope = buildScope(actor);
    const tenantIds = scope.kind === "PLATFORM" ? await repo.loadActiveTenantIds() : [scope.tenantId as string];
    let scored = 0;
    for (const tenantId of tenantIds) {
      const inputs = await repo.loadMaturityInputs(tenantId);
      const rows = computeTenant(inputs).map((r) => ({ ...r, tenantId }));
      await withTransaction(async (client) => { await repo.replaceMaturity(client, tenantId, rows); });
      scored += rows.length;
    }
    return { accepted: true, scored, modelVersion: MODEL_VERSION, rubricVersion: RUBRIC_VERSION, computedAt: new Date().toISOString() };
  },

  async maturity(actor: ActorContext): Promise<CapabilityMaturityListResponse> {
    const scope = buildScope(actor);
    const rows = await repo.listActiveMaturity(scope);
    return { scope, items: rows.map(toScore), total: rows.length, generatedAt: new Date().toISOString() };
  },

  async orgUnit(actor: ActorContext, orgUnitId: string): Promise<CapabilityMaturityScore> {
    const scope = buildScope(actor);
    const row = await repo.getActiveMaturityByOrgUnit(scope, orgUnitId);
    if (!row) throw new NotFoundError("Maturity score", "MATURITY_SCORE_NOT_FOUND");
    return toScore(row);
  },
};
