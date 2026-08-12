/**
 * apps/api/src/modules/analytics/service.ts
 * Role-gated BI analytics aggregator. Reuses the dashboard role→scope tiering
 * (PLATFORM / TENANT / TEAM) and the dashboard's owned-position lookup so the
 * analytics surface is scoped identically to the admin dashboard.
 */

import { pool } from "../../db/client.js";
import { scopeTierOf } from "../../lib/scope/domains.js";
import { masksUnderPlatformMandate } from "../../lib/scope/mask.js";
import type { ActorContext } from "../../lib/actor.js";

export type { ActorContext };
import type {
  WorkforceAnalyticsResponse,
  KpiAnalyticsResponse,
  AttendanceAnalyticsResponse,
  CompensationAnalyticsResponse,
  SkillsCoverageAnalyticsResponse,
  SkillsCoverageProficiency,
  SkillsByCategoryAnalyticsResponse,
  SkillsByCategoryProficiency,
  OrgNetworkAnalyticsResponse,
  OvertimeAnalyticsResponse,
  OvertimeStatus,
  OvertimeType,
  SkillsGroupShareAnalyticsResponse,
  AnalyticsViewSlug,
} from "@heuresys/shared";
import * as repo from "./repository.js";
import { findOwnedPositionIds } from "../dashboard/repository.js";

type ScopeKind = "PLATFORM" | "TENANT" | "TEAM";

// #119 — le tre costanti di fascia stavano qui, identiche in tre moduli.
// La definizione unica vive in lib/scope/domains.ts.
/**
 * #119 — one definition, no fallback. This ladder was copy-pasted here, into
 * dashboard/service.ts and into insights/service.ts, and each copy ended in a
 * silent `return "TEAM"` that showed an empty page to anyone unmatched.
 */
function scopeKind(a: ActorContext): Promise<ScopeKind> {
  return scopeTierOf(pool, a, "analytics");
}

async function buildScope(
  a: ActorContext,
): Promise<{ kind: ScopeKind; filter: repo.ScopeFilter; tenantId: string | null }> {
  const kind = await scopeKind(a);
  const isPlatform = kind === "PLATFORM";
  const teamPositionIds =
    kind === "TEAM" ? await findOwnedPositionIds(pool, a.userId) : [];
  const tenantId = isPlatform ? null : a.tenantId;
  return {
    kind,
    tenantId,
    filter: { tenantId, teamPositionIds, isPlatformScope: isPlatform },
  };
}

