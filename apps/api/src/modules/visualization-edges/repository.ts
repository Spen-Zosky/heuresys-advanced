/**
 * apps/api/src/modules/visualization-edges/repository.ts
 */
import type { Pool, PoolClient } from "pg";
import type {
  VizEdge, VizEdgeType, VizEdgeListQuery, CreateVizEdgeBody,
} from "@heuresys/shared";

export type DbConnector = Pool | PoolClient;

interface Row {
  edge_id: string; edge_graph_id: string;
  edge_source_node_id: string; edge_target_node_id: string;
  edge_type: VizEdgeType; edge_weight: string | null;
  edge_metadata: Record<string, unknown>; created_at: Date;
}

const COLS = `edge_id, edge_graph_id, edge_source_node_id, edge_target_node_id,
  edge_type, edge_weight, edge_metadata, created_at`;

function toEdge(r: Row): VizEdge {
  return {
    edgeId: r.edge_id, graphId: r.edge_graph_id,
    sourceNodeId: r.edge_source_node_id, targetNodeId: r.edge_target_node_id,
    type: r.edge_type, weight: r.edge_weight === null ? null : Number(r.edge_weight),
    metadata: r.edge_metadata, createdAt: r.created_at.toISOString(),
  };
}

export async function listEdges(
  q: DbConnector, filter: { tenantId?: string; query: VizEdgeListQuery },
): Promise<{ items: VizEdge[]; total: number }> {
  const where: string[] = []; const params: unknown[] = [];
  if (filter.tenantId) { params.push(filter.tenantId); where.push(`g.graph_tenant_id = $${params.length}`); }
  if (filter.query.graphId) { params.push(filter.query.graphId); where.push(`e.edge_graph_id = $${params.length}`); }
  if (filter.query.sourceNodeId) { params.push(filter.query.sourceNodeId); where.push(`e.edge_source_node_id = $${params.length}`); }
  if (filter.query.targetNodeId) { params.push(filter.query.targetNodeId); where.push(`e.edge_target_node_id = $${params.length}`); }
  if (filter.query.type) { params.push(filter.query.type); where.push(`e.edge_type = $${params.length}`); }
  const w = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const tr = await q.query<{ total: string }>(
    `SELECT count(*)::text AS total FROM sys.sys_visualization_edges e
       JOIN sys.sys_visualization_graphs g ON g.graph_id = e.edge_graph_id ${w}`, params,
  );
  params.push(filter.query.limit); const lim = params.length;
  params.push(filter.query.offset); const off = params.length;
  const res = await q.query<Row>(
    `SELECT ${COLS.split(",").map(c => `e.${c.trim()}`).join(", ")}
       FROM sys.sys_visualization_edges e
       JOIN sys.sys_visualization_graphs g ON g.graph_id = e.edge_graph_id
       ${w} ORDER BY e.created_at LIMIT $${lim} OFFSET $${off}`, params,
  );
  return { items: res.rows.map(toEdge), total: Number(tr.rows[0]?.total ?? 0) };
}

export async function findEdgeById(q: DbConnector, id: string): Promise<VizEdge | null> {
  const res = await q.query<Row>(`SELECT ${COLS} FROM sys.sys_visualization_edges WHERE edge_id = $1`, [id]);
  return res.rows[0] ? toEdge(res.rows[0]) : null;
}

export async function getNodeGraph(q: DbConnector, nodeId: string): Promise<string | null> {
  const res = await q.query<{ node_graph_id: string }>(
    `SELECT node_graph_id FROM sys.sys_visualization_nodes WHERE node_id = $1`, [nodeId],
  );
  return res.rows[0]?.node_graph_id ?? null;
}

export async function insertEdge(q: DbConnector, body: CreateVizEdgeBody): Promise<VizEdge> {
  const res = await q.query<Row>(
    `INSERT INTO sys.sys_visualization_edges (
        edge_graph_id, edge_source_node_id, edge_target_node_id,
        edge_type, edge_weight, edge_metadata
      ) VALUES ($1, $2, $3, $4, $5, $6::jsonb) RETURNING ${COLS}`,
    [body.graphId, body.sourceNodeId, body.targetNodeId, body.type,
     body.weight ?? null, JSON.stringify(body.metadata ?? {})],
  );
  return toEdge(res.rows[0]!);
}

export async function deleteEdge(q: DbConnector, id: string): Promise<boolean> {
  const res = await q.query(`DELETE FROM sys.sys_visualization_edges WHERE edge_id = $1`, [id]);
  return (res.rowCount ?? 0) === 1;
}
