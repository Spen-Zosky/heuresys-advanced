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
  economicWeight: number | null;
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
    q.query<{ position_id: string; ou_id: string | null; title: string | null; criticality: string | null; economic_weight: string | null }>(
      `SELECT position_id, position_organization_unit_id AS ou_id, position_title AS title,
              position_criticality AS criticality, position_economic_weight AS economic_weight
         FROM sys.sys_positions
        WHERE position_tenant_id = $1 AND position_is_active`, [tenantId]),
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
      economicWeight: p.economic_weight === null ? null : Number(p.economic_weight),
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
  scope: { tenantId: string | null }, subjectType: CapabilitySubjectType | undefined, q: Queryable = pool,
): Promise<ActiveScoreRow[]> {
  const clauses: string[] = [];
  const params: unknown[] = [];
  if (scope.tenantId !== null) { params.push(scope.tenantId); clauses.push(`s.capability_score_tenant_id = $${params.length}`); }
  if (subjectType) { params.push(subjectType); clauses.push(`s.capability_score_subject_type = $${params.length}`); }
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
