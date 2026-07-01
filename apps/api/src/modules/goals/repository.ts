/**
 * apps/api/src/modules/goals/repository.ts
 * Raw parameterized SQL for sys.sys_goals. Tenant filter at SQL level.
 * numeric(goal_weight) -> string from pg => Number(); date columns cast ::text.
 * Mirrors modules/engagement-feedback/repository.ts.
 */
import type { Pool, PoolClient } from "pg";
import { randomUUID } from "node:crypto";
import type { Goal, GoalListQuery, CreateGoalBody, UpdateGoalBody } from "@heuresys/shared";

export type DbConnector = Pool | PoolClient;

interface GoalRow {
  goal_id: string; goal_tenant_id: string; goal_natural_key: string;
  goal_subject_user_id: string | null; goal_owner_user_id: string | null;
  goal_parent_goal_id: string | null; goal_template_id: string | null;
  goal_title: string; goal_description: string | null; goal_type: string;
  goal_category: string | null; goal_priority: string; goal_status: string;
  goal_progress_percent: number; goal_weight: string;
  goal_start_date: string | null; goal_due_date: string | null;
  goal_completed_at: Date | null; goal_tags: unknown[]; goal_metadata: Record<string, unknown>;
  created_at: Date; updated_at: Date;
}

const GOAL_COLS = `goal_id, goal_tenant_id, goal_natural_key, goal_subject_user_id, goal_owner_user_id,
  goal_parent_goal_id, goal_template_id, goal_title, goal_description, goal_type, goal_category,
  goal_priority, goal_status, goal_progress_percent, goal_weight,
  goal_start_date::text AS goal_start_date, goal_due_date::text AS goal_due_date, goal_completed_at,
  goal_tags, goal_metadata, created_at, updated_at`;

function toGoal(r: GoalRow): Goal {
  return {
    goalId: r.goal_id, tenantId: r.goal_tenant_id, naturalKey: r.goal_natural_key,
    subjectUserId: r.goal_subject_user_id, ownerUserId: r.goal_owner_user_id,
    parentGoalId: r.goal_parent_goal_id, templateId: r.goal_template_id,
    title: r.goal_title, description: r.goal_description,
    type: r.goal_type as Goal["type"], category: r.goal_category,
    priority: r.goal_priority as Goal["priority"], status: r.goal_status as Goal["status"],
    progressPercent: r.goal_progress_percent, weight: Number(r.goal_weight),
    startDate: r.goal_start_date, dueDate: r.goal_due_date,
    completedAt: r.goal_completed_at ? r.goal_completed_at.toISOString() : null,
    tags: r.goal_tags ?? [], metadata: r.goal_metadata,
    createdAt: r.created_at.toISOString(), updatedAt: r.updated_at.toISOString(),
  };
}

export async function listGoals(
  q: DbConnector, tenantId: string | undefined, query: GoalListQuery,
  userIdAllowList?: string[],
): Promise<{ items: Goal[]; total: number }> {
  const where: string[] = []; const params: unknown[] = [];
  if (tenantId) { params.push(tenantId); where.push(`goal_tenant_id = $${params.length}`); }
  if (userIdAllowList) {
    if (userIdAllowList.length === 0) return { items: [], total: 0 };
    params.push(userIdAllowList);
    where.push(`(goal_subject_user_id = ANY($${params.length}::uuid[]) OR goal_subject_user_id IS NULL)`);
  }
  if (query.status) { params.push(query.status); where.push(`goal_status = $${params.length}`); }
  if (query.type) { params.push(query.type); where.push(`goal_type = $${params.length}`); }
  if (query.priority) { params.push(query.priority); where.push(`goal_priority = $${params.length}`); }
  if (query.ownerUserId) { params.push(query.ownerUserId); where.push(`goal_owner_user_id = $${params.length}`); }
  if (query.subjectUserId) { params.push(query.subjectUserId); where.push(`goal_subject_user_id = $${params.length}`); }
  if (query.search) { params.push(`%${query.search}%`); where.push(`goal_title ILIKE $${params.length}`); }
  const wc = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const totalRow = await q.query<{ total: string }>(`SELECT count(*)::text AS total FROM sys.sys_goals ${wc}`, params);
  const total = Number(totalRow.rows[0]?.total ?? 0);
  params.push(query.limit); const lim = params.length; params.push(query.offset); const off = params.length;
  const res = await q.query<GoalRow>(`SELECT ${GOAL_COLS} FROM sys.sys_goals ${wc} ORDER BY created_at DESC LIMIT $${lim} OFFSET $${off}`, params);
  return { items: res.rows.map(toGoal), total };
}

