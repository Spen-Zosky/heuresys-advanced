/**
 * apps/api/src/modules/capability-maturity/repository.ts
 * Raw SQL for the Maturity engine (Gap#1 Step 4).
 *
 * READS: loadMaturityInputs gathers the per-org-unit MLCE composite (from
 * sys_capability_scores, ORG_UNIT) + the per-user gate metrics from live data —
 * KPI achievement (sys_user_kpi_evidence measured/target), succession readiness
 * (sys_succession_readiness_scores), skill-gap segment (sys_skill_gap_scores) —
 * plus the OU tree + PRIMARY-ACTIVE assignments so the service can aggregate the
 * gate metrics over each OU's SUBTREE incumbents (consistent with the composite).
 * WRITES: replaceMaturity is a bounded per-tenant delete-then-insert (D-18).
 */
import type { Pool, PoolClient } from "pg";
import { pool } from "../../db/client.js";
import type { MaturityLevel } from "@heuresys/shared";

type Queryable = Pool | PoolClient;
export { loadActiveTenantIds } from "../capability-composition/repository.js";

export interface MaturityInputs {
  orgUnits: Array<{ id: string; parentId: string | null; name: string | null }>;
  positions: Array<{ positionId: string; ouId: string | null }>;
  assignments: Array<{ userId: string; positionId: string }>;
  composites: Array<{ ouId: string; value: number; coverage: number }>;
  kpiByUser: Map<string, number>;     // achievement 0..1
  readyUsers: Set<string>;            // latest readiness in {READY_NOW, READY_6_MONTHS}
  majorGapUsers: Set<string>;         // latest skill-gap segment = MAJOR_GAP
}

export async function loadMaturityInputs(tenantId: string, q: Queryable = pool): Promise<MaturityInputs> {
  const [orgUnits, positions, assignments, composites, kpi, ready, majorGap] = await Promise.all([
    q.query<{ id: string; parent_id: string | null; name: string | null }>(
      `SELECT organization_unit_id AS id, organization_unit_parent_id AS parent_id, organization_unit_name AS name
         FROM sys.sys_organization_units WHERE organization_unit_tenant_id = $1 AND organization_unit_is_active`, [tenantId]),
    q.query<{ position_id: string; ou_id: string | null }>(
      `SELECT position_id, position_organization_unit_id AS ou_id
         FROM sys.sys_positions WHERE position_tenant_id = $1 AND position_is_active`, [tenantId]),
    q.query<{ user_id: string; position_id: string }>(
      `SELECT user_position_assignment_user_id AS user_id, user_position_assignment_position_id AS position_id
         FROM sys.sys_user_position_assignments
        WHERE user_position_assignment_tenant_id = $1
          AND user_position_assignment_kind = 'PRIMARY' AND user_position_assignment_status = 'ACTIVE'`, [tenantId]),
    q.query<{ ou_id: string; value: string; coverage: string }>(
      `SELECT DISTINCT ON (capability_score_subject_id)
              capability_score_subject_id AS ou_id, capability_score_value AS value, capability_score_coverage AS coverage
         FROM sys.sys_capability_scores
        WHERE capability_score_tenant_id = $1 AND capability_score_subject_type = 'ORG_UNIT'
        ORDER BY capability_score_subject_id, capability_score_computed_at DESC`, [tenantId]),
    q.query<{ uid: string; achievement: string }>(
      `WITH latest AS (
         SELECT DISTINCT ON (user_kpi_evidence_user_id, user_kpi_evidence_kpi_id)
                user_kpi_evidence_user_id AS uid,
                CASE WHEN user_kpi_evidence_target_value > 0
                     THEN LEAST(user_kpi_evidence_measured_value / user_kpi_evidence_target_value, 1.0)
                     ELSE NULL END AS ach
           FROM sys.sys_user_kpi_evidence
          WHERE user_kpi_evidence_tenant_id = $1
          ORDER BY user_kpi_evidence_user_id, user_kpi_evidence_kpi_id, user_kpi_evidence_period_end DESC NULLS LAST
       )
       SELECT uid, avg(ach) AS achievement FROM latest WHERE ach IS NOT NULL GROUP BY uid`, [tenantId]),
    q.query<{ uid: string }>(
      `SELECT DISTINCT succession_readiness_score_user_id AS uid
         FROM sys.sys_succession_readiness_scores
        WHERE succession_readiness_score_tenant_id = $1
          AND succession_readiness_score_horizon IN ('READY_NOW','READY_6_MONTHS')`, [tenantId]),
    q.query<{ uid: string }>(
      `SELECT DISTINCT ON (skill_gap_score_user_id) skill_gap_score_user_id AS uid, skill_gap_score_segment AS segment
         FROM sys.sys_skill_gap_scores
        WHERE skill_gap_score_tenant_id = $1
        ORDER BY skill_gap_score_user_id, skill_gap_score_computed_at DESC`, [tenantId]),
  ]);

  return {
    orgUnits: orgUnits.rows.map((o) => ({ id: o.id, parentId: o.parent_id, name: o.name })),
    positions: positions.rows.map((p) => ({ positionId: p.position_id, ouId: p.ou_id })),
    assignments: assignments.rows.map((a) => ({ userId: a.user_id, positionId: a.position_id })),
    composites: composites.rows.map((c) => ({ ouId: c.ou_id, value: Number(c.value), coverage: Number(c.coverage) })),
    kpiByUser: new Map(kpi.rows.map((r) => [r.uid, Number(r.achievement)])),
    readyUsers: new Set(ready.rows.map((r) => r.uid)),
    majorGapUsers: new Set(
      (majorGap.rows as Array<{ uid: string; segment: string }>).filter((r) => r.segment === "MAJOR_GAP").map((r) => r.uid),
    ),
  };
}

