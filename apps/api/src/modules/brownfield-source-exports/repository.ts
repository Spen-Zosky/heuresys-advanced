/**
 * apps/api/src/modules/brownfield-source-exports/repository.ts
 * Read-only viewer for brownfield.source_exports.
 */
import type { Pool, PoolClient } from "pg";
import type {
  BrownfieldSourceExport, BrownfieldSourceExportStatus,
  BrownfieldSourceExportListQuery,
} from "@heuresys/shared";

export type DbConnector = Pool | PoolClient;

interface Row {
  source_export_id: string;
  source_export_name: string;
  source_export_file_hash: string | null;
  source_export_retrieved_at: Date;
  source_export_size_bytes: string | null;
  source_export_status: BrownfieldSourceExportStatus;
  source_export_metadata: Record<string, unknown>;
  created_at: Date;
}

const COLS = `source_export_id, source_export_name, source_export_file_hash,
  source_export_retrieved_at, source_export_size_bytes, source_export_status,
  source_export_metadata, created_at`;

function toExp(r: Row): BrownfieldSourceExport {
  return {
    sourceExportId: r.source_export_id,
    name: r.source_export_name,
    fileHash: r.source_export_file_hash,
    retrievedAt: r.source_export_retrieved_at.toISOString(),
    sizeBytes: r.source_export_size_bytes === null ? null : Number(r.source_export_size_bytes),
    status: r.source_export_status,
    metadata: r.source_export_metadata,
    createdAt: r.created_at.toISOString(),
  };
}

export async function listExports(
  q: DbConnector, query: BrownfieldSourceExportListQuery,
): Promise<{ items: BrownfieldSourceExport[]; total: number }> {
  const where: string[] = []; const params: unknown[] = [];
  if (query.status) { params.push(query.status); where.push(`source_export_status = $${params.length}`); }
  if (query.search) { params.push(`%${query.search}%`); where.push(`source_export_name ILIKE $${params.length}`); }
  const w = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const tr = await q.query<{ total: string }>(`SELECT count(*)::text AS total FROM brownfield.source_exports ${w}`, params);
  params.push(query.limit); const lim = params.length;
  params.push(query.offset); const off = params.length;
  const res = await q.query<Row>(
    `SELECT ${COLS} FROM brownfield.source_exports ${w}
      ORDER BY source_export_retrieved_at DESC LIMIT $${lim} OFFSET $${off}`, params,
  );
  return { items: res.rows.map(toExp), total: Number(tr.rows[0]?.total ?? 0) };
}

export async function findExportById(q: DbConnector, id: string): Promise<BrownfieldSourceExport | null> {
  const res = await q.query<Row>(`SELECT ${COLS} FROM brownfield.source_exports WHERE source_export_id = $1`, [id]);
  return res.rows[0] ? toExp(res.rows[0]) : null;
}
