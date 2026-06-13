/**
 * apps/api/src/modules/engagement-feedback/repository.ts
 * Raw parameterized SQL for the engagement feedback domain (2 sys.* tables).
 * Tenant filtering at SQL level; PLATFORM_ADMIN passes tenantId=undefined (no filter).
 * Mirrors modules/surveys/repository.ts. due_date cast ::text in the column list to dodge
 * node-pg date/timezone ambiguity (returns 'YYYY-MM-DD' verbatim).
 */
import type { Pool, PoolClient } from "pg";
import { randomUUID } from "node:crypto";
import type {
  EngagementFeedback, EngagementFeedbackListQuery, CreateEngagementFeedbackBody, UpdateEngagementFeedbackBody,
  EngagementActionPlan, EngagementActionPlanListQuery, CreateEngagementActionPlanBody, UpdateEngagementActionPlanBody,
} from "@heuresys/shared";

export type DbConnector = Pool | PoolClient;

// ─────────────────────────── Feedback ───────────────────────────
interface FeedbackRow {
  feedback_id: string; feedback_tenant_id: string; feedback_natural_key: string;
  feedback_category: string; feedback_message: string; feedback_status: string;
  feedback_reviewed_by_user_id: string | null; feedback_reviewed_at: Date | null;
  feedback_action_notes: string | null; feedback_metadata: Record<string, unknown>;
  created_at: Date; updated_at: Date;
}
const FEEDBACK_COLS = `feedback_id, feedback_tenant_id, feedback_natural_key, feedback_category, feedback_message,
  feedback_status, feedback_reviewed_by_user_id, feedback_reviewed_at, feedback_action_notes, feedback_metadata,
  created_at, updated_at`;
function toFeedback(r: FeedbackRow): EngagementFeedback {
  return {
    feedbackId: r.feedback_id, tenantId: r.feedback_tenant_id, naturalKey: r.feedback_natural_key,
    category: r.feedback_category as EngagementFeedback["category"], message: r.feedback_message,
    status: r.feedback_status as EngagementFeedback["status"], reviewedByUserId: r.feedback_reviewed_by_user_id,
    reviewedAt: r.feedback_reviewed_at ? r.feedback_reviewed_at.toISOString() : null,
    actionNotes: r.feedback_action_notes, metadata: r.feedback_metadata,
    createdAt: r.created_at.toISOString(), updatedAt: r.updated_at.toISOString(),
  };
}

export async function listFeedback(
  q: DbConnector, tenantId: string | undefined, query: EngagementFeedbackListQuery,
): Promise<{ items: EngagementFeedback[]; total: number }> {
  const where: string[] = []; const params: unknown[] = [];
  if (tenantId) { params.push(tenantId); where.push(`feedback_tenant_id = $${params.length}`); }
  if (query.category) { params.push(query.category); where.push(`feedback_category = $${params.length}`); }
  if (query.status) { params.push(query.status); where.push(`feedback_status = $${params.length}`); }
  if (query.search) { params.push(`%${query.search}%`); where.push(`feedback_message ILIKE $${params.length}`); }
  const wc = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const totalRow = await q.query<{ total: string }>(`SELECT count(*)::text AS total FROM sys.sys_engagement_feedback ${wc}`, params);
  const total = Number(totalRow.rows[0]?.total ?? 0);
  params.push(query.limit); const lim = params.length; params.push(query.offset); const off = params.length;
  const res = await q.query<FeedbackRow>(`SELECT ${FEEDBACK_COLS} FROM sys.sys_engagement_feedback ${wc} ORDER BY created_at DESC LIMIT $${lim} OFFSET $${off}`, params);
  return { items: res.rows.map(toFeedback), total };
}
export async function findFeedbackById(q: DbConnector, id: string): Promise<EngagementFeedback | null> {
  const res = await q.query<FeedbackRow>(`SELECT ${FEEDBACK_COLS} FROM sys.sys_engagement_feedback WHERE feedback_id = $1`, [id]);
  return res.rows[0] ? toFeedback(res.rows[0]) : null;
}
export async function insertFeedback(q: DbConnector, tenantId: string, body: CreateEngagementFeedbackBody): Promise<EngagementFeedback> {
  const res = await q.query<FeedbackRow>(
    `INSERT INTO sys.sys_engagement_feedback (feedback_tenant_id, feedback_natural_key, feedback_category, feedback_message,
       feedback_status, feedback_reviewed_by_user_id, feedback_reviewed_at, feedback_action_notes, feedback_metadata)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb) RETURNING ${FEEDBACK_COLS}`,
    [tenantId, `API::${randomUUID()}`, body.category ?? "other", body.message, body.status ?? "new",
     body.reviewedByUserId ?? null, body.reviewedAt ?? null, body.actionNotes ?? null, JSON.stringify(body.metadata ?? {})],
  );
  return toFeedback(res.rows[0]!);
}
export async function updateFeedbackPartial(q: DbConnector, id: string, patch: UpdateEngagementFeedbackBody): Promise<EngagementFeedback | null> {
  const sets: string[] = []; const params: unknown[] = [];
  const add = (col: string, v: unknown) => { params.push(v); sets.push(`${col} = $${params.length}`); };
  if (patch.category !== undefined) add("feedback_category", patch.category);
  if (patch.message !== undefined) add("feedback_message", patch.message);
  if (patch.status !== undefined) add("feedback_status", patch.status);
  if (patch.reviewedByUserId !== undefined) add("feedback_reviewed_by_user_id", patch.reviewedByUserId);
  if (patch.reviewedAt !== undefined) add("feedback_reviewed_at", patch.reviewedAt);
  if (patch.actionNotes !== undefined) add("feedback_action_notes", patch.actionNotes);
  if (patch.metadata !== undefined) { params.push(JSON.stringify(patch.metadata)); sets.push(`feedback_metadata = $${params.length}::jsonb`); }
  if (sets.length === 0) return findFeedbackById(q, id);
  params.push(id);
  const res = await q.query<FeedbackRow>(`UPDATE sys.sys_engagement_feedback SET ${sets.join(", ")} WHERE feedback_id = $${params.length} RETURNING ${FEEDBACK_COLS}`, params);
  return res.rows[0] ? toFeedback(res.rows[0]) : null;
}
export async function deleteFeedback(q: DbConnector, id: string): Promise<boolean> {
  const res = await q.query(`DELETE FROM sys.sys_engagement_feedback WHERE feedback_id = $1`, [id]);
  return (res.rowCount ?? 0) > 0;
}

