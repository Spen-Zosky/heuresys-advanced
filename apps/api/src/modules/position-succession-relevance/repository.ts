/**
 * apps/api/src/modules/position-succession-relevance/repository.ts
 * 1:1 with sys_positions (unique on position_id). Upsert by position_id.
 */

import type { Pool, PoolClient } from "pg";
import type {
  PositionSuccessionRelevance,
  PositionSuccessionRelevanceListQuery,
  ReadinessHorizon,
  UpsertPositionSuccessionRelevanceBody,
} from "@heuresys/shared";

export type DbConnector = Pool | PoolClient;

interface Row {
  position_succession_relevance_id: string;
  position_id: string;
  position_succession_relevance_tenant_id: string;
  is_critical: boolean;
  readiness_horizon: ReadinessHorizon | null;
  position_succession_relevance_metadata: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

const COLS = `position_succession_relevance_id, position_id, position_succession_relevance_tenant_id,
  is_critical, readiness_horizon, position_succession_relevance_metadata, created_at, updated_at`;

function toPsr(r: Row): PositionSuccessionRelevance {
  return {
    positionSuccessionRelevanceId: r.position_succession_relevance_id,
    positionId: r.position_id,
    tenantId: r.position_succession_relevance_tenant_id,
    isCritical: r.is_critical,
    readinessHorizon: r.readiness_horizon,
    metadata: r.position_succession_relevance_metadata,
    createdAt: r.created_at.toISOString(),
    updatedAt: r.updated_at.toISOString(),
  };
}

export async function listRelevance(
  q: DbConnector,
  filter: { tenantId?: string; query: PositionSuccessionRelevanceListQuery },
): Promise<{ items: PositionSuccessionRelevance[]; total: number }> {
  const where: string[] = [];
  const params: unknown[] = [];
  if (filter.tenantId) {
    params.push(filter.tenantId);
    where.push(`position_succession_relevance_tenant_id = $${params.length}`);
  }
  if (filter.query.isCritical !== undefined) {
    params.push(filter.query.isCritical);
    where.push(`is_critical = $${params.length}`);
  }
  if (filter.query.readinessHorizon) {
    params.push(filter.query.readinessHorizon);
    where.push(`readiness_horizon = $${params.length}`);
  }
  const whereClause = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";

  const totalRow = await q.query<{ total: string }>(
    `SELECT count(*)::text AS total FROM sys.sys_position_succession_relevance ${whereClause}`,
    params,
  );
  const total = Number(totalRow.rows[0]?.total ?? 0);

  params.push(filter.query.limit);
  const lim = params.length;
  params.push(filter.query.offset);
  const off = params.length;
  const res = await q.query<Row>(
    `SELECT ${COLS} FROM sys.sys_position_succession_relevance ${whereClause}
      ORDER BY created_at DESC LIMIT $${lim} OFFSET $${off}`,
    params,
  );
  return { items: res.rows.map(toPsr), total };
}

export async function findRelevanceById(q: DbConnector, id: string): Promise<PositionSuccessionRelevance | null> {
  const res = await q.query<Row>(
    `SELECT ${COLS} FROM sys.sys_position_succession_relevance WHERE position_succession_relevance_id = $1`,
    [id],
  );
  return res.rows[0] ? toPsr(res.rows[0]) : null;
}

export async function findRelevanceByPosition(q: DbConnector, positionId: string): Promise<PositionSuccessionRelevance | null> {
  const res = await q.query<Row>(
    `SELECT ${COLS} FROM sys.sys_position_succession_relevance WHERE position_id = $1`, [positionId],
  );
  return res.rows[0] ? toPsr(res.rows[0]) : null;
}

export async function positionInTenant(
  q: DbConnector,
  positionId: string,
  tenantId: string,
): Promise<{ exists: boolean; sameTenant: boolean; tenantId: string | null }> {
  const res = await q.query<{ position_tenant_id: string }>(
    `SELECT position_tenant_id FROM sys.sys_positions WHERE position_id = $1`, [positionId],
  );
  if (res.rows.length === 0) return { exists: false, sameTenant: false, tenantId: null };
  const tid = res.rows[0]!.position_tenant_id;
  return { exists: true, sameTenant: tid === tenantId, tenantId: tid };
}

export async function upsertRelevance(
  q: DbConnector,
  tenantId: string,
  body: UpsertPositionSuccessionRelevanceBody,
  byUserId: string,
): Promise<PositionSuccessionRelevance> {
  const res = await q.query<Row>(
    `INSERT INTO sys.sys_position_succession_relevance (
        position_id, position_succession_relevance_tenant_id,
        is_critical, readiness_horizon, position_succession_relevance_metadata,
        created_by, updated_by
      ) VALUES ($1, $2, $3, $4, $5::jsonb, $6, $6)
      ON CONFLICT (position_id) DO UPDATE SET
        is_critical = EXCLUDED.is_critical,
        readiness_horizon = EXCLUDED.readiness_horizon,
        position_succession_relevance_metadata = EXCLUDED.position_succession_relevance_metadata,
        updated_at = now(),
        updated_by = EXCLUDED.updated_by
      RETURNING ${COLS}`,
    [
      body.positionId,
      tenantId,
      body.isCritical ?? false,
      body.readinessHorizon ?? null,
      JSON.stringify(body.metadata ?? {}),
      byUserId,
    ],
  );
  return toPsr(res.rows[0]!);
}

export async function deleteRelevance(q: DbConnector, id: string): Promise<boolean> {
  const res = await q.query(
    `DELETE FROM sys.sys_position_succession_relevance WHERE position_succession_relevance_id = $1`, [id],
  );
  return (res.rowCount ?? 0) === 1;
}
