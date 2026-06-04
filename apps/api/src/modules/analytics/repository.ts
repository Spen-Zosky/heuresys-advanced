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

// --- Attendance / overtime (P2) ---------------------------------------------
// Worked-hours rollups over sys.sys_attendance. Overtime = attendance_hours_overtime
// (recorded worked overtime that already rolls into attendance_hours_total) — NOT
// sys_overtime (a separate PENDING request/approval table, largely disjoint; summing
// would double-count). Hours are fractional numeric → ::text cast then Number() in JS.

export interface AttendanceHoursRow {
  /** 'YYYY-MM' for monthly rows, OU name for by-OU rows. */
  dimension: string;
  regularHours: number;
  overtimeHours: number;
  totalHours: number;
}

export interface AttendanceTotals {
  totalRegularHours: number;
  totalOvertimeHours: number;
  totalHours: number;
  monthly: AttendanceHoursRow[];
  byOrgUnit: AttendanceHoursRow[];
}

/**
 * Scope clause for attendance rollups. The subject is at.attendance_subject_user_id.
 *   PLATFORM → no filter.
 *   TENANT   → attendance_tenant_id = $1.
 *   TEAM     → TENANT + the subject user's PRIMARY/ACTIVE assignment position is one of
 *              teamPositionIds, expressed as an EXISTS so it works whether or not the
 *              outer query joins the assignment table (monthly has no join; by-OU does).
 */
function attendanceScopeClause(scope: ScopeFilter): { sql: string; params: unknown[] } {
  if (scope.isPlatformScope) return { sql: "TRUE", params: [] };
  const params: unknown[] = [scope.tenantId];
  const clauses = [`at.attendance_tenant_id = $1`];
  if (scope.teamPositionIds.length > 0) {
    params.push(scope.teamPositionIds);
    clauses.push(`EXISTS (
      SELECT 1 FROM sys.sys_user_position_assignments tap
       WHERE tap.user_position_assignment_user_id = at.attendance_subject_user_id
         AND tap.user_position_assignment_kind = 'PRIMARY'
         AND tap.user_position_assignment_status = 'ACTIVE'
         AND tap.user_position_assignment_position_id = ANY($${params.length}::uuid[]))`);
  }
  return { sql: clauses.join(" AND "), params };
}

export async function getAttendanceTotals(
  q: DbConnector,
  scope: ScopeFilter,
): Promise<AttendanceTotals> {
  const sc = attendanceScopeClause(scope);

  // Monthly time-series (no OU join needed for PLATFORM/TENANT; the TEAM filter
  // attaches via the EXISTS subquery on attendance_subject_user_id).
  const monthly = await q.query<{
    dimension: string;
    reg: string;
    ot: string;
    total: string;
  }>(
    `SELECT to_char(date_trunc('month', at.attendance_date), 'YYYY-MM') AS dimension,
            round(sum(at.attendance_hours_regular), 2)::text AS reg,
            round(sum(at.attendance_hours_overtime), 2)::text AS ot,
            round(sum(at.attendance_hours_total), 2)::text AS total
       FROM sys.sys_attendance at
      WHERE ${sc.sql}
      GROUP BY 1
      ORDER BY 1`,
    sc.params,
  );

  // By-OU rollup. The subject user → PRIMARY/ACTIVE assignment → position → OU chain
  // mirrors PRIMARY_ASSIGNMENT_JOIN (1 primary active assignment per user → no fan-out).
  const byOu = await q.query<{
    dimension: string;
    reg: string;
    ot: string;
    total: string;
  }>(
    `SELECT COALESCE(ou.organization_unit_name, '(unassigned)') AS dimension,
            round(sum(at.attendance_hours_regular), 2)::text AS reg,
            round(sum(at.attendance_hours_overtime), 2)::text AS ot,
            round(sum(at.attendance_hours_total), 2)::text AS total
       FROM sys.sys_attendance at
       LEFT JOIN sys.sys_users u
         ON u.user_id = at.attendance_subject_user_id
       LEFT JOIN sys.sys_user_position_assignments a
         ON a.user_position_assignment_user_id = u.user_id
        AND a.user_position_assignment_kind = 'PRIMARY'
        AND a.user_position_assignment_status = 'ACTIVE'
       LEFT JOIN sys.sys_positions p
         ON p.position_id = a.user_position_assignment_position_id
       LEFT JOIN sys.sys_organization_units ou
         ON ou.organization_unit_id = p.position_organization_unit_id
      WHERE ${sc.sql}
      GROUP BY 1
      ORDER BY sum(at.attendance_hours_total) DESC`,
    sc.params,
  );

  const totals = await q.query<{ reg: string; ot: string; total: string }>(
    `SELECT round(sum(at.attendance_hours_regular), 2)::text AS reg,
            round(sum(at.attendance_hours_overtime), 2)::text AS ot,
            round(sum(at.attendance_hours_total), 2)::text AS total
       FROM sys.sys_attendance at
      WHERE ${sc.sql}`,
    sc.params,
  );

  const mapRow = (r: { dimension: string; reg: string; ot: string; total: string }): AttendanceHoursRow => ({
    dimension: r.dimension,
    regularHours: Number(r.reg),
    overtimeHours: Number(r.ot),
    totalHours: Number(r.total),
  });

  const t = totals.rows[0];
  return {
    totalRegularHours: Number(t?.reg ?? 0),
    totalOvertimeHours: Number(t?.ot ?? 0),
    totalHours: Number(t?.total ?? 0),
    monthly: monthly.rows.map(mapRow),
    byOrgUnit: byOu.rows.map(mapRow),
  };
}

