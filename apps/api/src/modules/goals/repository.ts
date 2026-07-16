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

// ─────────────────────────────────────────────────────────────────────────────
// #26 (S1018) — goal-life sub-resources (READ-only, mig 000037 satellites).
// Same conventions: date ::text, numeric → Number(), {items,total} envelopes.
// ─────────────────────────────────────────────────────────────────────────────

import type {
  GoalUpdate, GoalCheckIn, GoalMilestone, GoalComment, GoalAlignment,
  GoalTemplate, GoalTemplateListQuery,
} from "@heuresys/shared";

interface GoalUpdateRow {
  update_id: string; update_goal_id: string; update_author_user_id: string | null;
  update_type: string; update_previous_progress: string | null; update_new_progress: string | null;
  update_previous_status: string | null; update_new_status: string | null;
  update_content: string | null; update_attachments: unknown[]; created_at: Date;
}
export async function listGoalUpdates(
  q: DbConnector, goalId: string, limit: number, offset: number,
): Promise<{ items: GoalUpdate[]; total: number }> {
  const totalRow = await q.query<{ total: string }>(
    `SELECT count(*)::text AS total FROM sys.sys_goal_updates WHERE update_goal_id = $1`, [goalId]);
  const res = await q.query<GoalUpdateRow>(
    `SELECT update_id, update_goal_id, update_author_user_id, update_type,
            update_previous_progress, update_new_progress, update_previous_status,
            update_new_status, update_content, update_attachments, created_at
       FROM sys.sys_goal_updates WHERE update_goal_id = $1
      ORDER BY created_at DESC LIMIT $2 OFFSET $3`, [goalId, limit, offset]);
  return {
    total: Number(totalRow.rows[0]?.total ?? 0),
    items: res.rows.map((r) => ({
      updateId: r.update_id, goalId: r.update_goal_id, authorUserId: r.update_author_user_id,
      type: r.update_type as GoalUpdate["type"],
      previousProgress: r.update_previous_progress === null ? null : Number(r.update_previous_progress),
      newProgress: r.update_new_progress === null ? null : Number(r.update_new_progress),
      previousStatus: r.update_previous_status, newStatus: r.update_new_status,
      content: r.update_content, attachments: r.update_attachments ?? [],
      createdAt: r.created_at.toISOString(),
    })),
  };
}

interface GoalCheckInRow {
  check_in_id: string; check_in_goal_id: string; check_in_subject_user_id: string;
  check_in_date: string; check_in_previous_progress: number | null; check_in_new_progress: number;
  check_in_status_update: string | null; check_in_notes: string | null;
  check_in_blockers: string | null; check_in_next_steps: string | null;
  check_in_confidence_level: number | null; created_at: Date;
}
export async function listGoalCheckIns(
  q: DbConnector, goalId: string, limit: number, offset: number,
): Promise<{ items: GoalCheckIn[]; total: number }> {
  const totalRow = await q.query<{ total: string }>(
    `SELECT count(*)::text AS total FROM sys.sys_goal_check_ins WHERE check_in_goal_id = $1`, [goalId]);
  const res = await q.query<GoalCheckInRow>(
    `SELECT check_in_id, check_in_goal_id, check_in_subject_user_id, check_in_date::text AS check_in_date,
            check_in_previous_progress, check_in_new_progress, check_in_status_update,
            check_in_notes, check_in_blockers, check_in_next_steps, check_in_confidence_level, created_at
       FROM sys.sys_goal_check_ins WHERE check_in_goal_id = $1
      ORDER BY created_at DESC LIMIT $2 OFFSET $3`, [goalId, limit, offset]);
  return {
    total: Number(totalRow.rows[0]?.total ?? 0),
    items: res.rows.map((r) => ({
      checkInId: r.check_in_id, goalId: r.check_in_goal_id, subjectUserId: r.check_in_subject_user_id,
      date: r.check_in_date, previousProgress: r.check_in_previous_progress,
      newProgress: r.check_in_new_progress,
      statusUpdate: r.check_in_status_update as GoalCheckIn["statusUpdate"],
      notes: r.check_in_notes, blockers: r.check_in_blockers, nextSteps: r.check_in_next_steps,
      confidenceLevel: r.check_in_confidence_level, createdAt: r.created_at.toISOString(),
    })),
  };
}