export const analyticsService = {
  async workforce(a: ActorContext): Promise<WorkforceAnalyticsResponse> {
    const s = await buildScope(a);
    const w = await repo.getWorkforceTotals(pool, s.filter);
    return {
      scope: { kind: s.kind, tenantId: s.tenantId },
      totalHeadcount: w.total,
      byOrgUnit: w.byOrgUnit,
      byJobRole: w.byJobRole,
      generatedAt: new Date().toISOString(),
    };
  },

  async kpi(a: ActorContext): Promise<KpiAnalyticsResponse> {
    const s = await buildScope(a);
    const k = await repo.getKpiAchievement(pool, s.filter);
    return {
      scope: { kind: s.kind, tenantId: s.tenantId },
      totalTargets: k.totalTargets,
      distinctKpis: k.distinctKpis,
      byKpi: k.byKpi,
      generatedAt: new Date().toISOString(),
    };
  },

  async attendance(a: ActorContext): Promise<AttendanceAnalyticsResponse> {
    const s = await buildScope(a);
    const at = await repo.getAttendanceTotals(pool, s.filter);
    return {
      scope: { kind: s.kind, tenantId: s.tenantId },
      totalRegularHours: at.totalRegularHours,
      totalOvertimeHours: at.totalOvertimeHours,
      totalHours: at.totalHours,
      // Repo rows carry the bucket label as `dimension`; the monthly response
      // field is `month` (the by-OU field stays `dimension`).
      monthly: at.monthly.map((m) => ({
        month: m.dimension,
        regularHours: m.regularHours,
        overtimeHours: m.overtimeHours,
        totalHours: m.totalHours,
      })),
      byOrgUnit: at.byOrgUnit,
      generatedAt: new Date().toISOString(),
    };
  },

  async compensation(a: ActorContext): Promise<CompensationAnalyticsResponse> {
    const s = await buildScope(a);
    const c = await repo.getCompensationEquity(pool, s.filter);
    const base = {
      scope: { kind: s.kind, tenantId: s.tenantId },
      totalProfiles: c.totalProfiles,
      ouCount: c.ouCount,
      generatedAt: new Date().toISOString(),
    };

    // VINCOLO 5 (ADR-0032): un aggregato su una classe mascherata e' una fuga
    // aritmetica. Qui non e' teorico — MISURATO 2026-08-12: 280 posizioni su 299
    // hanno UN SOLO titolare, quindi ogni punto dello scatter (titolo, banda,
    // mediana) E' la retribuzione di quella persona, e il mandato tecnico di
    // piattaforma non deve leggerla. Restano visibili i CONTEGGI (quante
    // posizioni, quante unita'): dicono la forma dell'organizzazione senza
    // dire quanto prende nessuno.
    if (masksUnderPlatformMandate(a, "COMPENSATION", null)) {
      return {
        ...base,
        masked: [
          "bandingByOu",
          "overallMaxMidEur",
          "overallMedianMidEur",
          "overallMinMidEur",
          "scatter",
        ],
      };
    }

    return {
      ...base,
      overallMinMidEur: c.overallMinMidEur,
      overallMaxMidEur: c.overallMaxMidEur,
      overallMedianMidEur: c.overallMedianMidEur,
      bandingByOu: c.bandingByOu,
      scatter: c.scatter,
    };
  },

  async skills(a: ActorContext): Promise<SkillsCoverageAnalyticsResponse> {
    const s = await buildScope(a);
    const sk = await repo.getSkillsCoverage(pool, s.filter);
    // Repo carries proficiency as string; the live values are guaranteed to be in
    // the enum (declared_proficiency CHECK) — narrow to the schema union here.
    return {
      scope: { kind: s.kind, tenantId: s.tenantId },
      orgUnits: sk.orgUnits,
      proficiencyLevels: sk.proficiencyLevels as SkillsCoverageProficiency[],
      cells: sk.cells.map((c) => ({
        orgUnit: c.orgUnit,
        proficiency: c.proficiency as SkillsCoverageProficiency,
        evidenceCount: c.evidenceCount,
        distinctUsers: c.distinctUsers,
      })),
      byProficiency: sk.byProficiency.map((b) => ({
        proficiency: b.proficiency as SkillsCoverageProficiency,
        evidenceCount: b.evidenceCount,
        distinctUsers: b.distinctUsers,
      })),
      totalEvidence: sk.totalEvidence,
      distinctUsers: sk.distinctUsers,
      distinctOrgUnits: sk.distinctOrgUnits,
      generatedAt: new Date().toISOString(),
    };
  },

  async skillsByCategory(a: ActorContext): Promise<SkillsByCategoryAnalyticsResponse> {
    const s = await buildScope(a);
    const sk = await repo.getSkillsByCategory(pool, s.filter);
    // Repo carries proficiency as string; the live values are guaranteed to be in
    // the enum (declared_proficiency CHECK) — narrow to the schema union here.
    return {
      scope: { kind: s.kind, tenantId: s.tenantId },
      categories: sk.categories,
      proficiencyLevels: sk.proficiencyLevels as SkillsByCategoryProficiency[],
      cells: sk.cells.map((c) => ({
        category: c.category,
        proficiency: c.proficiency as SkillsByCategoryProficiency,
        evidenceCount: c.evidenceCount,
        distinctUsers: c.distinctUsers,
      })),
      byCategory: sk.byCategory.map((b) => ({
        category: b.category,
        evidenceCount: b.evidenceCount,
        distinctUsers: b.distinctUsers,
      })),
      totalEvidence: sk.totalEvidence,
      distinctUsers: sk.distinctUsers,
      distinctCategories: sk.distinctCategories,
      generatedAt: new Date().toISOString(),
    };
  },

  async orgNetwork(a: ActorContext): Promise<OrgNetworkAnalyticsResponse> {
    const s = await buildScope(a);
    const o = await repo.getOrgNetwork(pool, s.filter);
    return {
      scope: { kind: s.kind, tenantId: s.tenantId },
      totalPositions: o.totalPositions,
      rootPositions: o.rootPositions,
      managersCount: o.managersCount,
      avgSpanOfControl: o.avgSpanOfControl,
      maxDepth: o.maxDepth,
      byDepth: o.byDepth,
      topSpan: o.topSpan,
      topReach: o.topReach,
      generatedAt: new Date().toISOString(),
    };
  },

  async overtime(a: ActorContext): Promise<OvertimeAnalyticsResponse> {
    const s = await buildScope(a);
    const o = await repo.getOvertimeRollups(pool, s.filter);
    // Repo carries status/type as string; the live values are guaranteed in the
    // CHECK domains — narrow to the schema unions here (same pattern as skills).
    return {
      scope: { kind: s.kind, tenantId: s.tenantId },
      totalRequests: o.totalRequests,
      totalHours: o.totalHours,
      totalCompensationEur: o.totalCompensationEur,
      byStatus: o.byStatus.map((r) => ({
        status: r.status as OvertimeStatus,
        count: r.count,
        hours: r.hours,
        compensationEur: r.compensationEur,
      })),
      byType: o.byType.map((r) => ({
        type: r.type as OvertimeType,
        count: r.count,
        hours: r.hours,
      })),
      monthly: o.monthly.map((m) => ({
        month: m.dimension,
        count: m.count,
        hours: m.hours,
      })),
      byOrgUnit: o.byOrgUnit.map((r) => ({
        dimension: r.dimension,
        count: r.count,
        hours: r.hours,
      })),
      generatedAt: new Date().toISOString(),
    };
  },

  // The ESCO skill catalogue is platform-global (tenantId=null), so the group
  // share is global; scope is reported for surface parity only (no tenant filter).
  async skillsGroupShare(a: ActorContext): Promise<SkillsGroupShareAnalyticsResponse> {
    const s = await buildScope(a);
    const g = await repo.getSkillsGroupShare(pool);
    return {
      scope: { kind: s.kind, tenantId: s.tenantId },
      groups: g.groups,
      otherGroupsCount: g.otherGroupsCount,
      otherSkillCount: g.otherSkillCount,
      totalSkills: g.totalSkills,
      totalGrouped: g.totalGrouped,
      ungroupedSkills: g.ungroupedSkills,
      distinctGroups: g.distinctGroups,
      generatedAt: new Date().toISOString(),
    };
  },

  /**
   * Export dispatcher — re-runs one of the 9 view aggregators by its route slug.
   * Returns the same scope-filtered payload the view endpoint returns; the route
   * layer serialises it to CSV or JSON. Slugs mirror AnalyticsViewSlugSchema and
   * the route segments in routes.ts.
   */
  async exportView(a: ActorContext, view: AnalyticsViewSlug): Promise<Record<string, unknown>> {
    switch (view) {
      case "workforce":
        return this.workforce(a);
      case "kpi":
        return this.kpi(a);
      case "attendance":
        return this.attendance(a);
      case "compensation":
        return this.compensation(a);
      case "skills":
        return this.skills(a);
      case "skills-by-category":
        return this.skillsByCategory(a);
      case "org-network":
        return this.orgNetwork(a);
      case "overtime":
        return this.overtime(a);
      case "skills-group-share":
        return this.skillsGroupShare(a);
    }
  },
};