// --- Compensation equity (P2) -----------------------------------------------
// Driving table is sys_position_compensation_profiles; the INNER JOIN to
// sys_compensation_bands silently drops unbanded profiles (nothing to plot).
// Scope is POSITION-centric (the band/OU dimension hangs off the position), so
// the TEAM filter restricts p.position_id directly — NOT a subject-user join.

export interface CompensationBandingByOuRow {
  ou: string;
  count: number;
  min: number;
  q1: number;
  median: number;
  q3: number;
  max: number;
}

export interface CompensationScatterPoint {
  ou: string;
  positionTitle: string;
  bandCode: string;
  midEur: number;
  spreadEur: number;
}

export interface CompensationEquity {
  totalProfiles: number;
  ouCount: number;
  overallMinMidEur: number | null;
  overallMaxMidEur: number | null;
  overallMedianMidEur: number | null;
  bandingByOu: CompensationBandingByOuRow[];
  scatter: CompensationScatterPoint[];
}

function compensationScopeClause(scope: ScopeFilter): { sql: string; params: unknown[] } {
  if (scope.isPlatformScope) return { sql: "TRUE", params: [] };
  const params: unknown[] = [scope.tenantId];
  const clauses = [`pcp.position_compensation_profile_tenant_id = $1`];
  if (scope.teamPositionIds.length > 0) {
    params.push(scope.teamPositionIds);
    clauses.push(`p.position_id = ANY($${params.length}::uuid[])`);
  }
  return { sql: clauses.join(" AND "), params };
}

