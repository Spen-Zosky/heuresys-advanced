/**
 * apps/api/src/modules/seed-candidate-records/repository.ts
 * Read-only viewer for sys.sys_seed_candidate_records.
 */
import type { Pool, PoolClient } from "pg";
import type {
  SeedCandidateRecord, SeedCandidateValidationStatus,
  SeedCandidateRecordListQuery, SeedValidationResult, SeedSourceEvidence,
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

/** Le validazioni di un record candidato: prima non le leggeva nessuno. */
export async function listValidations(
  q: DbConnector, candidateId: string,
): Promise<SeedValidationResult[]> {
  const res = await q.query<{
    seed_validation_result_id: string;
    seed_validation_result_candidate_id: string;
    seed_validation_result_rule_code: string;
    seed_validation_result_status: string;
    seed_validation_result_message: string | null;
    seed_validation_result_payload: Record<string, unknown> | null;
    created_at: Date;
  }>(
    `SELECT seed_validation_result_id, seed_validation_result_candidate_id,
            seed_validation_result_rule_code, seed_validation_result_status,
            seed_validation_result_message, seed_validation_result_payload, created_at
       FROM sys.sys_seed_validation_results
      WHERE seed_validation_result_candidate_id = $1
      ORDER BY seed_validation_result_rule_code`,
    [candidateId],
  );
  return res.rows.map((r): SeedValidationResult => ({
    seedValidationResultId: r.seed_validation_result_id,
    candidateId: r.seed_validation_result_candidate_id,
    ruleCode: r.seed_validation_result_rule_code,
    status: r.seed_validation_result_status as SeedValidationResult["status"],
    message: r.seed_validation_result_message,
    payload: r.seed_validation_result_payload ?? {},
    createdAt: r.created_at.toISOString(),
  }));
}

/** Le fonti da cui un record candidato viene. */
export async function listEvidence(
  q: DbConnector, candidateId: string,
): Promise<SeedSourceEvidence[]> {
  const res = await q.query<{
    seed_source_evidence_id: string;
    seed_source_evidence_candidate_id: string;
    seed_source_evidence_url: string | null;
    seed_source_evidence_retrieved_at: Date | null;
    seed_source_evidence_content_hash: string | null;
    seed_source_evidence_payload: Record<string, unknown> | null;
    created_at: Date;
  }>(
    `SELECT seed_source_evidence_id, seed_source_evidence_candidate_id,
            seed_source_evidence_url, seed_source_evidence_retrieved_at,
            seed_source_evidence_content_hash, seed_source_evidence_payload, created_at
       FROM sys.sys_seed_source_evidence
      WHERE seed_source_evidence_candidate_id = $1
      ORDER BY created_at`,
    [candidateId],
  );
  return res.rows.map((r): SeedSourceEvidence => ({
    seedSourceEvidenceId: r.seed_source_evidence_id,
    candidateId: r.seed_source_evidence_candidate_id,
    url: r.seed_source_evidence_url,
    retrievedAt: r.seed_source_evidence_retrieved_at
      ? r.seed_source_evidence_retrieved_at.toISOString() : null,
    contentHash: r.seed_source_evidence_content_hash,
    payload: r.seed_source_evidence_payload ?? {},
    createdAt: r.created_at.toISOString(),
  }));
}
