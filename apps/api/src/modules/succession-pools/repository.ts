/**
 * apps/api/src/modules/succession-pools/repository.ts
 * Raw SQL for sys.sys_succession_pools. Tenant-scoped only.
 */

import type { Pool, PoolClient } from "pg";
import type {
  SuccessionPool,
  SuccessionPoolListQuery,
  SuccessionPoolStatus,
  CreateSuccessionPoolBody,
  UpdateSuccessionPoolBody,
} from "@heuresys/shared";

export type DbConnector = Pool | PoolClient;

interface Row {
  succession_pool_id: string;
  succession_pool_tenant_id: string;
  succession_pool_position_id: string;
  succession_pool_code: string;
  succession_pool_name: string;
  succession_pool_description: string | null;
  succession_pool_status: SuccessionPoolStatus;
  succession_pool_metadata: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

const COLS = `succession_pool_id, succession_pool_tenant_id, succession_pool_position_id,
  succession_pool_code, succession_pool_name, succession_pool_description,
  succession_pool_status, succession_pool_metadata, created_at, updated_at`;

function toPool(r: Row): SuccessionPool {
  return {
    successionPoolId: r.succession_pool_id,
    tenantId: r.succession_pool_tenant_id,
    positionId: r.succession_pool_position_id,
    code: r.succession_pool_code,
    name: r.succession_pool_name,
    description: r.succession_pool_description,
    status: r.succession_pool_status,
    metadata: r.succession_pool_metadata,
    createdAt: r.created_at.toISOString(),
    updatedAt: r.updated_at.toISOString(),
  };
}

export async function listPools(
  q: DbConnector,
  filter: { tenantId?: string; query: SuccessionPoolListQuery },
): Promise<{ items: SuccessionPool[]; total: number }> {
  const where: string[] = [];
  const params: unknown[] = [];
  if (filter.tenantId) {
    params.push(filter.tenantId);
    where.push(`succession_pool_tenant_id = $${params.length}`);
  }
  if (filter.query.positionId) {
    params.push(filter.query.positionId);
    where.push(`succession_pool_position_id = $${params.length}`);
  }
  if (filter.query.status) {
    params.push(filter.query.status);
    where.push(`succession_pool_status = $${params.length}`);
  }
  if (filter.query.search) {
    params.push(`%${filter.query.search}%`);
    where.push(`(succession_pool_name ILIKE $${params.length} OR succession_pool_code ILIKE $${params.length})`);
  }
  const whereClause = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";

  const totalRow = await q.query<{ total: string }>(
    `SELECT count(*)::text AS total FROM sys.sys_succession_pools ${whereClause}`,
    params,
  );
  const total = Number(totalRow.rows[0]?.total ?? 0);

  params.push(filter.query.limit);
  const lim = params.length;
  params.push(filter.query.offset);
  const off = params.length;
  const res = await q.query<Row>(
    `SELECT ${COLS} FROM sys.sys_succession_pools ${whereClause}
      ORDER BY succession_pool_name LIMIT $${lim} OFFSET $${off}`,
    params,
  );
  return { items: res.rows.map(toPool), total };
}

export async function findPoolById(q: DbConnector, id: string): Promise<SuccessionPool | null> {
  const res = await q.query<Row>(
    `SELECT ${COLS} FROM sys.sys_succession_pools WHERE succession_pool_id = $1`, [id],
  );
  return res.rows[0] ? toPool(res.rows[0]) : null;
}

export async function findPoolByCodeInTenant(
  q: DbConnector,
  tenantId: string,
  code: string,
): Promise<SuccessionPool | null> {
  const res = await q.query<Row>(
    `SELECT ${COLS} FROM sys.sys_succession_pools
      WHERE succession_pool_tenant_id = $1 AND succession_pool_code = $2`,
    [tenantId, code],
  );
  return res.rows[0] ? toPool(res.rows[0]) : null;
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

export async function insertPool(
  q: DbConnector,
  tenantId: string,
  body: CreateSuccessionPoolBody,
  createdBy: string,
): Promise<SuccessionPool> {
  const res = await q.query<Row>(
    `INSERT INTO sys.sys_succession_pools (
        succession_pool_tenant_id, succession_pool_position_id, succession_pool_code,
        succession_pool_name, succession_pool_description, succession_pool_status,
        succession_pool_metadata, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8)
      RETURNING ${COLS}`,
    [
      tenantId,
      body.positionId,
      body.code,
      body.name,
      body.description ?? null,
      body.status ?? "ACTIVE",
      JSON.stringify(body.metadata ?? {}),
      createdBy,
    ],
  );
  return toPool(res.rows[0]!);
}

export async function updatePoolPartial(
  q: DbConnector,
  id: string,
  patch: UpdateSuccessionPoolBody,
  updatedBy: string,
): Promise<SuccessionPool | null> {
  const sets: string[] = [];
  const params: unknown[] = [];
  const addSet = (col: string, value: unknown) => {
    params.push(value);
    sets.push(`${col} = $${params.length}`);
  };
  if (patch.name !== undefined) addSet("succession_pool_name", patch.name);
  if (patch.description !== undefined) addSet("succession_pool_description", patch.description);
  if (patch.status !== undefined) addSet("succession_pool_status", patch.status);
  if (patch.metadata !== undefined) {
    params.push(JSON.stringify(patch.metadata));
    sets.push(`succession_pool_metadata = $${params.length}::jsonb`);
  }
  if (sets.length === 0) return findPoolById(q, id);
  sets.push(`updated_at = now()`);
  params.push(updatedBy);
  sets.push(`updated_by = $${params.length}`);
  params.push(id);
  const res = await q.query<Row>(
    `UPDATE sys.sys_succession_pools SET ${sets.join(", ")}
      WHERE succession_pool_id = $${params.length}
      RETURNING ${COLS}`,
    params,
  );
  return res.rows[0] ? toPool(res.rows[0]) : null;
}

export async function poolHasCandidates(q: DbConnector, id: string): Promise<boolean> {
  const res = await q.query<{ x: number }>(
    `SELECT 1 AS x FROM sys.sys_successor_candidates WHERE successor_candidate_pool_id = $1 LIMIT 1`,
    [id],
  );
  return res.rows.length > 0;
}

export async function deletePool(q: DbConnector, id: string): Promise<boolean> {
  const res = await q.query(`DELETE FROM sys.sys_succession_pools WHERE succession_pool_id = $1`, [id]);
  return (res.rowCount ?? 0) === 1;
}
