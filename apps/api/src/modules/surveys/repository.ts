/**
 * apps/api/src/modules/surveys/repository.ts
 * Raw parameterized SQL for the engagement surveys domain (3 sys.* tables).
 * Tenant filtering at SQL level; PLATFORM_ADMIN passes tenantId=undefined (no filter).
 * questions/answers are jsonb (legacy = arrays, API-created default = {}); node-pg parses them.
 */
import type { Pool, PoolClient } from "pg";
import { randomUUID } from "node:crypto";
import type {
  SurveyTemplate, SurveyTemplateListQuery, CreateSurveyTemplateBody, UpdateSurveyTemplateBody,
  Survey, SurveyListQuery, CreateSurveyBody, UpdateSurveyBody,
  SurveyResponse, SurveyResponseListQuery,
} from "@heuresys/shared";

export type DbConnector = Pool | PoolClient;

type Json = Record<string, unknown> | unknown[];

// ─────────────────────────── Templates ───────────────────────────
interface TemplateRow {
  template_id: string; template_tenant_id: string; template_natural_key: string;
  template_name: string; template_description: string | null; template_category: string;
  template_questions: Json; template_is_system: boolean; template_created_by_user_id: string | null;
  template_metadata: Record<string, unknown>; created_at: Date; updated_at: Date;
}
const TEMPLATE_COLS = `template_id, template_tenant_id, template_natural_key, template_name, template_description,
  template_category, template_questions, template_is_system, template_created_by_user_id, template_metadata,
  created_at, updated_at`;
function toTemplate(r: TemplateRow): SurveyTemplate {
  return {
    templateId: r.template_id, tenantId: r.template_tenant_id, naturalKey: r.template_natural_key,
    name: r.template_name, description: r.template_description, category: r.template_category as SurveyTemplate["category"],
    questions: r.template_questions, isSystem: r.template_is_system, createdByUserId: r.template_created_by_user_id,
    metadata: r.template_metadata, createdAt: r.created_at.toISOString(), updatedAt: r.updated_at.toISOString(),
  };
}

export async function listTemplates(
  q: DbConnector, tenantId: string | undefined, query: SurveyTemplateListQuery,
): Promise<{ items: SurveyTemplate[]; total: number }> {
  const where: string[] = []; const params: unknown[] = [];
  if (tenantId) { params.push(tenantId); where.push(`template_tenant_id = $${params.length}`); }
  if (query.category) { params.push(query.category); where.push(`template_category = $${params.length}`); }
  if (query.isSystem !== undefined) { params.push(query.isSystem); where.push(`template_is_system = $${params.length}`); }
  if (query.search) { params.push(`%${query.search}%`); where.push(`template_name ILIKE $${params.length}`); }
  const wc = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const totalRow = await q.query<{ total: string }>(`SELECT count(*)::text AS total FROM sys.sys_engagement_survey_templates ${wc}`, params);
  const total = Number(totalRow.rows[0]?.total ?? 0);
  params.push(query.limit); const lim = params.length; params.push(query.offset); const off = params.length;
  const res = await q.query<TemplateRow>(`SELECT ${TEMPLATE_COLS} FROM sys.sys_engagement_survey_templates ${wc} ORDER BY template_name LIMIT $${lim} OFFSET $${off}`, params);
  return { items: res.rows.map(toTemplate), total };
}
export async function findTemplateById(q: DbConnector, id: string): Promise<SurveyTemplate | null> {
  const res = await q.query<TemplateRow>(`SELECT ${TEMPLATE_COLS} FROM sys.sys_engagement_survey_templates WHERE template_id = $1`, [id]);
  return res.rows[0] ? toTemplate(res.rows[0]) : null;
}
export async function insertTemplate(q: DbConnector, tenantId: string, body: CreateSurveyTemplateBody): Promise<SurveyTemplate> {
  const res = await q.query<TemplateRow>(
    `INSERT INTO sys.sys_engagement_survey_templates (template_tenant_id, template_natural_key, template_name,
       template_description, template_category, template_questions, template_is_system, template_created_by_user_id, template_metadata)
     VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9::jsonb) RETURNING ${TEMPLATE_COLS}`,
    [tenantId, `API::${randomUUID()}`, body.name, body.description ?? null, body.category ?? "custom",
     JSON.stringify(body.questions ?? []), body.isSystem ?? false, body.createdByUserId ?? null, JSON.stringify(body.metadata ?? {})],
  );
  return toTemplate(res.rows[0]!);
}
export async function updateTemplatePartial(q: DbConnector, id: string, patch: UpdateSurveyTemplateBody): Promise<SurveyTemplate | null> {
  const sets: string[] = []; const params: unknown[] = [];
  const add = (col: string, v: unknown) => { params.push(v); sets.push(`${col} = $${params.length}`); };
  if (patch.name !== undefined) add("template_name", patch.name);
  if (patch.description !== undefined) add("template_description", patch.description);
  if (patch.category !== undefined) add("template_category", patch.category);
  if (patch.questions !== undefined) { params.push(JSON.stringify(patch.questions)); sets.push(`template_questions = $${params.length}::jsonb`); }
  if (patch.isSystem !== undefined) add("template_is_system", patch.isSystem);
  if (patch.metadata !== undefined) { params.push(JSON.stringify(patch.metadata)); sets.push(`template_metadata = $${params.length}::jsonb`); }
  if (sets.length === 0) return findTemplateById(q, id);
  params.push(id);
  const res = await q.query<TemplateRow>(`UPDATE sys.sys_engagement_survey_templates SET ${sets.join(", ")} WHERE template_id = $${params.length} RETURNING ${TEMPLATE_COLS}`, params);
  return res.rows[0] ? toTemplate(res.rows[0]) : null;
}
export async function deleteTemplate(q: DbConnector, id: string): Promise<boolean> {
  const res = await q.query(`DELETE FROM sys.sys_engagement_survey_templates WHERE template_id = $1`, [id]);
  return (res.rowCount ?? 0) > 0;
}