interface GoalMilestoneRow {
  milestone_id: string; milestone_goal_id: string; milestone_title: string;
  milestone_description: string | null; milestone_target_date: string | null;
  milestone_completed_at: Date | null; milestone_status: string; milestone_weight: string;
  created_at: Date; updated_at: Date;
}
export async function listGoalMilestones(
  q: DbConnector, goalId: string, limit: number, offset: number,
): Promise<{ items: GoalMilestone[]; total: number }> {
  const totalRow = await q.query<{ total: string }>(
    `SELECT count(*)::text AS total FROM sys.sys_goal_milestones WHERE milestone_goal_id = $1`, [goalId]);
  const res = await q.query<GoalMilestoneRow>(
    `SELECT milestone_id, milestone_goal_id, milestone_title, milestone_description,
            milestone_target_date::text AS milestone_target_date, milestone_completed_at,
            milestone_status, milestone_weight, created_at, updated_at
       FROM sys.sys_goal_milestones WHERE milestone_goal_id = $1
      ORDER BY milestone_target_date ASC NULLS LAST, created_at ASC LIMIT $2 OFFSET $3`,
    [goalId, limit, offset]);
  return {
    total: Number(totalRow.rows[0]?.total ?? 0),
    items: res.rows.map((r) => ({
      milestoneId: r.milestone_id, goalId: r.milestone_goal_id, title: r.milestone_title,
      description: r.milestone_description, targetDate: r.milestone_target_date,
      completedAt: r.milestone_completed_at ? r.milestone_completed_at.toISOString() : null,
      status: r.milestone_status as GoalMilestone["status"], weight: Number(r.milestone_weight),
      createdAt: r.created_at.toISOString(), updatedAt: r.updated_at.toISOString(),
    })),
  };
}

interface GoalCommentRow {
  comment_id: string; comment_goal_id: string; comment_author_user_id: string | null;
  comment_parent_comment_id: string | null; comment_content: string;
  comment_is_private: boolean; created_at: Date; updated_at: Date;
}
/**
 * Private comments are visible only to their author or to a tenant-wide reader
 * (org scope kind all|tenant) — decided in the service, passed as includePrivate.
 */
export async function listGoalComments(
  q: DbConnector, goalId: string, viewerUserId: string, includePrivate: boolean,
  limit: number, offset: number,
): Promise<{ items: GoalComment[]; total: number }> {
  const vis = includePrivate
    ? ""
    : ` AND (comment_is_private = false OR comment_author_user_id = $2)`;
  const baseParams: unknown[] = includePrivate ? [goalId] : [goalId, viewerUserId];
  const totalRow = await q.query<{ total: string }>(
    `SELECT count(*)::text AS total FROM sys.sys_goal_comments WHERE comment_goal_id = $1${vis}`,
    baseParams);
  const params = [...baseParams, limit, offset];
  const res = await q.query<GoalCommentRow>(
    `SELECT comment_id, comment_goal_id, comment_author_user_id, comment_parent_comment_id,
            comment_content, comment_is_private, created_at, updated_at
       FROM sys.sys_goal_comments WHERE comment_goal_id = $1${vis}
      ORDER BY created_at ASC LIMIT $${params.length - 1} OFFSET $${params.length}`, params);
  return {
    total: Number(totalRow.rows[0]?.total ?? 0),
    items: res.rows.map((r) => ({
      commentId: r.comment_id, goalId: r.comment_goal_id, authorUserId: r.comment_author_user_id,
      parentCommentId: r.comment_parent_comment_id, content: r.comment_content,
      isPrivate: r.comment_is_private,
      createdAt: r.created_at.toISOString(), updatedAt: r.updated_at.toISOString(),
    })),
  };
}

