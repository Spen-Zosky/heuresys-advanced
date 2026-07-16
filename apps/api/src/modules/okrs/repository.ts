/**
 * apps/api/src/modules/okrs/repository.ts
 * Raw SQL on sys.sys_okrs + sys.sys_okr_key_results (read). numeric -> Number(); date -> ::text.
 */
import type { Pool, PoolClient } from "pg";
import { randomUUID } from "node:crypto";
import type { Okr, OkrListQuery, CreateOkrBody, UpdateOkrBody, OkrKeyResult } from "@heuresys/shared";

export type DbConnector = Pool | PoolClient;

interface OkrRow {
  okr_id: string; okr_tenant_id: string; okr_owner_user_id: string | null;
  okr_created_by_user_id: string | null; okr_parent_okr_id: string | null; okr_natural_key: string;
  okr_objective: string; okr_description: string | null; okr_okr_type: string;
  okr_department: string | null; okr_period_type: string;
  okr_period_start: string; okr_period_end: string;
  okr_fiscal_year: number | null; okr_fiscal_quarter: number | null; okr_status: string;
  okr_overall_progress: string; okr_confidence_level: string | null;
  okr_tags: unknown[]; okr_metadata: Record<string, unknown>; created_at: Date; updated_at: Date;
}
const OKR_COLS = `okr_id, okr_tenant_id, okr_owner_user_id, okr_created_by_user_id, okr_parent_okr_id,
  okr_natural_key, okr_objective, okr_description, okr_okr_type, okr_department, okr_period_type,
  okr_period_start::text AS okr_period_start, okr_period_end::text AS okr_period_end,
  okr_fiscal_year, okr_fiscal_quarter, okr_status, okr_overall_progress, okr_confidence_level,
  okr_tags, okr_metadata, created_at, updated_at`;

function toOkr(r: OkrRow): Okr {
  return {
    okrId: r.okr_id, tenantId: r.okr_tenant_id, ownerUserId: r.okr_owner_user_id,
    createdByUserId: r.okr_created_by_user_id, parentOkrId: r.okr_parent_okr_id, naturalKey: r.okr_natural_key,
    objective: r.okr_objective, description: r.okr_description, okrType: r.okr_okr_type as Okr["okrType"],
    department: r.okr_department, periodType: r.okr_period_type as Okr["periodType"],
    periodStart: r.okr_period_start, periodEnd: r.okr_period_end,
    fiscalYear: r.okr_fiscal_year, fiscalQuarter: r.okr_fiscal_quarter, status: r.okr_status as Okr["status"],
    overallProgress: Number(r.okr_overall_progress),
    confidenceLevel: r.okr_confidence_level === null ? null : Number(r.okr_confidence_level),
    tags: r.okr_tags ?? [], metadata: r.okr_metadata,
    createdAt: r.created_at.toISOString(), updatedAt: r.updated_at.toISOString(),
  };
}

export async function listOkrs(
  q: DbConnector, tenantId: string | undefined, query: OkrListQuery,
  userIdAllowList?: string[],
): Promise<{ items: Okr[]; total: number }> {
  const where: string[] = []; const params: unknown[] = [];
  if (tenantId) { params.push(tenantId); where.push(`okr_tenant_id = $${params.length}`); }
  if (userIdAllowList) {
    if (userIdAllowList.length === 0) return { items: [], total: 0 };
    params.push(userIdAllowList); where.push(`okr_owner_user_id = ANY($${params.length}::uuid[])`);
  }
  if (query.status) { params.push(query.status); where.push(`okr_status = $${params.length}`); }
  if (query.okrType) { params.push(query.okrType); where.push(`okr_okr_type = $${params.length}`); }
  if (query.ownerUserId) { params.push(query.ownerUserId); where.push(`okr_owner_user_id = $${params.length}`); }
  if (query.search) { params.push(`%${query.search}%`); where.push(`okr_objective ILIKE $${params.length}`); }
  const wc = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const totalRow = await q.query<{ total: string }>(`SELECT count(*)::text AS total FROM sys.sys_okrs ${wc}`, params);
  const total = Number(totalRow.rows[0]?.total ?? 0);
  params.push(query.limit); const lim = params.length; params.push(query.offset); const off = params.length;
  const res = await q.query<OkrRow>(`SELECT ${OKR_COLS} FROM sys.sys_okrs ${wc} ORDER BY okr_period_start DESC LIMIT $${lim} OFFSET $${off}`, params);
  return { items: res.rows.map(toOkr), total };
}