// ─────────────────────────── Surveys ───────────────────────────
interface SurveyRow {
  survey_id: string; survey_tenant_id: string; survey_natural_key: string; survey_template_id: string | null;
  survey_title: string; survey_description: string | null; survey_questions: Json; survey_status: string;
  survey_audience_type: string; survey_audience_ids: string[] | null; survey_is_anonymous: boolean;
  survey_total_invitations: number; survey_total_responses: number; survey_created_by_user_id: string | null;
  survey_start_date: Date | null; survey_end_date: Date | null;
  survey_metadata: Record<string, unknown>; created_at: Date; updated_at: Date;
}
const SURVEY_COLS = `survey_id, survey_tenant_id, survey_natural_key, survey_template_id, survey_title,
  survey_description, survey_questions, survey_status, survey_audience_type, survey_audience_ids,
  survey_is_anonymous, survey_total_invitations, survey_total_responses, survey_created_by_user_id,
  survey_start_date, survey_end_date, survey_metadata, created_at, updated_at`;
function toSurvey(r: SurveyRow): Survey {
  return {
    surveyId: r.survey_id, tenantId: r.survey_tenant_id, naturalKey: r.survey_natural_key,
    templateId: r.survey_template_id, title: r.survey_title, description: r.survey_description,
    questions: r.survey_questions, status: r.survey_status as Survey["status"],
    audienceType: r.survey_audience_type as Survey["audienceType"], audienceIds: r.survey_audience_ids,
    isAnonymous: r.survey_is_anonymous, totalInvitations: r.survey_total_invitations, totalResponses: r.survey_total_responses,
    createdByUserId: r.survey_created_by_user_id,
    startDate: r.survey_start_date ? r.survey_start_date.toISOString() : null,
    endDate: r.survey_end_date ? r.survey_end_date.toISOString() : null,
    metadata: r.survey_metadata, createdAt: r.created_at.toISOString(), updatedAt: r.updated_at.toISOString(),
  };
}