interface GoalAlignmentRow {
  alignment_id: string; alignment_source_goal_id: string; alignment_aligned_goal_id: string;
  other_title: string | null; direction: "OUT" | "IN"; alignment_type: string;
  alignment_weight: string; created_at: Date;
}
/** Both directions: OUT (goal → other) and IN (other → goal), other goal title joined. */
export async function listGoalAlignments(
  q: DbConnector, goalId: string, limit: number, offset: number,
): Promise<{ items: GoalAlignment[]; total: number }> {
  const totalRow = await q.query<{ total: string }>(
    `SELECT count(*)::text AS total FROM sys.sys_goal_alignments
      WHERE alignment_source_goal_id = $1 OR alignment_aligned_goal_id = $1`, [goalId]);
  const res = await q.query<GoalAlignmentRow>(
    `SELECT a.alignment_id, a.alignment_source_goal_id, a.alignment_aligned_goal_id,
            g.goal_title AS other_title,
            CASE WHEN a.alignment_source_goal_id = $1 THEN 'OUT' ELSE 'IN' END AS direction,
            a.alignment_type, a.alignment_weight, a.created_at
       FROM sys.sys_goal_alignments a
       LEFT JOIN sys.sys_goals g ON g.goal_id =
         CASE WHEN a.alignment_source_goal_id = $1 THEN a.alignment_aligned_goal_id
              ELSE a.alignment_source_goal_id END
      WHERE a.alignment_source_goal_id = $1 OR a.alignment_aligned_goal_id = $1
      ORDER BY a.created_at DESC LIMIT $2 OFFSET $3`, [goalId, limit, offset]);
  return {
    total: Number(totalRow.rows[0]?.total ?? 0),
    items: res.rows.map((r) => ({
      alignmentId: r.alignment_id, sourceGoalId: r.alignment_source_goal_id,
      alignedGoalId: r.alignment_aligned_goal_id, alignedGoalTitle: r.other_title,
      direction: r.direction, type: r.alignment_type as GoalAlignment["type"],
      weight: Number(r.alignment_weight), createdAt: r.created_at.toISOString(),
    })),
  };
}

interface GoalTemplateRow {
  template_id: string; template_name: string; template_description: string | null;
  template_category: string | null; template_goal_type: string;
  template_suggested_metrics: string[] | null; template_suggested_duration_days: number | null;
  template_suggested_weight: string; template_difficulty_level: string;
  template_is_company_wide: boolean; template_usage_count: number;
  template_is_active: boolean; created_at: Date;
}
export async function listGoalTemplates(
  q: DbConnector, tenantId: string | undefined, query: GoalTemplateListQuery,
): Promise<{ items: GoalTemplate[]; total: number }> {
  const where: string[] = ["template_deleted_at IS NULL"]; const params: unknown[] = [];
  if (tenantId) { params.push(tenantId); where.push(`template_tenant_id = $${params.length}`); }
  if (query.category) { params.push(query.category); where.push(`template_category = $${params.length}`); }
  if (query.isActive !== undefined) { params.push(query.isActive); where.push(`template_is_active = $${params.length}`); }
  const wc = `WHERE ${where.join(" AND ")}`;
  const totalRow = await q.query<{ total: string }>(
    `SELECT count(*)::text AS total FROM sys.sys_goal_templates ${wc}`, params);
  params.push(query.limit); const lim = params.length; params.push(query.offset); const off = params.length;
  const res = await q.query<GoalTemplateRow>(
    `SELECT template_id, template_name, template_description, template_category, template_goal_type,
            template_suggested_metrics, template_suggested_duration_days, template_suggested_weight,
            template_difficulty_level, template_is_company_wide, template_usage_count,
            template_is_active, created_at
       FROM sys.sys_goal_templates ${wc}
      ORDER BY template_usage_count DESC, template_name ASC LIMIT $${lim} OFFSET $${off}`, params);
  return {
    total: Number(totalRow.rows[0]?.total ?? 0),
    items: res.rows.map((r) => ({
      templateId: r.template_id, name: r.template_name, description: r.template_description,
      category: r.template_category, goalType: r.template_goal_type as GoalTemplate["goalType"],
      suggestedMetrics: r.template_suggested_metrics, suggestedDurationDays: r.template_suggested_duration_days,
      suggestedWeight: Number(r.template_suggested_weight),
      difficultyLevel: r.template_difficulty_level as GoalTemplate["difficultyLevel"],
      isCompanyWide: r.template_is_company_wide, usageCount: r.template_usage_count,
      isActive: r.template_is_active, createdAt: r.created_at.toISOString(),
    })),
  };
}
