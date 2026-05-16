/**
 * apps/api/src/modules/visualization-layouts/repository.ts
 */
import type { Pool, PoolClient } from "pg";
import type {
  VizLayout, VizLayoutEngine, VizLayoutListQuery,
  CreateVizLayoutBody, UpdateVizLayoutBody,
} from "@heuresys/shared";

export type DbConnector = Pool | PoolClient;

interface Row {
  layout_id: string; layout_graph_id: string; layout_engine: VizLayoutEngine;
  layout_version: number; is_default: boolean; layout_metadata: Record<string, unknown>;
  created_at: Date; updated_at: Date;
}

const COLS = `layout_id, layout_graph_id, layout_engine, layout_version, is_default,
  layout_metadata, created_at, updated_at`;

function toLayout(r: Row): VizLayout {
  return {
    layoutId: r.layout_id, graphId: r.layout_graph_id, engine: r.layout_engine,
    version: r.layout_version, isDefault: r.is_default, metadata: r.layout_metadata,
    createdAt: r.created_at.toISOString(), updatedAt: r.updated_at.toISOString(),
  };
}

export async function listLayouts(
  q: DbConnector, filter: { tenantId?: string; query: VizLayoutListQuery },
): Promise<{ items: VizLayout[]; total: number }> {
  const where: string[] = []; const params: unknown[] = [];
  if (filter.tenantId) { params.push(filter.tenantId); where.push(`g.graph_tenant_id = $${params.length}`); }
  if (filter.query.graphId) { params.push(filter.query.graphId); where.push(`l.layout_graph_id = $${params.length}`); }
  if (filter.query.engine) { params.push(filter.query.engine); where.push(`l.layout_engine = $${params.length}`); }
  if (filter.query.isDefault !== undefined) { params.push(filter.query.isDefault); where.push(`l.is_default = $${params.length}`); }
  const w = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const tr = await q.query<{ total: string }>(
    `SELECT count(*)::text AS total FROM sys.sys_visualization_layouts l
       JOIN sys.sys_visualization_graphs g ON g.graph_id = l.layout_graph_id ${w}`, params,
  );
  params.push(filter.query.limit); const lim = params.length;
  params.push(filter.query.offset); const off = params.length;
  const res = await q.query<Row>(
    `SELECT ${COLS.split(",").map(c => `l.${c.trim()}`).join(", ")}
       FROM sys.sys_visualization_layouts l
       JOIN sys.sys_visualization_graphs g ON g.graph_id = l.layout_graph_id
       ${w} ORDER BY l.created_at LIMIT $${lim} OFFSET $${off}`, params,
  );
  return { items: res.rows.map(toLayout), total: Number(tr.rows[0]?.total ?? 0) };
}

export async function findLayoutById(q: DbConnector, id: string): Promise<VizLayout | null> {
  const res = await q.query<Row>(`SELECT ${COLS} FROM sys.sys_visualization_layouts WHERE layout_id = $1`, [id]);
  return res.rows[0] ? toLayout(res.rows[0]) : null;
}

export async function insertLayout(q: DbConnector, body: CreateVizLayoutBody): Promise<VizLayout> {
  const res = await q.query<Row>(
    `INSERT INTO sys.sys_visualization_layouts (
        layout_graph_id, layout_engine, is_default, layout_metadata
      ) VALUES ($1, $2, $3, $4::jsonb) RETURNING ${COLS}`,
    [body.graphId, body.engine, body.isDefault, JSON.stringify(body.metadata ?? {})],
  );
  return toLayout(res.rows[0]!);
}

export async function updateLayoutPartial(
  q: DbConnector, id: string, patch: UpdateVizLayoutBody,
): Promise<VizLayout | null> {
  const sets: string[] = []; const params: unknown[] = [];
  const add = (col: string, v: unknown) => { params.push(v); sets.push(`${col} = $${params.length}`); };
  if (patch.engine !== undefined) add("layout_engine", patch.engine);
  if (patch.isDefault !== undefined) add("is_default", patch.isDefault);
  if (patch.metadata !== undefined) { params.push(JSON.stringify(patch.metadata)); sets.push(`layout_metadata = $${params.length}::jsonb`); }
  if (sets.length === 0) return findLayoutById(q, id);
  sets.push(`updated_at = now()`);
  params.push(id);
  const res = await q.query<Row>(
    `UPDATE sys.sys_visualization_layouts SET ${sets.join(", ")}
      WHERE layout_id = $${params.length} RETURNING ${COLS}`, params,
  );
  return res.rows[0] ? toLayout(res.rows[0]) : null;
}

export async function deleteLayout(q: DbConnector, id: string): Promise<boolean> {
  const res = await q.query(`DELETE FROM sys.sys_visualization_layouts WHERE layout_id = $1`, [id]);
  return (res.rowCount ?? 0) === 1;
}
