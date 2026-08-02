/**
 * apps/api/src/modules/visualization-exports/repository.ts
 */
import type { Pool, PoolClient } from "pg";
import type {
  VizExport, VizExportFormat, VizExportListQuery, CreateVizExportBody,
} from "@heuresys/shared";

export type DbConnector = Pool | PoolClient;

interface Row {
  export_id: string; export_graph_id: string; export_layout_id: string | null;
  export_format: VizExportFormat; export_payload_uri: string | null;
  export_generated_at: Date; export_metadata: Record<string, unknown>;
  created_at: Date;
  export_content_type: string | null; export_byte_size: number | null;
}

// Il payload NON è in COLS: è il documento intero e la lista non deve
// trascinarselo dietro. Si legge solo al download, con findExportPayload.
const COLS = `export_id, export_graph_id, export_layout_id, export_format,
  export_payload_uri, export_generated_at, export_metadata, created_at,
  export_content_type, export_byte_size`;

function toExp(r: Row): VizExport {
  return {
    exportId: r.export_id, graphId: r.export_graph_id, layoutId: r.export_layout_id,
    format: r.export_format, payloadUri: r.export_payload_uri,
    generatedAt: r.export_generated_at.toISOString(),
    metadata: r.export_metadata, createdAt: r.created_at.toISOString(),
    contentType: r.export_content_type, byteSize: r.export_byte_size,
  };
}

export async function listExports(
  q: DbConnector, filter: { tenantId?: string; query: VizExportListQuery },
): Promise<{ items: VizExport[]; total: number }> {
  const where: string[] = []; const params: unknown[] = [];
  if (filter.tenantId) { params.push(filter.tenantId); where.push(`g.graph_tenant_id = $${params.length}`); }
  if (filter.query.graphId) { params.push(filter.query.graphId); where.push(`e.export_graph_id = $${params.length}`); }
  if (filter.query.layoutId) { params.push(filter.query.layoutId); where.push(`e.export_layout_id = $${params.length}`); }
  if (filter.query.format) { params.push(filter.query.format); where.push(`e.export_format = $${params.length}`); }
  const w = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const tr = await q.query<{ total: string }>(
    `SELECT count(*)::text AS total FROM sys.sys_visualization_exports e
       JOIN sys.sys_visualization_graphs g ON g.graph_id = e.export_graph_id ${w}`, params,
  );
  params.push(filter.query.limit); const lim = params.length;
  params.push(filter.query.offset); const off = params.length;
  const res = await q.query<Row>(
    `SELECT ${COLS.split(",").map(c => `e.${c.trim()}`).join(", ")}
       FROM sys.sys_visualization_exports e
       JOIN sys.sys_visualization_graphs g ON g.graph_id = e.export_graph_id
       ${w} ORDER BY e.export_generated_at DESC LIMIT $${lim} OFFSET $${off}`, params,
  );
  return { items: res.rows.map(toExp), total: Number(tr.rows[0]?.total ?? 0) };
}

export async function findExportById(q: DbConnector, id: string): Promise<VizExport | null> {
  const res = await q.query<Row>(`SELECT ${COLS} FROM sys.sys_visualization_exports WHERE export_id = $1`, [id]);
  return res.rows[0] ? toExp(res.rows[0]) : null;
}

export async function insertExport(
  q: DbConnector,
  body: CreateVizExportBody,
  rendered: { content: string; contentType: string } | null,
): Promise<VizExport> {
  const res = await q.query<Row>(
    `INSERT INTO sys.sys_visualization_exports (
        export_graph_id, export_layout_id, export_format,
        export_payload_uri, export_metadata,
        export_payload, export_content_type, export_byte_size
      ) VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8) RETURNING ${COLS}`,
    [body.graphId, body.layoutId ?? null, body.format,
     body.payloadUri ?? null, JSON.stringify(body.metadata ?? {}),
     rendered?.content ?? null,
     rendered?.contentType ?? null,
     rendered ? Buffer.byteLength(rendered.content, "utf8") : null],
  );
  return toExp(res.rows[0]!);
}

/** Il documento vero e proprio. Letto solo al download. */
export async function findExportPayload(
  q: DbConnector, id: string,
): Promise<{ content: string; contentType: string; format: VizExportFormat; graphId: string } | null> {
  const res = await q.query<{
    export_payload: string | null; export_content_type: string | null;
    export_format: VizExportFormat; export_graph_id: string;
  }>(
    `SELECT export_payload, export_content_type, export_format, export_graph_id
       FROM sys.sys_visualization_exports WHERE export_id = $1`,
    [id],
  );
  const r = res.rows[0];
  if (!r || r.export_payload === null) return null;
  return {
    content: r.export_payload,
    contentType: r.export_content_type ?? "application/octet-stream",
    format: r.export_format,
    graphId: r.export_graph_id,
  };
}
