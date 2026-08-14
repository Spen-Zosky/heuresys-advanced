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

/**
 * @param unitaEscluse #99 F4 — le unità di vertice, quando l'attore sta sotto la soglia di
 *   catena (ADR-0036 §5). Si esclude **a monte**, nella clausola, e non a valle sui
 *   risultati: così scatter, banding e i tre estremi (min/mediana/max) sono calcolati
 *   sullo stesso universo e restano fra loro coerenti. Filtrare a valle avrebbe lasciato
 *   `overallMaxMidEur` a raccontare la banda del vertice appena tolto dallo scatter — la
 *   fuga aritmetica che `mask.ts` chiama per nome nella sua quarta proprietà.
 */
function compensationScopeClause(
  scope: ScopeFilter,
  unitaEscluse: readonly string[] = [],
): { sql: string; params: unknown[] } {
  const params: unknown[] = [];
  const clauses: string[] = [];
  if (!scope.isPlatformScope) {
    params.push(scope.tenantId);
    clauses.push(`pcp.position_compensation_profile_tenant_id = $${params.length}`);
    if (scope.teamPositionIds.length > 0) {
      params.push(scope.teamPositionIds);
      clauses.push(`p.position_id = ANY($${params.length}::uuid[])`);
    }
  }
  if (unitaEscluse.length > 0) {
    params.push(unitaEscluse);
    // `IS DISTINCT FROM ALL` non esiste: una posizione senza unità (NULL) non è di vertice
    // e deve restare, quindi il confronto va reso esplicito invece di affidarlo a NOT IN,
    // che su NULL restituisce NULL e farebbe sparire la riga in silenzio.
    clauses.push(
      `(p.position_organization_unit_id IS NULL OR NOT (p.position_organization_unit_id = ANY($${params.length}::uuid[])))`,
    );
  }
  if (clauses.length === 0) return { sql: "TRUE", params: [] };
  return { sql: clauses.join(" AND "), params };
}

