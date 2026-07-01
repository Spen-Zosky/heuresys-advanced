/**
 * apps/api/src/modules/mentorship/repository.ts
 * Raw parameterized SQL for the mentorship domain (4 sys.* tables).
 * Tenant filtering at SQL level; PLATFORM_ADMIN passes tenantId=undefined (no filter).
 */
import type { Pool, PoolClient } from "pg";
import { randomUUID } from "node:crypto";
import type {
  MentorshipProgram, MentorshipProgramListQuery, CreateMentorshipProgramBody, UpdateMentorshipProgramBody,
  Mentorship, MentorshipListQuery, CreateMentorshipBody, UpdateMentorshipBody,
  MentorshipSession, CreateMentorshipSessionBody, UpdateMentorshipSessionBody,
  MentorMatchScore, MentorMatchScoreListQuery,
} from "@heuresys/shared";

export type DbConnector = Pool | PoolClient;

const num = (v: string | null): number | null => (v === null ? null : Number(v));
// node-pg returns `date` columns as Date objects; the API contract is 'YYYY-MM-DD' (z.iso.date()).
const dateOnly = (v: Date | string | null): string | null =>
  v === null ? null : v instanceof Date ? v.toISOString().slice(0, 10) : String(v);

// ─────────────────────────── Programs ───────────────────────────
interface ProgramRow {
  program_id: string; program_tenant_id: string; program_natural_key: string;
  program_name: string; program_description: string | null; program_type: string; program_status: string;
  program_duration_months: number | null; program_max_participants: number | null;
  program_focus_areas: string[] | null; program_eligibility_criteria: Record<string, unknown>;
  program_start_date: Date | string | null; program_end_date: Date | string | null;
  program_metadata: Record<string, unknown>; created_at: Date; updated_at: Date;
}
const PROGRAM_COLS = `program_id, program_tenant_id, program_natural_key, program_name, program_description,
  program_type, program_status, program_duration_months, program_max_participants, program_focus_areas,
  program_eligibility_criteria, program_start_date, program_end_date, program_metadata, created_at, updated_at`;
function toProgram(r: ProgramRow): MentorshipProgram {
  return {
    programId: r.program_id, tenantId: r.program_tenant_id, naturalKey: r.program_natural_key,
    name: r.program_name, description: r.program_description,
    type: r.program_type as MentorshipProgram["type"], status: r.program_status as MentorshipProgram["status"],
    durationMonths: r.program_duration_months, maxParticipants: r.program_max_participants,
    focusAreas: r.program_focus_areas, eligibilityCriteria: r.program_eligibility_criteria,
    startDate: dateOnly(r.program_start_date), endDate: dateOnly(r.program_end_date),
    metadata: r.program_metadata, createdAt: r.created_at.toISOString(), updatedAt: r.updated_at.toISOString(),
  };
}

