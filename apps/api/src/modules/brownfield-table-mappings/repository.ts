/**
 * apps/api/src/modules/brownfield-table-mappings/repository.ts
 */
import type { Pool, PoolClient } from "pg";
import type {
  BrownfieldTableMapping, BrownfieldApprovalStatus,
  BrownfieldTableMappingListQuery, ApproveBrownfieldTableMappingBody,
} from "@heuresys/shared";

export type DbConnector = Pool | PoolClient;

interface Row {
  table_mapping_id: string;
  table_mapping_run_id: string | null;
  table_mapping_source_table_id: string;
  table_mapping_target_schema: string;
  table_mapping_target_table: string;
  table_mapping_classification: string;
  table_mapping_approval_status: BrownfieldApprovalStatus;
  table_mapping_approved_by: string | null;
  table_mapping_approved_at: Date | null;
  table_mapping_rationale: string | null;
  table_mapping_metadata: Record<string, unknown>;
  created_at: Date;
}

const COLS = `table_mapping_id, table_mapping_run_id, table_mapping_source_table_id,
  table_mapping_target_schema, table_mapping_target_table, table_mapping_classification,
  table_mapping_approval_status, table_mapping_approved_by, table_mapping_approved_at,
  table_mapping_rationale, table_mapping_metadata, created_at`;

function toMap(r: Row): BrownfieldTableMapping {
  return {
    tableMappingId: r.table_mapping_id,
    runId: r.table_mapping_run_id,
    sourceTableId: r.table_mapping_source_table_id,
    targetSchema: r.table_mapping_target_schema,
    targetTable: r.table_mapping_target_table,
    classification: r.table_mapping_classification,
    approvalStatus: r.table_mapping_approval_status,
    approvedBy: r.table_mapping_approved_by,
    approvedAt: r.table_mapping_approved_at ? r.table_mapping_approved_at.toISOString() : null,
    rationale: r.table_mapping_rationale,
    metadata: r.table_mapping_metadata,
    createdAt: r.created_at.toISOString(),
  };
}

export async function listMappings(
  q: DbConnector, query: BrownfieldTableMappingListQuery,
): Promise<{ items: BrownfieldTableMapping[]; total: number }> {
  const where: string[] = []; const params: unknown[] = [];
  if (query.runId) { params.push(query.runId); where.push(`table_mapping_run_id = $${params.length}`); }
  if (query.sourceTableId) { params.push(query.sourceTableId); where.push(`table_mapping_source_table_id = $${params.length}`); }
  if (query.approvalStatus) { params.push(query.approvalStatus); where.push(`table_mapping_approval_status = $${params.length}`); }
  if (query.targetSchema) { params.push(query.targetSchema); where.push(`table_mapping_target_schema = $${params.length}`); }
  const w = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const tr = await q.query<{ total: string }>(`SELECT count(*)::text AS total FROM brownfield.table_mappings ${w}`, params);
  params.push(query.limit); const lim = params.length;
  params.push(query.offset); const off = params.length;
  const res = await q.query<Row>(
    `SELECT ${COLS} FROM brownfield.table_mappings ${w}
      ORDER BY created_at DESC LIMIT $${lim} OFFSET $${off}`, params,
  );
  return { items: res.rows.map(toMap), total: Number(tr.rows[0]?.total ?? 0) };
}

export async function findMappingById(q: DbConnector, id: string): Promise<BrownfieldTableMapping | null> {
  const res = await q.query<Row>(`SELECT ${COLS} FROM brownfield.table_mappings WHERE table_mapping_id = $1`, [id]);
  return res.rows[0] ? toMap(res.rows[0]) : null;
}

export async function decideMapping(
  q: DbConnector, id: string, body: ApproveBrownfieldTableMappingBody, approverId: string,
): Promise<BrownfieldTableMapping | null> {
  const finalising = body.approvalStatus === "APPROVED" || body.approvalStatus === "REJECTED";
  const res = await q.query<Row>(
    `UPDATE brownfield.table_mappings SET
        table_mapping_approval_status = $1,
        table_mapping_approved_by = CASE WHEN $4::boolean THEN $2 ELSE table_mapping_approved_by END,
        table_mapping_approved_at = CASE WHEN $4::boolean THEN now() ELSE table_mapping_approved_at END,
        table_mapping_rationale = COALESCE($3, table_mapping_rationale)
      WHERE table_mapping_id = $5 RETURNING ${COLS}`,
    [body.approvalStatus, approverId, body.rationale ?? null, finalising, id],
  );
  return res.rows[0] ? toMap(res.rows[0]) : null;
}