// ─────────────────────────── Action plans ───────────────────────────
interface ActionPlanRow {
  action_plan_id: string; action_plan_tenant_id: string; action_plan_natural_key: string;
  action_plan_source_type: string; action_plan_source_id: string | null; action_plan_title: string;
  action_plan_description: string | null; action_plan_owner_user_id: string | null; action_plan_status: string;
  action_plan_priority: string; action_plan_due_date: string | null; action_plan_completed_at: Date | null;
  action_plan_created_by_user_id: string | null; action_plan_metadata: Record<string, unknown>;
  created_at: Date; updated_at: Date;
}
const ACTION_PLAN_COLS = `action_plan_id, action_plan_tenant_id, action_plan_natural_key, action_plan_source_type,
  action_plan_source_id, action_plan_title, action_plan_description, action_plan_owner_user_id, action_plan_status,
  action_plan_priority, action_plan_due_date::text AS action_plan_due_date, action_plan_completed_at,
  action_plan_created_by_user_id, action_plan_metadata, created_at, updated_at`;
function toActionPlan(r: ActionPlanRow): EngagementActionPlan {
  return {
    actionPlanId: r.action_plan_id, tenantId: r.action_plan_tenant_id, naturalKey: r.action_plan_natural_key,
    sourceType: r.action_plan_source_type as EngagementActionPlan["sourceType"], sourceId: r.action_plan_source_id,
    title: r.action_plan_title, description: r.action_plan_description, ownerUserId: r.action_plan_owner_user_id,
    status: r.action_plan_status as EngagementActionPlan["status"], priority: r.action_plan_priority as EngagementActionPlan["priority"],
    dueDate: r.action_plan_due_date,
    completedAt: r.action_plan_completed_at ? r.action_plan_completed_at.toISOString() : null,
    createdByUserId: r.action_plan_created_by_user_id, metadata: r.action_plan_metadata,
    createdAt: r.created_at.toISOString(), updatedAt: r.updated_at.toISOString(),
  };
}