export async function listPrograms(
  q: DbConnector, tenantId: string | undefined, query: MentorshipProgramListQuery,
): Promise<{ items: MentorshipProgram[]; total: number }> {
  const where: string[] = []; const params: unknown[] = [];
  if (tenantId) { params.push(tenantId); where.push(`program_tenant_id = $${params.length}`); }
  if (query.status) { params.push(query.status); where.push(`program_status = $${params.length}`); }
  if (query.type) { params.push(query.type); where.push(`program_type = $${params.length}`); }
  if (query.search) { params.push(`%${query.search}%`); where.push(`program_name ILIKE $${params.length}`); }
  const wc = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const totalRow = await q.query<{ total: string }>(`SELECT count(*)::text AS total FROM sys.sys_mentorship_programs ${wc}`, params);
  const total = Number(totalRow.rows[0]?.total ?? 0);
  params.push(query.limit); const lim = params.length; params.push(query.offset); const off = params.length;
  const res = await q.query<ProgramRow>(`SELECT ${PROGRAM_COLS} FROM sys.sys_mentorship_programs ${wc} ORDER BY program_name LIMIT $${lim} OFFSET $${off}`, params);
  return { items: res.rows.map(toProgram), total };
}
export async function findProgramById(q: DbConnector, id: string): Promise<MentorshipProgram | null> {
  const res = await q.query<ProgramRow>(`SELECT ${PROGRAM_COLS} FROM sys.sys_mentorship_programs WHERE program_id = $1`, [id]);
  return res.rows[0] ? toProgram(res.rows[0]) : null;
}
export async function insertProgram(q: DbConnector, tenantId: string, body: CreateMentorshipProgramBody): Promise<MentorshipProgram> {
  const res = await q.query<ProgramRow>(
    `INSERT INTO sys.sys_mentorship_programs (program_tenant_id, program_natural_key, program_name, program_description,
       program_type, program_status, program_duration_months, program_max_participants, program_focus_areas,
       program_eligibility_criteria, program_start_date, program_end_date, program_metadata)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11,$12,$13::jsonb) RETURNING ${PROGRAM_COLS}`,
    [tenantId, `API::${randomUUID()}`, body.name, body.description ?? null, body.type ?? "GENERAL", body.status ?? "ACTIVE",
     body.durationMonths ?? null, body.maxParticipants ?? null, body.focusAreas ?? null,
     JSON.stringify(body.eligibilityCriteria ?? {}), body.startDate ?? null, body.endDate ?? null, JSON.stringify(body.metadata ?? {})],
  );
  return toProgram(res.rows[0]!);
}
export async function updateProgramPartial(q: DbConnector, id: string, patch: UpdateMentorshipProgramBody): Promise<MentorshipProgram | null> {
  const sets: string[] = []; const params: unknown[] = [];
  const add = (col: string, v: unknown) => { params.push(v); sets.push(`${col} = $${params.length}`); };
  if (patch.name !== undefined) add("program_name", patch.name);
  if (patch.description !== undefined) add("program_description", patch.description);
  if (patch.type !== undefined) add("program_type", patch.type);
  if (patch.status !== undefined) add("program_status", patch.status);
  if (patch.durationMonths !== undefined) add("program_duration_months", patch.durationMonths);
  if (patch.maxParticipants !== undefined) add("program_max_participants", patch.maxParticipants);
  if (patch.focusAreas !== undefined) add("program_focus_areas", patch.focusAreas);
  if (patch.eligibilityCriteria !== undefined) { params.push(JSON.stringify(patch.eligibilityCriteria)); sets.push(`program_eligibility_criteria = $${params.length}::jsonb`); }
  if (patch.startDate !== undefined) add("program_start_date", patch.startDate);
  if (patch.endDate !== undefined) add("program_end_date", patch.endDate);
  if (patch.metadata !== undefined) { params.push(JSON.stringify(patch.metadata)); sets.push(`program_metadata = $${params.length}::jsonb`); }
  if (sets.length === 0) return findProgramById(q, id);
  params.push(id);
  const res = await q.query<ProgramRow>(`UPDATE sys.sys_mentorship_programs SET ${sets.join(", ")} WHERE program_id = $${params.length} RETURNING ${PROGRAM_COLS}`, params);
  return res.rows[0] ? toProgram(res.rows[0]) : null;
}
export async function deleteProgram(q: DbConnector, id: string): Promise<boolean> {
  const res = await q.query(`DELETE FROM sys.sys_mentorship_programs WHERE program_id = $1`, [id]);
  return (res.rowCount ?? 0) > 0;
}

// ─────────────────────────── Pairings (mentorships) ───────────────────────────
interface MentorshipRow {
  mentorship_id: string; mentorship_tenant_id: string; mentorship_natural_key: string;
  mentorship_program_id: string | null; mentorship_mentor_user_id: string | null; mentorship_mentee_user_id: string | null;
  mentorship_status: string; mentorship_focus_areas: string[] | null; mentorship_meeting_frequency: string;
  mentorship_goals: string[] | null; mentorship_match_score: string | null;
  mentorship_start_date: Date | string | null; mentorship_end_date: Date | string | null; mentorship_notes: string | null;
  mentorship_metadata: Record<string, unknown>; created_at: Date; updated_at: Date;
}
const MENT_COLS = `mentorship_id, mentorship_tenant_id, mentorship_natural_key, mentorship_program_id,
  mentorship_mentor_user_id, mentorship_mentee_user_id, mentorship_status, mentorship_focus_areas,
  mentorship_meeting_frequency, mentorship_goals, mentorship_match_score, mentorship_start_date,
  mentorship_end_date, mentorship_notes, mentorship_metadata, created_at, updated_at`;
function toMentorship(r: MentorshipRow): Mentorship {
  return {
    mentorshipId: r.mentorship_id, tenantId: r.mentorship_tenant_id, naturalKey: r.mentorship_natural_key,
    programId: r.mentorship_program_id, mentorUserId: r.mentorship_mentor_user_id, menteeUserId: r.mentorship_mentee_user_id,
    status: r.mentorship_status as Mentorship["status"], focusAreas: r.mentorship_focus_areas,
    meetingFrequency: r.mentorship_meeting_frequency as Mentorship["meetingFrequency"], goals: r.mentorship_goals,
    matchScore: num(r.mentorship_match_score), startDate: dateOnly(r.mentorship_start_date), endDate: dateOnly(r.mentorship_end_date),
    notes: r.mentorship_notes, metadata: r.mentorship_metadata, createdAt: r.created_at.toISOString(), updatedAt: r.updated_at.toISOString(),
  };
}

