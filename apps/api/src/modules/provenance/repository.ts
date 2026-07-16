/**
 * apps/api/src/modules/provenance/repository.ts — #28 (S1018) Trust Ledger.
 * Raw parameterized SQL over sys.sys_source_lineage_records (70k+ rows):
 * always paginated (limit ≤ 200); summary = ONE GROUP BY round-trip.
 */
import type { Pool, PoolClient } from "pg";
import type {
  ProvenanceRecord, ProvenanceListQuery,
  ProvenanceSummaryRow, ProvenanceSummaryResponse,
} from "@heuresys/shared";

export type DbConnector = Pool | PoolClient;

interface LineageRow {
  source_lineage_record_id: string; source_lineage_tenant_id: string;
  source_lineage_source_system: string; source_lineage_source_table: string;
  source_lineage_source_record_id: string; source_lineage_source_natural_key: string | null;
  source_lineage_source_content_hash: string | null; source_lineage_import_run_id: string | null;
  source_lineage_target_table_name: string; source_lineage_target_record_id: string;
  source_lineage_mapping_confidence: string; source_lineage_validation_status: string;
  source_lineage_sdbi_mapping_card_id: string | null; source_lineage_sdbi_confidence: string | null;
  source_lineage_sdbi_ai_model_id: string | null; source_lineage_sdbi_human_approver: string | null;
  created_at: Date;
}

function toRecord(r: LineageRow): ProvenanceRecord {
  return {
    lineageId: r.source_lineage_record_id,
    tenantId: r.source_lineage_tenant_id,
    sourceSystem: r.source_lineage_source_system,
    sourceTable: r.source_lineage_source_table,
    sourceRecordId: r.source_lineage_source_record_id,
    sourceNaturalKey: r.source_lineage_source_natural_key,
    contentHash: r.source_lineage_source_content_hash ? r.source_lineage_source_content_hash.trim() : null,
    importRunId: r.source_lineage_import_run_id,
    targetTableName: r.source_lineage_target_table_name,
    targetRecordId: r.source_lineage_target_record_id,
    mappingConfidence: Number(r.source_lineage_mapping_confidence),
    validationStatus: r.source_lineage_validation_status as ProvenanceRecord["validationStatus"],
    sdbiMappingCardId: r.source_lineage_sdbi_mapping_card_id,
    sdbiConfidence: r.source_lineage_sdbi_confidence === null ? null : Number(r.source_lineage_sdbi_confidence),
    sdbiAiModelId: r.source_lineage_sdbi_ai_model_id,
    sdbiHumanApprover: r.source_lineage_sdbi_human_approver,
    createdAt: r.created_at.toISOString(),
  };
}

function buildWhere(
  tenantId: string | undefined, query: ProvenanceListQuery,
): { wc: string; params: unknown[] } {
  const where: string[] = []; const params: unknown[] = [];
  if (tenantId) { params.push(tenantId); where.push(`source_lineage_tenant_id = $${params.length}`); }
  if (query.targetTable) { params.push(query.targetTable); where.push(`source_lineage_target_table_name = $${params.length}`); }
  if (query.sourceTable) { params.push(query.sourceTable); where.push(`source_lineage_source_table = $${params.length}`); }
  if (query.runId) { params.push(query.runId); where.push(`source_lineage_import_run_id = $${params.length}`); }
  if (query.validationStatus) { params.push(query.validationStatus); where.push(`source_lineage_validation_status = $${params.length}`); }
  if (query.minConfidence !== undefined) { params.push(query.minConfidence); where.push(`source_lineage_mapping_confidence >= $${params.length}`); }
  if (query.hasAiModel !== undefined) {
    where.push(query.hasAiModel ? `source_lineage_sdbi_ai_model_id IS NOT NULL` : `source_lineage_sdbi_ai_model_id IS NULL`);
  }
  if (query.hasHumanApprover !== undefined) {
    where.push(query.hasHumanApprover ? `source_lineage_sdbi_human_approver IS NOT NULL` : `source_lineage_sdbi_human_approver IS NULL`);
  }
  return { wc: where.length ? `WHERE ${where.join(" AND ")}` : "", params };
}

