/**
 * apps/api/src/modules/assessment-results/repository.ts
 * Raw SQL for sys.sys_assessment_results. Immutable: list, find, insert.
 * Tenant scoping is enforced via FK (results.tenant_id = assessments.tenant_id),
 * propagated by the service layer.
 */

import type { Pool, PoolClient } from "pg";
import type {
  AssessmentResult,
  AssessmentResultListQuery,
  CreateAssessmentResultBody,
} from "@heuresys/shared";

export type DbConnector = Pool | PoolClient;

interface Row {
  assessment_result_id: string;
  assessment_result_assessment_id: string;
  assessment_result_tenant_id: string;
  assessment_result_dimension: string;
  assessment_result_score: string | null;
  assessment_result_narrative: string | null;
  assessment_result_assessor_user_id: string | null;
  assessment_result_recorded_at: Date;
  assessment_result_metadata: Record<string, unknown>;
  created_at: Date;
}

const COLS = `assessment_result_id, assessment_result_assessment_id, assessment_result_tenant_id,
  assessment_result_dimension, assessment_result_score, assessment_result_narrative,
  assessment_result_assessor_user_id, assessment_result_recorded_at, assessment_result_metadata,
  created_at`;

function toResult(r: Row): AssessmentResult {
  return {
    assessmentResultId: r.assessment_result_id,
    assessmentId: r.assessment_result_assessment_id,
    tenantId: r.assessment_result_tenant_id,
    dimension: r.assessment_result_dimension,
    score: r.assessment_result_score === null ? null : Number(r.assessment_result_score),
    narrative: r.assessment_result_narrative,
    assessorUserId: r.assessment_result_assessor_user_id,
    recordedAt: r.assessment_result_recorded_at.toISOString(),
    metadata: r.assessment_result_metadata,
    createdAt: r.created_at.toISOString(),
  };
}

export interface ListFilter {
  tenantId?: string;
  /** Restrict to results whose PARENT assessment's subject user is in this set (org
   *  sub-tree / self, ADR-0027 F3). undefined = no restriction; empty = nobody visible. */
  userIdAllowList?: string[];
  query: AssessmentResultListQuery;
}

export async function listResults(
  q: DbConnector,
  filter: ListFilter,
): Promise<{ items: AssessmentResult[]; total: number }> {
  const where: string[] = [];
  const params: unknown[] = [];
  if (filter.tenantId) {
    params.push(filter.tenantId);
    where.push(`assessment_result_tenant_id = $${params.length}`);
  }
  if (filter.userIdAllowList) {
    if (filter.userIdAllowList.length === 0) {
      // Empty allow-list = nobody is visible. Short-circuit (org-axis, ADR-0027 F3).
      return { items: [], total: 0 };
    }
    params.push(filter.userIdAllowList);
    where.push(`EXISTS (
      SELECT 1 FROM sys.sys_assessments a
       WHERE a.assessment_id = assessment_result_assessment_id
         AND a.assessment_subject_user_id = ANY($${params.length}::uuid[])
    )`);
  }
  if (filter.query.assessmentId) {
    params.push(filter.query.assessmentId);
    where.push(`assessment_result_assessment_id = $${params.length}`);
  }
  if (filter.query.dimension) {
    params.push(filter.query.dimension);
    where.push(`assessment_result_dimension = $${params.length}`);
  }
  const whereClause = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";

  const totalRow = await q.query<{ total: string }>(
    `SELECT count(*)::text AS total FROM sys.sys_assessment_results ${whereClause}`,
    params,
  );
  const total = Number(totalRow.rows[0]?.total ?? 0);

  params.push(filter.query.limit);
  const lim = params.length;
  params.push(filter.query.offset);
  const off = params.length;
  const res = await q.query<Row>(
    `SELECT ${COLS} FROM sys.sys_assessment_results ${whereClause}
      ORDER BY assessment_result_recorded_at DESC, assessment_result_id
      LIMIT $${lim} OFFSET $${off}`,
    params,
  );
  return { items: res.rows.map(toResult), total };
}

export async function findResultById(q: DbConnector, id: string): Promise<AssessmentResult | null> {
  const res = await q.query<Row>(
    `SELECT ${COLS} FROM sys.sys_assessment_results WHERE assessment_result_id = $1`,
    [id],
  );
  return res.rows[0] ? toResult(res.rows[0]) : null;
}

export async function insertResult(
  q: DbConnector,
  tenantId: string,
  body: CreateAssessmentResultBody,
): Promise<AssessmentResult> {
  const res = await q.query<Row>(
    `INSERT INTO sys.sys_assessment_results (
        assessment_result_assessment_id, assessment_result_tenant_id,
        assessment_result_dimension, assessment_result_score, assessment_result_narrative,
        assessment_result_assessor_user_id, assessment_result_metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
      RETURNING ${COLS}`,
    [
      body.assessmentId,
      tenantId,
      body.dimension,
      body.score ?? null,
      body.narrative ?? null,
      body.assessorUserId ?? null,
      JSON.stringify(body.metadata ?? {}),
    ],
  );
  return toResult(res.rows[0]!);
}
