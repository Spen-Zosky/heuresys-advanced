/**
 * apps/api/src/modules/visualization-nodes/repository.ts
 */
import type { Pool, PoolClient } from "pg";
import type {
  VizNode, VizNodeSourceEntityType, VizNodeListQuery,
  CreateVizNodeBody, UpdateVizNodeBody,
} from "@heuresys/shared";

export type DbConnector = Pool | PoolClient;

interface Row {
  node_id: string; node_graph_id: string;
  node_source_entity_type: VizNodeSourceEntityType; node_source_entity_id: string | null;
  node_label: string; node_type: string | null; node_group_key: string | null;
  node_metadata: Record<string, unknown>; created_at: Date; updated_at: Date;
}

const COLS = `node_id, node_graph_id, node_source_entity_type, node_source_entity_id,
  node_label, node_type, node_group_key, node_metadata, created_at, updated_at`;

function toNode(r: Row): VizNode {
  return {
    nodeId: r.node_id, graphId: r.node_graph_id,
    sourceEntityType: r.node_source_entity_type, sourceEntityId: r.node_source_entity_id,
    label: r.node_label, type: r.node_type, groupKey: r.node_group_key,
    metadata: r.node_metadata,
    createdAt: r.created_at.toISOString(), updatedAt: r.updated_at.toISOString(),
  };
}

export async function listNodes(
  q: DbConnector, filter: { tenantId?: string; query: VizNodeListQuery },
): Promise<{ items: VizNode[]; total: number }> {
  const where: string[] = []; const params: unknown[] = [];
  if (filter.tenantId) { params.push(filter.tenantId); where.push(`g.graph_tenant_id = $${params.length}`); }
  if (filter.query.graphId) { params.push(filter.query.graphId); where.push(`n.node_graph_id = $${params.length}`); }
  if (filter.query.sourceEntityType) { params.push(filter.query.sourceEntityType); where.push(`n.node_source_entity_type = $${params.length}`); }
  if (filter.query.groupKey) { params.push(filter.query.groupKey); where.push(`n.node_group_key = $${params.length}`); }
  const w = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const tr = await q.query<{ total: string }>(
    `SELECT count(*)::text AS total FROM sys.sys_visualization_nodes n
       JOIN sys.sys_visualization_graphs g ON g.graph_id = n.node_graph_id ${w}`, params,
  );
  params.push(filter.query.limit); const lim = params.length;
  params.push(filter.query.offset); const off = params.length;
  const res = await q.query<Row>(
    `SELECT ${COLS.split(",").map(c => `n.${c.trim()}`).join(", ")}
       FROM sys.sys_visualization_nodes n
       JOIN sys.sys_visualization_graphs g ON g.graph_id = n.node_graph_id
       ${w} ORDER BY n.created_at LIMIT $${lim} OFFSET $${off}`, params,
  );
  return { items: res.rows.map(toNode), total: Number(tr.rows[0]?.total ?? 0) };
}

export async function findNodeById(q: DbConnector, id: string): Promise<VizNode | null> {
  const res = await q.query<Row>(`SELECT ${COLS} FROM sys.sys_visualization_nodes WHERE node_id = $1`, [id]);
  return res.rows[0] ? toNode(res.rows[0]) : null;
}

export async function insertNode(q: DbConnector, body: CreateVizNodeBody): Promise<VizNode> {
  const res = await q.query<Row>(
    `INSERT INTO sys.sys_visualization_nodes (
        node_graph_id, node_source_entity_type, node_source_entity_id,
        node_label, node_type, node_group_key, node_metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb) RETURNING ${COLS}`,
    [body.graphId, body.sourceEntityType, body.sourceEntityId ?? null,
     body.label, body.type ?? null, body.groupKey ?? null, JSON.stringify(body.metadata ?? {})],
  );
  return toNode(res.rows[0]!);
}

export async function updateNodePartial(
  q: DbConnector, id: string, patch: UpdateVizNodeBody,
): Promise<VizNode | null> {
  const sets: string[] = []; const params: unknown[] = [];
  const add = (col: string, v: unknown) => { params.push(v); sets.push(`${col} = $${params.length}`); };
  if (patch.label !== undefined) add("node_label", patch.label);
  if (patch.type !== undefined) add("node_type", patch.type);
  if (patch.groupKey !== undefined) add("node_group_key", patch.groupKey);
  if (patch.metadata !== undefined) { params.push(JSON.stringify(patch.metadata)); sets.push(`node_metadata = $${params.length}::jsonb`); }
  if (sets.length === 0) return findNodeById(q, id);
  sets.push(`updated_at = now()`);
  params.push(id);
  const res = await q.query<Row>(
    `UPDATE sys.sys_visualization_nodes SET ${sets.join(", ")}
      WHERE node_id = $${params.length} RETURNING ${COLS}`, params,
  );
  return res.rows[0] ? toNode(res.rows[0]) : null;
}

export async function deleteNode(q: DbConnector, id: string): Promise<boolean> {
  const res = await q.query(`DELETE FROM sys.sys_visualization_nodes WHERE node_id = $1`, [id]);
  return (res.rowCount ?? 0) === 1;
}