export async function findOkrById(q: DbConnector, id: string): Promise<Okr | null> {
  const res = await q.query<OkrRow>(`SELECT ${OKR_COLS} FROM sys.sys_okrs WHERE okr_id = $1`, [id]);
  return res.rows[0] ? toOkr(res.rows[0]) : null;
}

export async function insertOkr(q: DbConnector, tenantId: string, body: CreateOkrBody): Promise<Okr> {
  const res = await q.query<OkrRow>(
    `INSERT INTO sys.sys_okrs (okr_tenant_id, okr_natural_key, okr_owner_user_id, okr_parent_okr_id,
       okr_objective, okr_description, okr_okr_type, okr_department, okr_period_type, okr_period_start,
       okr_period_end, okr_fiscal_year, okr_fiscal_quarter, okr_status, okr_metadata)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::date,$11::date,$12,$13,$14,$15::jsonb)
     RETURNING ${OKR_COLS}`,
    [tenantId, `API::${randomUUID()}`, body.ownerUserId ?? null, body.parentOkrId ?? null,
     body.objective, body.description ?? null, body.okrType ?? "COMPANY", body.department ?? null,
     body.periodType ?? "QUARTERLY", body.periodStart, body.periodEnd, body.fiscalYear ?? null,
     body.fiscalQuarter ?? null, body.status ?? "ACTIVE", JSON.stringify(body.metadata ?? {})],
  );
  return toOkr(res.rows[0]!);
}

export async function updateOkrPartial(q: DbConnector, id: string, patch: UpdateOkrBody): Promise<Okr | null> {
  const sets: string[] = []; const params: unknown[] = [];
  const add = (col: string, v: unknown) => { params.push(v); sets.push(`${col} = $${params.length}`); };
  if (patch.objective !== undefined) add("okr_objective", patch.objective);
  if (patch.description !== undefined) add("okr_description", patch.description);
  if (patch.okrType !== undefined) add("okr_okr_type", patch.okrType);
  if (patch.department !== undefined) add("okr_department", patch.department);
  if (patch.periodType !== undefined) add("okr_period_type", patch.periodType);
  if (patch.periodStart !== undefined) { params.push(patch.periodStart); sets.push(`okr_period_start = $${params.length}::date`); }
  if (patch.periodEnd !== undefined) { params.push(patch.periodEnd); sets.push(`okr_period_end = $${params.length}::date`); }
  if (patch.status !== undefined) add("okr_status", patch.status);
  if (patch.overallProgress !== undefined) add("okr_overall_progress", patch.overallProgress);
  if (patch.ownerUserId !== undefined) add("okr_owner_user_id", patch.ownerUserId);
  if (patch.metadata !== undefined) { params.push(JSON.stringify(patch.metadata)); sets.push(`okr_metadata = $${params.length}::jsonb`); }
  if (sets.length === 0) return findOkrById(q, id);
  params.push(id);
  const res = await q.query<OkrRow>(`UPDATE sys.sys_okrs SET ${sets.join(", ")} WHERE okr_id = $${params.length} RETURNING ${OKR_COLS}`, params);
  return res.rows[0] ? toOkr(res.rows[0]) : null;
}

export async function deleteOkr(q: DbConnector, id: string): Promise<boolean> {
  const res = await q.query(`DELETE FROM sys.sys_okrs WHERE okr_id = $1`, [id]);
  return (res.rowCount ?? 0) > 0;
}

interface KrRow {
  key_result_id: string; key_result_tenant_id: string; key_result_okr_id: string;
  key_result_owner_user_id: string | null; key_result_natural_key: string; key_result_description: string;
  key_result_metric_type: string; key_result_start_value: string; key_result_target_value: string;
  key_result_current_value: string; key_result_unit: string | null; key_result_progress_percent: string;
  key_result_status: string; key_result_weight: string; key_result_confidence_level: number;
  created_at: Date; updated_at: Date;
}
const KR_COLS = `key_result_id, key_result_tenant_id, key_result_okr_id, key_result_owner_user_id,
  key_result_natural_key, key_result_description, key_result_metric_type, key_result_start_value,
  key_result_target_value, key_result_current_value, key_result_unit, key_result_progress_percent,
  key_result_status, key_result_weight, key_result_confidence_level, created_at, updated_at`;
