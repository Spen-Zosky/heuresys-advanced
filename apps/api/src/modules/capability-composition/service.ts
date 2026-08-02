/**
 * apps/api/src/modules/capability-composition/service.ts
 * MLCE Phase-1 — deterministic, in-platform bottom-up capability composition.
 *
 * EMPLOYEE (leaf): weighted skill coverage vs the PRIMARY-ACTIVE position's required
 *   skills — s_i = clamp(heldRank/requiredRank, 0..1), effW_i = weight_i ×
 *   criticalityFactor; value = 100·Σ(effW·s)/Σ(effW); coverage = % required skills held.
 * POSITION: FTE-weighted mean of its incumbents' employee scores.
 * ORG_UNIT: hierarchical weighted mean of its DIRECT positions (weight =
 *   compensation-band percentile, falling back to criticalityFactor) + its DIRECT child OUs
 *   (weight = the child's subtree weight-mass) — mathematically the flat
 *   subtree-weighted mean, computed via post-order DFS for clean lineage.
 * ORG: weight-mass-weighted mean of the tenant's root OUs.
 * Every aggregate is reproducible from its lineage arcs (frozen child value +
 * effective normalized weight). No ML, no external service, no clock in the math.
 */
import { pool, withTransaction } from "../../db/client.js";
import { ForbiddenError, NotFoundError } from "../../errors/index.js";
import type { ActorContext } from "../../lib/actor.js";
import { isPlatform } from "../../lib/actor.js";
import { resolveOrgReadScope, canReadOrgTarget } from "../../lib/scope/resolver.js";
import type {
  CapabilityScore, CapabilityScoreListResponse, CapabilityRecomputeResponse,
  CapabilitySubjectType, CapabilityScope,
  EssentialCapabilityRanking, EssentialCapabilityItem,
  VrioScorecard, VrioCapabilityItem, VrioVerdict,
} from "@heuresys/shared";
import {
  ESSENTIAL_CAPABILITY_WEIGHTS as W,
  VRIO_VALUE_WEIGHTS as VW,
  VRIO_INIMITABILITY_WEIGHTS as IW,
  VRIO_THRESHOLDS as VT,
  VRIO_MAX_PROFICIENCY_RANK,
} from "@heuresys/shared";
import * as repo from "./repository.js";
import type { ScoringInputs, ScoreRow, LineageRow } from "./repository.js";

export type { ActorContext };

const MODEL_VERSION = "capability-composition-v1";
const MODE = "WEIGHTED_AVG" as const;

const clamp = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x));
const round2 = (x: number): number => Math.round(x * 100) / 100;
const round4 = (x: number): number => Math.round(x * 10000) / 10000;

function criticalityFactor(c: string | null): number {
  switch (c) {
    case "CRITICAL": return 2.0;
    case "HIGH": return 1.5;
    case "MEDIUM": return 1.0;
    case "LOW": return 0.5;
    default: return 1.0;
  }
}

/** Same span as criticalityFactor, so the two bases stay interchangeable in the roll-up. */
const ECONOMIC_WEIGHT_MIN = 0.5;
const ECONOMIC_WEIGHT_MAX = 2.0;

/**
 * Aggregation mass per position, derived from the compensation band (#88).
 *
 * The band is the SAME economic base already used by F1 (essential ranking) and F2 (VRIO), so
 * the platform keeps one notion of economic value instead of three. It replaces
 * `sys_positions.position_economic_weight`, which is NULL on every row: the old
 * `COALESCE(economicWeight, criticalityFactor, 1)` therefore always fell through to criticality,
 * and criticality is MEDIUM on 160 of 181 positions — so the org-unit roll-up was an unweighted
 * mean wearing the clothes of a weighted one.
 *
 * Normalized by PERCENTILE within the tenant rather than by an absolute EUR scale: a band mid-point
 * means nothing on its own (34k and 220k are both "normal" in their own market), and the percentile
 * is what makes the weight comparable across tenants with different pay levels. Same reasoning as
 * the F2 correction, where absolute thresholds collapsed the whole scorecard onto one dimension.
 *
 * A position with no band falls back to its criticality factor — never to zero, which would silently
 * delete it from its unit's average.
 */
