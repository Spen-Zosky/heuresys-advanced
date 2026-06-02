/**
 * apps/api/src/modules/analytics/repository.ts
 * BI analytics Phase 1 — read-only rollups for the workforce + KPI surfaces.
 * Raw parameterized SQL against existing sys.* tables. No writes.
 *
 * Scope filter mirrors dashboard/repository.ts ScopeFilter:
 *   - PLATFORM → no tenant filter (cross-tenant aggregate)
 *   - TENANT   → filter by *_tenant_id = $1
 *   - TEAM     → MANAGER scope is filtered to owned positions (teamPositionIds);
 *                headcount restricts to users whose primary active assignment is
 *                one of those positions.
 *
 * Column names verified against the live seed (S958):
 *   - primary assignment = user_position_assignment_kind = 'PRIMARY' (+ status 'ACTIVE')
 *   - position → OU via position_organization_unit_id → organization_unit_name
 *   - position label = position_title
 *   - kpi actual value lives at metadata #>> '{legacy,actual_value}'
 */

import type { Pool, PoolClient } from "pg";

export type DbConnector = Pool | PoolClient;

export interface ScopeFilter {
  /** When set, all rollups are filtered to this tenant. */
  tenantId: string | null;
  /** When set (MANAGER), headcount restricts to users whose primary active assignment is one of these positions. */
  teamPositionIds: string[];
  /** PLATFORM scope = no tenant filter. */
  isPlatformScope: boolean;
}

export interface WorkforceDimensionRow {
  dimension: string;
  headcount: number;
}

export interface WorkforceTotals {
  total: number;
  byOrgUnit: WorkforceDimensionRow[];
  byJobRole: WorkforceDimensionRow[];
}

export interface KpiAchievementRow {
  kpiCode: string;
  kpiName: string;
  targetsCount: number;
  avgAchievementPct: number | null;
}

export interface KpiAchievement {
  totalTargets: number;
  distinctKpis: number;
  byKpi: KpiAchievementRow[];
}

/**
 * Build the user-level WHERE clause + params for a given scope. The `u` alias is
 * sys.sys_users; the `a` alias is the user's primary active position assignment
 * (LEFT JOINed). For TEAM scope we constrain to users whose primary active
 * assignment position is one of the manager's owned positions.
 */
function userScopeClause(scope: ScopeFilter): { sql: string; params: unknown[] } {
  if (scope.isPlatformScope) {
    return { sql: "TRUE", params: [] };
  }
  const params: unknown[] = [scope.tenantId];
  const clauses = [`u.user_tenant_id = $1`];
  if (scope.teamPositionIds.length > 0) {
    params.push(scope.teamPositionIds);
    clauses.push(`a.user_position_assignment_position_id = ANY($${params.length}::uuid[])`);
  }
  return { sql: clauses.join(" AND "), params };
}

const PRIMARY_ASSIGNMENT_JOIN = `
  LEFT JOIN sys.sys_user_position_assignments a
    ON a.user_position_assignment_user_id = u.user_id
   AND a.user_position_assignment_kind = 'PRIMARY'
   AND a.user_position_assignment_status = 'ACTIVE'
  LEFT JOIN sys.sys_positions p
    ON p.position_id = a.user_position_assignment_position_id
`;

export async function getWorkforceTotals(
  q: DbConnector,
  scope: ScopeFilter,
): Promise<WorkforceTotals> {
  const sc = userScopeClause(scope);

  // Total headcount: distinct users in scope. Use the same primary-assignment
  // join so the TEAM team-position filter applies; for PLATFORM/TENANT the join
  // does not change the distinct-user count (1 primary active assignment max).
  const total = await q.query<{ n: string }>(
    `SELECT count(DISTINCT u.user_id)::text AS n
       FROM sys.sys_users u
       ${PRIMARY_ASSIGNMENT_JOIN}
      WHERE ${sc.sql}`,
    sc.params,
  );

  const byOu = await q.query<{ dimension: string; headcount: string }>(
    `SELECT COALESCE(ou.organization_unit_name, '(unassigned)') AS dimension,
            count(DISTINCT u.user_id)::text AS headcount
       FROM sys.sys_users u
       ${PRIMARY_ASSIGNMENT_JOIN}
       LEFT JOIN sys.sys_organization_units ou
         ON ou.organization_unit_id = p.position_organization_unit_id
      WHERE ${sc.sql}
      GROUP BY 1
      ORDER BY 2 DESC`,
    sc.params,
  );

  const byRole = await q.query<{ dimension: string; headcount: string }>(
    `SELECT COALESCE(p.position_title, '(no position)') AS dimension,
            count(DISTINCT u.user_id)::text AS headcount
       FROM sys.sys_users u
       ${PRIMARY_ASSIGNMENT_JOIN}
      WHERE ${sc.sql}
      GROUP BY 1
      ORDER BY 2 DESC
      LIMIT 50`,
    sc.params,
  );

  return {
    total: Number(total.rows[0]?.n ?? 0),
    byOrgUnit: byOu.rows.map((r) => ({ dimension: r.dimension, headcount: Number(r.headcount) })),
    byJobRole: byRole.rows.map((r) => ({ dimension: r.dimension, headcount: Number(r.headcount) })),
  };
}

export async function getKpiAchievement(
  q: DbConnector,
  scope: ScopeFilter,
): Promise<KpiAchievement> {
  // kpi_targets carry the tenant on the row; the legacy actual is in
  // metadata #>> '{legacy,actual_value}' (seed 03). avg() skips NULL inputs,
  // so targets without an actual_value simply don't contribute to the mean.
  const params: unknown[] = [];
  let where = "TRUE";
  if (!scope.isPlatformScope) {
    params.push(scope.tenantId);
    where = `t.kpi_target_tenant_id = $1`;
  }

  const rows = await q.query<{
    kpicode: string;
    kpiname: string;
    cnt: string;
    avgpct: string | null;
  }>(
    `SELECT k.kpi_definition_code AS kpicode,
            k.kpi_definition_name AS kpiname,
            count(*)::text AS cnt,
            avg((t.kpi_target_metadata #>> '{legacy,actual_value}')::numeric
                / NULLIF(t.kpi_target_target_value, 0) * 100)::text AS avgpct
       FROM sys.sys_kpi_targets t
       JOIN sys.sys_kpi_definitions k ON k.kpi_definition_id = t.kpi_target_kpi_id
      WHERE ${where}
      GROUP BY 1, 2
      ORDER BY 3 DESC`,
    params,
  );

  const totals = await q.query<{ total: string; distinct: string }>(
    `SELECT count(*)::text AS total,
            count(DISTINCT t.kpi_target_kpi_id)::text AS distinct
       FROM sys.sys_kpi_targets t
      WHERE ${where}`,
    params,
  );

  return {
    totalTargets: Number(totals.rows[0]?.total ?? 0),
    distinctKpis: Number(totals.rows[0]?.distinct ?? 0),
    byKpi: rows.rows.map((r) => ({
      kpiCode: r.kpicode,
      kpiName: r.kpiname,
      targetsCount: Number(r.cnt),
      avgAchievementPct: r.avgpct === null ? null : Number(r.avgpct),
    })),
  };
}
