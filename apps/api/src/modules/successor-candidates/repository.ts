/**
 * apps/api/src/modules/successor-candidates/repository.ts
 * Raw SQL for sys.sys_successor_candidates. Tenant-scoped via pool.
 */

import type { Pool, PoolClient } from "pg";
import type {
  SuccessorCandidate,
  SuccessorCandidateListQuery,
  SuccessorCandidateStatus,
  CreateSuccessorCandidateBody,
  UpdateSuccessorCandidateBody,
} from "@heuresys/shared";

export type DbConnector = Pool | PoolClient;

interface Row {
  successor_candidate_id: string;
  successor_candidate_pool_id: string;
  successor_candidate_tenant_id: string;
  successor_candidate_user_id: string;
  successor_candidate_status: SuccessorCandidateStatus;
  successor_candidate_readiness_level: string | null;
  successor_candidate_metadata: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
  user_name?: string | null; // G-02: resolved on the list query, undefined elsewhere
  pool_name?: string | null;
}

const COLS = `successor_candidate_id, successor_candidate_pool_id, successor_candidate_tenant_id,
  successor_candidate_user_id, successor_candidate_status, successor_candidate_readiness_level,
  successor_candidate_metadata, created_at, updated_at`;

function toCand(r: Row): SuccessorCandidate {
  return {
    successorCandidateId: r.successor_candidate_id,
    poolId: r.successor_candidate_pool_id,
    tenantId: r.successor_candidate_tenant_id,
    userId: r.successor_candidate_user_id,
    userName: r.user_name ?? null,
    poolName: r.pool_name ?? null,
    status: r.successor_candidate_status,
    readinessLevel: r.successor_candidate_readiness_level,
    metadata: r.successor_candidate_metadata,
    createdAt: r.created_at.toISOString(),
    updatedAt: r.updated_at.toISOString(),
  };
}

export async function listCandidates(
  q: DbConnector,
  filter: { tenantId?: string; query: SuccessorCandidateListQuery },
): Promise<{ items: SuccessorCandidate[]; total: number }> {
  const where: string[] = [];
  const params: unknown[] = [];
  if (filter.tenantId) {
    params.push(filter.tenantId);
    where.push(`successor_candidate_tenant_id = $${params.length}`);
  }
  if (filter.query.poolId) {
    params.push(filter.query.poolId);
    where.push(`successor_candidate_pool_id = $${params.length}`);
  }
  if (filter.query.userId) {
    params.push(filter.query.userId);
    where.push(`successor_candidate_user_id = $${params.length}`);
  }
  if (filter.query.status) {
    params.push(filter.query.status);
    where.push(`successor_candidate_status = $${params.length}`);
  }
  const whereClause = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";

  const totalRow = await q.query<{ total: string }>(
    `SELECT count(*)::text AS total FROM sys.sys_successor_candidates ${whereClause}`,
    params,
  );
  const total = Number(totalRow.rows[0]?.total ?? 0);

  params.push(filter.query.limit);
  const lim = params.length;
  params.push(filter.query.offset);
  const off = params.length;
  const res = await q.query<Row>(
    `SELECT ${COLS},
            (SELECT u.user_display_name FROM sys.sys_users u WHERE u.user_id = sys.sys_successor_candidates.successor_candidate_user_id) AS user_name,
            (SELECT sp.succession_pool_name FROM sys.sys_succession_pools sp WHERE sp.succession_pool_id = sys.sys_successor_candidates.successor_candidate_pool_id) AS pool_name
       FROM sys.sys_successor_candidates ${whereClause}
      ORDER BY created_at DESC, successor_candidate_id
      LIMIT $${lim} OFFSET $${off}`,
    params,
  );
  return { items: res.rows.map(toCand), total };
}

/**
 * Candidate counts grouped by readiness level (null → 'UNASSESSED'), tenant-scoped.
 * Feeds the career-succession pipeline chart (F4).
 */
