/**
 * apps/api/src/modules/capability-composition/repository.ts
 * Raw parameterized SQL for the MLCE (Gap#1 Step 3).
 *
 * READS: loadScoringInputs gathers everything one tenant's bottom-up compute needs
 * (positions, OU adjacency, PRIMARY-ACTIVE incumbents, per-position required skills
 * with their required rank, per-(user,skill) latest held rank). Proficiency ranks
 * resolve via sys_skill_proficiency_levels (NOVICE=1..MASTER=6) in SQL.
 * WRITES: replaceScores / replaceLineage are bounded delete-then-insert per tenant
 * cohort (D-18) — re-running never grows the tables; one cohort per tenant at a time.
 */
import type { Pool, PoolClient } from "pg";
import { pool } from "../../db/client.js";
import type { CapabilitySubjectType } from "@heuresys/shared";

type Queryable = Pool | PoolClient;

/* ----------------------------- read: inputs ----------------------------- */

export interface PositionInput {
  positionId: string;
  ouId: string | null;
  title: string | null;
  criticality: string | null;
  /** Mid-point of the position's compensation band, in EUR. Null when the position has no band. */
  economicBaseEur: number | null;
}
export interface OrgUnitInput {
  id: string;
  parentId: string | null;
  name: string | null;
}
export interface AssignmentInput {
  userId: string;
  positionId: string;
  fte: number;
}
export interface RequirementInput {
  positionId: string;
  skillId: string;
  weight: number;
  criticality: string;
  requiredRank: number;
}
export interface HeldInput {
  userId: string;
  skillId: string;
  heldRank: number;
}

export interface ScoringInputs {
  tenantId: string;
  tenantName: string | null;
  positions: PositionInput[];
  orgUnits: OrgUnitInput[];
  assignments: AssignmentInput[];
  requirements: RequirementInput[];
  held: HeldInput[];
  userNames: Map<string, string | null>;
}

export async function loadActiveTenantIds(q: Queryable = pool): Promise<string[]> {
  const res = await q.query<{ tenant_id: string }>(
    `SELECT tenant_id FROM sys.sys_tenancies WHERE tenant_status = 'ACTIVE' ORDER BY tenant_id`,
  );
  return res.rows.map((r) => r.tenant_id);
}