function toKr(r: KrRow): OkrKeyResult {
  return {
    keyResultId: r.key_result_id, tenantId: r.key_result_tenant_id, okrId: r.key_result_okr_id,
    ownerUserId: r.key_result_owner_user_id, naturalKey: r.key_result_natural_key, description: r.key_result_description,
    metricType: r.key_result_metric_type as OkrKeyResult["metricType"],
    startValue: Number(r.key_result_start_value), targetValue: Number(r.key_result_target_value),
    currentValue: Number(r.key_result_current_value), unit: r.key_result_unit,
    progressPercent: Number(r.key_result_progress_percent), status: r.key_result_status as OkrKeyResult["status"],
    weight: Number(r.key_result_weight), confidenceLevel: r.key_result_confidence_level,
    createdAt: r.created_at.toISOString(), updatedAt: r.updated_at.toISOString(),
  };
}
export async function listKeyResultsByOkr(q: DbConnector, okrId: string): Promise<{ items: OkrKeyResult[]; total: number }> {
  const res = await q.query<KrRow>(`SELECT ${KR_COLS} FROM sys.sys_okr_key_results WHERE key_result_okr_id = $1 ORDER BY created_at ASC`, [okrId]);
  return { items: res.rows.map(toKr), total: res.rows.length };
}

// ── #26 (S1018): OKR check-ins (READ-only, sys.sys_okr_check_ins) ──
import type { OkrCheckIn } from "@heuresys/shared";

interface OkrCheckInRow {
  check_in_id: string; check_in_okr_id: string; check_in_key_result_id: string | null;
  check_in_subject_user_id: string | null; check_in_scope: string; check_in_date: string;
  check_in_previous_value: string | null; check_in_new_value: string | null;
  check_in_previous_progress: string | null; check_in_new_progress: string | null;
  check_in_overall_progress: string | null; check_in_status_update: string | null;
  check_in_next_steps: string | null; check_in_confidence_level: string | null;
  check_in_notes: string | null; check_in_blockers: string | null; created_at: Date;
}
const numOrNull = (v: string | null): number | null => (v === null ? null : Number(v));

export async function listOkrCheckIns(
  q: DbConnector, okrId: string, limit: number, offset: number,
): Promise<{ items: OkrCheckIn[]; total: number }> {
  const totalRow = await q.query<{ total: string }>(
    `SELECT count(*)::text AS total FROM sys.sys_okr_check_ins WHERE check_in_okr_id = $1`, [okrId]);
  const res = await q.query<OkrCheckInRow>(
    `SELECT check_in_id, check_in_okr_id, check_in_key_result_id, check_in_subject_user_id,
            check_in_scope, check_in_date::text AS check_in_date, check_in_previous_value,
            check_in_new_value, check_in_previous_progress, check_in_new_progress,
            check_in_overall_progress, check_in_status_update, check_in_next_steps,
            check_in_confidence_level, check_in_notes, check_in_blockers, created_at
       FROM sys.sys_okr_check_ins WHERE check_in_okr_id = $1
      ORDER BY created_at DESC LIMIT $2 OFFSET $3`, [okrId, limit, offset]);
  return {
    total: Number(totalRow.rows[0]?.total ?? 0),
    items: res.rows.map((r) => ({
      checkInId: r.check_in_id, okrId: r.check_in_okr_id, keyResultId: r.check_in_key_result_id,
      subjectUserId: r.check_in_subject_user_id, scope: r.check_in_scope as OkrCheckIn["scope"],
      date: r.check_in_date,
      previousValue: numOrNull(r.check_in_previous_value), newValue: numOrNull(r.check_in_new_value),
      previousProgress: numOrNull(r.check_in_previous_progress), newProgress: numOrNull(r.check_in_new_progress),
      overallProgress: numOrNull(r.check_in_overall_progress),
      statusUpdate: r.check_in_status_update, nextSteps: r.check_in_next_steps,
      confidenceLevel: numOrNull(r.check_in_confidence_level),
      notes: r.check_in_notes, blockers: r.check_in_blockers,
      createdAt: r.created_at.toISOString(),
    })),
  };
}