export async function getCompensationEquity(
  q: DbConnector,
  scope: ScopeFilter,
  unitaEscluse: readonly string[] = [],
): Promise<CompensationEquity> {
  const sc = compensationScopeClause(scope, unitaEscluse);
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

// --- Skills coverage by CATEGORY (BI ①·#8b) ----------------------------------
// Clone of getSkillsCoverage with the y-axis swapped from OU to skill_category.
// The category link (sys_skills.skill_category_id → sys_skill_categories, wired
// S970) resolves on every evidence (0 NULL → dense). Scope is identical:
// PERSON-scoped via sys.sys_users + userScopeClause (alias u = sys_users, a =
// PRIMARY/ACTIVE assignment) so TENANT/TEAM filtering matches the OU heatmap.
// The category JOINs add NO fan-out (one skill → one category; one evidence →
// one skill), so counts stay 1:1 with the evidence rows.

export interface SkillsByCategoryCell {
  category: string;
  proficiency: string;
  evidenceCount: number;
  distinctUsers: number;
}

export interface SkillsByCategoryRow {
  category: string;
  evidenceCount: number;
  distinctUsers: number;
}

export interface SkillsByCategory {
  categories: string[];
  proficiencyLevels: string[];
  cells: SkillsByCategoryCell[];
  byCategory: SkillsByCategoryRow[];
  totalEvidence: number;
  distinctUsers: number;
  distinctCategories: number;
}

// evidence → skill → category, plus the same person/assignment chain as SKILLS_FROM
// (the assignment join only matters for TEAM scope; it never fans out).
const SKILLS_BY_CATEGORY_FROM = `
       FROM sys.sys_user_skill_evidence e
       JOIN sys.sys_users u ON u.user_id = e.user_skill_evidence_user_id
       JOIN sys.sys_skills sk ON sk.skill_id = e.user_skill_evidence_skill_id
       JOIN sys.sys_skill_categories sc ON sc.skill_category_id = sk.skill_category_id
       LEFT JOIN sys.sys_user_position_assignments a
         ON a.user_position_assignment_user_id = u.user_id
        AND a.user_position_assignment_kind = 'PRIMARY'
        AND a.user_position_assignment_status = 'ACTIVE'`;

export async function getSkillsByCategory(
  q: DbConnector,
  scope: ScopeFilter,
): Promise<SkillsByCategory> {
  const sc = userScopeClause(scope);

  const cells = await q.query<{
    category: string;
    proficiency: string;
    evidence_count: string;
    distinct_users: string;
  }>(
    `SELECT sc.skill_category_name AS category,
            e.user_skill_evidence_declared_proficiency AS proficiency,
            count(*)::text AS evidence_count,
            count(DISTINCT u.user_id)::text AS distinct_users
       ${SKILLS_BY_CATEGORY_FROM}
      WHERE ${sc.sql}
      GROUP BY 1, 2`,
    sc.params,
  );

  const byCat = await q.query<{
    category: string;
    evidence_count: string;
    distinct_users: string;
  }>(
    `SELECT sc.skill_category_name AS category,
            count(*)::text AS evidence_count,
            count(DISTINCT u.user_id)::text AS distinct_users
       ${SKILLS_BY_CATEGORY_FROM}
      WHERE ${sc.sql}
      GROUP BY 1`,
    sc.params,
  );

  const totals = await q.query<{ total: string; users: string; cats: string }>(
    `SELECT count(*)::text AS total,
            count(DISTINCT u.user_id)::text AS users,
            count(DISTINCT sc.skill_category_name)::text AS cats
       ${SKILLS_BY_CATEGORY_FROM}
      WHERE ${sc.sql}`,
    sc.params,
  );

  const cellRows: SkillsByCategoryCell[] = cells.rows.map((r) => ({
    category: r.category,
    proficiency: r.proficiency,
    evidenceCount: Number(r.evidence_count),
    distinctUsers: Number(r.distinct_users),
  }));

  // Heatmap rows: categories ordered by total evidence desc.
  const catEvidence = new Map<string, number>();
  for (const c of cellRows) {
    catEvidence.set(c.category, (catEvidence.get(c.category) ?? 0) + c.evidenceCount);
  }
  const categories = [...catEvidence.entries()].sort((x, y) => y[1] - x[1]).map(([cat]) => cat);

  // Heatmap cols: proficiency levels present, ordered by the shared rank.
  const profOrder = (level: string): number => PROFICIENCY_RANK[level] ?? 99;
  const proficiencyLevels = [...new Set(cellRows.map((c) => c.proficiency))].sort(
    (x, y) => profOrder(x) - profOrder(y),
  );

  const byCategory: SkillsByCategoryRow[] = byCat.rows
    .map((r) => ({
      category: r.category,
      evidenceCount: Number(r.evidence_count),
      distinctUsers: Number(r.distinct_users),
    }))
    .sort((x, y) => y.evidenceCount - x.evidenceCount);

  const t = totals.rows[0];
  return {
    categories,
    proficiencyLevels,
    cells: cellRows,
    byCategory,
    totalEvidence: Number(t?.total ?? 0),
    distinctUsers: Number(t?.users ?? 0),
    distinctCategories: Number(t?.cats ?? 0),
  };
}

// --- Org-network metrics (P3) ------------------------------------------------
// Structural metrics over the position reports-to graph. POSITION-centric scope
// (mirrors compensationScopeClause on alias `p` = sys_positions): TENANT filters
// p.position_tenant_id, TEAM additionally restricts p.position_id ∈ teamPositionIds.
// The full org chart is the graph — is_active is NOT filtered (matches the 158-node
// RTL_ORG_CHART). All recursive CTEs carry a depth/lvl guard (< 100) against cycles.
// Numerics are ::text-cast in SQL then Number()'d here (file convention).

export interface OrgNetworkDepthRow {
  depth: number;
  positionCount: number;
}

export interface OrgNetworkSpanRow {
  positionTitle: string;
  orgUnit: string;
  directReports: number;
}

export interface OrgNetworkReachRow {
  positionTitle: string;
  orgUnit: string;
  reach: number;
}

export interface OrgNetwork {
  totalPositions: number;
  rootPositions: number;
  managersCount: number;
  avgSpanOfControl: number | null;
  maxDepth: number;
  byDepth: OrgNetworkDepthRow[];
  topSpan: OrgNetworkSpanRow[];
  topReach: OrgNetworkReachRow[];
}

function orgNetworkScopeClause(scope: ScopeFilter): { sql: string; params: unknown[] } {
  if (scope.isPlatformScope) return { sql: "TRUE", params: [] };
  const params: unknown[] = [scope.tenantId];
  const clauses = [`p.position_tenant_id = $1`];
  if (scope.teamPositionIds.length > 0) {
    params.push(scope.teamPositionIds);
    clauses.push(`p.position_id = ANY($${params.length}::uuid[])`);
  }
  return { sql: clauses.join(" AND "), params };
}

export async function getOrgNetwork(
  q: DbConnector,
  scope: ScopeFilter,
): Promise<OrgNetwork> {
  const sc = orgNetworkScopeClause(scope);

  // Shared `scoped` base CTE = the in-scope position set with its reports-to edge
  // and resolved OU label. Reused by every query below so the scope WHERE is built once.
  // WITH RECURSIVE is required because the depth/reach CTEs that extend this list
  // self-reference; Postgres tolerates RECURSIVE on the non-recursive queries too.
  const SCOPED = `
    WITH RECURSIVE scoped AS (
      SELECT p.position_id, p.position_title, p.position_reports_to_position_id AS reports_to,
             COALESCE(ou.organization_unit_name, '(unassigned)') AS org_unit
        FROM sys.sys_positions p
        LEFT JOIN sys.sys_organization_units ou
          ON ou.organization_unit_id = p.position_organization_unit_id
       WHERE ${sc.sql}
    )`;

  // Totals: total positions + roots (no reports-to, or reports-to a position outside
  // the scoped set — so a scoped subtree counts its in-scope top as a root).
  const totals = await q.query<{ total: string; roots: string }>(
    `${SCOPED}
     SELECT count(*)::text AS total,
            count(*) FILTER (
              WHERE reports_to IS NULL
                 OR reports_to NOT IN (SELECT position_id FROM scoped)
            )::text AS roots
       FROM scoped`,
    sc.params,
  );

  // Managers count + avg span-of-control among managers (positions with ≥1 report).
  const spanStats = await q.query<{ managers: string; avg_span: string | null }>(
    `${SCOPED},
     spans AS (
       SELECT s.position_id,
              (SELECT count(*) FROM scoped c WHERE c.reports_to = s.position_id) AS dr
         FROM scoped s
     )
     SELECT count(*) FILTER (WHERE dr > 0)::text AS managers,
            round(avg(dr) FILTER (WHERE dr > 0), 2)::text AS avg_span
       FROM spans`,
    sc.params,
  );

  // Top span-of-control: positions ranked by direct reports (correlated count; 158 rows).
  const topSpan = await q.query<{
    position_title: string;
    org_unit: string;
    direct_reports: string;
  }>(
    `${SCOPED}
     SELECT s.position_title,
            s.org_unit,
            (SELECT count(*) FROM scoped c WHERE c.reports_to = s.position_id)::text AS direct_reports
       FROM scoped s
      ORDER BY (SELECT count(*) FROM scoped c WHERE c.reports_to = s.position_id) DESC,
               s.position_title
      LIMIT 15`,
    sc.params,
  );

  // Hierarchy depth (recursive): anchor = scoped roots at depth 0; recurse children
  // (child.reports_to = parent.position_id) depth+1, guarded at depth < 100.
  const depth = await q.query<{ depth: string; position_count: string }>(
    `${SCOPED},
     tree AS (
       SELECT s.position_id, 0 AS depth
         FROM scoped s
        WHERE s.reports_to IS NULL
           OR s.reports_to NOT IN (SELECT position_id FROM scoped)
       UNION ALL
       SELECT s.position_id, t.depth + 1
         FROM scoped s
         JOIN tree t ON s.reports_to = t.position_id
        WHERE t.depth < 100
     )
     SELECT depth::text AS depth, count(*)::text AS position_count
       FROM tree
      GROUP BY depth
      ORDER BY depth`,
    sc.params,
  );

  // Reach / centrality (recursive): for each ancestor, the set of nodes reachable
  // downward (incl. self at lvl 0). reach = descendants count - 1 (excludes self).
  // `descendants` name avoids the `desc` reserved word.
  const reach = await q.query<{
    position_title: string;
    org_unit: string;
    reach: string;
  }>(
    `${SCOPED},
     descendants AS (
       SELECT position_id AS ancestor, position_id AS node, 0 AS lvl
         FROM scoped
       UNION ALL
       SELECT d.ancestor, s.position_id, d.lvl + 1
         FROM scoped s
         JOIN descendants d ON s.reports_to = d.node
        WHERE d.lvl < 100
     )
     SELECT a.position_title,
            a.org_unit,
            (count(*) - 1)::text AS reach
       FROM descendants d
       JOIN scoped a ON a.position_id = d.ancestor
      GROUP BY a.position_id, a.position_title, a.org_unit
     HAVING (count(*) - 1) > 0
      ORDER BY (count(*) - 1) DESC, a.position_title
      LIMIT 15`,
    sc.params,
  );

  const maxDepth = depth.rows.reduce((m, r) => Math.max(m, Number(r.depth)), 0);
  const ss = spanStats.rows[0];

  return {
    totalPositions: Number(totals.rows[0]?.total ?? 0),
    rootPositions: Number(totals.rows[0]?.roots ?? 0),
    managersCount: Number(ss?.managers ?? 0),
    avgSpanOfControl: ss?.avg_span == null ? null : Number(ss.avg_span),
    maxDepth,
    byDepth: depth.rows.map((r) => ({
      depth: Number(r.depth),
      positionCount: Number(r.position_count),
    })),
    topSpan: topSpan.rows.map((r) => ({
      positionTitle: r.position_title,
      orgUnit: r.org_unit,
      directReports: Number(r.direct_reports),
    })),
    topReach: reach.rows.map((r) => ({
      positionTitle: r.position_title,
      orgUnit: r.org_unit,
      reach: Number(r.reach),
    })),
  };
}

// --- Overtime requests (P2 ext) ----------------------------------------------
// Request/approval lifecycle over sys.sys_overtime — NOT sys_attendance worked hours
// (that's getAttendanceTotals; the two are disjoint and summing double-counts). Subject
// is ot.overtime_subject_user_id; tenant is ot.overtime_tenant_id. Hours/comp are
// fractional numeric → ::text cast then Number() in JS; compensation is nullable.
// Scope mirrors attendanceScopeClause (subject-centric EXISTS for TEAM).

export interface OvertimeByStatusRow {
  status: string;
  count: number;
  hours: number;
  compensationEur: number | null;
}

export interface OvertimeByTypeRow {
  type: string;
  count: number;
  hours: number;
}

/** Shared shape for the monthly + by-OU rollups (count + hours per bucket). */
export interface OvertimeDimensionRow {
  dimension: string;
  count: number;
  hours: number;
}

export interface OvertimeRollups {
  totalRequests: number;
  totalHours: number;
  totalCompensationEur: number | null;
  byStatus: OvertimeByStatusRow[];
  byType: OvertimeByTypeRow[];
  monthly: OvertimeDimensionRow[];
  byOrgUnit: OvertimeDimensionRow[];
}

function overtimeScopeClause(scope: ScopeFilter): { sql: string; params: unknown[] } {
  if (scope.isPlatformScope) return { sql: "TRUE", params: [] };
  const params: unknown[] = [scope.tenantId];
  const clauses = [`ot.overtime_tenant_id = $1`];
  if (scope.teamPositionIds.length > 0) {
    params.push(scope.teamPositionIds);
    clauses.push(`EXISTS (
      SELECT 1 FROM sys.sys_user_position_assignments tap
       WHERE tap.user_position_assignment_user_id = ot.overtime_subject_user_id
         AND tap.user_position_assignment_kind = 'PRIMARY'
         AND tap.user_position_assignment_status = 'ACTIVE'
         AND tap.user_position_assignment_position_id = ANY($${params.length}::uuid[]))`);
  }
  return { sql: clauses.join(" AND "), params };
}

export async function getOvertimeRollups(
  q: DbConnector,
  scope: ScopeFilter,
): Promise<OvertimeRollups> {
  const sc = overtimeScopeClause(scope);

  const totals = await q.query<{ requests: string; hours: string; comp: string | null }>(
    `SELECT count(*)::text AS requests,
            COALESCE(round(sum(ot.overtime_hours), 2), 0)::text AS hours,
            round(sum(ot.overtime_total_compensation), 2)::text AS comp
       FROM sys.sys_overtime ot
      WHERE ${sc.sql}`,
    sc.params,
  );

  const byStatus = await q.query<{
    status: string;
    cnt: string;
    hours: string;
    comp: string | null;
  }>(
    `SELECT ot.overtime_status AS status,
            count(*)::text AS cnt,
            round(sum(ot.overtime_hours), 2)::text AS hours,
            round(sum(ot.overtime_total_compensation), 2)::text AS comp
       FROM sys.sys_overtime ot
      WHERE ${sc.sql}
      GROUP BY 1
      ORDER BY count(*) DESC`,
    sc.params,
  );

  const byType = await q.query<{ type: string; cnt: string; hours: string }>(
    `SELECT ot.overtime_type AS type,
            count(*)::text AS cnt,
            round(sum(ot.overtime_hours), 2)::text AS hours
       FROM sys.sys_overtime ot
      WHERE ${sc.sql}
      GROUP BY 1
      ORDER BY count(*) DESC`,
    sc.params,
  );

  const monthly = await q.query<{ dimension: string; cnt: string; hours: string }>(
    `SELECT to_char(date_trunc('month', ot.overtime_date), 'YYYY-MM') AS dimension,
            count(*)::text AS cnt,
            round(sum(ot.overtime_hours), 2)::text AS hours
       FROM sys.sys_overtime ot
      WHERE ${sc.sql}
      GROUP BY 1
      ORDER BY 1`,
    sc.params,
  );

  // Subject user → PRIMARY/ACTIVE assignment → position → OU (1 primary active per user → no fan-out).
  const byOu = await q.query<{ dimension: string; cnt: string; hours: string }>(
    `SELECT COALESCE(ou.organization_unit_name, '(unassigned)') AS dimension,
            count(*)::text AS cnt,
            round(sum(ot.overtime_hours), 2)::text AS hours
       FROM sys.sys_overtime ot
       LEFT JOIN sys.sys_user_position_assignments a
         ON a.user_position_assignment_user_id = ot.overtime_subject_user_id
        AND a.user_position_assignment_kind = 'PRIMARY'
        AND a.user_position_assignment_status = 'ACTIVE'
       LEFT JOIN sys.sys_positions p
         ON p.position_id = a.user_position_assignment_position_id
       LEFT JOIN sys.sys_organization_units ou
         ON ou.organization_unit_id = p.position_organization_unit_id
      WHERE ${sc.sql}
      GROUP BY 1
      ORDER BY sum(ot.overtime_hours) DESC`,
    sc.params,
  );

  const numOrNull = (v: string | null | undefined): number | null =>
    v === null || v === undefined ? null : Number(v);

  const t = totals.rows[0];
  return {
    totalRequests: Number(t?.requests ?? 0),
    totalHours: Number(t?.hours ?? 0),
    totalCompensationEur: numOrNull(t?.comp),
    byStatus: byStatus.rows.map((r) => ({
      status: r.status,
      count: Number(r.cnt),
      hours: Number(r.hours),
      compensationEur: numOrNull(r.comp),
    })),
    byType: byType.rows.map((r) => ({
      type: r.type,
      count: Number(r.cnt),
      hours: Number(r.hours),
    })),
    monthly: monthly.rows.map((r) => ({
      dimension: r.dimension,
      count: Number(r.cnt),
      hours: Number(r.hours),
    })),
    byOrgUnit: byOu.rows.map((r) => ({
      dimension: r.dimension,
      count: Number(r.cnt),
      hours: Number(r.hours),
    })),
  };
}

// --- Skills-group share (T3.8 chart + T2.6 clustering) -----------------------
// Catalogue-global rollup: the ESCO skill GROUPS (skill_metadata->>'skill_group_uri')
// and how the catalogue's skills distribute across them. ESCO skills are
// platform-global (tenantId=null) so this rollup carries NO scope filter — the
// groups themselves are the clusters (T2.6); the share is the chart (T3.8).

export const SKILLS_GROUP_SHARE_TOP_N = 25;

export interface SkillsGroupShareGroupRow {
  groupCode: string;
  groupUri: string;
  skillCount: number;
  sharePct: number;
}

export interface SkillsGroupShare {
  groups: SkillsGroupShareGroupRow[];
  otherGroupsCount: number;
  otherSkillCount: number;
  totalSkills: number;
  totalGrouped: number;
  ungroupedSkills: number;
  distinctGroups: number;
}

/** Human-readable ESCO group code from the concept URI. The URI carries TWO
 *  `/esco/` segments — the API path (.../esco/api/resource/concept?uri=...) and the
 *  vocabulary IRI (.../data.europa.eu/esco/skill/S2.8.1). We want the vocabulary one:
 *  "skill/S2.8.1" / "isced-f/0613". Falls back to a non-`api/` `/esco/` segment. */
function escoGroupCode(uri: string): string {
  const m =
    uri.match(/data\.europa\.eu\/esco\/([^&?#]+)/) ?? uri.match(/\/esco\/(?!api\/)([^&?#]+)/);
  return (m?.[1] ?? uri).replace(/\/+$/, "");
}

export async function getSkillsGroupShare(q: DbConnector): Promise<SkillsGroupShare> {
  const totals = await q.query<{ total: string; grouped: string; groups: string }>(
    `SELECT count(*)::text AS total,
            count(skill_metadata->>'skill_group_uri')::text AS grouped,
            count(DISTINCT skill_metadata->>'skill_group_uri')::text AS groups
       FROM sys.sys_skills`,
  );
  const perGroup = await q.query<{ group_uri: string; n: string }>(
    `SELECT skill_metadata->>'skill_group_uri' AS group_uri, count(*)::text AS n
       FROM sys.sys_skills
      WHERE skill_metadata->>'skill_group_uri' IS NOT NULL
      GROUP BY 1
      ORDER BY count(*) DESC, 1`,
  );

  const t = totals.rows[0];
  const totalSkills = Number(t?.total ?? 0);
  const totalGrouped = Number(t?.grouped ?? 0);

  const all = perGroup.rows.map((r) => ({
    groupUri: r.group_uri,
    groupCode: escoGroupCode(r.group_uri),
    count: Number(r.n),
  }));
  const top = all.slice(0, SKILLS_GROUP_SHARE_TOP_N);
  const rest = all.slice(SKILLS_GROUP_SHARE_TOP_N);

  const groups: SkillsGroupShareGroupRow[] = top.map((g) => ({
    groupCode: g.groupCode,
    groupUri: g.groupUri,
    skillCount: g.count,
    sharePct: totalGrouped > 0 ? Math.round((g.count / totalGrouped) * 10000) / 100 : 0,
  }));

  return {
    groups,
    otherGroupsCount: rest.length,
    otherSkillCount: rest.reduce((s, g) => s + g.count, 0),
    totalSkills,
    totalGrouped,
    ungroupedSkills: totalSkills - totalGrouped,
    distinctGroups: Number(t?.groups ?? 0),
  };
}
