/**
 * apps/api/src/modules/insights/repository.ts
 * Cap③ data-mining — raw parameterized SQL for the flight-risk slice.
 *
 *   extractFlightRiskFeatures — deterministic per-subject feature extraction over
 *     live sys.* (tenure, attendance/overtime, KPI achievement, engagement-survey,
 *     comp-band position, promotion recency). Returns RAW values; null = no data
 *     for that subject (the service drops it + re-normalizes the weights).
 *   upsertFlightRiskScores — append the recomputed scores (latest-wins via the
 *     *_user_idx DESC index; no destructive delete).
 *   readFlightRiskScores / readUserFlightRiskScore — active (latest) score per
 *     subject, scope-filtered (I5 = FK + middleware, never RLS).
 *
 * Scope filter mirrors analytics/dashboard ScopeFilter:
 *   PLATFORM → no tenant filter · TENANT → *_tenant_id = $1 ·
 *   TEAM (MANAGER) → restricted to the manager's owned positions.
 * Column names verified live against the seed (S974).
 */
import type { Pool, PoolClient } from "pg";

export type DbConnector = Pool | PoolClient;

export interface ScopeFilter {
  tenantId: string | null;
  teamPositionIds: string[];
  isPlatformScope: boolean;
}

/** Raw per-subject feature values (null = absent → dropped + weights re-normalized). */
export interface RawFeatureRow {
  userId: string;
  tenantId: string;
  displayName: string | null;
  tenureYears: number | null;
  otRatio: number | null;
  absenceRatio: number | null;
  kpiAchievement: number | null;
  engagementAvg: number | null;
  compBandPct: number | null;
  daysSinceLastMove: number | null;
}

/** A computed score ready to persist. */
export interface ScoreToStore {
  userId: string;
  tenantId: string;
  value: number;
  band: string;
  modelVersion: string;
  payload: unknown;
}

/** A stored (active) score row joined to the live person row. */
export interface StoredScoreRow {
  userId: string;
  tenantId: string;
  displayName: string | null;
  value: number;
  band: string;
  modelVersion: string;
  computedAt: string;
  payload: Record<string, unknown>;
}

function num(x: unknown): number | null {
  if (x === null || x === undefined) return null;
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
}

/**
 * user-level scope WHERE for the `scoped` CTE. `u` = sys.sys_users, `a` = the
 * primary active assignment (LEFT JOINed by the caller).
 */
