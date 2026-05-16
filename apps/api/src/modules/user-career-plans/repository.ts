/**
 * apps/api/src/modules/user-career-plans/repository.ts
 * Raw SQL for sys.sys_user_career_plans. Tenant-scoped only.
 */

import type { Pool, PoolClient } from "pg";
import type {
  UserCareerPlan,
  UserCareerPlanListQuery,
  UserCareerPlanStatus,
  CreateUserCareerPlanBody,
  UpdateUserCareerPlanBody,
} from "@heuresys/shared";

export type DbConnector = Pool | PoolClient;

interface Row {
  user_career_plan_id: string;
  user_career_plan_tenant_id: string;
  user_career_plan_user_id: string;
  user_career_plan_path_id: string | null;
  user_career_plan_target_position_id: string | null;
  user_career_plan_horizon_months: number | null;
  user_career_plan_status: UserCareerPlanStatus;
  user_career_plan_metadata: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

const COLS = `user_career_plan_id, user_career_plan_tenant_id, user_career_plan_user_id,
  user_career_plan_path_id, user_career_plan_target_position_id,
  user_career_plan_horizon_months, user_career_plan_status,
  user_career_plan_metadata, created_at, updated_at`;

function toUcp(r: Row): UserCareerPlan {
  return {
    userCareerPlanId: r.user_career_plan_id,
    tenantId: r.user_career_plan_tenant_id,
    userId: r.user_career_plan_user_id,
    pathId: r.user_career_plan_path_id,
    targetPositionId: r.user_career_plan_target_position_id,
    horizonMonths: r.user_career_plan_horizon_months,
    status: r.user_career_plan_status,
    metadata: r.user_career_plan_metadata,
    createdAt: r.created_at.toISOString(),
    updatedAt: r.updated_at.toISOString(),
  };
}

export async function listPlans(
  q: DbConnector,
  filter: { tenantId?: string; query: UserCareerPlanListQuery },
): Promise<{ items: UserCareerPlan[]; total: number }> {
  const where: string[] = [];
  const params: unknown[] = [];
  if (filter.tenantId) {
    params.push(filter.tenantId);
    where.push(`user_career_plan_tenant_id = $${params.length}`);
  }
  if (filter.query.userId) {
    params.push(filter.query.userId);
    where.push(`user_career_plan_user_id = $${params.length}`);
  }
  if (filter.query.pathId) {
    params.push(filter.query.pathId);
    where.push(`user_career_plan_path_id = $${params.length}`);
  }
  if (filter.query.targetPositionId) {
    params.push(filter.query.targetPositionId);
    where.push(`user_career_plan_target_position_id = $${params.length}`);
  }
  if (filter.query.status) {
    params.push(filter.query.status);
    where.push(`user_career_plan_status = $${params.length}`);
  }
  const whereClause = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";

  const totalRow = await q.query<{ total: string }>(
    `SELECT count(*)::text AS total FROM sys.sys_user_career_plans ${whereClause}`,
    params,
  );
  const total = Number(totalRow.rows[0]?.total ?? 0);

  params.push(filter.query.limit);
  const lim = params.length;
  params.push(filter.query.offset);
  const off = params.length;
  const res = await q.query<Row>(
    `SELECT ${COLS} FROM sys.sys_user_career_plans ${whereClause}
      ORDER BY created_at DESC, user_career_plan_id
      LIMIT $${lim} OFFSET $${off}`,
    params,
  );
  return { items: res.rows.map(toUcp), total };
}

export async function findPlanById(q: DbConnector, id: string): Promise<UserCareerPlan | null> {
  const res = await q.query<Row>(
    `SELECT ${COLS} FROM sys.sys_user_career_plans WHERE user_career_plan_id = $1`, [id],
  );
  return res.rows[0] ? toUcp(res.rows[0]) : null;
}

export async function getUserTenant(q: DbConnector, userId: string): Promise<{ tenantId: string | null } | null> {
  const res = await q.query<{ user_tenant_id: string | null }>(
    `SELECT user_tenant_id FROM sys.sys_users WHERE user_id = $1`, [userId],
  );
  const r = res.rows[0];
  if (!r) return null;
  return { tenantId: r.user_tenant_id };
}

export async function careerPathVisibleToTenant(
  q: DbConnector,
  pathId: string,
  tenantId: string,
): Promise<boolean> {
  const res = await q.query<{ x: number }>(
    `SELECT 1 AS x FROM sys.sys_career_paths
      WHERE career_path_id = $1
        AND (career_path_is_global = true OR career_path_tenant_id = $2)
      LIMIT 1`,
    [pathId, tenantId],
  );
  return res.rows.length > 0;
}

export async function positionInTenant(
  q: DbConnector,
  positionId: string,
  tenantId: string,
): Promise<{ exists: boolean; sameTenant: boolean }> {
  const res = await q.query<{ position_tenant_id: string }>(
    `SELECT position_tenant_id FROM sys.sys_positions WHERE position_id = $1`, [positionId],
  );
  if (res.rows.length === 0) return { exists: false, sameTenant: false };
  return { exists: true, sameTenant: res.rows[0]!.position_tenant_id === tenantId };
}

export async function insertPlan(
  q: DbConnector,
  tenantId: string,
  body: CreateUserCareerPlanBody,
  createdBy: string,
): Promise<UserCareerPlan> {
  const res = await q.query<Row>(
    `INSERT INTO sys.sys_user_career_plans (
        user_career_plan_tenant_id, user_career_plan_user_id, user_career_plan_path_id,
        user_career_plan_target_position_id, user_career_plan_horizon_months,
        user_career_plan_status, user_career_plan_metadata, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8)
      RETURNING ${COLS}`,
    [
      tenantId,
      body.userId,
      body.pathId ?? null,
      body.targetPositionId ?? null,
      body.horizonMonths ?? null,
      body.status ?? "ACTIVE",
      JSON.stringify(body.metadata ?? {}),
      createdBy,
    ],
  );
  return toUcp(res.rows[0]!);
}

export async function updatePlanPartial(
  q: DbConnector,
  id: string,
  patch: UpdateUserCareerPlanBody,
  updatedBy: string,
): Promise<UserCareerPlan | null> {
  const sets: string[] = [];
  const params: unknown[] = [];
  const addSet = (col: string, value: unknown) => {
    params.push(value);
    sets.push(`${col} = $${params.length}`);
  };
  if (patch.pathId !== undefined) addSet("user_career_plan_path_id", patch.pathId);
  if (patch.targetPositionId !== undefined) addSet("user_career_plan_target_position_id", patch.targetPositionId);
  if (patch.horizonMonths !== undefined) addSet("user_career_plan_horizon_months", patch.horizonMonths);
  if (patch.status !== undefined) addSet("user_career_plan_status", patch.status);
  if (patch.metadata !== undefined) {
    params.push(JSON.stringify(patch.metadata));
    sets.push(`user_career_plan_metadata = $${params.length}::jsonb`);
  }
  if (sets.length === 0) return findPlanById(q, id);
  sets.push(`updated_at = now()`);
  params.push(updatedBy);
  sets.push(`updated_by = $${params.length}`);
  params.push(id);
  const res = await q.query<Row>(
    `UPDATE sys.sys_user_career_plans SET ${sets.join(", ")}
      WHERE user_career_plan_id = $${params.length}
      RETURNING ${COLS}`,
    params,
  );
  return res.rows[0] ? toUcp(res.rows[0]) : null;
}

export async function deletePlan(q: DbConnector, id: string): Promise<boolean> {
  const res = await q.query(`DELETE FROM sys.sys_user_career_plans WHERE user_career_plan_id = $1`, [id]);
  return (res.rowCount ?? 0) === 1;
}