export async function listMentorships(
  q: DbConnector, tenantId: string | undefined, userIdAllowList: string[] | undefined, query: MentorshipListQuery,
): Promise<{ items: Mentorship[]; total: number }> {
  const where: string[] = []; const params: unknown[] = [];
  if (tenantId) { params.push(tenantId); where.push(`mentorship_tenant_id = $${params.length}`); }
  if (userIdAllowList) {
    if (userIdAllowList.length === 0) return { items: [], total: 0 };
    params.push(userIdAllowList);
    where.push(`(mentorship_mentor_user_id = ANY($${params.length}::uuid[]) OR mentorship_mentee_user_id = ANY($${params.length}::uuid[]))`);
  }
  if (query.status) { params.push(query.status); where.push(`mentorship_status = $${params.length}`); }
  if (query.programId) { params.push(query.programId); where.push(`mentorship_program_id = $${params.length}`); }
  if (query.mentorUserId) { params.push(query.mentorUserId); where.push(`mentorship_mentor_user_id = $${params.length}`); }
  if (query.menteeUserId) { params.push(query.menteeUserId); where.push(`mentorship_mentee_user_id = $${params.length}`); }
  const wc = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const totalRow = await q.query<{ total: string }>(`SELECT count(*)::text AS total FROM sys.sys_mentorships ${wc}`, params);
  const total = Number(totalRow.rows[0]?.total ?? 0);
  params.push(query.limit); const lim = params.length; params.push(query.offset); const off = params.length;
  const res = await q.query<MentorshipRow>(`SELECT ${MENT_COLS} FROM sys.sys_mentorships ${wc} ORDER BY created_at DESC LIMIT $${lim} OFFSET $${off}`, params);
  return { items: res.rows.map(toMentorship), total };
}
export async function findMentorshipById(q: DbConnector, id: string): Promise<Mentorship | null> {
  const res = await q.query<MentorshipRow>(`SELECT ${MENT_COLS} FROM sys.sys_mentorships WHERE mentorship_id = $1`, [id]);
  return res.rows[0] ? toMentorship(res.rows[0]) : null;
}
export async function insertMentorship(q: DbConnector, tenantId: string, body: CreateMentorshipBody): Promise<Mentorship> {
  const res = await q.query<MentorshipRow>(
    `INSERT INTO sys.sys_mentorships (mentorship_tenant_id, mentorship_natural_key, mentorship_program_id,
       mentorship_mentor_user_id, mentorship_mentee_user_id, mentorship_status, mentorship_focus_areas,
       mentorship_meeting_frequency, mentorship_goals, mentorship_match_score, mentorship_start_date,
       mentorship_end_date, mentorship_notes, mentorship_metadata)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb) RETURNING ${MENT_COLS}`,
    [tenantId, `API::${randomUUID()}`, body.programId ?? null, body.mentorUserId ?? null, body.menteeUserId ?? null,
     body.status ?? "ACTIVE", body.focusAreas ?? null, body.meetingFrequency ?? "BI_WEEKLY", body.goals ?? null,
     body.matchScore ?? null, body.startDate ?? null, body.endDate ?? null, body.notes ?? null, JSON.stringify(body.metadata ?? {})],
  );
  return toMentorship(res.rows[0]!);
}
export async function updateMentorshipPartial(q: DbConnector, id: string, patch: UpdateMentorshipBody): Promise<Mentorship | null> {
  const sets: string[] = []; const params: unknown[] = [];
  const add = (col: string, v: unknown) => { params.push(v); sets.push(`${col} = $${params.length}`); };
  if (patch.programId !== undefined) add("mentorship_program_id", patch.programId);
  if (patch.mentorUserId !== undefined) add("mentorship_mentor_user_id", patch.mentorUserId);
  if (patch.menteeUserId !== undefined) add("mentorship_mentee_user_id", patch.menteeUserId);
  if (patch.status !== undefined) add("mentorship_status", patch.status);
  if (patch.focusAreas !== undefined) add("mentorship_focus_areas", patch.focusAreas);
  if (patch.meetingFrequency !== undefined) add("mentorship_meeting_frequency", patch.meetingFrequency);
  if (patch.goals !== undefined) add("mentorship_goals", patch.goals);
  if (patch.matchScore !== undefined) add("mentorship_match_score", patch.matchScore);
  if (patch.startDate !== undefined) add("mentorship_start_date", patch.startDate);
  if (patch.endDate !== undefined) add("mentorship_end_date", patch.endDate);
  if (patch.notes !== undefined) add("mentorship_notes", patch.notes);
  if (patch.metadata !== undefined) { params.push(JSON.stringify(patch.metadata)); sets.push(`mentorship_metadata = $${params.length}::jsonb`); }
  if (sets.length === 0) return findMentorshipById(q, id);
  params.push(id);
  const res = await q.query<MentorshipRow>(`UPDATE sys.sys_mentorships SET ${sets.join(", ")} WHERE mentorship_id = $${params.length} RETURNING ${MENT_COLS}`, params);
  return res.rows[0] ? toMentorship(res.rows[0]) : null;
}
export async function deleteMentorship(q: DbConnector, id: string): Promise<boolean> {
  const res = await q.query(`DELETE FROM sys.sys_mentorships WHERE mentorship_id = $1`, [id]);
  return (res.rowCount ?? 0) > 0;
}