export async function getCompensationEquity(
  q: DbConnector,
  scope: ScopeFilter,
): Promise<CompensationEquity> {
  const sc = compensationScopeClause(scope);
  const FROM = `
       FROM sys.sys_position_compensation_profiles pcp
       JOIN sys.sys_positions p ON p.position_id = pcp.position_id
       JOIN sys.sys_compensation_bands b ON b.compensation_band_id = pcp.compensation_band_id
       LEFT JOIN sys.sys_organization_units ou ON ou.organization_unit_id = p.position_organization_unit_id
      WHERE ${sc.sql}`;

  // Boxplot 5-number summary of band mid_eur per OU. Ordered by median (numeric
  // expression, not the ::text alias) desc, then count desc.
  const banding = await q.query<{
    ou: string;
    n: string;
    minv: string;
    q1: string;
    median: string;
    q3: string;
    maxv: string;
  }>(
    `SELECT COALESCE(ou.organization_unit_name, '(unassigned)') AS ou,
            count(*)::text AS n,
            min(b.compensation_band_mid_eur)::text AS minv,
            percentile_cont(0.25) WITHIN GROUP (ORDER BY b.compensation_band_mid_eur)::text AS q1,
            percentile_cont(0.5)  WITHIN GROUP (ORDER BY b.compensation_band_mid_eur)::text AS median,
            percentile_cont(0.75) WITHIN GROUP (ORDER BY b.compensation_band_mid_eur)::text AS q3,
            max(b.compensation_band_mid_eur)::text AS maxv
       ${FROM}
      GROUP BY 1
      ORDER BY percentile_cont(0.5) WITHIN GROUP (ORDER BY b.compensation_band_mid_eur) DESC, count(*) DESC`,
    sc.params,
  );

  // One scatter point per banded profile: mid_eur (x) vs spread max-min (y).
  const scatter = await q.query<{
    ou: string;
    mid: string;
    spread: string;
    band_code: string;
    position_title: string;
  }>(
    `SELECT COALESCE(ou.organization_unit_name, '(unassigned)') AS ou,
            b.compensation_band_mid_eur::text AS mid,
            (b.compensation_band_max_eur - b.compensation_band_min_eur)::text AS spread,
            b.compensation_band_code AS band_code,
            p.position_title AS position_title
       ${FROM}
      ORDER BY b.compensation_band_mid_eur DESC,
               (b.compensation_band_max_eur - b.compensation_band_min_eur) DESC`,
    sc.params,
  );

  const summary = await q.query<{
    total: string;
    oucount: string;
    minmid: string | null;
    maxmid: string | null;
    medianmid: string | null;
  }>(
    `SELECT count(*)::text AS total,
            count(DISTINCT COALESCE(ou.organization_unit_name, '(unassigned)'))::text AS oucount,
            min(b.compensation_band_mid_eur)::text AS minmid,
            max(b.compensation_band_mid_eur)::text AS maxmid,
            (percentile_cont(0.5) WITHIN GROUP (ORDER BY b.compensation_band_mid_eur))::text AS medianmid
       ${FROM}`,
    sc.params,
  );

  const s = summary.rows[0];
  const numOrNull = (v: string | null | undefined): number | null =>
    v === null || v === undefined ? null : Number(v);

  return {
    totalProfiles: Number(s?.total ?? 0),
    ouCount: Number(s?.oucount ?? 0),
    overallMinMidEur: numOrNull(s?.minmid),
    overallMaxMidEur: numOrNull(s?.maxmid),
    overallMedianMidEur: numOrNull(s?.medianmid),
    bandingByOu: banding.rows.map((r) => ({
      ou: r.ou,
      count: Number(r.n),
      min: Number(r.minv),
      q1: Number(r.q1),
      median: Number(r.median),
      q3: Number(r.q3),
      max: Number(r.maxv),
    })),
    scatter: scatter.rows.map((r) => ({
      ou: r.ou,
      positionTitle: r.position_title,
      bandCode: r.band_code,
      midEur: Number(r.mid),
      spreadEur: Number(r.spread),
    })),
  };
}

// --- Skills coverage (P2) ----------------------------------------------------
// COVERAGE (evidence distribution), NOT a held-vs-required gap: the requirements
// table is empty. Column axis is declared_proficiency (skill→category is NULL in
// the seed). Scope is PERSON-scoped via sys.sys_users — the v5 person record,
// populated employee-centric per I14/ADR-0024. NB: "user" here means sys_users
// (the person, ex-legacy `employees`), NOT the legacy auth `users` shell — this
// is read-only analytics, not ingestion, so the I14 crosswalk doctrine does not
// apply. Reuses userScopeClause (alias u = sys_users, a = PRIMARY/ACTIVE
// assignment): TENANT filters u.user_tenant_id, TEAM filters
// a.user_position_assignment_position_id — identical to the workforce rollup.

const PROFICIENCY_RANK: Record<string, number> = {
  NOVICE: 1,
  BASIC: 2,
  COMPETENT: 3,
  PROFICIENT: 4,
  EXPERT: 5,
  MASTER: 6,
};

export interface SkillsCoverageCell {
  orgUnit: string;
  proficiency: string;
  evidenceCount: number;
  distinctUsers: number;
}

export interface SkillsCoverageByProficiencyRow {
  proficiency: string;
  evidenceCount: number;
  distinctUsers: number;
}

