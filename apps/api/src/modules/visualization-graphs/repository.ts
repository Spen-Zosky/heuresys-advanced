/**
 * apps/api/src/modules/visualization-graphs/repository.ts
 */
import type { Pool, PoolClient } from "pg";
import type {
  VizGraph, VizGraphType, VizGraphListQuery, CreateVizGraphBody, UpdateVizGraphBody,
} from "@heuresys/shared";

export type DbConnector = Pool | PoolClient;

interface Row {
  graph_id: string; graph_tenant_id: string; graph_code: string;
  graph_type: VizGraphType; graph_name: string; graph_description: string | null;
  graph_source_query: string | null; graph_version: number; graph_is_active: boolean;
  graph_metadata: Record<string, unknown>; created_at: Date; updated_at: Date;
}

const COLS = `graph_id, graph_tenant_id, graph_code, graph_type, graph_name,
  graph_description, graph_source_query, graph_version, graph_is_active,
  graph_metadata, created_at, updated_at`;

function toGraph(r: Row): VizGraph {
  return {
    graphId: r.graph_id, tenantId: r.graph_tenant_id, code: r.graph_code,
    type: r.graph_type, name: r.graph_name, description: r.graph_description,
    sourceQuery: r.graph_source_query, version: r.graph_version, isActive: r.graph_is_active,
    metadata: r.graph_metadata,
    createdAt: r.created_at.toISOString(), updatedAt: r.updated_at.toISOString(),
  };
}

export async function listGraphs(
  q: DbConnector, filter: { tenantId?: string; query: VizGraphListQuery },
): Promise<{ items: VizGraph[]; total: number }> {
  const where: string[] = []; const params: unknown[] = [];
  if (filter.tenantId) { params.push(filter.tenantId); where.push(`graph_tenant_id = $${params.length}`); }
  if (filter.query.type) { params.push(filter.query.type); where.push(`graph_type = $${params.length}`); }
  if (filter.query.isActive !== undefined) { params.push(filter.query.isActive); where.push(`graph_is_active = $${params.length}`); }
  if (filter.query.search) { params.push(`%${filter.query.search}%`); where.push(`(graph_name ILIKE $${params.length} OR graph_code ILIKE $${params.length})`); }
  const w = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const tr = await q.query<{ total: string }>(`SELECT count(*)::text AS total FROM sys.sys_visualization_graphs ${w}`, params);
  params.push(filter.query.limit); const lim = params.length;
  params.push(filter.query.offset); const off = params.length;
  const res = await q.query<Row>(
    `SELECT ${COLS} FROM sys.sys_visualization_graphs ${w}
      ORDER BY graph_name LIMIT $${lim} OFFSET $${off}`, params,
  );
  return { items: res.rows.map(toGraph), total: Number(tr.rows[0]?.total ?? 0) };
}

export async function findGraphById(q: DbConnector, id: string): Promise<VizGraph | null> {
  const res = await q.query<Row>(`SELECT ${COLS} FROM sys.sys_visualization_graphs WHERE graph_id = $1`, [id]);
  return res.rows[0] ? toGraph(res.rows[0]) : null;
}

export async function findGraphByCodeVersion(
  q: DbConnector, tenantId: string, code: string, version: number,
): Promise<VizGraph | null> {
  const res = await q.query<Row>(
    `SELECT ${COLS} FROM sys.sys_visualization_graphs
      WHERE graph_tenant_id = $1 AND graph_code = $2 AND graph_version = $3`,
    [tenantId, code, version],
  );
  return res.rows[0] ? toGraph(res.rows[0]) : null;
}

export async function insertGraph(
  q: DbConnector, tenantId: string, body: CreateVizGraphBody, createdBy: string,
): Promise<VizGraph> {
  const res = await q.query<Row>(
    `INSERT INTO sys.sys_visualization_graphs (
        graph_tenant_id, graph_code, graph_type, graph_name, graph_description,
        graph_source_query, graph_is_active, graph_metadata, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9) RETURNING ${COLS}`,
    [tenantId, body.code, body.type, body.name, body.description ?? null,
     body.sourceQuery ?? null, body.isActive, JSON.stringify(body.metadata ?? {}), createdBy],
  );
  return toGraph(res.rows[0]!);
}

export async function updateGraphPartial(
  q: DbConnector, id: string, patch: UpdateVizGraphBody, updatedBy: string,
): Promise<VizGraph | null> {
  const sets: string[] = []; const params: unknown[] = [];
  const add = (col: string, v: unknown) => { params.push(v); sets.push(`${col} = $${params.length}`); };
  if (patch.name !== undefined) add("graph_name", patch.name);
  if (patch.description !== undefined) add("graph_description", patch.description);
  if (patch.sourceQuery !== undefined) add("graph_source_query", patch.sourceQuery);
  if (patch.isActive !== undefined) add("graph_is_active", patch.isActive);
  if (patch.metadata !== undefined) { params.push(JSON.stringify(patch.metadata)); sets.push(`graph_metadata = $${params.length}::jsonb`); }
  if (sets.length === 0) return findGraphById(q, id);
  sets.push(`updated_at = now()`);
  params.push(updatedBy); sets.push(`updated_by = $${params.length}`);
  params.push(id);
  const res = await q.query<Row>(
    `UPDATE sys.sys_visualization_graphs SET ${sets.join(", ")}
      WHERE graph_id = $${params.length} RETURNING ${COLS}`, params,
  );
  return res.rows[0] ? toGraph(res.rows[0]) : null;
}

export async function deleteGraph(q: DbConnector, id: string): Promise<boolean> {
  const res = await q.query(`DELETE FROM sys.sys_visualization_graphs WHERE graph_id = $1`, [id]);
  return (res.rowCount ?? 0) === 1;
}