export async function findGoalById(q: DbConnector, id: string): Promise<Goal | null> {
  const res = await q.query<GoalRow>(`SELECT ${GOAL_COLS} FROM sys.sys_goals WHERE goal_id = $1`, [id]);
  return res.rows[0] ? toGoal(res.rows[0]) : null;
}

export async function insertGoal(q: DbConnector, tenantId: string, body: CreateGoalBody): Promise<Goal> {
  const res = await q.query<GoalRow>(
    `INSERT INTO sys.sys_goals (goal_tenant_id, goal_natural_key, goal_subject_user_id, goal_owner_user_id,
       goal_parent_goal_id, goal_template_id, goal_title, goal_description, goal_type, goal_category,
       goal_priority, goal_status, goal_progress_percent, goal_weight, goal_start_date, goal_due_date, goal_metadata)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15::date,$16::date,$17::jsonb)
     RETURNING ${GOAL_COLS}`,
    [tenantId, `API::${randomUUID()}`, body.subjectUserId ?? null, body.ownerUserId ?? null,
     body.parentGoalId ?? null, body.templateId ?? null, body.title, body.description ?? null,
     body.type ?? "OBJECTIVE", body.category ?? null, body.priority ?? "MEDIUM", body.status ?? "NOT_STARTED",
     body.progressPercent ?? 0, body.weight ?? 1, body.startDate ?? null, body.dueDate ?? null,
     JSON.stringify(body.metadata ?? {})],
  );
  return toGoal(res.rows[0]!);
}

export async function updateGoalPartial(q: DbConnector, id: string, patch: UpdateGoalBody): Promise<Goal | null> {
  const sets: string[] = []; const params: unknown[] = [];
  const add = (col: string, v: unknown) => { params.push(v); sets.push(`${col} = $${params.length}`); };
  if (patch.title !== undefined) add("goal_title", patch.title);
  if (patch.description !== undefined) add("goal_description", patch.description);
  if (patch.type !== undefined) add("goal_type", patch.type);
  if (patch.category !== undefined) add("goal_category", patch.category);
  if (patch.priority !== undefined) add("goal_priority", patch.priority);
  if (patch.status !== undefined) add("goal_status", patch.status);
  if (patch.progressPercent !== undefined) add("goal_progress_percent", patch.progressPercent);
  if (patch.weight !== undefined) add("goal_weight", patch.weight);
  if (patch.ownerUserId !== undefined) add("goal_owner_user_id", patch.ownerUserId);
  if (patch.startDate !== undefined) { params.push(patch.startDate); sets.push(`goal_start_date = $${params.length}::date`); }
  if (patch.dueDate !== undefined) { params.push(patch.dueDate); sets.push(`goal_due_date = $${params.length}::date`); }
  if (patch.completedAt !== undefined) add("goal_completed_at", patch.completedAt);
  if (patch.metadata !== undefined) { params.push(JSON.stringify(patch.metadata)); sets.push(`goal_metadata = $${params.length}::jsonb`); }
  if (sets.length === 0) return findGoalById(q, id);
  params.push(id);
  const res = await q.query<GoalRow>(`UPDATE sys.sys_goals SET ${sets.join(", ")} WHERE goal_id = $${params.length} RETURNING ${GOAL_COLS}`, params);
  return res.rows[0] ? toGoal(res.rows[0]) : null;
}

export async function deleteGoal(q: DbConnector, id: string): Promise<boolean> {
  const res = await q.query(`DELETE FROM sys.sys_goals WHERE goal_id = $1`, [id]);
  return (res.rowCount ?? 0) > 0;
}