function economicWeightScale(positions: Array<{ economicBaseEur: number | null }>) {
  const bases = positions
    .map((p) => p.economicBaseEur)
    .filter((b): b is number => b !== null)
    .sort((a, b) => a - b);
  return (position: { economicBaseEur: number | null; criticality: string | null }): number => {
    const base = position.economicBaseEur;
    if (base === null || bases.length === 0) return criticalityFactor(position.criticality);
    if (bases.length === 1) return (ECONOMIC_WEIGHT_MIN + ECONOMIC_WEIGHT_MAX) / 2;
    const below = bases.filter((b) => b < base).length;
    const percentile = below / (bases.length - 1);
    const clamped = percentile > 1 ? 1 : percentile;
    return ECONOMIC_WEIGHT_MIN + (ECONOMIC_WEIGHT_MAX - ECONOMIC_WEIGHT_MIN) * clamped;
  };
}

function buildScope(actor: ActorContext): CapabilityScope {
  if (isPlatform(actor)) return { kind: "PLATFORM", tenantId: null };
  if (!actor.tenantId) throw new ForbiddenError("Tenant context required", "TENANT_REQUIRED");
  return { kind: "TENANT", tenantId: actor.tenantId };
}

/* ------------------------- pure compute (one tenant) ------------------------- */

interface Aggregate { value: number; coverage: number; weightMass: number }

