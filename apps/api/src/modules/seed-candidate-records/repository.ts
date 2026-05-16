/**
 * apps/api/src/modules/seed-candidate-records/repository.ts
 * Read-only viewer for sys.sys_seed_candidate_records.
 */
import type { Pool, PoolClient } from "pg";
import type {
  SeedCandidateRecord, SeedCandidateValidationStatus,
  SeedCandidateRecordListQuery,
} from "@heuresys/shared";

export type DbConnector = Pool | PoolClient;

interface Row {
  seed_candidate_record_id: string;
  seed_candidate_record_run_id: string;
  seed_candidate_record_tenant_id: string;
  seed_candidate_record_domain: string;
  seed_candidate_record_natural_key: string;
  seed_candidate_record_payload: Record<string, unknown>;
  seed_candidate_record_validation_status: SeedCandidateValidationStatus;
  seed_candidate_record_metadata: Record<string, unknown>;
  created_at: Date; updated_at: Date;
}

const COLS = `seed_candidate_record_id, seed_candidate_record_run_id,
  seed_candidate_record_tenant_id, seed_candidate_record_domain,
  seed_candidate_record_natural_key, seed_candidate_record_payload,
  seed_candidate_record_validation_status, seed_candidate_record_metadata,
  created_at, updated_at`;

function toRow(r: Row): SeedCandidateRecord {
  return {
    seedCandidateRecordId: r.seed_candidate_record_id,
    runId: r.seed_candidate_record_run_id,
    tenantId: r.seed_candidate_record_tenant_id,
    domain: r.seed_candidate_record_domain,
    naturalKey: r.seed_candidate_record_natural_key,
    payload: r.seed_candidate_record_payload,
    validationStatus: r.seed_candidate_record_validation_status,
    metadata: r.seed_candidate_record_metadata,
    createdAt: r.created_at.toISOString(),
    updatedAt: r.updated_at.toISOString(),
  };
}

export async function listCandidates(
  q: DbConnector, filter: { tenantId?: string; query: SeedCandidateRecordListQuery },
): Promise<{ items: SeedCandidateRecord[]; total: number }> {
  const where: string[] = []; const params: unknown[] = [];
  if (filter.tenantId) { params.push(filter.tenantId); where.push(`seed_candidate_record_tenant_id = $${params.length}`); }
  if (filter.query.runId) { params.push(filter.query.runId); where.push(`seed_candidate_record_run_id = $${params.length}`); }
  if (filter.query.domain) { params.push(filter.query.domain); where.push(`seed_candidate_record_domain = $${params.length}`); }
  if (filter.query.validationStatus) { params.push(filter.query.validationStatus); where.push(`seed_candidate_record_validation_status = $${params.length}`); }
  if (filter.query.search) { params.push(`%${filter.query.search}%`); where.push(`seed_candidate_record_natural_key ILIKE $${params.length}`); }
  const w = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const tr = await q.query<{ total: string }>(`SELECT count(*)::text AS total FROM sys.sys_seed_candidate_records ${w}`, params);
  params.push(filter.query.limit); const lim = params.length;
  params.push(filter.query.offset); const off = params.length;
  const res = await q.query<Row>(
    `SELECT ${COLS} FROM sys.sys_seed_candidate_records ${w}
      ORDER BY created_at DESC LIMIT $${lim} OFFSET $${off}`, params,
  );
  return { items: res.rows.map(toRow), total: Number(tr.rows[0]?.total ?? 0) };
}

export async function findCandidateById(q: DbConnector, id: string): Promise<SeedCandidateRecord | null> {
  const res = await q.query<Row>(`SELECT ${COLS} FROM sys.sys_seed_candidate_records WHERE seed_candidate_record_id = $1`, [id]);
  return res.rows[0] ? toRow(res.rows[0]) : null;
}
