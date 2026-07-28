/**
 * apps/api/src/modules/user-target-positions/repository.ts
 * Raw SQL per sys.sys_user_target_positions. Tenant-scoped.
 */

import type { Pool, PoolClient } from "pg";
import type {
  UserTargetPosition,
  UserTargetPositionListQuery,
  UserTargetPositionHorizon,
  UserTargetPositionReviewStatus,
  UserTargetPositionReviewDecision,
  CreateUserTargetPositionBody,
  UpdateUserTargetPositionBody,
} from "@heuresys/shared";

export type DbConnector = Pool | PoolClient;

interface Row {
  user_target_position_id: string;
  user_target_position_tenant_id: string;
  user_target_position_user_id: string;
  user_target_position_position_id: string;
  user_target_position_horizon: UserTargetPositionHorizon | null;
  user_target_position_review_status: UserTargetPositionReviewStatus;
  user_target_position_reviewer_user_id: string | null;
  user_target_position_review_notes: string | null;
  user_target_position_metadata: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

const COLS = `user_target_position_id, user_target_position_tenant_id, user_target_position_user_id,
  user_target_position_position_id, user_target_position_horizon,
  user_target_position_review_status, user_target_position_reviewer_user_id,
  user_target_position_review_notes, user_target_position_metadata, created_at, updated_at`;

function toUtp(r: Row): UserTargetPosition {
  return {
    userTargetPositionId: r.user_target_position_id,
    tenantId: r.user_target_position_tenant_id,
    userId: r.user_target_position_user_id,
    positionId: r.user_target_position_position_id,
    horizon: r.user_target_position_horizon,
    reviewStatus: r.user_target_position_review_status,
    reviewerUserId: r.user_target_position_reviewer_user_id,
    reviewNotes: r.user_target_position_review_notes,
    metadata: r.user_target_position_metadata,
    createdAt: r.created_at.toISOString(),
    updatedAt: r.updated_at.toISOString(),
  };
}

export async function listTargets(
  q: DbConnector,
  filter: {
    tenantId?: string;
    /** Restringe ai soggetti visibili sull'asse organizzativo (ADR-0027 F3).
     *  undefined = nessuna restrizione; vuoto = nessuno è visibile. */
    userIdAllowList?: string[];
    query: UserTargetPositionListQuery;
  },
): Promise<{ items: UserTargetPosition[]; total: number }> {
  const where: string[] = [];
  const params: unknown[] = [];
  if (filter.tenantId) {
    params.push(filter.tenantId);
    where.push(`user_target_position_tenant_id = $${params.length}`);
  }
  if (filter.userIdAllowList) {
    if (filter.userIdAllowList.length === 0) return { items: [], total: 0 };
    params.push(filter.userIdAllowList);
    where.push(`user_target_position_user_id = ANY($${params.length}::uuid[])`);
  }
  if (filter.query.userId) {
    params.push(filter.query.userId);
    where.push(`user_target_position_user_id = $${params.length}`);
  }
  if (filter.query.positionId) {
    params.push(filter.query.positionId);
    where.push(`user_target_position_position_id = $${params.length}`);
  }
  if (filter.query.horizon) {
    params.push(filter.query.horizon);
    where.push(`user_target_position_horizon = $${params.length}`);
  }
  if (filter.query.reviewStatus) {
    params.push(filter.query.reviewStatus);
    where.push(`user_target_position_review_status = $${params.length}`);
  }
  if (filter.query.reviewerUserId) {
    params.push(filter.query.reviewerUserId);
    where.push(`user_target_position_reviewer_user_id = $${params.length}`);
  }
  const whereClause = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";

  const totalRow = await q.query<{ total: string }>(
    `SELECT count(*)::text AS total FROM sys.sys_user_target_positions ${whereClause}`,
    params,
  );
  const total = Number(totalRow.rows[0]?.total ?? 0);

  params.push(filter.query.limit);
  const lim = params.length;
  params.push(filter.query.offset);
  const off = params.length;
  const res = await q.query<Row>(
    `SELECT ${COLS} FROM sys.sys_user_target_positions ${whereClause}
      ORDER BY created_at DESC, user_target_position_id
      LIMIT $${lim} OFFSET $${off}`,
    params,
  );
  return { items: res.rows.map(toUtp), total };
}

export async function findTargetById(q: DbConnector, id: string): Promise<UserTargetPosition | null> {
  const res = await q.query<Row>(
    `SELECT ${COLS} FROM sys.sys_user_target_positions WHERE user_target_position_id = $1`, [id],
  );
  return res.rows[0] ? toUtp(res.rows[0]) : null;
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
    `SELECT position_tenant_id FROM sys.sys_positions WHERE position_id = $1`, [positionId],
  );
  if (res.rows.length === 0) return { exists: false, sameTenant: false };
  return { exists: true, sameTenant: res.rows[0]!.position_tenant_id === tenantId };
}