export async function loadScoringInputs(tenantId: string, q: Queryable = pool): Promise<ScoringInputs> {
  const [tenant, positions, orgUnits, assignments, requirements, held, users] = await Promise.all([
    q.query<{ tenant_name: string | null }>(
      `SELECT tenant_name FROM sys.sys_tenancies WHERE tenant_id = $1`, [tenantId]),
    // #88 — the economic base is the compensation band, as in F1 and F2.
    // `sys_positions.position_economic_weight` is NOT read: it is NULL on every row, so the
    // COALESCE below it always fell through to the criticality factor, and 160 of 181 positions
    // are MEDIUM — the org-unit roll-up was effectively an unweighted mean.
    q.query<{ position_id: string; ou_id: string | null; title: string | null; criticality: string | null; economic_base_eur: string | null }>(
      `SELECT p.position_id, p.position_organization_unit_id AS ou_id, p.position_title AS title,
              p.position_criticality AS criticality,
              avg(cb.compensation_band_mid_eur)::text AS economic_base_eur
         FROM sys.sys_positions p
         LEFT JOIN sys.sys_position_compensation_profiles pcp ON pcp.position_id = p.position_id
         LEFT JOIN sys.sys_compensation_bands cb ON cb.compensation_band_id = pcp.compensation_band_id
        WHERE p.position_tenant_id = $1 AND p.position_is_active
        GROUP BY p.position_id, p.position_organization_unit_id, p.position_title, p.position_criticality`, [tenantId]),
    q.query<{ id: string; parent_id: string | null; name: string | null }>(
      `SELECT organization_unit_id AS id, organization_unit_parent_id AS parent_id, organization_unit_name AS name
         FROM sys.sys_organization_units
        WHERE organization_unit_tenant_id = $1 AND organization_unit_is_active`, [tenantId]),
    q.query<{ user_id: string; position_id: string; fte: string | null }>(
      `SELECT user_position_assignment_user_id AS user_id, user_position_assignment_position_id AS position_id,
              user_position_assignment_fte AS fte
         FROM sys.sys_user_position_assignments
        WHERE user_position_assignment_tenant_id = $1
          AND user_position_assignment_kind = 'PRIMARY'
          AND user_position_assignment_status = 'ACTIVE'`, [tenantId]),
    q.query<{ position_id: string; skill_id: string; weight: string; criticality: string; required_rank: number }>(
      `SELECT r.position_id, r.skill_id, r.weight, r.criticality, lvl.skill_proficiency_level_rank AS required_rank
         FROM sys.sys_position_skill_requirements r
         JOIN sys.sys_skill_proficiency_levels lvl ON lvl.skill_proficiency_level_code = r.required_proficiency
         JOIN sys.sys_positions p ON p.position_id = r.position_id
        WHERE r.position_skill_requirement_tenant_id = $1 AND p.position_is_active`, [tenantId]),
    q.query<{ user_id: string; skill_id: string; held_rank: number }>(
      `SELECT DISTINCT ON (e.user_skill_evidence_user_id, e.user_skill_evidence_skill_id)
              e.user_skill_evidence_user_id AS user_id, e.user_skill_evidence_skill_id AS skill_id,
              lvl.skill_proficiency_level_rank AS held_rank
         FROM sys.sys_user_skill_evidence e
         JOIN sys.sys_skill_proficiency_levels lvl ON lvl.skill_proficiency_level_code = e.user_skill_evidence_declared_proficiency
        WHERE e.user_skill_evidence_tenant_id = $1
        ORDER BY e.user_skill_evidence_user_id, e.user_skill_evidence_skill_id, e.user_skill_evidence_assessed_at DESC NULLS LAST`, [tenantId]),
    q.query<{ user_id: string; user_display_name: string | null }>(
      `SELECT user_id, user_display_name FROM sys.sys_users WHERE user_tenant_id = $1`, [tenantId]),
  ]);

  return {
    tenantId,
    tenantName: tenant.rows[0]?.tenant_name ?? null,
    positions: positions.rows.map((p) => ({
      positionId: p.position_id, ouId: p.ou_id, title: p.title, criticality: p.criticality,
      economicBaseEur: p.economic_base_eur === null ? null : Number(p.economic_base_eur),
    })),
    orgUnits: orgUnits.rows.map((o) => ({ id: o.id, parentId: o.parent_id, name: o.name })),
    assignments: assignments.rows.map((a) => ({
      userId: a.user_id, positionId: a.position_id, fte: a.fte === null ? 1 : Number(a.fte),
    })),
    requirements: requirements.rows.map((r) => ({
      positionId: r.position_id, skillId: r.skill_id, weight: Number(r.weight),
      criticality: r.criticality, requiredRank: r.required_rank,
    })),
    held: held.rows.map((h) => ({ userId: h.user_id, skillId: h.skill_id, heldRank: h.held_rank })),
    userNames: new Map(users.rows.map((u) => [u.user_id, u.user_display_name])),
  };
}

/* ----------------------------- write: cohort ----------------------------- */

export interface ScoreRow {
  tenantId: string;
  subjectType: CapabilitySubjectType;
  subjectId: string;
  value: number;
  coverage: number;
  aggregationMode: string;
  modelVersion: string;
  childCount: number;
  payload: unknown;
}
export interface LineageRow {
  tenantId: string;
  parentType: CapabilitySubjectType;
  parentId: string;
  childType: CapabilitySubjectType;
  childId: string;
  childValue: number;
  weight: number;
}

/** Bounded delete-then-insert: replace the whole tenant cohort atomically (D-18). */
export async function replaceScores(client: PoolClient, tenantId: string, rows: ScoreRow[]): Promise<number> {
  await client.query(`DELETE FROM sys.sys_capability_scores WHERE capability_score_tenant_id = $1`, [tenantId]);
  if (rows.length === 0) return 0;
  const params: unknown[] = [];
  const tuples = rows.map((r) => {
    const b = params.length;
    params.push(r.tenantId, r.subjectType, r.subjectId, r.value, r.coverage, r.aggregationMode, r.modelVersion, r.childCount, JSON.stringify(r.payload));
    return `($${b + 1}, $${b + 2}, $${b + 3}, $${b + 4}, $${b + 5}, $${b + 6}, $${b + 7}, $${b + 8}, $${b + 9}::jsonb)`;
  });
  await client.query(
    `INSERT INTO sys.sys_capability_scores
       (capability_score_tenant_id, capability_score_subject_type, capability_score_subject_id,
        capability_score_value, capability_score_coverage, capability_score_aggregation_mode,
        capability_score_model_version, capability_score_child_count, capability_score_payload)
     VALUES ${tuples.join(", ")}`, params,
  );
  return rows.length;
}