/** Computes all four levels for one tenant. Pure + deterministic (no I/O, no clock). */
export function computeTenant(inputs: ScoringInputs): { scores: ScoreRow[]; lineage: LineageRow[] } {
  const { tenantId } = inputs;
  const scores: ScoreRow[] = [];
  const lineage: LineageRow[] = [];

  // Indexes.
  const reqByPosition = new Map<string, repo.RequirementInput[]>();
  for (const r of inputs.requirements) {
    const arr = reqByPosition.get(r.positionId) ?? [];
    arr.push(r); reqByPosition.set(r.positionId, arr);
  }
  const heldByUser = new Map<string, Map<string, number>>();
  for (const h of inputs.held) {
    const m = heldByUser.get(h.userId) ?? new Map<string, number>();
    m.set(h.skillId, h.heldRank); heldByUser.set(h.userId, m);
  }
  const incumbentsByPosition = new Map<string, repo.AssignmentInput[]>();
  for (const a of inputs.assignments) {
    const arr = incumbentsByPosition.get(a.positionId) ?? [];
    arr.push(a); incumbentsByPosition.set(a.positionId, arr);
  }
  const positionsByOu = new Map<string, string[]>();
  for (const p of inputs.positions) {
    if (!p.ouId) continue;
    const arr = positionsByOu.get(p.ouId) ?? [];
    arr.push(p.positionId); positionsByOu.set(p.ouId, arr);
  }
  const ouIds = new Set(inputs.orgUnits.map((o) => o.id));
  const childOus = new Map<string, string[]>();
  const rootOus: string[] = [];
  for (const o of inputs.orgUnits) {
    if (o.parentId && ouIds.has(o.parentId)) {
      const arr = childOus.get(o.parentId) ?? [];
      arr.push(o.id); childOus.set(o.parentId, arr);
    } else {
      rootOus.push(o.id); // root or orphaned parent -> treat as root
    }
  }

  // ---- EMPLOYEE leaf scores ----
  const employeeValue = new Map<string, Aggregate>(); // keyed userId (one PRIMARY-ACTIVE per user)
  for (const a of [...inputs.assignments].sort((x, y) => (x.userId < y.userId ? -1 : 1))) {
    const reqs = reqByPosition.get(a.positionId);
    if (!reqs || reqs.length === 0) continue; // no requirement basis -> not scoreable
    const held = heldByUser.get(a.userId);
    let sumEff = 0, sumEffS = 0, covered = 0;
    const skillDetail: Array<{ skillId: string; requiredRank: number; heldRank: number; s: number; effWeight: number }> = [];
    for (const r of [...reqs].sort((x, y) => (x.skillId < y.skillId ? -1 : 1))) {
      const heldRank = held?.get(r.skillId) ?? 0;
      const s = r.requiredRank > 0 ? clamp(heldRank / r.requiredRank, 0, 1) : 0;
      const effWeight = r.weight * criticalityFactor(r.criticality);
      sumEff += effWeight; sumEffS += effWeight * s;
      if (heldRank > 0) covered += 1;
      skillDetail.push({ skillId: r.skillId, requiredRank: r.requiredRank, heldRank, s: round4(s), effWeight: round4(effWeight) });
    }
    // All-zero weights -> simple average of s (equal weight) to avoid div-by-zero.
    const value = sumEff > 0 ? 100 * (sumEffS / sumEff) : 100 * (skillDetail.reduce((acc, d) => acc + d.s, 0) / skillDetail.length);
    const coverage = 100 * (covered / reqs.length);
    employeeValue.set(a.userId, { value: round2(clamp(value, 0, 100)), coverage: round2(clamp(coverage, 0, 100)), weightMass: a.fte });
    scores.push({
      tenantId, subjectType: "EMPLOYEE", subjectId: a.userId,
      value: round2(clamp(value, 0, 100)), coverage: round2(clamp(coverage, 0, 100)),
      aggregationMode: MODE, modelVersion: MODEL_VERSION, childCount: 0,
      payload: { derivation: { ruleId: "capability-composition-v1", aggregationMode: MODE, positionId: a.positionId, requiredSkillCount: reqs.length, coveredCount: covered, skills: skillDetail } },
    });
  }

  // ---- POSITION scores (FTE-weighted over incumbents that have an employee score) ----
  // The scale is built over ALL active positions of the tenant, not only the scoreable ones:
  // a vacant position still says something about where the money sits in this organization.
  const weightOf = economicWeightScale(inputs.positions);
  const positionValue = new Map<string, Aggregate>();
  for (const p of [...inputs.positions].sort((x, y) => (x.positionId < y.positionId ? -1 : 1))) {
    const incumbents = (incumbentsByPosition.get(p.positionId) ?? [])
      .filter((a) => employeeValue.has(a.userId))
      .sort((x, y) => (x.userId < y.userId ? -1 : 1));
    if (incumbents.length === 0) continue; // vacant / unscoreable -> drop (D3-B)
    const totalFte = incumbents.reduce((acc, a) => acc + a.fte, 0);
    const denom = totalFte > 0 ? totalFte : incumbents.length; // FTE all-zero -> equal weight
    let v = 0, c = 0;
    for (const a of incumbents) {
      const ev = employeeValue.get(a.userId)!;
      const w = totalFte > 0 ? a.fte : 1;
      v += w * ev.value; c += w * ev.coverage;
      lineage.push({ tenantId, parentType: "POSITION", parentId: p.positionId, childType: "EMPLOYEE", childId: a.userId, childValue: ev.value, weight: round4(w / denom) });
    }
    const value = round2(clamp(v / denom, 0, 100));
    const coverage = round2(clamp(c / denom, 0, 100));
    const wMass = weightOf(p);
    positionValue.set(p.positionId, { value, coverage, weightMass: wMass });
    scores.push({
      tenantId, subjectType: "POSITION", subjectId: p.positionId, value, coverage,
      aggregationMode: MODE, modelVersion: MODEL_VERSION, childCount: incumbents.length,
      payload: { derivation: { ruleId: "capability-composition-v1", aggregationMode: MODE, weightMass: round4(wMass), inputs: incumbents.map((a) => ({ childType: "EMPLOYEE", childId: a.userId, childValue: employeeValue.get(a.userId)!.value, fte: a.fte })) } },
    });
  }

  // ---- ORG_UNIT scores (post-order DFS; weight-mass = subtree position-weight) ----
  const ouAgg = new Map<string, Aggregate>();
  const visiting = new Set<string>();
  function computeOu(ouId: string): Aggregate | null {
    if (ouAgg.has(ouId)) return ouAgg.get(ouId)!;
    if (visiting.has(ouId)) return null; // cycle guard
    visiting.add(ouId);
    const terms: Array<{ childType: CapabilitySubjectType; childId: string; value: number; coverage: number; weight: number }> = [];
    // direct positions
    for (const posId of (positionsByOu.get(ouId) ?? []).slice().sort()) {
      const pv = positionValue.get(posId);
      if (!pv) continue;
      terms.push({ childType: "POSITION", childId: posId, value: pv.value, coverage: pv.coverage, weight: pv.weightMass });
    }
    // direct child OUs
    for (const childId of (childOus.get(ouId) ?? []).slice().sort()) {
      const ca = computeOu(childId);
      if (!ca || ca.weightMass <= 0) continue;
      terms.push({ childType: "ORG_UNIT", childId, value: ca.value, coverage: ca.coverage, weight: ca.weightMass });
    }
    visiting.delete(ouId);
    const totalMass = terms.reduce((acc, t) => acc + t.weight, 0);
    if (totalMass <= 0) { ouAgg.set(ouId, { value: 0, coverage: 0, weightMass: 0 }); return ouAgg.get(ouId)!; }
    let v = 0, c = 0;
    for (const t of terms) {
      v += t.weight * t.value; c += t.weight * t.coverage;
      lineage.push({ tenantId, parentType: "ORG_UNIT", parentId: ouId, childType: t.childType, childId: t.childId, childValue: t.value, weight: round4(t.weight / totalMass) });
    }
    const agg: Aggregate = { value: round2(clamp(v / totalMass, 0, 100)), coverage: round2(clamp(c / totalMass, 0, 100)), weightMass: totalMass };
    ouAgg.set(ouId, agg);
    scores.push({
      tenantId, subjectType: "ORG_UNIT", subjectId: ouId, value: agg.value, coverage: agg.coverage,
      aggregationMode: MODE, modelVersion: MODEL_VERSION, childCount: terms.length,
      payload: { derivation: { ruleId: "capability-composition-v1", aggregationMode: MODE, weightMass: round4(totalMass), inputs: terms.map((t) => ({ childType: t.childType, childId: t.childId, childValue: t.value, weight: round4(t.weight / totalMass) })) } },
    });
    return agg;
  }
  for (const o of [...inputs.orgUnits].sort((x, y) => (x.id < y.id ? -1 : 1))) computeOu(o.id);

  // ---- ORG score (weight-mass-weighted over root OUs with a score) ----
  const rootTerms = rootOus.slice().sort()
    .map((id) => ({ id, agg: ouAgg.get(id) }))
    .filter((r): r is { id: string; agg: Aggregate } => !!r.agg && r.agg.weightMass > 0);
  const orgMass = rootTerms.reduce((acc, r) => acc + r.agg.weightMass, 0);
  if (orgMass > 0) {
    let v = 0, c = 0;
    for (const r of rootTerms) {
      v += r.agg.weightMass * r.agg.value; c += r.agg.weightMass * r.agg.coverage;
      lineage.push({ tenantId, parentType: "ORG", parentId: tenantId, childType: "ORG_UNIT", childId: r.id, childValue: r.agg.value, weight: round4(r.agg.weightMass / orgMass) });
    }
    scores.push({
      tenantId, subjectType: "ORG", subjectId: tenantId,
      value: round2(clamp(v / orgMass, 0, 100)), coverage: round2(clamp(c / orgMass, 0, 100)),
      aggregationMode: MODE, modelVersion: MODEL_VERSION, childCount: rootTerms.length,
      payload: { derivation: { ruleId: "capability-composition-v1", aggregationMode: MODE, inputs: rootTerms.map((r) => ({ childType: "ORG_UNIT", childId: r.id, childValue: r.agg.value, weight: round4(r.agg.weightMass / orgMass) })) } },
    });
  }

  return { scores, lineage };
}

