/**
 * apps/api/src/modules/learning-gaps/repository.ts
 * Raw SQL for sys.sys_learning_gaps. Tenant-scoped only.
 */

import type { Pool, PoolClient } from "pg";
import type {
  LearningGap,
  LearningGapListQuery,
  LearningGapSeverity,
  CreateLearningGapBody,
  UpdateLearningGapBody,
} from "@heuresys/shared";

export type DbConnector = Pool | PoolClient;

interface Row {
  learning_gap_id: string;
  learning_gap_tenant_id: string;
  learning_gap_user_id: string;
  learning_gap_position_id: string | null;
  learning_gap_skill_id: string | null;
  learning_gap_required_proficiency: string | null;
  learning_gap_current_proficiency: string | null;
  learning_gap_score: string | null;
  learning_gap_severity: LearningGapSeverity;
  learning_gap_detected_at: Date;
  learning_gap_metadata: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
  user_name?: string | null; // G-02: resolved on the list query, undefined elsewhere
  position_title?: string | null;
  skill_name?: string | null;
}

const COLS = `learning_gap_id, learning_gap_tenant_id, learning_gap_user_id,
  learning_gap_position_id, learning_gap_skill_id, learning_gap_required_proficiency,
  learning_gap_current_proficiency, learning_gap_score, learning_gap_severity,
  learning_gap_detected_at, learning_gap_metadata, created_at, updated_at`;

function toGap(r: Row): LearningGap {
  return {
    learningGapId: r.learning_gap_id,
    tenantId: r.learning_gap_tenant_id,
    userId: r.learning_gap_user_id,
    userName: r.user_name ?? null,
    positionId: r.learning_gap_position_id,
    positionTitle: r.position_title ?? null,
    skillId: r.learning_gap_skill_id,
    skillName: r.skill_name ?? null,
    requiredProficiency: r.learning_gap_required_proficiency,
    currentProficiency: r.learning_gap_current_proficiency,
    score: r.learning_gap_score === null ? null : Number(r.learning_gap_score),
    severity: r.learning_gap_severity,
    detectedAt: r.learning_gap_detected_at.toISOString(),
    metadata: r.learning_gap_metadata,
    createdAt: r.created_at.toISOString(),
    updatedAt: r.updated_at.toISOString(),
  };
}

export async function listGaps(
  q: DbConnector,
  filter: { tenantId?: string; userIdAllowList?: string[]; query: LearningGapListQuery },
): Promise<{ items: LearningGap[]; total: number }> {
  const where: string[] = [];
  const params: unknown[] = [];
  if (filter.tenantId) {
    params.push(filter.tenantId);
    where.push(`learning_gap_tenant_id = $${params.length}`);
  }
  if (filter.userIdAllowList) {
    // ADR-0027 F3: an empty allow-list means nobody is visible — short-circuit to empty.
    if (filter.userIdAllowList.length === 0) return { items: [], total: 0 };
    params.push(filter.userIdAllowList);
    where.push(`learning_gap_user_id = ANY($${params.length}::uuid[])`);
  }
  if (filter.query.userId) {
    params.push(filter.query.userId);
    where.push(`learning_gap_user_id = $${params.length}`);
  }
  if (filter.query.positionId) {
    params.push(filter.query.positionId);
    where.push(`learning_gap_position_id = $${params.length}`);
  }
  if (filter.query.skillId) {
    params.push(filter.query.skillId);
    where.push(`learning_gap_skill_id = $${params.length}`);
  }
  if (filter.query.severity) {
    params.push(filter.query.severity);
    where.push(`learning_gap_severity = $${params.length}`);
  }
  const whereClause = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";

  const totalRow = await q.query<{ total: string }>(
    `SELECT count(*)::text AS total FROM sys.sys_learning_gaps ${whereClause}`,
    params,
  );
  const total = Number(totalRow.rows[0]?.total ?? 0);

  params.push(filter.query.limit);
  const lim = params.length;
  params.push(filter.query.offset);
  const off = params.length;
  const res = await q.query<Row>(
    `SELECT ${COLS},
            (SELECT u.user_display_name FROM sys.sys_users u WHERE u.user_id = sys.sys_learning_gaps.learning_gap_user_id) AS user_name,
            (SELECT p.position_title FROM sys.sys_positions p WHERE p.position_id = sys.sys_learning_gaps.learning_gap_position_id) AS position_title,
            (SELECT s.skill_name FROM sys.sys_skills s WHERE s.skill_id = sys.sys_learning_gaps.learning_gap_skill_id) AS skill_name
       FROM sys.sys_learning_gaps ${whereClause}
      ORDER BY learning_gap_detected_at DESC, learning_gap_id
      LIMIT $${lim} OFFSET $${off}`,
    params,
  );
  return { items: res.rows.map(toGap), total };
}