export async function listSurveys(
  q: DbConnector, tenantId: string | undefined, query: SurveyListQuery,
): Promise<{ items: Survey[]; total: number }> {
  const where: string[] = []; const params: unknown[] = [];
  if (tenantId) { params.push(tenantId); where.push(`survey_tenant_id = $${params.length}`); }
  if (query.status) { params.push(query.status); where.push(`survey_status = $${params.length}`); }
  if (query.audienceType) { params.push(query.audienceType); where.push(`survey_audience_type = $${params.length}`); }
  if (query.templateId) { params.push(query.templateId); where.push(`survey_template_id = $${params.length}`); }
  if (query.search) { params.push(`%${query.search}%`); where.push(`survey_title ILIKE $${params.length}`); }
  const wc = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const totalRow = await q.query<{ total: string }>(`SELECT count(*)::text AS total FROM sys.sys_engagement_surveys ${wc}`, params);
  const total = Number(totalRow.rows[0]?.total ?? 0);
  params.push(query.limit); const lim = params.length; params.push(query.offset); const off = params.length;
  const res = await q.query<SurveyRow>(`SELECT ${SURVEY_COLS} FROM sys.sys_engagement_surveys ${wc} ORDER BY created_at DESC LIMIT $${lim} OFFSET $${off}`, params);
  return { items: res.rows.map(toSurvey), total };
}
export async function findSurveyById(q: DbConnector, id: string): Promise<Survey | null> {
  const res = await q.query<SurveyRow>(`SELECT ${SURVEY_COLS} FROM sys.sys_engagement_surveys WHERE survey_id = $1`, [id]);
  return res.rows[0] ? toSurvey(res.rows[0]) : null;
}
export async function insertSurvey(q: DbConnector, tenantId: string, body: CreateSurveyBody): Promise<Survey> {
  const res = await q.query<SurveyRow>(
    `INSERT INTO sys.sys_engagement_surveys (survey_tenant_id, survey_natural_key, survey_template_id, survey_title,
       survey_description, survey_questions, survey_status, survey_audience_type, survey_audience_ids, survey_is_anonymous,
       survey_total_invitations, survey_total_responses, survey_created_by_user_id, survey_start_date, survey_end_date, survey_metadata)
     VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16::jsonb) RETURNING ${SURVEY_COLS}`,
    [tenantId, `API::${randomUUID()}`, body.templateId ?? null, body.title, body.description ?? null,
     JSON.stringify(body.questions ?? []), body.status ?? "draft", body.audienceType ?? "all", body.audienceIds ?? null,
     body.isAnonymous ?? false, body.totalInvitations ?? 0, body.totalResponses ?? 0, body.createdByUserId ?? null,
     body.startDate ?? null, body.endDate ?? null, JSON.stringify(body.metadata ?? {})],
  );
  return toSurvey(res.rows[0]!);
}
export async function updateSurveyPartial(q: DbConnector, id: string, patch: UpdateSurveyBody): Promise<Survey | null> {
  const sets: string[] = []; const params: unknown[] = [];
  const add = (col: string, v: unknown) => { params.push(v); sets.push(`${col} = $${params.length}`); };
  if (patch.templateId !== undefined) add("survey_template_id", patch.templateId);
  if (patch.title !== undefined) add("survey_title", patch.title);
  if (patch.description !== undefined) add("survey_description", patch.description);
  if (patch.questions !== undefined) { params.push(JSON.stringify(patch.questions)); sets.push(`survey_questions = $${params.length}::jsonb`); }
  if (patch.status !== undefined) add("survey_status", patch.status);
  if (patch.audienceType !== undefined) add("survey_audience_type", patch.audienceType);
  if (patch.audienceIds !== undefined) add("survey_audience_ids", patch.audienceIds);
  if (patch.isAnonymous !== undefined) add("survey_is_anonymous", patch.isAnonymous);
  if (patch.totalInvitations !== undefined) add("survey_total_invitations", patch.totalInvitations);
  if (patch.totalResponses !== undefined) add("survey_total_responses", patch.totalResponses);
  if (patch.startDate !== undefined) add("survey_start_date", patch.startDate);
  if (patch.endDate !== undefined) add("survey_end_date", patch.endDate);
  if (patch.metadata !== undefined) { params.push(JSON.stringify(patch.metadata)); sets.push(`survey_metadata = $${params.length}::jsonb`); }
  if (sets.length === 0) return findSurveyById(q, id);
  params.push(id);
  const res = await q.query<SurveyRow>(`UPDATE sys.sys_engagement_surveys SET ${sets.join(", ")} WHERE survey_id = $${params.length} RETURNING ${SURVEY_COLS}`, params);
  return res.rows[0] ? toSurvey(res.rows[0]) : null;
}
export async function deleteSurvey(q: DbConnector, id: string): Promise<boolean> {
  const res = await q.query(`DELETE FROM sys.sys_engagement_surveys WHERE survey_id = $1`, [id]);
  return (res.rowCount ?? 0) > 0;
}