function userScopeClause(scope: ScopeFilter): { sql: string; params: unknown[] } {
  if (scope.isPlatformScope) return { sql: "TRUE", params: [] };
  const params: unknown[] = [scope.tenantId];
  const clauses = ["u.user_tenant_id = $1"];
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
`;

export async function extractFlightRiskFeatures(
  q: DbConnector,
  scope: ScopeFilter,
): Promise<RawFeatureRow[]> {
  const sc = userScopeClause(scope);
  const sql = `
    WITH scoped AS (
      SELECT DISTINCT u.user_id, u.user_tenant_id, u.user_display_name
      FROM sys.sys_users u
      ${PRIMARY_ASSIGNMENT_JOIN}
      WHERE u.user_status = 'ACTIVE' AND (${sc.sql})
    ),
    asg AS (
      SELECT user_position_assignment_user_id AS user_id,
             min(user_position_assignment_start_date) AS first_start,
             max(user_position_assignment_start_date) AS last_start
      FROM sys.sys_user_position_assignments
      WHERE user_position_assignment_start_date IS NOT NULL
      GROUP BY 1
    ),
    att AS (
      SELECT attendance_subject_user_id AS user_id,
             sum(attendance_hours_overtime) AS ot,
             sum(attendance_hours_regular + attendance_hours_overtime) AS worked,
             (count(*) FILTER (WHERE attendance_status = 'ABSENT'))::numeric
               / NULLIF(count(*), 0) AS absence_ratio
      FROM sys.sys_attendance
      GROUP BY 1
    ),
    kpi AS (
      SELECT user_kpi_evidence_user_id AS user_id,
             avg(user_kpi_evidence_measured_value / NULLIF(user_kpi_evidence_target_value, 0)) AS achievement
      FROM sys.sys_user_kpi_evidence
      WHERE user_kpi_evidence_target_value IS NOT NULL
      GROUP BY 1
    ),
    eng AS (
      -- response_answers is jsonb DEFAULT '{}' (an OBJECT) and the surveys module
      -- documents a dual shape (legacy=array, API-created default={}). Guard the
      -- LATERAL: a non-array payload yields zero elements (skipped) instead of
      -- raising "cannot extract elements from an object" — which would abort the
      -- whole recompute query for the entire scope, not just the offending row.
      SELECT r.response_subject_user_id AS user_id,
             avg(COALESCE((e->>'value')::numeric, (e->>'rating')::numeric)) AS engagement_avg
      FROM sys.sys_engagement_survey_responses r
      CROSS JOIN LATERAL jsonb_array_elements(
        CASE WHEN jsonb_typeof(r.response_answers) = 'array'
             THEN r.response_answers ELSE '[]'::jsonb END
      ) e
      WHERE ((e->>'question_type') = 'rating' OR (e ? 'rating'))
        AND COALESCE((e->>'value')::numeric, (e->>'rating')::numeric) IS NOT NULL
      GROUP BY 1
    ),
    comp AS (
      SELECT u.user_id,
             percent_rank() OVER (
               PARTITION BY u.user_tenant_id ORDER BY cb.compensation_band_mid_eur
             ) AS band_pct
      FROM sys.sys_users u
      JOIN sys.sys_user_position_assignments a
        ON a.user_position_assignment_user_id = u.user_id
       AND a.user_position_assignment_kind = 'PRIMARY'
       AND a.user_position_assignment_status = 'ACTIVE'
      JOIN sys.sys_position_compensation_profiles pcp
        ON pcp.position_id = a.user_position_assignment_position_id
      JOIN sys.sys_compensation_bands cb
        ON cb.compensation_band_id = pcp.compensation_band_id
      WHERE cb.compensation_band_mid_eur IS NOT NULL
    )
    SELECT s.user_id, s.user_tenant_id AS tenant_id, s.user_display_name AS display_name,
           CASE WHEN asg.first_start IS NOT NULL
                THEN (CURRENT_DATE - asg.first_start)::numeric / 365.25 END AS tenure_years,
           CASE WHEN att.worked IS NOT NULL AND att.worked > 0
                THEN att.ot / att.worked END AS ot_ratio,
           att.absence_ratio,
           kpi.achievement AS kpi_achievement,
           eng.engagement_avg,
           comp.band_pct AS comp_band_pct,
           CASE WHEN asg.last_start IS NOT NULL
                THEN (CURRENT_DATE - asg.last_start) END AS days_since_last_move
    FROM scoped s
    LEFT JOIN asg  ON asg.user_id  = s.user_id
    LEFT JOIN att  ON att.user_id  = s.user_id
    LEFT JOIN kpi  ON kpi.user_id  = s.user_id
    LEFT JOIN eng  ON eng.user_id  = s.user_id
    LEFT JOIN comp ON comp.user_id = s.user_id
    ORDER BY s.user_id
  `;
  const res = await q.query(sql, sc.params);
  return res.rows.map((r) => ({
    userId: r.user_id as string,
    tenantId: r.tenant_id as string,
    displayName: (r.display_name as string | null) ?? null,
    tenureYears: num(r.tenure_years),
    otRatio: num(r.ot_ratio),
    absenceRatio: num(r.absence_ratio),
    kpiAchievement: num(r.kpi_achievement),
    engagementAvg: num(r.engagement_avg),
    compBandPct: num(r.comp_band_pct),
    daysSinceLastMove: num(r.days_since_last_move),
  }));
}

/**
 * Append the recomputed scores in one INSERT (all rows share the transaction's
 * now() → a single computed_at cohort). Latest-wins on read; no destructive delete.
 */
export async function upsertFlightRiskScores(
  q: DbConnector,
  rows: ScoreToStore[],
): Promise<number> {
  if (rows.length === 0) return 0;
  const params: unknown[] = [];
  const tuples = rows.map((r, i) => {
    const b = i * 6;
    params.push(r.tenantId, r.userId, r.value, r.band, r.modelVersion, JSON.stringify(r.payload));
    return `($${b + 1}, $${b + 2}, $${b + 3}, $${b + 4}, $${b + 5}, $${b + 6}::jsonb)`;
  });
  await q.query(
    `INSERT INTO sys.sys_flight_risk_scores
       (flight_risk_score_tenant_id, flight_risk_score_user_id, flight_risk_score_value,
        flight_risk_score_band, flight_risk_score_model_version, flight_risk_score_payload)
     VALUES ${tuples.join(", ")}`,
    params,
  );
  return rows.length;
}

const ACTIVE_SCORE_JOIN_SELECT = `
  SELECT DISTINCT ON (fr.flight_risk_score_user_id)
         fr.flight_risk_score_user_id   AS user_id,
         fr.flight_risk_score_tenant_id AS tenant_id,
         u.user_display_name            AS display_name,
         fr.flight_risk_score_value     AS value,
         fr.flight_risk_score_band      AS band,
         fr.flight_risk_score_model_version AS model_version,
         fr.flight_risk_score_computed_at   AS computed_at,
         fr.flight_risk_score_payload       AS payload
  FROM sys.sys_flight_risk_scores fr
  JOIN sys.sys_users u ON u.user_id = fr.flight_risk_score_user_id
  LEFT JOIN sys.sys_user_position_assignments a
    ON a.user_position_assignment_user_id = fr.flight_risk_score_user_id
   AND a.user_position_assignment_kind = 'PRIMARY'
   AND a.user_position_assignment_status = 'ACTIVE'
`;

function mapStored(r: Record<string, unknown>): StoredScoreRow {
  return {
    userId: r.user_id as string,
    tenantId: r.tenant_id as string,
    displayName: (r.display_name as string | null) ?? null,
    value: Number(r.value),
    band: r.band as string,
    modelVersion: r.model_version as string,
    computedAt: (r.computed_at as Date).toISOString(),
    payload: (r.payload as Record<string, unknown>) ?? {},
  };
}

/** Scope WHERE for reads against the flight-risk rows (fr alias + a alias for TEAM). */
function readScopeClause(scope: ScopeFilter): { sql: string; params: unknown[] } {
  if (scope.isPlatformScope) return { sql: "TRUE", params: [] };
  const params: unknown[] = [scope.tenantId];
  const clauses = ["fr.flight_risk_score_tenant_id = $1"];
  if (scope.teamPositionIds.length > 0) {
    params.push(scope.teamPositionIds);
    clauses.push(`a.user_position_assignment_position_id = ANY($${params.length}::uuid[])`);
  }
  return { sql: clauses.join(" AND "), params };
}

export async function readFlightRiskScores(
  q: DbConnector,
  scope: ScopeFilter,
): Promise<StoredScoreRow[]> {
  const sc = readScopeClause(scope);
  const res = await q.query(
    `${ACTIVE_SCORE_JOIN_SELECT}
      WHERE ${sc.sql}
      ORDER BY fr.flight_risk_score_user_id, fr.flight_risk_score_computed_at DESC`,
    sc.params,
  );
  return res.rows.map(mapStored);
}

export async function readUserFlightRiskScore(
  q: DbConnector,
  scope: ScopeFilter,
  userId: string,
): Promise<StoredScoreRow | null> {
  const sc = readScopeClause(scope);
  const params = [...sc.params, userId];
  const res = await q.query(
    `${ACTIVE_SCORE_JOIN_SELECT}
      WHERE (${sc.sql}) AND fr.flight_risk_score_user_id = $${params.length}
      ORDER BY fr.flight_risk_score_user_id, fr.flight_risk_score_computed_at DESC`,
    params,
  );
  const row = res.rows[0];
  return row ? mapStored(row) : null;
}

/* ======================================================================== */
/* P2 — Slice B: succession-readiness  &  Slice C: skill-gap                 */
/* In-platform-derived over the ② embedding substrate + live sys.* features. */
/* ======================================================================== */

/** Raw per-(user, candidate target position) features for slice B. */
export interface ReadinessFeatureRow {
  userId: string;
  tenantId: string;
  displayName: string | null;
  positionId: string;
  positionCode: string | null;
  positionTitle: string | null;
  positionFit: number | null;   // cosine 0..1 (profile ↔ target role embedding)
  kpiAchievement: number | null; // measured/target ratio
  tenureYears: number | null;
}

/** A stored readiness/skill-gap row (band-or-horizon-or-segment in `category`). */
export interface StoredSubjectPositionRow {
  userId: string;
  tenantId: string;
  displayName: string | null;
  positionId: string;
  positionCode: string | null;
  positionTitle: string | null;
  value: number;
  category: string;
  modelVersion: string;
  computedAt: string;
  payload: Record<string, unknown>;
}

export interface SubjectPositionScoreToStore {
  userId: string;
  tenantId: string;
  positionId: string;
  value: number;
  category: string; // horizon (B) | segment (C)
  modelVersion: string;
  payload: unknown;
}

/**
 * Slice B feature extraction: each scoped user's top-N best-fit CANDIDATE target
 * positions (cosine profile ↔ position's job_role embedding, in-tenant, excluding the
 * user's current position) + KPI achievement + tenure. The service normalizes + weights.
 */
export async function extractReadinessFeatures(
  q: DbConnector,
  scope: ScopeFilter,
  topN: number,
): Promise<ReadinessFeatureRow[]> {
  const sc = userScopeClause(scope);
  const np = sc.params.length;
  const sql = `
    WITH scoped AS (
      SELECT DISTINCT u.user_id, u.user_tenant_id, u.user_display_name
      FROM sys.sys_users u
      ${PRIMARY_ASSIGNMENT_JOIN}
      WHERE u.user_status = 'ACTIVE' AND (${sc.sql})
    ),
    cur AS (
      SELECT user_position_assignment_user_id AS user_id, user_position_assignment_position_id AS position_id
      FROM sys.sys_user_position_assignments
      WHERE user_position_assignment_kind = 'PRIMARY' AND user_position_assignment_status = 'ACTIVE'
    ),
    cand AS (
      SELECT s.user_id, s.user_tenant_id AS tenant_id, s.user_display_name AS display_name,
             p.position_id, p.position_code, p.position_title,
             (1 - (jre.embedding <=> pe.embedding)) AS cosine,
             row_number() OVER (PARTITION BY s.user_id ORDER BY (jre.embedding <=> pe.embedding), p.position_code) AS rn
      FROM scoped s
      JOIN sys.sys_user_profile_embeddings pe ON pe.user_id = s.user_id
      JOIN sys.sys_positions p ON p.position_is_active = true AND p.position_tenant_id = s.user_tenant_id
      JOIN sys.sys_job_role_embeddings jre ON jre.job_role_id = p.position_job_role_id
      LEFT JOIN cur ON cur.user_id = s.user_id
      WHERE p.position_id IS DISTINCT FROM cur.position_id
    ),
    kpi AS (
      SELECT user_kpi_evidence_user_id AS user_id,
             avg(user_kpi_evidence_measured_value / NULLIF(user_kpi_evidence_target_value, 0)) AS achievement
      FROM sys.sys_user_kpi_evidence
      WHERE user_kpi_evidence_target_value IS NOT NULL
      GROUP BY 1
    ),
    ten AS (
      SELECT user_position_assignment_user_id AS user_id, min(user_position_assignment_start_date) AS first_start
      FROM sys.sys_user_position_assignments
      WHERE user_position_assignment_start_date IS NOT NULL
      GROUP BY 1
    )
    SELECT c.user_id, c.tenant_id, c.display_name, c.position_id, c.position_code, c.position_title,
           c.cosine AS position_fit, kpi.achievement AS kpi_achievement,
           CASE WHEN ten.first_start IS NOT NULL THEN (CURRENT_DATE - ten.first_start)::numeric / 365.25 END AS tenure_years
    FROM cand c
    LEFT JOIN kpi ON kpi.user_id = c.user_id
    LEFT JOIN ten ON ten.user_id = c.user_id
    WHERE c.rn <= $${np + 1}
    ORDER BY c.user_id, c.rn
  `;
  const res = await q.query(sql, [...sc.params, topN]);
  return res.rows.map((r) => ({
    userId: r.user_id as string,
    tenantId: r.tenant_id as string,
    displayName: (r.display_name as string | null) ?? null,
    positionId: r.position_id as string,
    positionCode: (r.position_code as string | null) ?? null,
    positionTitle: (r.position_title as string | null) ?? null,
    positionFit: num(r.position_fit),
    kpiAchievement: num(r.kpi_achievement),
    tenureYears: num(r.tenure_years),
  }));
}

/** Raw per-user features for slice C (current-role skill-gap). */
export interface SkillGapFeatureRow {
  userId: string;
  tenantId: string;
  displayName: string | null;
  positionId: string;
  positionCode: string | null;
  positionTitle: string | null;
  currentRoleFit: number | null; // cosine 0..1 (profile ↔ current role embedding)
  evidenceCount: number | null;  // # distinct skills with evidence
}

/**
 * Slice C feature extraction: each scoped user's cosine fit to their CURRENT position's
 * role embedding + skill-evidence sparsity (distinct-skill count). The service derives the
 * gap (1 - cosine) blended with evidence sparsity.
 */
export async function extractSkillGapFeatures(
  q: DbConnector,
  scope: ScopeFilter,
): Promise<SkillGapFeatureRow[]> {
  const sc = userScopeClause(scope);
  const sql = `
    WITH scoped AS (
      SELECT DISTINCT u.user_id, u.user_tenant_id, u.user_display_name
      FROM sys.sys_users u
      ${PRIMARY_ASSIGNMENT_JOIN}
      WHERE u.user_status = 'ACTIVE' AND (${sc.sql})
    )
    SELECT s.user_id, s.user_tenant_id AS tenant_id, s.user_display_name AS display_name,
           p.position_id, p.position_code, p.position_title,
           (1 - (jre.embedding <=> pe.embedding)) AS current_role_fit,
           pe.derived_from_evidence_count AS evidence_count
    FROM scoped s
    JOIN sys.sys_user_profile_embeddings pe ON pe.user_id = s.user_id
    JOIN sys.sys_user_position_assignments a ON a.user_position_assignment_user_id = s.user_id
      AND a.user_position_assignment_kind = 'PRIMARY' AND a.user_position_assignment_status = 'ACTIVE'
    JOIN sys.sys_positions p ON p.position_id = a.user_position_assignment_position_id
    JOIN sys.sys_job_role_embeddings jre ON jre.job_role_id = p.position_job_role_id
    ORDER BY s.user_id
  `;
  const res = await q.query(sql, sc.params);
  return res.rows.map((r) => ({
    userId: r.user_id as string,
    tenantId: r.tenant_id as string,
    displayName: (r.display_name as string | null) ?? null,
    positionId: r.position_id as string,
    positionCode: (r.position_code as string | null) ?? null,
    positionTitle: (r.position_title as string | null) ?? null,
    currentRoleFit: num(r.current_role_fit),
    evidenceCount: num(r.evidence_count),
  }));
}

// ── Upserts (append-with-latest-wins) ──
export async function upsertReadinessScores(q: DbConnector, rows: SubjectPositionScoreToStore[]): Promise<number> {
  if (rows.length === 0) return 0;
  const params: unknown[] = [];
  const tuples = rows.map((r, i) => {
    const b = i * 7;
    params.push(r.tenantId, r.userId, r.positionId, r.value, r.category, r.modelVersion, JSON.stringify(r.payload));
    return `($${b + 1}, $${b + 2}, $${b + 3}, $${b + 4}, $${b + 5}, $${b + 6}, $${b + 7}::jsonb)`;
  });
  await q.query(
    `INSERT INTO sys.sys_succession_readiness_scores
       (succession_readiness_score_tenant_id, succession_readiness_score_user_id, succession_readiness_score_position_id,
        succession_readiness_score_value, succession_readiness_score_horizon, succession_readiness_score_model_version, succession_readiness_score_payload)
     VALUES ${tuples.join(", ")}`,
    params,
  );
  return rows.length;
}

export async function upsertSkillGapScores(q: DbConnector, rows: SubjectPositionScoreToStore[]): Promise<number> {
  if (rows.length === 0) return 0;
  const params: unknown[] = [];
  const tuples = rows.map((r, i) => {
    const b = i * 7;
    params.push(r.tenantId, r.userId, r.positionId, r.value, r.category, r.modelVersion, JSON.stringify(r.payload));
    return `($${b + 1}, $${b + 2}, $${b + 3}, $${b + 4}, $${b + 5}, $${b + 6}, $${b + 7}::jsonb)`;
  });
  await q.query(
    `INSERT INTO sys.sys_skill_gap_scores
       (skill_gap_score_tenant_id, skill_gap_score_user_id, skill_gap_score_position_id,
        skill_gap_score_value, skill_gap_score_segment, skill_gap_score_model_version, skill_gap_score_payload)
     VALUES ${tuples.join(", ")}`,
    params,
  );
  return rows.length;
}

function mapSubjectPosition(r: Record<string, unknown>): StoredSubjectPositionRow {
  return {
    userId: r.user_id as string,
    tenantId: r.tenant_id as string,
    displayName: (r.display_name as string | null) ?? null,
    positionId: r.position_id as string,
    positionCode: (r.position_code as string | null) ?? null,
    positionTitle: (r.position_title as string | null) ?? null,
    value: Number(r.value),
    category: r.category as string,
    modelVersion: r.model_version as string,
    computedAt: (r.computed_at as Date).toISOString(),
    payload: (r.payload as Record<string, unknown>) ?? {},
  };
}

export async function readReadinessScores(q: DbConnector, scope: ScopeFilter): Promise<StoredSubjectPositionRow[]> {
  const params: unknown[] = [];
  let where = "TRUE";
  if (!scope.isPlatformScope) {
    params.push(scope.tenantId);
    const clauses = ["sr.succession_readiness_score_tenant_id = $1"];
    if (scope.teamPositionIds.length > 0) {
      params.push(scope.teamPositionIds);
      clauses.push(`a.user_position_assignment_position_id = ANY($${params.length}::uuid[])`);
    }
    where = clauses.join(" AND ");
  }
  const res = await q.query(
    `SELECT DISTINCT ON (sr.succession_readiness_score_user_id, sr.succession_readiness_score_position_id)
            sr.succession_readiness_score_user_id   AS user_id,
            sr.succession_readiness_score_tenant_id AS tenant_id,
            u.user_display_name                     AS display_name,
            sr.succession_readiness_score_position_id AS position_id,
            p.position_code, p.position_title,
            sr.succession_readiness_score_value         AS value,
            sr.succession_readiness_score_horizon       AS category,
            sr.succession_readiness_score_model_version AS model_version,
            sr.succession_readiness_score_computed_at   AS computed_at,
            sr.succession_readiness_score_payload       AS payload
     FROM sys.sys_succession_readiness_scores sr
     JOIN sys.sys_users u ON u.user_id = sr.succession_readiness_score_user_id
     LEFT JOIN sys.sys_positions p ON p.position_id = sr.succession_readiness_score_position_id
     LEFT JOIN sys.sys_user_position_assignments a
       ON a.user_position_assignment_user_id = sr.succession_readiness_score_user_id
      AND a.user_position_assignment_kind = 'PRIMARY' AND a.user_position_assignment_status = 'ACTIVE'
     WHERE ${where}
     ORDER BY sr.succession_readiness_score_user_id, sr.succession_readiness_score_position_id, sr.succession_readiness_score_computed_at DESC`,
    params,
  );
  return res.rows.map(mapSubjectPosition);
}

export async function readSkillGapScores(q: DbConnector, scope: ScopeFilter): Promise<StoredSubjectPositionRow[]> {
  const params: unknown[] = [];
  let where = "TRUE";
  if (!scope.isPlatformScope) {
    params.push(scope.tenantId);
    const clauses = ["sg.skill_gap_score_tenant_id = $1"];
    if (scope.teamPositionIds.length > 0) {
      params.push(scope.teamPositionIds);
      clauses.push(`a.user_position_assignment_position_id = ANY($${params.length}::uuid[])`);
    }
    where = clauses.join(" AND ");
  }
  const res = await q.query(
    `SELECT DISTINCT ON (sg.skill_gap_score_user_id)
            sg.skill_gap_score_user_id   AS user_id,
            sg.skill_gap_score_tenant_id AS tenant_id,
            u.user_display_name          AS display_name,
            sg.skill_gap_score_position_id AS position_id,
            p.position_code, p.position_title,
            sg.skill_gap_score_value         AS value,
            sg.skill_gap_score_segment       AS category,
            sg.skill_gap_score_model_version AS model_version,
            sg.skill_gap_score_computed_at   AS computed_at,
            sg.skill_gap_score_payload       AS payload
     FROM sys.sys_skill_gap_scores sg
     JOIN sys.sys_users u ON u.user_id = sg.skill_gap_score_user_id
     LEFT JOIN sys.sys_positions p ON p.position_id = sg.skill_gap_score_position_id
     LEFT JOIN sys.sys_user_position_assignments a
       ON a.user_position_assignment_user_id = sg.skill_gap_score_user_id
      AND a.user_position_assignment_kind = 'PRIMARY' AND a.user_position_assignment_status = 'ACTIVE'
     WHERE ${where}
     ORDER BY sg.skill_gap_score_user_id, sg.skill_gap_score_computed_at DESC`,
    params,
  );
  return res.rows.map(mapSubjectPosition);
}