/**
 * C4 (#42): severity counts for the /gaps KPI strip, computed server-side.
 * Takes the SAME scope filter as listGaps (tenant + ADR-0027 org allow-list) so
 * the summary can never describe gaps the actor cannot list. Deliberately has no
 * limit/offset: it is an aggregate over the whole visible set, which is exactly
 * what the old client-side reduce over `?limit=200` failed to be.
 */
export async function getSeverityDistribution(
  q: DbConnector,
  filter: { tenantId?: string; userIdAllowList?: string[] },
): Promise<{ items: { severity: LearningGapSeverity; count: number }[]; total: number }> {
  const where: string[] = [];
  const params: unknown[] = [];
  if (filter.tenantId) {
    params.push(filter.tenantId);
    where.push(`learning_gap_tenant_id = $${params.length}`);
  }
  if (filter.userIdAllowList) {
    if (filter.userIdAllowList.length === 0) return { items: [], total: 0 };
    params.push(filter.userIdAllowList);
    where.push(`learning_gap_user_id = ANY($${params.length}::uuid[])`);
  }
  const whereClause = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";
  const res = await q.query<{ severity: LearningGapSeverity; count: string }>(
    `SELECT learning_gap_severity AS severity, count(*)::text AS count
       FROM sys.sys_learning_gaps ${whereClause}
      GROUP BY learning_gap_severity
      ORDER BY count(*) DESC, learning_gap_severity`,
    params,
  );
  const items = res.rows.map((r) => ({ severity: r.severity, count: Number(r.count) }));
  return { items, total: items.reduce((sum, i) => sum + i.count, 0) };
}

export async function findGapById(q: DbConnector, id: string): Promise<LearningGap | null> {
  const res = await q.query<Row>(
    `SELECT ${COLS} FROM sys.sys_learning_gaps WHERE learning_gap_id = $1`, [id],
  );
  return res.rows[0] ? toGap(res.rows[0]) : null;
}

export async function getUserTenant(q: DbConnector, userId: string): Promise<{ tenantId: string | null } | null> {
  const res = await q.query<{ user_tenant_id: string | null }>(
    `SELECT user_tenant_id FROM sys.sys_users WHERE user_id = $1`, [userId],
  );
  const r = res.rows[0];
  if (!r) return null;
  return { tenantId: r.user_tenant_id };
}

export async function positionInTenant(
  q: DbConnector,
  positionId: string,
  tenantId: string,
): Promise<{ exists: boolean; sameTenant: boolean }> {
  const res = await q.query<{ position_tenant_id: string }>(
    `SELECT position_tenant_id FROM sys.sys_positions WHERE position_id = $1`,
    [positionId],
  );
  if (res.rows.length === 0) return { exists: false, sameTenant: false };
  return { exists: true, sameTenant: res.rows[0]!.position_tenant_id === tenantId };
}

export async function skillVisibleToTenant(
  q: DbConnector,
  skillId: string,
  tenantId: string,
): Promise<boolean> {
  const res = await q.query<{ x: number }>(
    `SELECT 1 AS x FROM sys.sys_skills
       WHERE skill_id = $1
         AND (skill_is_global = true OR skill_tenant_id = $2)
       LIMIT 1`,
    [skillId, tenantId],
  );
  return res.rows.length > 0;
}

export async function insertGap(
  q: DbConnector,
  tenantId: string,
  body: CreateLearningGapBody,
): Promise<LearningGap> {
  const res = await q.query<Row>(
    `INSERT INTO sys.sys_learning_gaps (
        learning_gap_tenant_id, learning_gap_user_id, learning_gap_position_id,
        learning_gap_skill_id, learning_gap_required_proficiency, learning_gap_current_proficiency,
        learning_gap_score, learning_gap_severity, learning_gap_metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
      RETURNING ${COLS}`,
    [
      tenantId,
      body.userId,
      body.positionId ?? null,
      body.skillId ?? null,
      body.requiredProficiency ?? null,
      body.currentProficiency ?? null,
      body.score ?? null,
      body.severity ?? "MEDIUM",
      JSON.stringify(body.metadata ?? {}),
    ],
  );
  return toGap(res.rows[0]!);
}

