/**
 * apps/api/src/modules/assessments/repository.ts
 * Raw SQL for sys.sys_assessments. Always tenant-scoped.
 */

import type { Pool, PoolClient } from "pg";
import type {
  Assessment,
  AssessmentListQuery,
  CreateAssessmentBody,
  UpdateAssessmentBody,
  AssessmentKind,
  AssessmentStatus,
} from "@heuresys/shared";

export type DbConnector = Pool | PoolClient;

interface Row {
  assessment_id: string;
  assessment_tenant_id: string;
  assessment_subject_user_id: string;
  assessment_method_id: string | null;
  assessment_kind: AssessmentKind;
  assessment_period_start: Date | null;
  assessment_period_end: Date | null;
  assessment_status: AssessmentStatus;
  assessment_metadata: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

const COLS = `assessment_id, assessment_tenant_id, assessment_subject_user_id,
  assessment_method_id, assessment_kind, assessment_period_start,
  assessment_period_end, assessment_status, assessment_metadata,
  created_at, updated_at`;

import { toDateOnly } from "../../lib/date-only.js";

function toAssessment(r: Row): Assessment {
  return {
    assessmentId: r.assessment_id,
    tenantId: r.assessment_tenant_id,
    subjectUserId: r.assessment_subject_user_id,
    methodId: r.assessment_method_id,
    kind: r.assessment_kind,
    periodStart: toDateOnly(r.assessment_period_start),
    periodEnd: toDateOnly(r.assessment_period_end),
    status: r.assessment_status,
    metadata: r.assessment_metadata,
    createdAt: r.created_at.toISOString(),
    updatedAt: r.updated_at.toISOString(),
  };
}

export interface ListFilter {
  tenantId?: string;
  /** Restrict to this set of subject user ids (org sub-tree / self, ADR-0027 F3).
   *  undefined = no id restriction; empty = nobody is visible. */
  userIdAllowList?: string[];
  query: AssessmentListQuery;
}

export async function listAssessments(
  q: DbConnector,
  filter: ListFilter,
): Promise<{ items: Assessment[]; total: number }> {
  const where: string[] = [];
  const params: unknown[] = [];
  if (filter.tenantId) {
    params.push(filter.tenantId);
    where.push(`assessment_tenant_id = $${params.length}`);
  }
  if (filter.userIdAllowList) {
    if (filter.userIdAllowList.length === 0) {
      // Empty allow-list = nobody is visible. Short-circuit (org-axis, ADR-0027 F3).
      return { items: [], total: 0 };
    }
    params.push(filter.userIdAllowList);
    where.push(`assessment_subject_user_id = ANY($${params.length}::uuid[])`);
  }
  if (filter.query.subjectUserId) {
    params.push(filter.query.subjectUserId);
    where.push(`assessment_subject_user_id = $${params.length}`);
  }
  if (filter.query.methodId) {
    params.push(filter.query.methodId);
    where.push(`assessment_method_id = $${params.length}`);
  }
  if (filter.query.kind) {
    params.push(filter.query.kind);
    where.push(`assessment_kind = $${params.length}`);
  }
  if (filter.query.status) {
    params.push(filter.query.status);
    where.push(`assessment_status = $${params.length}`);
  }
  const whereClause = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";

  const totalRow = await q.query<{ total: string }>(
    `SELECT count(*)::text AS total FROM sys.sys_assessments ${whereClause}`,
    params,
  );
  const total = Number(totalRow.rows[0]?.total ?? 0);

  params.push(filter.query.limit);
  const lim = params.length;
  params.push(filter.query.offset);
  const off = params.length;
  const res = await q.query<Row>(
    `SELECT ${COLS} FROM sys.sys_assessments ${whereClause}
      ORDER BY created_at DESC, assessment_id
      LIMIT $${lim} OFFSET $${off}`,
    params,
  );
  return { items: res.rows.map(toAssessment), total };
}

export async function findAssessmentById(q: DbConnector, id: string): Promise<Assessment | null> {
  const res = await q.query<Row>(
    `SELECT ${COLS} FROM sys.sys_assessments WHERE assessment_id = $1`,
    [id],
  );
  return res.rows[0] ? toAssessment(res.rows[0]) : null;
}

export async function getUserTenant(q: DbConnector, userId: string): Promise<{ tenantId: string | null } | null> {
  const res = await q.query<{ user_tenant_id: string | null }>(
    `SELECT user_tenant_id FROM sys.sys_users WHERE user_id = $1`,
    [userId],
  );
  const r = res.rows[0];
  if (!r) return null;
  return { tenantId: r.user_tenant_id };
}

export async function insertAssessment(
  q: DbConnector,
  tenantId: string,
  body: CreateAssessmentBody,
  createdBy: string,
): Promise<Assessment> {
  const res = await q.query<Row>(
    `INSERT INTO sys.sys_assessments (
        assessment_tenant_id, assessment_subject_user_id, assessment_method_id,
        assessment_kind, assessment_period_start, assessment_period_end,
        assessment_status, assessment_metadata, created_by
      ) VALUES ($1, $2, $3, $4, $5::date, $6::date, $7, $8::jsonb, $9)
      RETURNING ${COLS}`,
    [
      tenantId,
      body.subjectUserId,
      body.methodId ?? null,
      body.kind ?? "MANAGER",
      body.periodStart ?? null,
      body.periodEnd ?? null,
      body.status ?? "OPEN",
      JSON.stringify(body.metadata ?? {}),
      createdBy,
    ],
  );
  return toAssessment(res.rows[0]!);
}

export async function updateAssessmentPartial(
  q: DbConnector,
  id: string,
  patch: UpdateAssessmentBody,
  updatedBy: string,
): Promise<Assessment | null> {
  const sets: string[] = [];
  const params: unknown[] = [];
  const addSet = (col: string, value: unknown) => {
    params.push(value);
    sets.push(`${col} = $${params.length}`);
  };
  if (patch.methodId !== undefined) addSet("assessment_method_id", patch.methodId);
  if (patch.kind !== undefined) addSet("assessment_kind", patch.kind);
  if (patch.periodStart !== undefined) {
    params.push(patch.periodStart);
    sets.push(`assessment_period_start = $${params.length}::date`);
  }
  if (patch.periodEnd !== undefined) {
    params.push(patch.periodEnd);
    sets.push(`assessment_period_end = $${params.length}::date`);
  }
  if (patch.status !== undefined) addSet("assessment_status", patch.status);
  if (patch.metadata !== undefined) {
    params.push(JSON.stringify(patch.metadata));
    sets.push(`assessment_metadata = $${params.length}::jsonb`);
  }
  if (sets.length === 0) return findAssessmentById(q, id);
  sets.push(`updated_at = now()`);
  params.push(updatedBy);
  sets.push(`updated_by = $${params.length}`);
  params.push(id);
  const res = await q.query<Row>(
    `UPDATE sys.sys_assessments SET ${sets.join(", ")}
      WHERE assessment_id = $${params.length}
      RETURNING ${COLS}`,
    params,
  );
  return res.rows[0] ? toAssessment(res.rows[0]) : null;
}