/* --------------------- #56 F2 — VRIO pure compute --------------------- */

/** Rank used only to order the scorecard: strongest strategic position first, gaps last. */
const VERDICT_RANK: Record<VrioVerdict, number> = {
  SUSTAINED_ADVANTAGE: 6,
  UNUSED_ADVANTAGE: 5,
  TEMPORARY_ADVANTAGE: 4,
  PARITY: 3,
  DISADVANTAGE: 2,
  CAPABILITY_GAP: 1,
};

/**
 * Tie-aware percentile of v within xs, in [0,1]. Same construction already used for the
 * economic component in F1, lifted here to every dimension.
 */
function percentileIn(xs: number[], v: number): number {
  if (xs.length <= 1) return 0.5;
  const below = xs.filter((x) => x < v).length;
  return below / (xs.length - 1);
}

/**
 * Classifies every in-play capability. Pure and deterministic: no I/O, no clock.
 * Each dimension lands in [0,1]; the verdict is the Barney lattice read over the
 * thresholds, never an average of the four.
 */
export function computeVrio(inputs: repo.VrioInputs): VrioCapabilityItem[] {
  const { headcount, groups } = inputs;

  // Economic percentile over the in-play set (tie-aware), same construction as F1.
  const econVals = groups
    .map((g) => g.avgEcon)
    .filter((v): v is number => v !== null)
    .sort((a, b) => a - b);
  const econPercentile = (v: number | null): number => {
    if (v === null) return 0; // no band on any requiring position -> no economic evidence
    if (econVals.length <= 1) return 0.5;
    const below = econVals.filter((x) => x < v).length;
    return below / (econVals.length - 1);
  };

  // ---- pass 1: the raw measures ----
  const raw = groups.map((g) => {
    const econ = econPercentile(g.avgEcon);
    const crit = clamp(g.critShare, 0, 1);
    const depth = g.avgHeldRank === null ? 0 : clamp(g.avgHeldRank / VRIO_MAX_PROFICIENCY_RANK, 0, 1);
    return {
      g,
      econ,
      crit,
      // Valuable = the org pays well for the positions that demand it, and they are critical.
      value: clamp(VW.econ * econ + VW.crit * crit, 0, 1),
      // Rare = few people hold it relative to the workforce.
      rarity: headcount > 0 ? clamp(1 - g.holders / headcount, 0, 1) : 0,
      // Hard to imitate = deep mastery, verified, backed by documented evidence.
      inimitability: clamp(
        IW.depth * depth + IW.verified * clamp(g.verifiedShare, 0, 1) + IW.evidence * clamp(g.evidenceShare, 0, 1),
        0, 1,
      ),
      // Organized = the demand is actually met by the people sitting in those positions.
      organization: g.totalRequirements > 0 ? clamp(g.coveredRequirements / g.totalRequirements, 0, 1) : 0,
    };
  });

  // ---- pass 2: rank each dimension across the org's own capability set ----
  // Absolute cuts do not work here: measured on live data three of the four raw scales sit
  // entirely above 0.5, which would mark them "present" everywhere and collapse the verdict
  // onto Value alone. Percentiles give four axes that actually separate.
  const sortedAsc = (pick: (r: (typeof raw)[number]) => number) => raw.map(pick).sort((a, b) => a - b);
  const dist = {
    value: sortedAsc((r) => r.value),
    rarity: sortedAsc((r) => r.rarity),
    inimitability: sortedAsc((r) => r.inimitability),
    organization: sortedAsc((r) => r.organization),
  };

  const items = raw.map(({ g, econ, crit, ...m }): VrioCapabilityItem => {
    const value = percentileIn(dist.value, m.value);
    const rarity = percentileIn(dist.rarity, m.rarity);
    const inimitability = percentileIn(dist.inimitability, m.inimitability);
    const organization = percentileIn(dist.organization, m.organization);

    const isValuable = value >= VT.value;
    const isRare = rarity >= VT.rarity;
    const isInimitable = inimitability >= VT.inimitability;
    const isOrganized = organization >= VT.organization;

    // A capability the organization demands but nobody holds is an absence, not a rare asset:
    // raw rarity would read 1.0 and flatter it into an "advantage". Classify it as the gap it is.
    const isGap = g.holders === 0 && g.positionsRequiring > 0;

    const verdict: VrioVerdict =
      isGap ? "CAPABILITY_GAP"
      : !isValuable ? "DISADVANTAGE"
      : !isRare ? "PARITY"
      : !isInimitable ? "TEMPORARY_ADVANTAGE"
      : !isOrganized ? "UNUSED_ADVANTAGE"
      : "SUSTAINED_ADVANTAGE";

    return {
      skillGroupId: g.skillGroupId,
      skillGroupName: g.skillGroupName,
      skillCount: g.skillCount,
      value: round4(value),
      rarity: round4(rarity),
      inimitability: round4(inimitability),
      organization: round4(organization),
      isValuable, isRare, isInimitable, isOrganized, verdict,
      evidence: {
        valueRaw: round4(m.value),
        rarityRaw: round4(m.rarity),
        inimitabilityRaw: round4(m.inimitability),
        organizationRaw: round4(m.organization),
        positionsRequiring: g.positionsRequiring,
        criticalPositions: g.criticalPositions,
        avgCompensationBandEur: g.avgEcon === null ? null : round2(g.avgEcon),
        econPercentile: round4(econ),
        criticalityShare: round4(crit),
        holders: g.holders,
        headcount,
        avgHeldRank: g.avgHeldRank === null ? null : round2(g.avgHeldRank),
        verifiedShare: round4(clamp(g.verifiedShare, 0, 1)),
        evidenceShare: round4(clamp(g.evidenceShare, 0, 1)),
        totalRequirements: g.totalRequirements,
        coveredRequirements: g.coveredRequirements,
      },
    };
  });

  // Strongest strategic position first; ties by value, then name for a stable order.
  items.sort(
    (a, b) =>
      VERDICT_RANK[b.verdict] - VERDICT_RANK[a.verdict] ||
      b.value - a.value ||
      a.skillGroupName.localeCompare(b.skillGroupName),
  );
  return items;
}

