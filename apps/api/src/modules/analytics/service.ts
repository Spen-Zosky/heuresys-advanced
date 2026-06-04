/**
 * apps/api/src/modules/analytics/service.ts
 * Role-gated BI analytics aggregator. Reuses the dashboard role→scope tiering
 * (PLATFORM / TENANT / TEAM) and the dashboard's owned-position lookup so the
 * analytics surface is scoped identically to the admin dashboard.
 */

import { pool } from "../../db/client.js";
import type { RoleCode } from "../../config/constants.js";
import type {
  WorkforceAnalyticsResponse,
  KpiAnalyticsResponse,
  AttendanceAnalyticsResponse,
} from "@heuresys/shared";
import * as repo from "./repository.js";
import { findOwnedPositionIds } from "../dashboard/repository.js";

export interface ActorContext {
  userId: string;
  tenantId: string | null;
  roles: RoleCode[];
}

type ScopeKind = "PLATFORM" | "TENANT" | "TEAM";

const PLATFORM_ROLES: RoleCode[] = ["PLATFORM_ADMIN"];
const TENANT_ROLES: RoleCode[] = [
  "TENANT_ADMIN",
  "BLUEPRINT_MANAGER",
  "HRMS_MANAGER",
  "PROCESS_OWNER",
];
const TEAM_ROLES: RoleCode[] = ["MANAGER"];

/** Highest scope tier the actor can see — mirrors dashboard/service.ts. */
function scopeKind(a: ActorContext): ScopeKind {
  if (a.roles.some((r) => PLATFORM_ROLES.includes(r))) return "PLATFORM";
  if (a.roles.some((r) => TENANT_ROLES.includes(r))) return "TENANT";
  if (a.roles.some((r) => TEAM_ROLES.includes(r))) return "TEAM";
  // RBAC gates this route to analytics:view; USER/READ_ONLY never reach here.
  return "TEAM";
}

async function buildScope(
  a: ActorContext,
): Promise<{ kind: ScopeKind; filter: repo.ScopeFilter; tenantId: string | null }> {
  const kind = scopeKind(a);
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
};