export async function replaceLineage(client: PoolClient, tenantId: string, rows: LineageRow[]): Promise<number> {
  await client.query(`DELETE FROM sys.sys_capability_score_lineage WHERE capability_score_lineage_tenant_id = $1`, [tenantId]);
  if (rows.length === 0) return 0;
  const params: unknown[] = [];
  const tuples = rows.map((r) => {
    const b = params.length;
    params.push(r.tenantId, r.parentType, r.parentId, r.childType, r.childId, r.childValue, r.weight);
    return `($${b + 1}, $${b + 2}, $${b + 3}, $${b + 4}, $${b + 5}, $${b + 6}, $${b + 7})`;
  });
  await client.query(
    `INSERT INTO sys.sys_capability_score_lineage
       (capability_score_lineage_tenant_id, capability_score_lineage_parent_type, capability_score_lineage_parent_id,
        capability_score_lineage_child_type, capability_score_lineage_child_id,
        capability_score_lineage_child_value, capability_score_lineage_weight)
     VALUES ${tuples.join(", ")}`, params,
  );
  return rows.length;
}

/* ----------------------------- read: scores ----------------------------- */

export interface ActiveScoreRow {
  subjectType: CapabilitySubjectType;
  subjectId: string;
  tenantId: string;
  value: number;
  coverage: number;
  aggregationMode: string;
  modelVersion: string;
  childCount: number;
  computedAt: Date;
  label: string | null;
}

const SCORE_SELECT = `
  SELECT DISTINCT ON (s.capability_score_tenant_id, s.capability_score_subject_type, s.capability_score_subject_id)
         s.capability_score_subject_type     AS subject_type,
         s.capability_score_subject_id       AS subject_id,
         s.capability_score_tenant_id        AS tenant_id,
         s.capability_score_value            AS value,
         s.capability_score_coverage         AS coverage,
         s.capability_score_aggregation_mode AS aggregation_mode,
         s.capability_score_model_version    AS model_version,
         s.capability_score_child_count      AS child_count,
         s.capability_score_computed_at      AS computed_at,
         COALESCE(u.user_display_name, p.position_title, ou.organization_unit_name, t.tenant_name) AS label
    FROM sys.sys_capability_scores s
    LEFT JOIN sys.sys_users u              ON s.capability_score_subject_type = 'EMPLOYEE' AND u.user_id = s.capability_score_subject_id
    LEFT JOIN sys.sys_positions p          ON s.capability_score_subject_type = 'POSITION' AND p.position_id = s.capability_score_subject_id
    LEFT JOIN sys.sys_organization_units ou ON s.capability_score_subject_type = 'ORG_UNIT' AND ou.organization_unit_id = s.capability_score_subject_id
    LEFT JOIN sys.sys_tenancies t          ON s.capability_score_subject_type = 'ORG' AND t.tenant_id = s.capability_score_subject_id
`;

function mapScoreRow(r: Record<string, unknown>): ActiveScoreRow {
  return {
    subjectType: r.subject_type as CapabilitySubjectType,
    subjectId: r.subject_id as string,
    tenantId: r.tenant_id as string,
    value: Number(r.value),
    coverage: Number(r.coverage),
    aggregationMode: r.aggregation_mode as string,
    modelVersion: r.model_version as string,
    childCount: Number(r.child_count),
    computedAt: r.computed_at as Date,
    label: (r.label as string | null) ?? null,
  };
}