export async function updateGapPartial(
  q: DbConnector,
  id: string,
  patch: UpdateLearningGapBody,
): Promise<LearningGap | null> {
  const sets: string[] = [];
  const params: unknown[] = [];
  const addSet = (col: string, value: unknown) => {
    params.push(value);
    sets.push(`${col} = $${params.length}`);
  };
  if (patch.requiredProficiency !== undefined) addSet("learning_gap_required_proficiency", patch.requiredProficiency);
  if (patch.currentProficiency !== undefined) addSet("learning_gap_current_proficiency", patch.currentProficiency);
  if (patch.score !== undefined) addSet("learning_gap_score", patch.score);
  if (patch.severity !== undefined) addSet("learning_gap_severity", patch.severity);
  if (patch.metadata !== undefined) {
    params.push(JSON.stringify(patch.metadata));
    sets.push(`learning_gap_metadata = $${params.length}::jsonb`);
  }
  if (sets.length === 0) return findGapById(q, id);
  sets.push(`updated_at = now()`);
  params.push(id);
  const res = await q.query<Row>(
    `UPDATE sys.sys_learning_gaps SET ${sets.join(", ")}
      WHERE learning_gap_id = $${params.length}
      RETURNING ${COLS}`,
    params,
  );
  return res.rows[0] ? toGap(res.rows[0]) : null;
}

export async function deleteGap(q: DbConnector, id: string): Promise<boolean> {
  const res = await q.query(`DELETE FROM sys.sys_learning_gaps WHERE learning_gap_id = $1`, [id]);
  return (res.rowCount ?? 0) === 1;
}

// ─────────────────────────────────────────────────────────────────────────────
// #30 (S1018) — gap-closure reads (000016/000017 satellites).
// ─────────────────────────────────────────────────────────────────────────────

import type {
  GapClosureAction, GapClosurePlan, GapClosurePlanListQuery,
  GapAnalysisResult, GapAnalysisResultListQuery,
} from "@heuresys/shared";

interface ActionRow {
  gap_closure_action_id: string; gap_closure_action_gap_id: string;
  gap_closure_action_kind: string; gap_closure_action_status: string;
  gap_closure_action_owner_user_id: string | null; gap_closure_action_due_date: string | null;
  gap_closure_action_payload: Record<string, unknown>; created_at: Date; updated_at: Date;
}
function toAction(r: ActionRow): GapClosureAction {
  return {
    actionId: r.gap_closure_action_id, gapId: r.gap_closure_action_gap_id,
    kind: r.gap_closure_action_kind as GapClosureAction["kind"],
    status: r.gap_closure_action_status as GapClosureAction["status"],
    ownerUserId: r.gap_closure_action_owner_user_id, dueDate: r.gap_closure_action_due_date,
    payload: r.gap_closure_action_payload ?? {},
    createdAt: r.created_at.toISOString(), updatedAt: r.updated_at.toISOString(),
  };
}
const ACTION_COLS = `gap_closure_action_id, gap_closure_action_gap_id, gap_closure_action_kind,
  gap_closure_action_status, gap_closure_action_owner_user_id,
  gap_closure_action_due_date::text AS gap_closure_action_due_date,
  gap_closure_action_payload, created_at, updated_at`;

export async function listClosureActionsByGap(
  q: DbConnector, gapId: string,
): Promise<{ items: GapClosureAction[]; total: number }> {
  const res = await q.query<ActionRow>(
    `SELECT ${ACTION_COLS} FROM sys.sys_gap_closure_actions
      WHERE gap_closure_action_gap_id = $1 ORDER BY created_at DESC`, [gapId]);
  return { total: res.rowCount ?? 0, items: res.rows.map(toAction) };
}

/** Actions attached to ANY of the subject's own gaps (ESS self view). */
export async function listClosureActionsForUser(
  q: DbConnector, userId: string,
): Promise<GapClosureAction[]> {
  const res = await q.query<ActionRow>(
    `SELECT ${ACTION_COLS} FROM sys.sys_gap_closure_actions a
      WHERE EXISTS (SELECT 1 FROM sys.sys_learning_gaps g
                     WHERE g.learning_gap_id = a.gap_closure_action_gap_id
                       AND g.learning_gap_user_id = $1)
      ORDER BY created_at DESC`, [userId]);
  return res.rows.map(toAction);
}

interface PlanRow {
  gap_closure_plan_id: string; gap_closure_plan_user_id: string;
  gap_closure_plan_position_id: string | null; gap_closure_plan_milestones: unknown[];
  gap_closure_plan_status: string; gap_closure_plan_owner_user_id: string | null;
  gap_closure_plan_target_completion_date: string | null; created_at: Date; updated_at: Date;
}
function toPlan(r: PlanRow): GapClosurePlan {
  return {
    planId: r.gap_closure_plan_id, userId: r.gap_closure_plan_user_id,
    positionId: r.gap_closure_plan_position_id, milestones: r.gap_closure_plan_milestones ?? [],
    status: r.gap_closure_plan_status as GapClosurePlan["status"],
    ownerUserId: r.gap_closure_plan_owner_user_id,
    targetCompletionDate: r.gap_closure_plan_target_completion_date,
    createdAt: r.created_at.toISOString(), updatedAt: r.updated_at.toISOString(),
  };
}
const PLAN_COLS = `gap_closure_plan_id, gap_closure_plan_user_id, gap_closure_plan_position_id,
  gap_closure_plan_milestones, gap_closure_plan_status, gap_closure_plan_owner_user_id,
  gap_closure_plan_target_completion_date::text AS gap_closure_plan_target_completion_date,
  created_at, updated_at`;

