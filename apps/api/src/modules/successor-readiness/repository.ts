/**
 * apps/api/src/modules/successor-readiness/repository.ts
 * Append-only readiness samples for a successor candidate.
 */

import type { Pool, PoolClient } from "pg";
import type {
  SuccessorReadiness,
  SuccessorReadinessListQuery,
  CreateSuccessorReadinessBody,
} from "@heuresys/shared";

export type DbConnector = Pool | PoolClient;

interface Row {
  successor_readiness_id: string;
  successor_readiness_candidate_id: string;
  successor_readiness_tenant_id: string;
  successor_readiness_score: string | null;
  successor_readiness_horizon: string | null;
  successor_readiness_payload: Record<string, unknown>;
  successor_readiness_assessed_at: Date;
  created_at: Date;
}

const COLS = `successor_readiness_id, successor_readiness_candidate_id, successor_readiness_tenant_id,
  successor_readiness_score, successor_readiness_horizon, successor_readiness_payload,
  successor_readiness_assessed_at, created_at`;

function toRd(r: Row): SuccessorReadiness {
  return {
    successorReadinessId: r.successor_readiness_id,
    candidateId: r.successor_readiness_candidate_id,
    tenantId: r.successor_readiness_tenant_id,
    score: r.successor_readiness_score === null ? null : Number(r.successor_readiness_score),
    horizon: r.successor_readiness_horizon,
    payload: r.successor_readiness_payload,
    assessedAt: r.successor_readiness_assessed_at.toISOString(),
    createdAt: r.created_at.toISOString(),
  };
}

export async function listReadiness(
  q: DbConnector,
  filter: { tenantId?: string; userIdAllowList?: string[]; query: SuccessorReadinessListQuery },
): Promise<{ items: SuccessorReadiness[]; total: number }> {
  const where: string[] = [];
  const params: unknown[] = [];
  if (filter.tenantId) {
    params.push(filter.tenantId);
    where.push(`successor_readiness_tenant_id = $${params.length}`);
  }
  if (filter.userIdAllowList) {
    // F3 (ADR-0027): keep only readiness rows whose parent candidate's subject user is in
    // the actor's organizational allow-list. Empty allow-list = nobody is visible.
    if (filter.userIdAllowList.length === 0) return { items: [], total: 0 };
    params.push(filter.userIdAllowList);
    where.push(
      `successor_readiness_candidate_id IN (SELECT successor_candidate_id FROM sys.sys_successor_candidates WHERE successor_candidate_user_id = ANY($${params.length}::uuid[]))`,
    );
  }
  if (filter.query.candidateId) {
    params.push(filter.query.candidateId);
    where.push(`successor_readiness_candidate_id = $${params.length}`);
  }
  if (filter.query.horizon) {
    params.push(filter.query.horizon);
    where.push(`successor_readiness_horizon = $${params.length}`);
  }
  const whereClause = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";

  const totalRow = await q.query<{ total: string }>(
    `SELECT count(*)::text AS total FROM sys.sys_successor_readiness ${whereClause}`,
    params,
  );
  const total = Number(totalRow.rows[0]?.total ?? 0);

  params.push(filter.query.limit);
  const lim = params.length;
  params.push(filter.query.offset);
  const off = params.length;
  const res = await q.query<Row>(
    `SELECT ${COLS} FROM sys.sys_successor_readiness ${whereClause}
      ORDER BY successor_readiness_assessed_at DESC, successor_readiness_id
      LIMIT $${lim} OFFSET $${off}`,
    params,
  );
  return { items: res.rows.map(toRd), total };
}

export async function findReadinessById(q: DbConnector, id: string): Promise<SuccessorReadiness | null> {
  const res = await q.query<Row>(
    `SELECT ${COLS} FROM sys.sys_successor_readiness WHERE successor_readiness_id = $1`, [id],
  );
  return res.rows[0] ? toRd(res.rows[0]) : null;
}

export async function insertReadiness(
  q: DbConnector,
  tenantId: string,
  body: CreateSuccessorReadinessBody,
): Promise<SuccessorReadiness> {
  const res = await q.query<Row>(
    `INSERT INTO sys.sys_successor_readiness (
        successor_readiness_candidate_id, successor_readiness_tenant_id,
        successor_readiness_score, successor_readiness_horizon, successor_readiness_payload
      ) VALUES ($1, $2, $3, $4, $5::jsonb)
      RETURNING ${COLS}`,
    [
      body.candidateId,
      tenantId,
      body.score ?? null,
      body.horizon ?? null,
      JSON.stringify(body.payload ?? {}),
    ],
  );
  return toRd(res.rows[0]!);
}
