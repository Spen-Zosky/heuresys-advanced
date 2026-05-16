/**
 * apps/api/src/modules/visualization-styles/repository.ts
 */
import type { Pool, PoolClient } from "pg";
import type { VizStyle, VizStyleListQuery, CreateVizStyleBody } from "@heuresys/shared";

export type DbConnector = Pool | PoolClient;

interface Row {
  style_id: string; style_graph_id: string; style_node_type: string | null;
  style_color: string | null; style_icon: string | null;
  style_metadata: Record<string, unknown>; created_at: Date;
}

const COLS = `style_id, style_graph_id, style_node_type, style_color, style_icon,
  style_metadata, created_at`;

function toStyle(r: Row): VizStyle {
  return {
    styleId: r.style_id, graphId: r.style_graph_id,
    nodeType: r.style_node_type, color: r.style_color, icon: r.style_icon,
    metadata: r.style_metadata, createdAt: r.created_at.toISOString(),
  };
}

export async function listStyles(
  q: DbConnector, filter: { tenantId?: string; query: VizStyleListQuery },
): Promise<{ items: VizStyle[]; total: number }> {
  const where: string[] = []; const params: unknown[] = [];
  if (filter.tenantId) { params.push(filter.tenantId); where.push(`g.graph_tenant_id = $${params.length}`); }
  if (filter.query.graphId) { params.push(filter.query.graphId); where.push(`s.style_graph_id = $${params.length}`); }
  if (filter.query.nodeType) { params.push(filter.query.nodeType); where.push(`s.style_node_type = $${params.length}`); }
  const w = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const tr = await q.query<{ total: string }>(
    `SELECT count(*)::text AS total FROM sys.sys_visualization_styles s
       JOIN sys.sys_visualization_graphs g ON g.graph_id = s.style_graph_id ${w}`, params,
  );
  params.push(filter.query.limit); const lim = params.length;
  params.push(filter.query.offset); const off = params.length;
  const res = await q.query<Row>(
    `SELECT ${COLS.split(",").map(c => `s.${c.trim()}`).join(", ")}
       FROM sys.sys_visualization_styles s
       JOIN sys.sys_visualization_graphs g ON g.graph_id = s.style_graph_id
       ${w} ORDER BY s.created_at LIMIT $${lim} OFFSET $${off}`, params,
  );
  return { items: res.rows.map(toStyle), total: Number(tr.rows[0]?.total ?? 0) };
}

export async function findStyleById(q: DbConnector, id: string): Promise<VizStyle | null> {
  const res = await q.query<Row>(`SELECT ${COLS} FROM sys.sys_visualization_styles WHERE style_id = $1`, [id]);
  return res.rows[0] ? toStyle(res.rows[0]) : null;
}

export async function insertStyle(q: DbConnector, body: CreateVizStyleBody): Promise<VizStyle> {
  const res = await q.query<Row>(
    `INSERT INTO sys.sys_visualization_styles (
        style_graph_id, style_node_type, style_color, style_icon, style_metadata
      ) VALUES ($1, $2, $3, $4, $5::jsonb) RETURNING ${COLS}`,
    [body.graphId, body.nodeType ?? null, body.color ?? null, body.icon ?? null,
     JSON.stringify(body.metadata ?? {})],
  );
  return toStyle(res.rows[0]!);
}

export async function deleteStyle(q: DbConnector, id: string): Promise<boolean> {
  const res = await q.query(`DELETE FROM sys.sys_visualization_styles WHERE style_id = $1`, [id]);
  return (res.rowCount ?? 0) === 1;
}