/* ------------------------------- service API ------------------------------- */

function toScore(row: repo.ActiveScoreRow, lineage: repo.ActiveLineageRow[]): CapabilityScore {
  return {
    subjectType: row.subjectType, subjectId: row.subjectId, tenantId: row.tenantId,
    label: row.label, value: row.value, coverage: row.coverage,
    aggregationMode: row.aggregationMode as CapabilityScore["aggregationMode"],
    modelVersion: row.modelVersion, childCount: row.childCount,
    computedAt: row.computedAt.toISOString(),
    lineage: lineage.map((l) => ({ childType: l.childType, childId: l.childId, childLabel: l.childLabel, childValue: l.childValue, weight: l.weight })),
  };
}

export const capabilityCompositionService = {
  async recompute(actor: ActorContext): Promise<CapabilityRecomputeResponse> {
    const scope = buildScope(actor);
    const tenantIds = scope.kind === "PLATFORM"
      ? await repo.loadActiveTenantIds()
      : [scope.tenantId as string];
    const counts = { employee: 0, position: 0, orgUnit: 0, org: 0, total: 0 };
    for (const tenantId of tenantIds) {
      const inputs = await repo.loadScoringInputs(tenantId);
      const { scores, lineage } = computeTenant(inputs);
      await withTransaction(async (client) => {
        await repo.replaceScores(client, tenantId, scores);
        await repo.replaceLineage(client, tenantId, lineage);
      });
      for (const s of scores) {
        if (s.subjectType === "EMPLOYEE") counts.employee += 1;
        else if (s.subjectType === "POSITION") counts.position += 1;
        else if (s.subjectType === "ORG_UNIT") counts.orgUnit += 1;
        else counts.org += 1;
      }
      counts.total += scores.length;
    }
    return { accepted: true, scored: counts, modelVersion: MODEL_VERSION, computedAt: new Date().toISOString() };
  },

  async composition(actor: ActorContext, subjectType?: CapabilitySubjectType): Promise<CapabilityScoreListResponse> {
    const scope = buildScope(actor);
    // ADR-0027 F3 (D-50): EMPLOYEE (per-person) capability scores are SENSITIVE (SKILL) data.
    // Resolve the actor's organizational read-scope; for non-mandated / non-platform actors this
    // narrows the EMPLOYEE rows to their org sub-tree (self only for a non-managerial actor).
    const orgScope = await resolveOrgReadScope(pool, actor);
    const userIdAllowList =
      orgScope.kind === "subtree" || orgScope.kind === "self" ? orgScope.userIdAllowList : undefined;
    const rows = await repo.listActiveScores({ tenantId: scope.tenantId, userIdAllowList }, subjectType);
    return {
      scope,
      items: rows.map((r) => toScore(r, [])),
      total: rows.length,
      generatedAt: new Date().toISOString(),
    };
  },

  /**
   * #55 F1 — Essential Capability Ranker. Ranks the skills the org depends on by
   * investment priority = essentiality · (1 − maturity), where essentiality blends the
   * economic value, criticality and scarcity of the skill's demand (declared weights).
   * Org-wide aggregate (no per-person data), so tenant scope only — no org-axis gate.
   */
  async essentialRanking(actor: ActorContext): Promise<EssentialCapabilityRanking> {
    const scope = buildScope(actor);
    const rows = await repo.loadEssentialRankInputs(scope.tenantId);
    const items: EssentialCapabilityItem[] = rows.map((r) => {
      const essentiality = W.econ * r.econPercentile + W.crit * r.critShare + W.scarcity * r.scarcity;
      const essentialityScore = round2(essentiality * 100);
      const investmentPriority = round2(essentiality * (1 - r.maturity) * 100);
      return {
        skillId: r.skillId,
        skillCode: r.skillCode,
        skillName: r.skillName,
        skillGroupId: r.skillGroupId,
        positionsRequiring: r.positionsRequiring,
        criticalPositions: r.criticalPositions,
        econ: round4(r.econPercentile),
        crit: round4(r.critShare),
        scarcity: round4(r.scarcity),
        maturity: round4(r.maturity),
        holders: r.holders,
        essentialityScore,
        investmentPriority,
      };
    });
    // Highest investment priority first; ties broken by essentiality then name for a stable order.
    items.sort(
      (a, b) =>
        b.investmentPriority - a.investmentPriority ||
        b.essentialityScore - a.essentialityScore ||
        a.skillName.localeCompare(b.skillName),
    );
    return { items, total: items.length, weights: { econ: W.econ, crit: W.crit, scarcity: W.scarcity } };
  },

  /**
   * #56 F2 — VRIO scorecard. Classifies each capability (skill group) the organization
   * actually uses into Barney's lattice. Org-wide aggregate over skill-group totals — no
   * per-person figure is exposed, so tenant scope alone gates it (no org-axis narrowing).
   */
  async vrioScorecard(actor: ActorContext): Promise<VrioScorecard> {
    const scope = buildScope(actor);
    const inputs = await repo.loadVrioInputs(scope.tenantId);
    const items = computeVrio(inputs);
    const summary: VrioScorecard["summary"] = {
      CAPABILITY_GAP: 0, DISADVANTAGE: 0, PARITY: 0, TEMPORARY_ADVANTAGE: 0, UNUSED_ADVANTAGE: 0,
      SUSTAINED_ADVANTAGE: 0,
    };
    for (const i of items) summary[i.verdict] += 1;
    return {
      items,
      total: items.length,
      headcount: inputs.headcount,
      summary,
      thresholds: { ...VT },
      weights: { value: { ...VW }, inimitability: { ...IW } },
      generatedAt: new Date().toISOString(),
    };
  },

  async subject(actor: ActorContext, subjectType: CapabilitySubjectType, subjectId: string): Promise<CapabilityScore> {
    const scope = buildScope(actor);
    const row = await repo.getActiveScore(scope, subjectType, subjectId);
    if (!row) throw new NotFoundError("Capability score", "CAPABILITY_SCORE_NOT_FOUND");
    // ADR-0027 F3 (D-50): an individual EMPLOYEE score is sensitive per-person data — gate it by
    // the organizational axis (404 to avoid cross-subtree existence enumeration).
    if (subjectType === "EMPLOYEE" && !(await canReadOrgTarget(pool, actor, subjectId, row.tenantId))) {
      throw new NotFoundError("Capability score", "CAPABILITY_SCORE_NOT_FOUND");
    }
    const lineage = await repo.getActiveLineage(row.tenantId, subjectType, subjectId);
    return toScore(row, lineage);
  },
};