// ─────────────────────────── Responses (read-only event log) ───────────────────────────
interface ResponseRow {
  response_id: string; response_tenant_id: string; response_natural_key: string; response_survey_id: string;
  response_subject_user_id: string | null; response_answers: Json; response_is_complete: boolean;
  response_started_at: Date | null; response_completed_at: Date | null;
  response_metadata: Record<string, unknown>; created_at: Date;
}
const RESP_COLS = `response_id, response_tenant_id, response_natural_key, response_survey_id, response_subject_user_id,
  response_answers, response_is_complete, response_started_at, response_completed_at, response_metadata, created_at`;
function toResponse(r: ResponseRow): SurveyResponse {
  return {
    responseId: r.response_id, tenantId: r.response_tenant_id, naturalKey: r.response_natural_key,
    surveyId: r.response_survey_id, subjectUserId: r.response_subject_user_id, answers: r.response_answers,
    isComplete: r.response_is_complete,
    startedAt: r.response_started_at ? r.response_started_at.toISOString() : null,
    completedAt: r.response_completed_at ? r.response_completed_at.toISOString() : null,
    metadata: r.response_metadata, createdAt: r.created_at.toISOString(),
  };
}
/**
 * #235 — `userIdAllowList` e' l'asse organizzativo, non un filtro di comodo: `undefined`
 * significa «nessun limite» (piattaforma o mandato HR), una lista VUOTA significa «nessuno»
 * e deve rendere zero righe, non tutte. La forma e' identica a `listGoals`, di proposito:
 * due modi diversi di scrivere lo stesso cancello sono due modi di sbagliarlo.
 *
 * NB: qui NON si aggiunge `OR ... IS NULL` come in `listGoals` — un obiettivo senza soggetto
 * e' un obiettivo aziendale, una risposta senza soggetto sarebbe una risposta anonima, e
 * un'anonima non deve diventare visibile a chi non vede la platea.
 */
export async function listResponsesBySurvey(
  q: DbConnector, surveyId: string, query: SurveyResponseListQuery,
  userIdAllowList?: string[],
): Promise<{ items: SurveyResponse[]; total: number }> {
  const where: string[] = [`response_survey_id = $1`]; const params: unknown[] = [surveyId];
  if (userIdAllowList) {
    if (userIdAllowList.length === 0) return { items: [], total: 0 };
    params.push(userIdAllowList);
    where.push(`response_subject_user_id = ANY($${params.length}::uuid[])`);
  }
  if (query.subjectUserId) { params.push(query.subjectUserId); where.push(`response_subject_user_id = $${params.length}`); }
  if (query.isComplete !== undefined) { params.push(query.isComplete); where.push(`response_is_complete = $${params.length}`); }
  const wc = `WHERE ${where.join(" AND ")}`;
  const totalRow = await q.query<{ total: string }>(`SELECT count(*)::text AS total FROM sys.sys_engagement_survey_responses ${wc}`, params);
  const total = Number(totalRow.rows[0]?.total ?? 0);
  params.push(query.limit); const lim = params.length; params.push(query.offset); const off = params.length;
  const res = await q.query<ResponseRow>(`SELECT ${RESP_COLS} FROM sys.sys_engagement_survey_responses ${wc} ORDER BY response_started_at DESC NULLS LAST LIMIT $${lim} OFFSET $${off}`, params);
  return { items: res.rows.map(toResponse), total };
}
export async function findResponseById(q: DbConnector, id: string): Promise<SurveyResponse | null> {
  const res = await q.query<ResponseRow>(`SELECT ${RESP_COLS} FROM sys.sys_engagement_survey_responses WHERE response_id = $1`, [id]);
  return res.rows[0] ? toResponse(res.rows[0]) : null;
}