// ─────────────────────────── Sessions ───────────────────────────
interface SessionRow {
  session_id: string; session_tenant_id: string; session_natural_key: string; session_mentorship_id: string;
  session_date: Date; session_duration_minutes: number | null; session_status: string;
  session_topics: string[] | null; session_notes: string | null; session_rating: number | null;
  session_metadata: Record<string, unknown>; created_at: Date;
}
const SESS_COLS = `session_id, session_tenant_id, session_natural_key, session_mentorship_id, session_date,
  session_duration_minutes, session_status, session_topics, session_notes, session_rating, session_metadata, created_at`;
function toSession(r: SessionRow): MentorshipSession {
  return {
    sessionId: r.session_id, tenantId: r.session_tenant_id, naturalKey: r.session_natural_key,
    mentorshipId: r.session_mentorship_id, date: r.session_date.toISOString(), durationMinutes: r.session_duration_minutes,
    status: r.session_status as MentorshipSession["status"], topics: r.session_topics, notes: r.session_notes,
    rating: r.session_rating, metadata: r.session_metadata, createdAt: r.created_at.toISOString(),
  };
}
export async function listSessionsByMentorship(q: DbConnector, mentorshipId: string): Promise<{ items: MentorshipSession[]; total: number }> {
  const res = await q.query<SessionRow>(`SELECT ${SESS_COLS} FROM sys.sys_mentorship_sessions WHERE session_mentorship_id = $1 ORDER BY session_date DESC`, [mentorshipId]);
  return { items: res.rows.map(toSession), total: res.rows.length };
}
export async function findSessionById(q: DbConnector, id: string): Promise<MentorshipSession | null> {
  const res = await q.query<SessionRow>(`SELECT ${SESS_COLS} FROM sys.sys_mentorship_sessions WHERE session_id = $1`, [id]);
  return res.rows[0] ? toSession(res.rows[0]) : null;
}
export async function insertSession(q: DbConnector, tenantId: string, mentorshipId: string, body: CreateMentorshipSessionBody): Promise<MentorshipSession> {
  const res = await q.query<SessionRow>(
    `INSERT INTO sys.sys_mentorship_sessions (session_tenant_id, session_natural_key, session_mentorship_id, session_date,
       session_duration_minutes, session_status, session_topics, session_notes, session_rating, session_metadata)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb) RETURNING ${SESS_COLS}`,
    [tenantId, `API::${randomUUID()}`, mentorshipId, body.date, body.durationMinutes ?? null, body.status ?? "SCHEDULED",
     body.topics ?? null, body.notes ?? null, body.rating ?? null, JSON.stringify(body.metadata ?? {})],
  );
  return toSession(res.rows[0]!);
}
export async function updateSessionPartial(q: DbConnector, id: string, patch: UpdateMentorshipSessionBody): Promise<MentorshipSession | null> {
  const sets: string[] = []; const params: unknown[] = [];
  const add = (col: string, v: unknown) => { params.push(v); sets.push(`${col} = $${params.length}`); };
  if (patch.date !== undefined) add("session_date", patch.date);
  if (patch.durationMinutes !== undefined) add("session_duration_minutes", patch.durationMinutes);
  if (patch.status !== undefined) add("session_status", patch.status);
  if (patch.topics !== undefined) add("session_topics", patch.topics);
  if (patch.notes !== undefined) add("session_notes", patch.notes);
  if (patch.rating !== undefined) add("session_rating", patch.rating);
  if (patch.metadata !== undefined) { params.push(JSON.stringify(patch.metadata)); sets.push(`session_metadata = $${params.length}::jsonb`); }
  if (sets.length === 0) return findSessionById(q, id);
  params.push(id);
  const res = await q.query<SessionRow>(`UPDATE sys.sys_mentorship_sessions SET ${sets.join(", ")} WHERE session_id = $${params.length} RETURNING ${SESS_COLS}`, params);
  return res.rows[0] ? toSession(res.rows[0]) : null;
}
export async function deleteSession(q: DbConnector, id: string): Promise<boolean> {
  const res = await q.query(`DELETE FROM sys.sys_mentorship_sessions WHERE session_id = $1`, [id]);
  return (res.rowCount ?? 0) > 0;
}

