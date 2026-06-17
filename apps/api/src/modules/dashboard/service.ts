/**
 * apps/api/src/modules/dashboard/service.ts
 * Role-gated aggregator: composes the dashboard widgets payload based on
 * actor role tier (PLATFORM / TENANT / TEAM).
 */

import { pool } from "../../db/client.js";
import type { ActorContext } from "../../lib/actor.js";

export type { ActorContext };
import type { RoleCode } from "../../config/constants.js";
import type {
  DashboardScopeKind,
  DashboardWidgetsResponse,
} from "@heuresys/shared";
import * as repo from "./repository.js";

const PLATFORM_ROLES: RoleCode[] = ["PLATFORM_ADMIN"];
const TENANT_ROLES: RoleCode[] = [
  "TENANT_ADMIN",
  "BLUEPRINT_MANAGER",
  "HRMS_MANAGER",
  "PROCESS_OWNER",
];
const TEAM_ROLES: RoleCode[] = ["MANAGER"];

/** Number of weekly buckets in the StatsCard sparkline series. */
const DASHBOARD_TREND_WEEKS = 8;

function highestScope(actor: ActorContext): DashboardScopeKind {
  if (actor.roles.some((r) => PLATFORM_ROLES.includes(r))) return "PLATFORM";
  if (actor.roles.some((r) => TENANT_ROLES.includes(r))) return "TENANT";
  if (actor.roles.some((r) => TEAM_ROLES.includes(r))) return "TEAM";
  // Fallback — caller is gated by RBAC `dashboard:view` so USER/READ_ONLY
  // should never reach here; map to TEAM-empty just in case.
  return "TEAM";
}

function highestRoleLabel(actor: ActorContext): string {
  const order: RoleCode[] = [
    "PLATFORM_ADMIN",
    "TENANT_ADMIN",
    "BLUEPRINT_MANAGER",
    "HRMS_MANAGER",
    "PROCESS_OWNER",
    "MANAGER",
    "USER",
    "READ_ONLY",
  ];
  for (const r of order) {
    if (actor.roles.includes(r)) return r;
  }
  return actor.roles[0] ?? "UNKNOWN";
}

export const dashboardService = {
  async getWidgets(actor: ActorContext): Promise<DashboardWidgetsResponse> {
    const scopeKind = highestScope(actor);
    const isPlatform = scopeKind === "PLATFORM";
    const isTeamScope = scopeKind === "TEAM" && !isPlatform;

    let teamPositionIds: string[] = [];
    const scopeTenantId: string | null = isPlatform ? null : actor.tenantId;

    if (isTeamScope) {
      // MANAGER: scope to own-team via positions where owner = self.
      teamPositionIds = await repo.findOwnedPositionIds(pool, actor.userId);
      // If MANAGER has no owned positions, scope becomes empty — render
      // empty-state on the frontend.
    }

    const scope: repo.ScopeFilter = {
      tenantId: scopeTenantId,
      teamPositionIds,
      isPlatformScope: isPlatform,
    };

    const [counters, trends, upcomingLearningDeadlines, recentActivity] = await Promise.all([
      repo.getDashboardCounters(pool, scope),
      repo.getDashboardTrends(pool, scope, DASHBOARD_TREND_WEEKS),
      repo.getUpcomingLearningDeadlines(pool, scope, 10),
      repo.getRecentActivity(pool, scope, 10),
    ]);

    return {
      role: highestRoleLabel(actor),
      scope: {
        kind: scopeKind,
        tenantId: scopeTenantId,
        teamPositionIds,
      },
      counters,
      trends,
      upcomingLearningDeadlines,
      recentActivity,
      generatedAt: new Date().toISOString(),
    };
  },
};
