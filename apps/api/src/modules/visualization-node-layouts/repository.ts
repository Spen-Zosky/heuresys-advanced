/**
 * apps/api/src/modules/visualization-node-layouts/repository.ts
 * Upsert by (layout_id, node_id).
 */
import type { Pool, PoolClient } from "pg";
import type {
  VizNodeLayout, VizNodeLayoutListQuery, UpsertVizNodeLayoutBody,
} from "@heuresys/shared";

export type DbConnector = Pool | PoolClient;

interface Row {
  node_layout_id: string; layout_id: string; node_id: string;
  x: string; y: string; z: string | null; locked: boolean;
  node_layout_metadata: Record<string, unknown>; created_at: Date; updated_at: Date;
}

const COLS = `node_layout_id, layout_id, node_id, x, y, z, locked,
  node_layout_metadata, created_at, updated_at`;

function toNl(r: Row): VizNodeLayout {
  return {
    nodeLayoutId: r.node_layout_id, layoutId: r.layout_id, nodeId: r.node_id,
    x: Number(r.x), y: Number(r.y), z: r.z === null ? null : Number(r.z),
    locked: r.locked, metadata: r.node_layout_metadata,
    createdAt: r.created_at.toISOString(), updatedAt: r.updated_at.toISOString(),
  };
}

export async function listNodeLayouts(
  q: DbConnector, filter: { tenantId?: string; query: VizNodeLayoutListQuery },
): Promise<{ items: VizNodeLayout[]; total: number }> {
  const where: string[] = []; const params: unknown[] = [];
  if (filter.tenantId) { params.push(filter.tenantId); where.push(`g.graph_tenant_id = $${params.length}`); }
  if (filter.query.layoutId) { params.push(filter.query.layoutId); where.push(`nl.layout_id = $${params.length}`); }
  if (filter.query.nodeId) { params.push(filter.query.nodeId); where.push(`nl.node_id = $${params.length}`); }
  const w = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const tr = await q.query<{ total: string }>(
    `SELECT count(*)::text AS total FROM sys.sys_visualization_node_layouts nl
       JOIN sys.sys_visualization_layouts l ON l.layout_id = nl.layout_id
       JOIN sys.sys_visualization_graphs g ON g.graph_id = l.layout_graph_id ${w}`, params,
  );
  params.push(filter.query.limit); const lim = params.length;
  params.push(filter.query.offset); const off = params.length;
  const res = await q.query<Row>(
    `SELECT ${COLS.split(",").map(c => `nl.${c.trim()}`).join(", ")}
       FROM sys.sys_visualization_node_layouts nl
       JOIN sys.sys_visualization_layouts l ON l.layout_id = nl.layout_id
       JOIN sys.sys_visualization_graphs g ON g.graph_id = l.layout_graph_id
       ${w} ORDER BY nl.created_at LIMIT $${lim} OFFSET $${off}`, params,
  );
  return { items: res.rows.map(toNl), total: Number(tr.rows[0]?.total ?? 0) };
}

/**
 * Tutte le posizioni di un layout, senza paginazione — serve al motore di
 * export (#36 B5), che deve disegnare il grafo intero: una pagina di posizioni
 * produrrebbe un documento con i nodi mancanti, non un documento più corto.
 */
export async function listAllPositionsForLayout(
  q: DbConnector, layoutId: string,
): Promise<Array<{ nodeId: string; x: number; y: number }>> {
  const res = await q.query<{ node_id: string; x: string; y: string }>(
    `SELECT node_id, x::text, y::text FROM sys.sys_visualization_node_layouts WHERE layout_id = $1`,
    [layoutId],
  );
  return res.rows.map((r) => ({ nodeId: r.node_id, x: Number(r.x), y: Number(r.y) }));
}

export async function findNodeLayoutById(q: DbConnector, id: string): Promise<VizNodeLayout | null> {
  const res = await q.query<Row>(`SELECT ${COLS} FROM sys.sys_visualization_node_layouts WHERE node_layout_id = $1`, [id]);
  return res.rows[0] ? toNl(res.rows[0]) : null;
}

export async function getLayoutGraph(q: DbConnector, layoutId: string): Promise<string | null> {
  const res = await q.query<{ layout_graph_id: string }>(
    `SELECT layout_graph_id FROM sys.sys_visualization_layouts WHERE layout_id = $1`, [layoutId],
  );
  return res.rows[0]?.layout_graph_id ?? null;
}

export async function getNodeGraph(q: DbConnector, nodeId: string): Promise<string | null> {
  const res = await q.query<{ node_graph_id: string }>(
    `SELECT node_graph_id FROM sys.sys_visualization_nodes WHERE node_id = $1`, [nodeId],
  );
  return res.rows[0]?.node_graph_id ?? null;
}

export async function upsertNodeLayout(
  q: DbConnector, body: UpsertVizNodeLayoutBody,
): Promise<VizNodeLayout> {
  const res = await q.query<Row>(
    `INSERT INTO sys.sys_visualization_node_layouts (
        layout_id, node_id, x, y, z, locked, node_layout_metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
      ON CONFLICT (layout_id, node_id) DO UPDATE SET
        x = EXCLUDED.x, y = EXCLUDED.y, z = EXCLUDED.z,
        locked = EXCLUDED.locked,
        node_layout_metadata = EXCLUDED.node_layout_metadata,
        updated_at = now()
      RETURNING ${COLS}`,
    [body.layoutId, body.nodeId, body.x, body.y, body.z ?? null,
     body.locked ?? false, JSON.stringify(body.metadata ?? {})],
  );
  return toNl(res.rows[0]!);
}

export async function deleteNodeLayout(q: DbConnector, id: string): Promise<boolean> {
  const res = await q.query(`DELETE FROM sys.sys_visualization_node_layouts WHERE node_layout_id = $1`, [id]);
  return (res.rowCount ?? 0) === 1;
}