export async function listActionPlans(
  q: DbConnector, tenantId: string | undefined, query: EngagementActionPlanListQuery,
): Promise<{ items: EngagementActionPlan[]; total: number }> {
  const where: string[] = []; const params: unknown[] = [];
  if (tenantId) { params.push(tenantId); where.push(`action_plan_tenant_id = $${params.length}`); }
  if (query.sourceType) { params.push(query.sourceType); where.push(`action_plan_source_type = $${params.length}`); }
  if (query.status) { params.push(query.status); where.push(`action_plan_status = $${params.length}`); }
  if (query.priority) { params.push(query.priority); where.push(`action_plan_priority = $${params.length}`); }
  if (query.ownerUserId) { params.push(query.ownerUserId); where.push(`action_plan_owner_user_id = $${params.length}`); }
  if (query.search) { params.push(`%${query.search}%`); where.push(`action_plan_title ILIKE $${params.length}`); }
  const wc = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const totalRow = await q.query<{ total: string }>(`SELECT count(*)::text AS total FROM sys.sys_engagement_action_plans ${wc}`, params);
  const total = Number(totalRow.rows[0]?.total ?? 0);
  params.push(query.limit); const lim = params.length; params.push(query.offset); const off = params.length;
  const res = await q.query<ActionPlanRow>(`SELECT ${ACTION_PLAN_COLS} FROM sys.sys_engagement_action_plans ${wc} ORDER BY created_at DESC LIMIT $${lim} OFFSET $${off}`, params);
  return { items: res.rows.map(toActionPlan), total };
}
export async function findActionPlanById(q: DbConnector, id: string): Promise<EngagementActionPlan | null> {
  const res = await q.query<ActionPlanRow>(`SELECT ${ACTION_PLAN_COLS} FROM sys.sys_engagement_action_plans WHERE action_plan_id = $1`, [id]);
  return res.rows[0] ? toActionPlan(res.rows[0]) : null;
}
export async function insertActionPlan(q: DbConnector, tenantId: string, body: CreateEngagementActionPlanBody): Promise<EngagementActionPlan> {
  const res = await q.query<ActionPlanRow>(
    `INSERT INTO sys.sys_engagement_action_plans (action_plan_tenant_id, action_plan_natural_key, action_plan_source_type,
       action_plan_source_id, action_plan_title, action_plan_description, action_plan_owner_user_id, action_plan_status,
       action_plan_priority, action_plan_due_date, action_plan_completed_at, action_plan_created_by_user_id, action_plan_metadata)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::date,$11,$12,$13::jsonb) RETURNING ${ACTION_PLAN_COLS}`,
    [tenantId, `API::${randomUUID()}`, body.sourceType ?? "feedback", body.sourceId ?? null, body.title,
     body.description ?? null, body.ownerUserId ?? null, body.status ?? "planned", body.priority ?? "medium",
     body.dueDate ?? null, body.completedAt ?? null, body.createdByUserId ?? null, JSON.stringify(body.metadata ?? {})],
  );
  return toActionPlan(res.rows[0]!);
}
export async function updateActionPlanPartial(q: DbConnector, id: string, patch: UpdateEngagementActionPlanBody): Promise<EngagementActionPlan | null> {
  const sets: string[] = []; const params: unknown[] = [];
  const add = (col: string, v: unknown) => { params.push(v); sets.push(`${col} = $${params.length}`); };
  if (patch.sourceType !== undefined) add("action_plan_source_type", patch.sourceType);
  if (patch.sourceId !== undefined) add("action_plan_source_id", patch.sourceId);
  if (patch.title !== undefined) add("action_plan_title", patch.title);
  if (patch.description !== undefined) add("action_plan_description", patch.description);
  if (patch.ownerUserId !== undefined) add("action_plan_owner_user_id", patch.ownerUserId);
  if (patch.status !== undefined) add("action_plan_status", patch.status);
  if (patch.priority !== undefined) add("action_plan_priority", patch.priority);
  if (patch.dueDate !== undefined) { params.push(patch.dueDate); sets.push(`action_plan_due_date = $${params.length}::date`); }
  if (patch.completedAt !== undefined) add("action_plan_completed_at", patch.completedAt);
  if (patch.createdByUserId !== undefined) add("action_plan_created_by_user_id", patch.createdByUserId);
  if (patch.metadata !== undefined) { params.push(JSON.stringify(patch.metadata)); sets.push(`action_plan_metadata = $${params.length}::jsonb`); }
  if (sets.length === 0) return findActionPlanById(q, id);
  params.push(id);
  const res = await q.query<ActionPlanRow>(`UPDATE sys.sys_engagement_action_plans SET ${sets.join(", ")} WHERE action_plan_id = $${params.length} RETURNING ${ACTION_PLAN_COLS}`, params);
  return res.rows[0] ? toActionPlan(res.rows[0]) : null;
}
export async function deleteActionPlan(q: DbConnector, id: string): Promise<boolean> {
  const res = await q.query(`DELETE FROM sys.sys_engagement_action_plans WHERE action_plan_id = $1`, [id]);
  return (res.rowCount ?? 0) > 0;
}