/* ----------------------------- write: cohort ----------------------------- */

export interface MaturityRow {
  tenantId: string;
  orgUnitId: string;
  capabilityRef: string;
  level: MaturityLevel;
  composite: number;
  rubricVersion: string;
  modelVersion: string;
  payload: unknown;
}

export async function replaceMaturity(client: PoolClient, tenantId: string, rows: MaturityRow[]): Promise<number> {
  await client.query(`DELETE FROM sys.sys_capability_maturity_scores WHERE capability_maturity_score_tenant_id = $1`, [tenantId]);
  if (rows.length === 0) return 0;
  const params: unknown[] = [];
  const tuples = rows.map((r) => {
    const b = params.length;
    params.push(r.tenantId, r.orgUnitId, r.capabilityRef, r.level, r.composite, r.rubricVersion, r.modelVersion, JSON.stringify(r.payload));
    return `($${b + 1}, $${b + 2}, $${b + 3}, $${b + 4}, $${b + 5}, $${b + 6}, $${b + 7}, $${b + 8}::jsonb)`;
  });
  await client.query(
    `INSERT INTO sys.sys_capability_maturity_scores
       (capability_maturity_score_tenant_id, capability_maturity_score_org_unit_id, capability_maturity_score_capability_ref,
        capability_maturity_score_level, capability_maturity_score_composite,
        capability_maturity_score_rubric_version, capability_maturity_score_model_version, capability_maturity_score_payload)
     VALUES ${tuples.join(", ")}`, params,
  );
  return rows.length;
}

/* ----------------------------- read: scores ----------------------------- */

export interface ActiveMaturityRow {
  orgUnitId: string;
  tenantId: string;
  orgUnitName: string | null;
  capabilityRef: string;
  level: MaturityLevel;
  composite: number;
  rubricVersion: string;
  modelVersion: string;
  computedAt: Date;
  payload: { criteria?: unknown };
}

const MAT_SELECT = `
  SELECT DISTINCT ON (m.capability_maturity_score_tenant_id, m.capability_maturity_score_org_unit_id, m.capability_maturity_score_capability_ref)
         m.capability_maturity_score_org_unit_id   AS org_unit_id,
         m.capability_maturity_score_tenant_id     AS tenant_id,
         ou.organization_unit_name                 AS org_unit_name,
         m.capability_maturity_score_capability_ref AS capability_ref,
         m.capability_maturity_score_level         AS level,
         m.capability_maturity_score_composite     AS composite,
         m.capability_maturity_score_rubric_version AS rubric_version,
         m.capability_maturity_score_model_version AS model_version,
         m.capability_maturity_score_computed_at   AS computed_at,
         m.capability_maturity_score_payload       AS payload
    FROM sys.sys_capability_maturity_scores m
    LEFT JOIN sys.sys_organization_units ou ON ou.organization_unit_id = m.capability_maturity_score_org_unit_id
`;

function mapRow(r: Record<string, unknown>): ActiveMaturityRow {
  return {
    orgUnitId: r.org_unit_id as string,
    tenantId: r.tenant_id as string,
    orgUnitName: (r.org_unit_name as string | null) ?? null,
    capabilityRef: r.capability_ref as string,
    level: r.level as MaturityLevel,
    composite: Number(r.composite),
    rubricVersion: r.rubric_version as string,
    modelVersion: r.model_version as string,
    computedAt: r.computed_at as Date,
    payload: (r.payload as { criteria?: unknown }) ?? {},
  };
}

export async function listActiveMaturity(scope: { tenantId: string | null }, q: Queryable = pool): Promise<ActiveMaturityRow[]> {
  const params: unknown[] = [];
  let where = "";
  if (scope.tenantId !== null) { params.push(scope.tenantId); where = `WHERE m.capability_maturity_score_tenant_id = $1`; }
  const res = await q.query(
    `${MAT_SELECT} ${where}
     ORDER BY m.capability_maturity_score_tenant_id, m.capability_maturity_score_org_unit_id,
              m.capability_maturity_score_capability_ref, m.capability_maturity_score_computed_at DESC`, params,
  );
  return res.rows.map(mapRow);
}

export async function getActiveMaturityByOrgUnit(
  scope: { tenantId: string | null }, orgUnitId: string, q: Queryable = pool,
): Promise<ActiveMaturityRow | null> {
  const params: unknown[] = [orgUnitId];
  let tenantClause = "";
  if (scope.tenantId !== null) { params.push(scope.tenantId); tenantClause = `AND m.capability_maturity_score_tenant_id = $2`; }
  const res = await q.query(
    `${MAT_SELECT}
      WHERE m.capability_maturity_score_org_unit_id = $1 ${tenantClause}
      ORDER BY m.capability_maturity_score_tenant_id, m.capability_maturity_score_org_unit_id,
               m.capability_maturity_score_capability_ref, m.capability_maturity_score_computed_at DESC
      LIMIT 1`, params,
  );
  const row = res.rows[0];
  return row ? mapRow(row) : null;
}