export async function listRecords(
  q: DbConnector, tenantId: string | undefined, query: ProvenanceListQuery,
): Promise<{ items: ProvenanceRecord[]; total: number }> {
  const { wc, params } = buildWhere(tenantId, query);
  const totalRow = await q.query<{ total: string }>(
    `SELECT count(*)::text AS total FROM sys.sys_source_lineage_records ${wc}`, params);
  params.push(query.limit); const lim = params.length; params.push(query.offset); const off = params.length;
  const res = await q.query<LineageRow>(
    `SELECT * FROM sys.sys_source_lineage_records ${wc}
      ORDER BY created_at DESC, source_lineage_record_id
      LIMIT $${lim} OFFSET $${off}`, params);
  return { total: Number(totalRow.rows[0]?.total ?? 0), items: res.rows.map(toRecord) };
}

interface SummaryRow {
  target_table: string; total: string; avg_confidence: string | null;
  valid: string; stale: string; conflicted: string; rejected: string;
  ai_assisted: string; human_approved: string;
}

export async function summarize(
  q: DbConnector, tenantId: string | undefined, runId?: string,
): Promise<ProvenanceSummaryResponse> {
  const where: string[] = []; const params: unknown[] = [];
  if (tenantId) { params.push(tenantId); where.push(`source_lineage_tenant_id = $${params.length}`); }
  if (runId) { params.push(runId); where.push(`source_lineage_import_run_id = $${params.length}`); }
  const wc = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const res = await q.query<SummaryRow>(
    `SELECT source_lineage_target_table_name AS target_table,
            count(*)::text AS total,
            avg(source_lineage_mapping_confidence)::text AS avg_confidence,
            count(*) FILTER (WHERE source_lineage_validation_status = 'VALID')::text AS valid,
            count(*) FILTER (WHERE source_lineage_validation_status = 'STALE')::text AS stale,
            count(*) FILTER (WHERE source_lineage_validation_status = 'CONFLICTED')::text AS conflicted,
            count(*) FILTER (WHERE source_lineage_validation_status = 'REJECTED')::text AS rejected,
            count(*) FILTER (WHERE source_lineage_sdbi_ai_model_id IS NOT NULL)::text AS ai_assisted,
            count(*) FILTER (WHERE source_lineage_sdbi_human_approver IS NOT NULL)::text AS human_approved
       FROM sys.sys_source_lineage_records ${wc}
      GROUP BY source_lineage_target_table_name
      ORDER BY count(*) DESC`, params);
  const byTable: ProvenanceSummaryRow[] = res.rows.map((r) => ({
    targetTable: r.target_table,
    total: Number(r.total),
    avgConfidence: r.avg_confidence === null ? null : Number(Number(r.avg_confidence).toFixed(3)),
    valid: Number(r.valid), stale: Number(r.stale),
    conflicted: Number(r.conflicted), rejected: Number(r.rejected),
    aiAssisted: Number(r.ai_assisted), humanApproved: Number(r.human_approved),
  }));
  const records = byTable.reduce((s, t) => s + t.total, 0);
  const weighted = byTable.reduce(
    (s, t) => (t.avgConfidence === null ? s : s + t.avgConfidence * t.total), 0);
  return {
    byTable,
    totals: {
      records,
      avgConfidence: records === 0 ? null : Number((weighted / records).toFixed(3)),
      aiAssisted: byTable.reduce((s, t) => s + t.aiAssisted, 0),
      humanApproved: byTable.reduce((s, t) => s + t.humanApproved, 0),
      conflicted: byTable.reduce((s, t) => s + t.conflicted, 0),
    },
  };
}