// ─────────────────────────── Match scores (read-only) ───────────────────────────
interface MatchRow {
  match_id: string; match_tenant_id: string; match_natural_key: string;
  match_mentee_user_id: string | null; match_mentor_user_id: string | null; match_skill_id: string | null;
  match_skill_name: string | null; match_mentee_level: string | null; match_mentor_level: string | null;
  match_score: string | null; match_factors: Record<string, unknown>; match_is_recommended: boolean;
  match_recommendation_rank: number | null; match_expires_at: Date | null; match_metadata: Record<string, unknown>; created_at: Date;
}
const MMS_COLS = `match_id, match_tenant_id, match_natural_key, match_mentee_user_id, match_mentor_user_id,
  match_skill_id, match_skill_name, match_mentee_level, match_mentor_level, match_score, match_factors,
  match_is_recommended, match_recommendation_rank, match_expires_at, match_metadata, created_at`;
function toMatch(r: MatchRow): MentorMatchScore {
  return {
    matchId: r.match_id, tenantId: r.match_tenant_id, naturalKey: r.match_natural_key,
    menteeUserId: r.match_mentee_user_id, mentorUserId: r.match_mentor_user_id, skillId: r.match_skill_id,
    skillName: r.match_skill_name, menteeLevel: num(r.match_mentee_level), mentorLevel: num(r.match_mentor_level),
    score: num(r.match_score), factors: r.match_factors, isRecommended: r.match_is_recommended,
    recommendationRank: r.match_recommendation_rank, expiresAt: r.match_expires_at ? r.match_expires_at.toISOString() : null,
    metadata: r.match_metadata, createdAt: r.created_at.toISOString(),
  };
}
export async function listMatchScores(
  q: DbConnector, tenantId: string | undefined, userIdAllowList: string[] | undefined, query: MentorMatchScoreListQuery,
): Promise<{ items: MentorMatchScore[]; total: number }> {
  const where: string[] = []; const params: unknown[] = [];
  if (tenantId) { params.push(tenantId); where.push(`match_tenant_id = $${params.length}`); }
  if (userIdAllowList) {
    if (userIdAllowList.length === 0) return { items: [], total: 0 };
    params.push(userIdAllowList);
    where.push(`(match_mentor_user_id = ANY($${params.length}::uuid[]) OR match_mentee_user_id = ANY($${params.length}::uuid[]))`);
  }
  if (query.mentorUserId) { params.push(query.mentorUserId); where.push(`match_mentor_user_id = $${params.length}`); }
  if (query.menteeUserId) { params.push(query.menteeUserId); where.push(`match_mentee_user_id = $${params.length}`); }
  if (query.isRecommended !== undefined) { params.push(query.isRecommended); where.push(`match_is_recommended = $${params.length}`); }
  const wc = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const totalRow = await q.query<{ total: string }>(`SELECT count(*)::text AS total FROM sys.sys_mentor_match_scores ${wc}`, params);
  const total = Number(totalRow.rows[0]?.total ?? 0);
  params.push(query.limit); const lim = params.length; params.push(query.offset); const off = params.length;
  const res = await q.query<MatchRow>(`SELECT ${MMS_COLS} FROM sys.sys_mentor_match_scores ${wc} ORDER BY match_score DESC NULLS LAST LIMIT $${lim} OFFSET $${off}`, params);
  return { items: res.rows.map(toMatch), total };
}
export async function findMatchScoreById(q: DbConnector, id: string): Promise<MentorMatchScore | null> {
  const res = await q.query<MatchRow>(`SELECT ${MMS_COLS} FROM sys.sys_mentor_match_scores WHERE match_id = $1`, [id]);
  return res.rows[0] ? toMatch(res.rows[0]) : null;
}
