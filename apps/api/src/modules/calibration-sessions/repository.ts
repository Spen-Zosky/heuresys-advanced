/**
 * apps/api/src/modules/calibration-sessions/repository.ts — #92 passo 3/7. READ-only.
 * Le calibrazioni reali di RTL Bank (mig 000257: 35 sessioni, 20 partecipazioni,
 * 40 discussioni dal legacy, lineage registrato). Lo scoping per-soggetto delle
 * discussioni arriva dal service; qui tenant + allowlist.
 */
import type { Pool, PoolClient } from "pg";
import type {
  CalibrationSession, CalibrationSessionListQuery,
  CalibrationParticipant, CalibrationDiscussion,
} from "@heuresys/shared";

export type DbConnector = Pool | PoolClient;

const SESSION_COLS = `calibration_session_id, calibration_session_tenant_id,
  calibration_session_cycle_id, calibration_session_name, calibration_session_description,
  calibration_session_org_unit_id, calibration_session_department,
  calibration_session_scheduled_at, calibration_session_duration_min,
  calibration_session_location, calibration_session_facilitator_user_id,
  calibration_session_status, calibration_session_summary_notes,
  created_at, updated_at`;

const isoN = (d: unknown): string | null => (d == null ? null : (d as Date).toISOString());
const numN = (v: unknown): number | null => (v == null ? null : Number(v));

function toSession(r: Record<string, unknown>): CalibrationSession {
  return {
    calibrationSessionId: r.calibration_session_id as string,
    tenantId: r.calibration_session_tenant_id as string,
    reviewCycleId: (r.calibration_session_cycle_id as string | null) ?? null,
    name: r.calibration_session_name as string,
    description: (r.calibration_session_description as string | null) ?? null,
    organizationUnitId: (r.calibration_session_org_unit_id as string | null) ?? null,
    department: (r.calibration_session_department as string | null) ?? null,
    scheduledAt: isoN(r.calibration_session_scheduled_at),
    durationMin: numN(r.calibration_session_duration_min),
    location: (r.calibration_session_location as string | null) ?? null,
    facilitatorUserId: (r.calibration_session_facilitator_user_id as string | null) ?? null,
    status: r.calibration_session_status as string,
    summaryNotes: (r.calibration_session_summary_notes as string | null) ?? null,
    createdAt: isoN(r.created_at)!,
    updatedAt: isoN(r.updated_at)!,
  };
}

export async function listSessions(
  q: DbConnector,
  tenantId: string | undefined,
  query: CalibrationSessionListQuery,
): Promise<{ items: CalibrationSession[]; total: number }> {
  const where: string[] = [];
  const params: unknown[] = [];
  if (tenantId) { params.push(tenantId); where.push(`calibration_session_tenant_id = $${params.length}`); }
  if (query.status) { params.push(query.status); where.push(`calibration_session_status = $${params.length}`); }
  if (query.reviewCycleId) { params.push(query.reviewCycleId); where.push(`calibration_session_cycle_id = $${params.length}`); }
  const clause = where.length ? ` WHERE ${where.join(" AND ")}` : "";

  const count = await q.query(`SELECT count(*)::int AS n FROM sys.sys_calibration_sessions${clause}`, params);
  params.push(query.limit, query.offset);
  const res = await q.query(
    `SELECT ${SESSION_COLS} FROM sys.sys_calibration_sessions${clause}
      ORDER BY calibration_session_scheduled_at DESC NULLS LAST, calibration_session_name
      LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );
  return { items: res.rows.map(toSession), total: (count.rows[0] as { n: number }).n };
}

export async function findSessionById(q: DbConnector, id: string): Promise<CalibrationSession | null> {
  const res = await q.query(
    `SELECT ${SESSION_COLS} FROM sys.sys_calibration_sessions WHERE calibration_session_id = $1`, [id]);
  return res.rows[0] ? toSession(res.rows[0]) : null;
}

export async function listParticipants(q: DbConnector, sessionId: string): Promise<CalibrationParticipant[]> {
  const res = await q.query(
    `SELECT calibration_participant_id, calibration_participant_session_id,
            calibration_participant_user_id,
            u.user_email, calibration_participant_role, calibration_participant_joined_at
       FROM sys.sys_calibration_participants p
       LEFT JOIN sys.sys_users u ON u.user_id = p.calibration_participant_user_id
      WHERE calibration_participant_session_id = $1
      ORDER BY calibration_participant_role, u.user_email`,
    [sessionId],
  );
  return res.rows.map((r: Record<string, unknown>) => ({
    calibrationParticipantId: r.calibration_participant_id as string,
    sessionId: r.calibration_participant_session_id as string,
    userId: r.calibration_participant_user_id as string,
    userEmail: (r.user_email as string | null) ?? null,
    role: r.calibration_participant_role as string,
    joinedAt: isoN(r.calibration_participant_joined_at),
  }));
}

export async function listDiscussions(
  q: DbConnector,
  sessionId: string,
  subjectAllowList: string[] | undefined,
): Promise<{ items: CalibrationDiscussion[]; total: number }> {
  const params: unknown[] = [sessionId];
  let clause = `WHERE calibration_discussion_session_id = $1`;
  if (subjectAllowList) {
    params.push(subjectAllowList);
    clause += ` AND calibration_discussion_subject_user_id = ANY($${params.length}::uuid[])`;
  }
  const res = await q.query(
    `SELECT calibration_discussion_id, calibration_discussion_session_id,
            calibration_discussion_subject_user_id,
            u.user_email AS subject_email,
            calibration_discussion_review_id, calibration_discussion_was_adjusted,
            calibration_discussion_discussed_at,
            calibration_discussion_original_rating, calibration_discussion_original_potential,
            calibration_discussion_calibrated_rating, calibration_discussion_calibrated_potential,
            calibration_discussion_notes, calibration_discussion_adjustment_reason
       FROM sys.sys_calibration_discussions d
       LEFT JOIN sys.sys_users u ON u.user_id = d.calibration_discussion_subject_user_id
      ${clause}
      ORDER BY u.user_email`,
    params,
  );
  const items: CalibrationDiscussion[] = res.rows.map((r: Record<string, unknown>) => ({
    calibrationDiscussionId: r.calibration_discussion_id as string,
    sessionId: r.calibration_discussion_session_id as string,
    subjectUserId: r.calibration_discussion_subject_user_id as string,
    subjectEmail: (r.subject_email as string | null) ?? null,
    reviewId: (r.calibration_discussion_review_id as string | null) ?? null,
    wasAdjusted: r.calibration_discussion_was_adjusted as boolean,
    discussedAt: isoN(r.calibration_discussion_discussed_at),
    originalRating: numN(r.calibration_discussion_original_rating),
    originalPotential: (r.calibration_discussion_original_potential as string | null) ?? null,
    calibratedRating: numN(r.calibration_discussion_calibrated_rating),
    calibratedPotential: (r.calibration_discussion_calibrated_potential as string | null) ?? null,
    notes: (r.calibration_discussion_notes as string | null) ?? null,
    adjustmentReason: (r.calibration_discussion_adjustment_reason as string | null) ?? null,
  }));
  return { items, total: items.length };
}