export async function insertTarget(
  q: DbConnector,
  tenantId: string,
  body: CreateUserTargetPositionBody,
  createdBy: string,
): Promise<UserTargetPosition> {
  const res = await q.query<Row>(
    `INSERT INTO sys.sys_user_target_positions (
        user_target_position_tenant_id, user_target_position_user_id,
        user_target_position_position_id, user_target_position_horizon,
        user_target_position_review_status, user_target_position_metadata, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)
      RETURNING ${COLS}`,
    [
      tenantId,
      body.userId,
      body.positionId,
      body.horizon ?? null,
      body.reviewStatus ?? "PENDING_REVIEW",
      JSON.stringify(body.metadata ?? {}),
      createdBy,
    ],
  );
  return toUtp(res.rows[0]!);
}

export async function updateTargetPartial(
  q: DbConnector,
  id: string,
  patch: UpdateUserTargetPositionBody,
  updatedBy: string,
): Promise<UserTargetPosition | null> {
  const sets: string[] = [];
  const params: unknown[] = [];
  const addSet = (col: string, value: unknown) => {
    params.push(value);
    sets.push(`${col} = $${params.length}`);
  };
  if (patch.positionId !== undefined) addSet("user_target_position_position_id", patch.positionId);
  if (patch.horizon !== undefined) addSet("user_target_position_horizon", patch.horizon);
  if (patch.metadata !== undefined) {
    params.push(JSON.stringify(patch.metadata));
    sets.push(`user_target_position_metadata = $${params.length}::jsonb`);
  }
  if (sets.length === 0) return findTargetById(q, id);
  sets.push(`updated_at = now()`);
  params.push(updatedBy);
  sets.push(`updated_by = $${params.length}`);
  params.push(id);
  const res = await q.query<Row>(
    `UPDATE sys.sys_user_target_positions SET ${sets.join(", ")}
      WHERE user_target_position_id = $${params.length}
      RETURNING ${COLS}`,
    params,
  );
  return res.rows[0] ? toUtp(res.rows[0]) : null;
}

/**
 * L'atto di revisione: esito, note e — soprattutto — il revisore, che è chi
 * compie l'azione. Prima di questo endpoint lo stato di revisione era un campo
 * che nessuna API sapeva scrivere (rilievo #40 della coda C5).
 */
export async function reviewTarget(
  q: DbConnector,
  id: string,
  decision: UserTargetPositionReviewDecision,
  notes: string | null,
  reviewerUserId: string,
): Promise<UserTargetPosition | null> {
  const res = await q.query<Row>(
    `UPDATE sys.sys_user_target_positions
        SET user_target_position_review_status = $1,
            user_target_position_review_notes = $2,
            user_target_position_reviewer_user_id = $3,
            updated_at = now(),
            updated_by = $3
      WHERE user_target_position_id = $4
      RETURNING ${COLS}`,
    [decision, notes, reviewerUserId, id],
  );
  return res.rows[0] ? toUtp(res.rows[0]) : null;
}

export async function deleteTarget(q: DbConnector, id: string): Promise<boolean> {
  const res = await q.query(
    `DELETE FROM sys.sys_user_target_positions WHERE user_target_position_id = $1`, [id],
  );
  return (res.rowCount ?? 0) === 1;
}
