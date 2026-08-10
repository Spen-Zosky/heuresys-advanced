/**
 * apps/api/src/modules/review-cycles/repository.ts — #92 passo 3/7. READ-only.
 * SQL parametrizzato su sys.sys_review_cycles (mig 000256). Catalogo di tenant:
 * nessuna riga-persona, il filtro e' il solo tenant (orgGate "catalog").
 */
import type { Pool, PoolClient } from "pg";
import type { ReviewCycle, ReviewCycleListQuery } from "@heuresys/shared";

export type DbConnector = Pool | PoolClient;

const COLS = `review_cycle_id, review_cycle_tenant_id, review_cycle_code,
  review_cycle_name, review_cycle_description, review_cycle_type,
  review_cycle_period_start, review_cycle_period_end,
  review_cycle_self_deadline, review_cycle_manager_deadline,
  review_cycle_status, review_cycle_opened_at, review_cycle_closed_at,
  created_at, updated_at`;

const isoN = (d: unknown): string | null => (d == null ? null : (d as Date).toISOString());
const dateN = (d: unknown): string | null => {
  if (d == null) return null;
  return d instanceof Date ? d.toISOString().slice(0, 10) : String(d);
};

function toCycle(r: Record<string, unknown>): ReviewCycle {
  return {
    reviewCycleId: r.review_cycle_id as string,
    tenantId: r.review_cycle_tenant_id as string,
    code: r.review_cycle_code as string,
    name: r.review_cycle_name as string,
    description: (r.review_cycle_description as string | null) ?? null,
    type: r.review_cycle_type as string,
    periodStart: dateN(r.review_cycle_period_start)!,
    periodEnd: dateN(r.review_cycle_period_end)!,
    selfDeadline: dateN(r.review_cycle_self_deadline),
    managerDeadline: dateN(r.review_cycle_manager_deadline),
    status: r.review_cycle_status as string,
    openedAt: isoN(r.review_cycle_opened_at),
    closedAt: isoN(r.review_cycle_closed_at),
    createdAt: isoN(r.created_at)!,
    updatedAt: isoN(r.updated_at)!,
  };
}

export async function listReviewCycles(
  q: DbConnector,
  tenantId: string | undefined,
  query: ReviewCycleListQuery,
): Promise<{ items: ReviewCycle[]; total: number }> {
  const where: string[] = [];
  const params: unknown[] = [];
  if (tenantId) { params.push(tenantId); where.push(`review_cycle_tenant_id = $${params.length}`); }
  if (query.status) { params.push(query.status); where.push(`review_cycle_status = $${params.length}`); }
  if (query.type) { params.push(query.type); where.push(`review_cycle_type = $${params.length}`); }
  const clause = where.length ? ` WHERE ${where.join(" AND ")}` : "";

  const count = await q.query(`SELECT count(*)::int AS n FROM sys.sys_review_cycles${clause}`, params);
  params.push(query.limit, query.offset);
  const res = await q.query(
    `SELECT ${COLS} FROM sys.sys_review_cycles${clause}
      ORDER BY review_cycle_period_start DESC, review_cycle_code
      LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );
  return { items: res.rows.map(toCycle), total: (count.rows[0] as { n: number }).n };
}

export async function findReviewCycleById(q: DbConnector, id: string): Promise<ReviewCycle | null> {
  const res = await q.query(`SELECT ${COLS} FROM sys.sys_review_cycles WHERE review_cycle_id = $1`, [id]);
  return res.rows[0] ? toCycle(res.rows[0]) : null;
}