export interface SkillsCoverage {
  orgUnits: string[];
  proficiencyLevels: string[];
  cells: SkillsCoverageCell[];
  byProficiency: SkillsCoverageByProficiencyRow[];
  totalEvidence: number;
  distinctUsers: number;
  distinctOrgUnits: number;
}

// One primary/active assignment per user → no evidence-row fan-out from these joins.
const SKILLS_FROM = `
       FROM sys.sys_user_skill_evidence e
       JOIN sys.sys_users u ON u.user_id = e.user_skill_evidence_user_id
       LEFT JOIN sys.sys_user_position_assignments a
         ON a.user_position_assignment_user_id = u.user_id
        AND a.user_position_assignment_kind = 'PRIMARY'
        AND a.user_position_assignment_status = 'ACTIVE'
       LEFT JOIN sys.sys_positions p ON p.position_id = a.user_position_assignment_position_id
       LEFT JOIN sys.sys_organization_units ou ON ou.organization_unit_id = p.position_organization_unit_id`;

export async function getSkillsCoverage(
  q: DbConnector,
  scope: ScopeFilter,
): Promise<SkillsCoverage> {
  const sc = userScopeClause(scope);

  const cells = await q.query<{
    org_unit: string;
    proficiency: string;
    evidence_count: string;
    distinct_users: string;
  }>(
    `SELECT COALESCE(ou.organization_unit_name, '(unassigned)') AS org_unit,
            e.user_skill_evidence_declared_proficiency AS proficiency,
            count(*)::text AS evidence_count,
            count(DISTINCT u.user_id)::text AS distinct_users
       ${SKILLS_FROM}
      WHERE ${sc.sql}
      GROUP BY 1, 2`,
    sc.params,
  );

  const byProf = await q.query<{
    proficiency: string;
    evidence_count: string;
    distinct_users: string;
  }>(
    `SELECT e.user_skill_evidence_declared_proficiency AS proficiency,
            count(*)::text AS evidence_count,
            count(DISTINCT u.user_id)::text AS distinct_users
       ${SKILLS_FROM}
      WHERE ${sc.sql}
      GROUP BY 1`,
    sc.params,
  );

  const totals = await q.query<{ total: string; users: string; ous: string }>(
    `SELECT count(*)::text AS total,
            count(DISTINCT u.user_id)::text AS users,
            count(DISTINCT COALESCE(ou.organization_unit_name, '(unassigned)'))::text AS ous
       ${SKILLS_FROM}
      WHERE ${sc.sql}`,
    sc.params,
  );

  const cellRows: SkillsCoverageCell[] = cells.rows.map((r) => ({
    orgUnit: r.org_unit,
    proficiency: r.proficiency,
    evidenceCount: Number(r.evidence_count),
    distinctUsers: Number(r.distinct_users),
  }));

  // Heatmap rows: OUs ordered by total evidence desc.
  const ouEvidence = new Map<string, number>();
  for (const c of cellRows) {
    ouEvidence.set(c.orgUnit, (ouEvidence.get(c.orgUnit) ?? 0) + c.evidenceCount);
  }
  const orgUnits = [...ouEvidence.entries()].sort((x, y) => y[1] - x[1]).map(([ou]) => ou);

  // Heatmap cols: proficiency levels present, ordered by rank (NOVICE→MASTER).
  const profOrder = (level: string): number => PROFICIENCY_RANK[level] ?? 99;
  const proficiencyLevels = [...new Set(cellRows.map((c) => c.proficiency))].sort(
    (x, y) => profOrder(x) - profOrder(y),
  );

  const byProficiency: SkillsCoverageByProficiencyRow[] = byProf.rows
    .map((r) => ({
      proficiency: r.proficiency,
      evidenceCount: Number(r.evidence_count),
      distinctUsers: Number(r.distinct_users),
    }))
    .sort((x, y) => profOrder(x.proficiency) - profOrder(y.proficiency));

  const t = totals.rows[0];
  return {
    orgUnits,
    proficiencyLevels,
    cells: cellRows,
    byProficiency,
    totalEvidence: Number(t?.total ?? 0),
    distinctUsers: Number(t?.users ?? 0),
    distinctOrgUnits: Number(t?.ous ?? 0),
  };
}