export async function listActiveScores(
  scope: { tenantId: string | null; userIdAllowList?: string[] }, subjectType: CapabilitySubjectType | undefined, q: Queryable = pool,
): Promise<ActiveScoreRow[]> {
  const clauses: string[] = [];
  const params: unknown[] = [];
  if (scope.tenantId !== null) { params.push(scope.tenantId); clauses.push(`s.capability_score_tenant_id = $${params.length}`); }
  if (subjectType) { params.push(subjectType); clauses.push(`s.capability_score_subject_type = $${params.length}`); }
  // ADR-0027 F3 (D-50): restrict EMPLOYEE (per-person) rows to the actor's org read-scope allow-list.
  // POSITION / ORG_UNIT / ORG are aggregates (no individual sensitive data) → never id-filtered.
  if (scope.userIdAllowList && subjectType === "EMPLOYEE") {
    params.push(scope.userIdAllowList);
    clauses.push(`s.capability_score_subject_id = ANY($${params.length}::uuid[])`);
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const res = await q.query(
    `${SCORE_SELECT} ${where}
     ORDER BY s.capability_score_tenant_id, s.capability_score_subject_type, s.capability_score_subject_id,
              s.capability_score_computed_at DESC`, params,
  );
  return res.rows.map(mapScoreRow);
}

export async function getActiveScore(
  scope: { tenantId: string | null }, subjectType: CapabilitySubjectType, subjectId: string, q: Queryable = pool,
): Promise<ActiveScoreRow | null> {
  const params: unknown[] = [subjectType, subjectId];
  let tenantClause = "";
  if (scope.tenantId !== null) { params.push(scope.tenantId); tenantClause = `AND s.capability_score_tenant_id = $3`; }
  const res = await q.query(
    `${SCORE_SELECT}
      WHERE s.capability_score_subject_type = $1 AND s.capability_score_subject_id = $2 ${tenantClause}
      ORDER BY s.capability_score_tenant_id, s.capability_score_subject_type, s.capability_score_subject_id,
               s.capability_score_computed_at DESC
      LIMIT 1`, params,
  );
  const row = res.rows[0];
  return row ? mapScoreRow(row) : null;
}

export interface ActiveLineageRow {
  childType: CapabilitySubjectType;
  childId: string;
  childValue: number;
  weight: number;
  childLabel: string | null;
}

/** Lineage of one active parent (one cohort per tenant -> no computed_at filter needed). */
export async function getActiveLineage(
  tenantId: string, parentType: CapabilitySubjectType, parentId: string, q: Queryable = pool,
): Promise<ActiveLineageRow[]> {
  const res = await q.query<{ child_type: string; child_id: string; child_value: string; weight: string; child_label: string | null }>(
    `SELECT l.capability_score_lineage_child_type AS child_type,
            l.capability_score_lineage_child_id   AS child_id,
            l.capability_score_lineage_child_value AS child_value,
            l.capability_score_lineage_weight     AS weight,
            COALESCE(u.user_display_name, p.position_title, ou.organization_unit_name) AS child_label
       FROM sys.sys_capability_score_lineage l
       LEFT JOIN sys.sys_users u               ON l.capability_score_lineage_child_type = 'EMPLOYEE' AND u.user_id = l.capability_score_lineage_child_id
       LEFT JOIN sys.sys_positions p           ON l.capability_score_lineage_child_type = 'POSITION' AND p.position_id = l.capability_score_lineage_child_id
       LEFT JOIN sys.sys_organization_units ou ON l.capability_score_lineage_child_type = 'ORG_UNIT' AND ou.organization_unit_id = l.capability_score_lineage_child_id
      WHERE l.capability_score_lineage_tenant_id = $1
        AND l.capability_score_lineage_parent_type = $2
        AND l.capability_score_lineage_parent_id = $3
      ORDER BY l.capability_score_lineage_weight DESC`, [tenantId, parentType, parentId],
  );
  return res.rows.map((r) => ({
    childType: r.child_type as CapabilitySubjectType,
    childId: r.child_id,
    childValue: Number(r.child_value),
    weight: Number(r.weight),
    childLabel: r.child_label,
  }));
}

/* ------------------------- #55 F1 essential-capability ranker ------------------------- */

export interface EssentialRankRow {
  skillId: string;
  skillCode: string;
  skillName: string;
  positionsRequiring: number;
  criticalPositions: number;
  econPercentile: number; // [0,1] percentile of avg comp-band value across requiring positions
  critShare: number; // [0,1] weighted share of CRITICAL positions requiring the skill
  scarcity: number; // [0,1] 1 - coverage(holders/demand)
  maturity: number; // [0,1] avg held rank of holders / max rank
  holders: number;
}

/**
 * One deterministic query producing the essential-capability inputs per skill, org-wide
 * (aggregate — no per-person data leaves this). Only skills actually REQUIRED by ≥1 active
 * position are in play. Every component is measured live:
 *   - econ: avg comp-band mid_eur of the requiring positions, expressed as a tenant-wide
 *     percentile across the in-play skills (scale-free, same idiom as the comp/engagement
 *     features);
 *   - critShare: share of requiring positions weighted by criticality;
 *   - scarcity: 1 - clamp(holders / positions_requiring, 0, 1) — under-supply vs demand;
 *   - maturity: avg held proficiency rank of the holders / 5 (MASTER=6 unused by the data).
 */
export async function loadEssentialRankInputs(
  tenantId: string | null,
  q: Queryable = pool,
): Promise<EssentialRankRow[]> {
  const params: unknown[] = [];
  let tenantClause = "";
  if (tenantId) {
    params.push(tenantId);
    tenantClause = `AND p.position_tenant_id = $${params.length}`;
  }
  const res = await q.query<{
    skill_id: string; skill_code: string; skill_name: string;
    positions_requiring: number; critical_positions: number;
    avg_econ: string | null; crit_share: string; holders: number; avg_held_rank: string | null;
  }>(
    `WITH demand AS (
       SELECT r.skill_id,
              count(DISTINCT p.position_id) AS positions_requiring,
              count(DISTINCT p.position_id) FILTER (WHERE p.position_criticality = 'CRITICAL') AS critical_positions,
              avg(cb.compensation_band_mid_eur) AS avg_econ,
              avg(CASE p.position_criticality
                    WHEN 'CRITICAL' THEN 1.0 WHEN 'HIGH' THEN 0.75
                    WHEN 'MEDIUM' THEN 0.5 WHEN 'LOW' THEN 0.25 ELSE 0.5 END) AS crit_share
         FROM sys.sys_position_skill_requirements r
         JOIN sys.sys_positions p ON p.position_id = r.position_id AND p.position_is_active
         LEFT JOIN sys.sys_position_compensation_profiles pcp ON pcp.position_id = p.position_id
         LEFT JOIN sys.sys_compensation_bands cb ON cb.compensation_band_id = pcp.compensation_band_id
        WHERE true ${tenantClause}
        GROUP BY r.skill_id
     ),
     supply AS (
       SELECT us.user_skill_skill_id AS skill_id,
              count(DISTINCT us.user_skill_user_id) AS holders,
              avg(pl.skill_proficiency_level_rank) AS avg_held_rank
         FROM sys.sys_user_skills us
         LEFT JOIN sys.sys_skill_proficiency_levels pl
                ON pl.skill_proficiency_level_code = us.user_skill_proficiency
        GROUP BY us.user_skill_skill_id
     )
     SELECT s.skill_id, s.skill_code, s.skill_name,
            d.positions_requiring::int, d.critical_positions::int,
            d.avg_econ, d.crit_share::text,
            COALESCE(sup.holders, 0)::int AS holders,
            sup.avg_held_rank::text
       FROM demand d
       JOIN sys.sys_skills s ON s.skill_id = d.skill_id
       LEFT JOIN supply sup ON sup.skill_id = d.skill_id`,
    params,
  );

  // econ percentile is computed in JS over the in-play set (small, ≤ few hundred): rank the
  // non-null econ values, tie-aware, into [0,1]. A skill with no comp-band info gets 0.
  const econVals = res.rows
    .map((r) => (r.avg_econ === null ? null : Number(r.avg_econ)))
    .filter((v): v is number => v !== null)
    .sort((a, b) => a - b);
  const econPercentile = (v: number | null): number => {
    if (v === null || econVals.length <= 1) return v === null ? 0 : 0.5;
    const below = econVals.filter((x) => x < v).length;
    return below / (econVals.length - 1);
  };

  return res.rows.map((r) => {
    const holders = r.holders;
    const demand = r.positions_requiring;
    const coverage = demand > 0 ? Math.min(1, holders / demand) : (holders > 0 ? 1 : 0);
    const avgEcon = r.avg_econ === null ? null : Number(r.avg_econ);
    const avgRank = r.avg_held_rank === null ? null : Number(r.avg_held_rank);
    return {
      skillId: r.skill_id,
      skillCode: r.skill_code,
      skillName: r.skill_name,
      positionsRequiring: r.positions_requiring,
      criticalPositions: r.critical_positions,
      econPercentile: econPercentile(avgEcon),
      critShare: Math.min(1, Math.max(0, Number(r.crit_share))),
      scarcity: 1 - coverage,
      maturity: avgRank === null ? 0 : Math.min(1, avgRank / 5),
      holders,
    };
  });
}

/* --------------------- read: #56 F2 VRIO scorecard inputs --------------------- */

export interface VrioGroupRow {
  skillGroupId: string;
  skillGroupName: string;
  skillCount: number;
  // demand / value
  positionsRequiring: number;
  criticalPositions: number;
  totalRequirements: number;
  avgEcon: number | null;
  critShare: number;
  // supply / rarity + inimitability
  holders: number;
  avgHeldRank: number | null;
  verifiedShare: number;
  evidenceShare: number;
  // organization
  coveredRequirements: number;
}

export interface VrioInputs {
  headcount: number;
  groups: VrioGroupRow[];
}

/**
 * Gathers the VRIO scorecard inputs for one tenant, aggregated at SKILL GROUP level.
 * Only groups that are actually in play (demanded by a position or held by someone) come
 * back — a taxonomy group nobody uses is not a capability of this organization.
 *
 * The economic base is the position compensation band (as in F1), not
 * sys_positions.position_economic_weight: that column is NULL on every row today.
 */
export async function loadVrioInputs(tenantId: string | null, q: Queryable = pool): Promise<VrioInputs> {
  const params: unknown[] = [];
  let posTenant = "";
  let usrTenant = "";
  if (tenantId) {
    params.push(tenantId);
    posTenant = `AND p.position_tenant_id = $${params.length}`;
    usrTenant = `AND us.user_skill_tenant_id = $${params.length}`;
  }

  const headcountRes = await q.query<{ headcount: string }>(
    `SELECT count(*)::text AS headcount FROM sys.sys_users u
      WHERE ($1::uuid IS NULL OR u.user_tenant_id = $1::uuid)`,
    [tenantId],
  );
  const headcount = Number(headcountRes.rows[0]?.headcount ?? 0);

  const res = await q.query<{
    skill_group_id: string; skill_group_name: string; skill_count: string;
    positions_requiring: string; critical_positions: string; total_requirements: string;
    avg_econ: string | null; crit_share: string | null;
    holders: string; avg_held_rank: string | null; verified_share: string | null; evidence_share: string | null;
    covered_requirements: string;
  }>(
    `WITH demand AS (
       SELECT s.skill_group_id,
              count(DISTINCT r.position_id)                                          AS positions_requiring,
              count(*)                                                               AS total_requirements,
              count(DISTINCT r.position_id) FILTER (WHERE p.position_criticality = 'CRITICAL') AS critical_positions,
              avg(cb.compensation_band_mid_eur)                                      AS avg_econ,
              avg(CASE p.position_criticality
                    WHEN 'CRITICAL' THEN 1.0 WHEN 'HIGH' THEN 0.75
                    WHEN 'MEDIUM' THEN 0.5  WHEN 'LOW'  THEN 0.25 ELSE 0.5 END)      AS crit_share
         FROM sys.sys_position_skill_requirements r
         JOIN sys.sys_positions p ON p.position_id = r.position_id AND p.position_is_active
         JOIN sys.sys_skills s    ON s.skill_id = r.skill_id AND s.skill_group_id IS NOT NULL
         LEFT JOIN sys.sys_position_compensation_profiles pcp ON pcp.position_id = p.position_id
         LEFT JOIN sys.sys_compensation_bands cb ON cb.compensation_band_id = pcp.compensation_band_id
        WHERE true ${posTenant}
        GROUP BY s.skill_group_id
     ),
     covered AS (
       SELECT s.skill_group_id, count(*) AS covered_requirements
         FROM sys.sys_position_skill_requirements r
         JOIN sys.sys_positions p ON p.position_id = r.position_id AND p.position_is_active
         JOIN sys.sys_skills s    ON s.skill_id = r.skill_id AND s.skill_group_id IS NOT NULL
         JOIN sys.sys_user_position_assignments a
              ON a.user_position_assignment_position_id = p.position_id
             AND a.user_position_assignment_kind = 'PRIMARY'
             AND a.user_position_assignment_status = 'ACTIVE'
         JOIN sys.sys_user_skills us
              ON us.user_skill_user_id = a.user_position_assignment_user_id
             AND us.user_skill_skill_id = r.skill_id
        WHERE true ${posTenant}
        GROUP BY s.skill_group_id
     ),
     supply AS (
       SELECT s.skill_group_id,
              count(DISTINCT us.user_skill_user_id)                          AS holders,
              avg(pl.skill_proficiency_level_rank)                           AS avg_held_rank,
              avg(CASE WHEN us.user_skill_is_verified THEN 1.0 ELSE 0.0 END) AS verified_share,
              avg(CASE WHEN ev.cnt > 0 THEN 1.0 ELSE 0.0 END)                AS evidence_share
         FROM sys.sys_user_skills us
         JOIN sys.sys_skills s ON s.skill_id = us.user_skill_skill_id AND s.skill_group_id IS NOT NULL
         LEFT JOIN sys.sys_skill_proficiency_levels pl
                ON pl.skill_proficiency_level_code = us.user_skill_proficiency
         LEFT JOIN LATERAL (
                SELECT count(*) AS cnt FROM sys.sys_user_skill_evidence e
                 WHERE e.user_skill_evidence_user_id = us.user_skill_user_id
                   AND e.user_skill_evidence_skill_id = us.user_skill_skill_id
              ) ev ON true
        WHERE true ${usrTenant}
        GROUP BY s.skill_group_id
     ),
     in_play AS (
       SELECT skill_group_id, count(DISTINCT skill_id) AS skill_count FROM (
         SELECT s.skill_group_id, s.skill_id
           FROM sys.sys_position_skill_requirements r
           JOIN sys.sys_positions p ON p.position_id = r.position_id AND p.position_is_active
           JOIN sys.sys_skills s    ON s.skill_id = r.skill_id AND s.skill_group_id IS NOT NULL
          WHERE true ${posTenant}
         UNION
         SELECT s.skill_group_id, s.skill_id
           FROM sys.sys_user_skills us
           JOIN sys.sys_skills s ON s.skill_id = us.user_skill_skill_id AND s.skill_group_id IS NOT NULL
          WHERE true ${usrTenant}
       ) z GROUP BY skill_group_id
     )
     SELECT g.skill_group_id, g.skill_group_name,
            ip.skill_count::text,
            COALESCE(d.positions_requiring, 0)::text  AS positions_requiring,
            COALESCE(d.critical_positions, 0)::text   AS critical_positions,
            COALESCE(d.total_requirements, 0)::text   AS total_requirements,
            d.avg_econ::text, d.crit_share::text,
            COALESCE(sup.holders, 0)::text            AS holders,
            sup.avg_held_rank::text, sup.verified_share::text, sup.evidence_share::text,
            COALESCE(c.covered_requirements, 0)::text AS covered_requirements
       FROM in_play ip
       JOIN sys.sys_skill_groups g ON g.skill_group_id = ip.skill_group_id
       LEFT JOIN demand  d   ON d.skill_group_id = ip.skill_group_id
       LEFT JOIN supply  sup ON sup.skill_group_id = ip.skill_group_id
       LEFT JOIN covered c   ON c.skill_group_id = ip.skill_group_id
      ORDER BY g.skill_group_name`,
    params,
  );

  const num = (v: string | null): number | null => (v === null ? null : Number(v));
  return {
    headcount,
    groups: res.rows.map((r) => ({
      skillGroupId: r.skill_group_id,
      skillGroupName: r.skill_group_name,
      skillCount: Number(r.skill_count),
      positionsRequiring: Number(r.positions_requiring),
      criticalPositions: Number(r.critical_positions),
      totalRequirements: Number(r.total_requirements),
      avgEcon: num(r.avg_econ),
      critShare: Number(r.crit_share ?? 0),
      holders: Number(r.holders),
      avgHeldRank: num(r.avg_held_rank),
      verifiedShare: Number(r.verified_share ?? 0),
      evidenceShare: Number(r.evidence_share ?? 0),
      coveredRequirements: Number(r.covered_requirements),
    })),
  };
}