export async function listClosurePlans(
  q: DbConnector, tenantId: string | undefined, query: GapClosurePlanListQuery,
  userIdAllowList?: string[],
): Promise<{ items: GapClosurePlan[]; total: number }> {
  const where: string[] = []; const params: unknown[] = [];
  if (tenantId) { params.push(tenantId); where.push(`gap_closure_plan_tenant_id = $${params.length}`); }
  if (userIdAllowList) {
    if (userIdAllowList.length === 0) return { items: [], total: 0 };
    params.push(userIdAllowList);
    where.push(`gap_closure_plan_user_id = ANY($${params.length}::uuid[])`);
  }
  if (query.userId) { params.push(query.userId); where.push(`gap_closure_plan_user_id = $${params.length}`); }
  if (query.status) { params.push(query.status); where.push(`gap_closure_plan_status = $${params.length}`); }
  const wc = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const totalRow = await q.query<{ total: string }>(
    `SELECT count(*)::text AS total FROM sys.sys_gap_closure_plans ${wc}`, params);
  params.push(query.limit); const lim = params.length; params.push(query.offset); const off = params.length;
  const res = await q.query<PlanRow>(
    `SELECT ${PLAN_COLS} FROM sys.sys_gap_closure_plans ${wc}
      ORDER BY created_at DESC LIMIT $${lim} OFFSET $${off}`, params);
  return { total: Number(totalRow.rows[0]?.total ?? 0), items: res.rows.map(toPlan) };
}

export async function listClosurePlansForUser(q: DbConnector, userId: string): Promise<GapClosurePlan[]> {
  const res = await q.query<PlanRow>(
    `SELECT ${PLAN_COLS} FROM sys.sys_gap_closure_plans
      WHERE gap_closure_plan_user_id = $1 ORDER BY created_at DESC`, [userId]);
  return res.rows.map(toPlan);
}

interface ResultRow {
  gap_analysis_result_id: string; gap_analysis_result_user_id: string;
  gap_analysis_result_position_id: string | null; gap_analysis_result_kind: string;
  gap_analysis_result_overall_score: string | null;
  gap_analysis_result_payload: Record<string, unknown>; gap_analysis_result_computed_at: Date;
}
export async function listAnalysisResults(
  q: DbConnector, tenantId: string | undefined, query: GapAnalysisResultListQuery,
  userIdAllowList?: string[],
): Promise<{ items: GapAnalysisResult[]; total: number }> {
  const where: string[] = []; const params: unknown[] = [];
  if (tenantId) { params.push(tenantId); where.push(`gap_analysis_result_tenant_id = $${params.length}`); }
  if (userIdAllowList) {
    if (userIdAllowList.length === 0) return { items: [], total: 0 };
    params.push(userIdAllowList);
    where.push(`gap_analysis_result_user_id = ANY($${params.length}::uuid[])`);
  }
  if (query.userId) { params.push(query.userId); where.push(`gap_analysis_result_user_id = $${params.length}`); }
  if (query.kind) { params.push(query.kind); where.push(`gap_analysis_result_kind = $${params.length}`); }
  const wc = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const totalRow = await q.query<{ total: string }>(
    `SELECT count(*)::text AS total FROM sys.sys_gap_analysis_results ${wc}`, params);
  params.push(query.limit); const lim = params.length; params.push(query.offset); const off = params.length;
  const res = await q.query<ResultRow>(
    `SELECT gap_analysis_result_id, gap_analysis_result_user_id, gap_analysis_result_position_id,
            gap_analysis_result_kind, gap_analysis_result_overall_score, gap_analysis_result_payload,
            gap_analysis_result_computed_at
       FROM sys.sys_gap_analysis_results ${wc}
      ORDER BY gap_analysis_result_computed_at DESC LIMIT $${lim} OFFSET $${off}`, params);
  return {
    total: Number(totalRow.rows[0]?.total ?? 0),
    items: res.rows.map((r) => ({
      resultId: r.gap_analysis_result_id, userId: r.gap_analysis_result_user_id,
      positionId: r.gap_analysis_result_position_id,
      kind: r.gap_analysis_result_kind as GapAnalysisResult["kind"],
      overallScore: r.gap_analysis_result_overall_score === null ? null : Number(r.gap_analysis_result_overall_score),
      payload: r.gap_analysis_result_payload ?? {},
      computedAt: r.gap_analysis_result_computed_at.toISOString(),
    })),
  };
}