export async function getReadinessDistribution(
  q: DbConnector,
  tenantId: string | undefined,
): Promise<{ items: { readinessLevel: string; count: number }[]; total: number }> {
  const params: unknown[] = [];
  let whereClause = "";
  if (tenantId) {
    params.push(tenantId);
    whereClause = `WHERE successor_candidate_tenant_id = $1`;
  }
  const res = await q.query<{ readiness_level: string; count: string }>(
    `SELECT COALESCE(successor_candidate_readiness_level, 'UNASSESSED') AS readiness_level,
            count(*)::text AS count
       FROM sys.sys_successor_candidates
       ${whereClause}
       GROUP BY COALESCE(successor_candidate_readiness_level, 'UNASSESSED')
       ORDER BY count(*) DESC, readiness_level`,
    params,
  );
  const items = res.rows.map((r) => ({ readinessLevel: r.readiness_level, count: Number(r.count) }));
  const total = items.reduce((sum, i) => sum + i.count, 0);
  return { items, total };
}

export async function findCandidateById(q: DbConnector, id: string): Promise<SuccessorCandidate | null> {
  const res = await q.query<Row>(
    `SELECT ${COLS} FROM sys.sys_successor_candidates WHERE successor_candidate_id = $1`, [id],
  );
  return res.rows[0] ? toCand(res.rows[0]) : null;
}

export async function findExisting(
  q: DbConnector,
  poolId: string,
  userId: string,
): Promise<SuccessorCandidate | null> {
  const res = await q.query<Row>(
    `SELECT ${COLS} FROM sys.sys_successor_candidates
      WHERE successor_candidate_pool_id = $1 AND successor_candidate_user_id = $2`,
    [poolId, userId],
  );
  return res.rows[0] ? toCand(res.rows[0]) : null;
}

export async function getUserTenant(q: DbConnector, userId: string): Promise<{ tenantId: string | null } | null> {
  const res = await q.query<{ user_tenant_id: string | null }>(
    `SELECT user_tenant_id FROM sys.sys_users WHERE user_id = $1`, [userId],
  );
  const r = res.rows[0];
  if (!r) return null;
  return { tenantId: r.user_tenant_id };
}

export async function insertCandidate(
  q: DbConnector,
  tenantId: string,
  body: CreateSuccessorCandidateBody,
): Promise<SuccessorCandidate> {
  const res = await q.query<Row>(
    `INSERT INTO sys.sys_successor_candidates (
        successor_candidate_pool_id, successor_candidate_tenant_id,
        successor_candidate_user_id, successor_candidate_status,
        successor_candidate_readiness_level, successor_candidate_metadata
      ) VALUES ($1, $2, $3, $4, $5, $6::jsonb)
      RETURNING ${COLS}`,
    [
      body.poolId,
      tenantId,
      body.userId,
      body.status ?? "CANDIDATE",
      body.readinessLevel ?? null,
      JSON.stringify(body.metadata ?? {}),
    ],
  );
  return toCand(res.rows[0]!);
}

export async function updateCandidatePartial(
  q: DbConnector,
  id: string,
  patch: UpdateSuccessorCandidateBody,
): Promise<SuccessorCandidate | null> {
  const sets: string[] = [];
  const params: unknown[] = [];
  const addSet = (col: string, value: unknown) => {
    params.push(value);
    sets.push(`${col} = $${params.length}`);
  };
  if (patch.status !== undefined) addSet("successor_candidate_status", patch.status);
  if (patch.readinessLevel !== undefined) addSet("successor_candidate_readiness_level", patch.readinessLevel);
  if (patch.metadata !== undefined) {
    params.push(JSON.stringify(patch.metadata));
    sets.push(`successor_candidate_metadata = $${params.length}::jsonb`);
  }
  if (sets.length === 0) return findCandidateById(q, id);
  sets.push(`updated_at = now()`);
  params.push(id);
  const res = await q.query<Row>(
    `UPDATE sys.sys_successor_candidates SET ${sets.join(", ")}
      WHERE successor_candidate_id = $${params.length}
      RETURNING ${COLS}`,
    params,
  );
  return res.rows[0] ? toCand(res.rows[0]) : null;
}

export async function deleteCandidate(q: DbConnector, id: string): Promise<boolean> {
  const res = await q.query(`DELETE FROM sys.sys_successor_candidates WHERE successor_candidate_id = $1`, [id]);
  return (res.rowCount ?? 0) === 1;
}
