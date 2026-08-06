/**
 * apps/api/src/modules/visualization-graphs/repository.ts
 */
import { randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import type {
  VizGraph, VizGraphType, VizGraphListQuery, CreateVizGraphBody, UpdateVizGraphBody,
  VizNode, VizEdge, VizNodeSourceEntityType,
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

/** Graph counts grouped by type, tenant-scoped. Feeds the visualizations summary chart (F4). */
export async function getTypeDistribution(
  q: DbConnector, tenantId: string | undefined,
): Promise<{ items: { type: string; count: number }[]; total: number }> {
  const params: unknown[] = [];
  let w = "";
  if (tenantId) { params.push(tenantId); w = `WHERE graph_tenant_id = $1`; }
  const res = await q.query<{ type: string; count: string }>(
    `SELECT graph_type AS type, count(*)::text AS count
       FROM sys.sys_visualization_graphs ${w}
       GROUP BY graph_type ORDER BY count(*) DESC, graph_type`,
    params,
  );
  const items = res.rows.map((r) => ({ type: r.type, count: Number(r.count) }));
  return { items, total: items.reduce((sum, i) => sum + i.count, 0) };
}

export async function findGraphById(q: DbConnector, id: string): Promise<VizGraph | null> {
  const res = await q.query<Row>(`SELECT ${COLS} FROM sys.sys_visualization_graphs WHERE graph_id = $1`, [id]);
  return res.rows[0] ? toGraph(res.rows[0]) : null;
}

interface NodeRow {
  node_id: string; node_graph_id: string; node_source_entity_type: VizNodeSourceEntityType;
  node_source_entity_id: string | null; node_label: string; node_type: string | null;
  node_group_key: string | null; node_metadata: Record<string, unknown> | null;
  created_at: Date; updated_at: Date;
}
interface EdgeRow {
  edge_id: string; edge_graph_id: string; edge_source_node_id: string; edge_target_node_id: string;
  edge_type: VizEdge["type"]; edge_weight: number | null;
  edge_metadata: Record<string, unknown> | null; created_at: Date;
}

/** Full graph payload (graph + nodes + edges) for the org-chart renderer (F4.4). */
export async function findGraphRender(
  q: DbConnector, graphId: string,
): Promise<{ graph: VizGraph; nodes: VizNode[]; edges: VizEdge[] } | null> {
  const graph = await findGraphById(q, graphId);
  if (!graph) return null;
  const nodes = await q.query<NodeRow>(
    `SELECT node_id, node_graph_id, node_source_entity_type, node_source_entity_id,
            node_label, node_type, node_group_key, node_metadata, created_at, updated_at
       FROM sys.sys_visualization_nodes WHERE node_graph_id = $1 ORDER BY node_label`,
    [graphId],
  );
  const edges = await q.query<EdgeRow>(
    `SELECT edge_id, edge_graph_id, edge_source_node_id, edge_target_node_id,
            edge_type, edge_weight::float8 AS edge_weight, edge_metadata, created_at
       FROM sys.sys_visualization_edges WHERE edge_graph_id = $1`,
    [graphId],
  );
  return {
    graph,
    nodes: nodes.rows.map((r) => ({
      nodeId: r.node_id, graphId: r.node_graph_id, sourceEntityType: r.node_source_entity_type,
      sourceEntityId: r.node_source_entity_id, label: r.node_label, type: r.node_type,
      groupKey: r.node_group_key, metadata: r.node_metadata ?? {},
      createdAt: r.created_at.toISOString(), updatedAt: r.updated_at.toISOString(),
    })),
    edges: edges.rows.map((r) => ({
      edgeId: r.edge_id, graphId: r.edge_graph_id, sourceNodeId: r.edge_source_node_id,
      targetNodeId: r.edge_target_node_id, type: r.edge_type, weight: r.edge_weight,
      metadata: r.edge_metadata ?? {}, createdAt: r.created_at.toISOString(),
    })),
  };
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

// ----------------------------------------------------- versionamento (#36 B5)

/** Tutte le versioni che condividono lo stesso codice, dalla più recente. */
export async function listGraphVersions(
  q: DbConnector, tenantId: string, code: string,
): Promise<VizGraph[]> {
  const res = await q.query<Row>(
    `SELECT ${COLS} FROM sys.sys_visualization_graphs
      WHERE graph_tenant_id = $1 AND graph_code = $2
      ORDER BY graph_version DESC`,
    [tenantId, code],
  );
  return res.rows.map(toGraph);
}

export async function maxGraphVersion(
  q: DbConnector, tenantId: string, code: string,
): Promise<number> {
  const res = await q.query<{ max: number | null }>(
    `SELECT max(graph_version) AS max FROM sys.sys_visualization_graphs
      WHERE graph_tenant_id = $1 AND graph_code = $2`,
    [tenantId, code],
  );
  return res.rows[0]?.max ?? 0;
}

/**
 * Inserisce la riga della nuova versione, copiando gli attributi dal grafo di
 * partenza. Il codice resta lo stesso: è ciò che lega le versioni fra loro.
 */
export async function insertGraphVersion(
  q: DbConnector,
  source: VizGraph,
  version: number,
  override: { name?: string; description?: string | null; metadata?: Record<string, unknown> },
  createdBy: string,
): Promise<VizGraph> {
  const res = await q.query<Row>(
    `INSERT INTO sys.sys_visualization_graphs (
        graph_tenant_id, graph_code, graph_type, graph_name, graph_description,
        graph_source_query, graph_version, graph_is_active, graph_metadata, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10) RETURNING ${COLS}`,
    [
      source.tenantId, source.code, source.type,
      override.name ?? source.name,
      override.description !== undefined ? override.description : source.description,
      source.sourceQuery, version, source.isActive,
      JSON.stringify(override.metadata ?? source.metadata),
      createdBy,
    ],
  );
  return toGraph(res.rows[0]!);
}

/**
 * Copia nodi e archi dal grafo di partenza a quello nuovo.
 *
 * Gli archi puntano a id di nodo: dopo la copia i nodi hanno id nuovi, quindi
 * la corrispondenza vecchio→nuovo si ricava dall'INSERT ... RETURNING e si usa
 * per rimappare le estremità. Senza questo passaggio gli archi della nuova
 * versione punterebbero ai nodi della vecchia — due versioni intrecciate.
 */
export async function copyGraphContent(
  q: DbConnector, sourceGraphId: string, targetGraphId: string,
): Promise<{ nodeIdMap: Map<string, string>; copiedNodes: number; copiedEdges: number }> {
  // Gli id della copia si generano QUI, non si lasciano al default della
  // tabella: è l'unico modo di conoscere la corrispondenza vecchio→nuovo senza
  // dedurla da un join su etichetta/entità, che accoppierebbe a caso due nodi
  // omonimi riferiti alla stessa entità.
  const existing = await q.query<{ node_id: string }>(
    `SELECT node_id FROM sys.sys_visualization_nodes WHERE node_graph_id = $1 ORDER BY node_id`,
    [sourceGraphId],
  );
  const nodeIdMap = new Map<string, string>(
    existing.rows.map((r) => [r.node_id, randomUUID()]),
  );
  const nodes = await q.query(
    `INSERT INTO sys.sys_visualization_nodes (
        node_id, node_graph_id, node_source_entity_type, node_source_entity_id,
        node_label, node_type, node_group_key, node_metadata)
     SELECT m.new_id, $2, n.node_source_entity_type, n.node_source_entity_id,
            n.node_label, n.node_type, n.node_group_key, n.node_metadata
       FROM sys.sys_visualization_nodes n
       JOIN unnest($3::uuid[], $4::uuid[]) AS m(old_id, new_id) ON m.old_id = n.node_id
      WHERE n.node_graph_id = $1`,
    [sourceGraphId, targetGraphId, [...nodeIdMap.keys()], [...nodeIdMap.values()]],
  );

  const edges = await q.query(
    `INSERT INTO sys.sys_visualization_edges (
        edge_graph_id, edge_source_node_id, edge_target_node_id,
        edge_type, edge_weight, edge_metadata)
     SELECT $2, m_src.new_id, m_tgt.new_id, e.edge_type, e.edge_weight, e.edge_metadata
       FROM sys.sys_visualization_edges e
       JOIN unnest($3::uuid[], $4::uuid[]) AS m_src(old_id, new_id)
         ON m_src.old_id = e.edge_source_node_id
       JOIN unnest($3::uuid[], $4::uuid[]) AS m_tgt(old_id, new_id)
         ON m_tgt.old_id = e.edge_target_node_id
      WHERE e.edge_graph_id = $1`,
    [sourceGraphId, targetGraphId, [...nodeIdMap.keys()], [...nodeIdMap.values()]],
  );

  return { nodeIdMap, copiedNodes: nodes.rowCount ?? 0, copiedEdges: edges.rowCount ?? 0 };
}

/**
 * Copia i layout del grafo e le posizioni dei nodi, rimappate sugli id nuovi.
 * Il vincolo "un solo layout predefinito per grafo" regge perché il grafo di
 * destinazione è nuovo e non ne ha ancora.
 */
export async function copyGraphLayouts(
  q: DbConnector, sourceGraphId: string, targetGraphId: string, nodeIdMap: Map<string, string>,
): Promise<{ copiedLayouts: number; copiedNodePositions: number }> {
  // Stessa ragione dei nodi: gli id nuovi si generano qui.
  const existing = await q.query<{ layout_id: string }>(
    `SELECT layout_id FROM sys.sys_visualization_layouts WHERE layout_graph_id = $1 ORDER BY layout_id`,
    [sourceGraphId],
  );
  if (existing.rowCount === 0) return { copiedLayouts: 0, copiedNodePositions: 0 };
  const layoutIdMap = new Map<string, string>(
    existing.rows.map((r) => [r.layout_id, randomUUID()]),
  );

  const layouts = await q.query(
    `INSERT INTO sys.sys_visualization_layouts (
        layout_id, layout_graph_id, layout_engine, layout_version, is_default, layout_metadata)
     SELECT m.new_id, $2, l.layout_engine, l.layout_version, l.is_default, l.layout_metadata
       FROM sys.sys_visualization_layouts l
       JOIN unnest($3::uuid[], $4::uuid[]) AS m(old_id, new_id) ON m.old_id = l.layout_id
      WHERE l.layout_graph_id = $1`,
    [sourceGraphId, targetGraphId, [...layoutIdMap.keys()], [...layoutIdMap.values()]],
  );
  if (nodeIdMap.size === 0) {
    return { copiedLayouts: layouts.rowCount ?? 0, copiedNodePositions: 0 };
  }

  const positions = await q.query(
    `INSERT INTO sys.sys_visualization_node_layouts (layout_id, node_id, x, y, z, locked, node_layout_metadata)
     SELECT ml.new_id, mn.new_id, nl.x, nl.y, nl.z, nl.locked, nl.node_layout_metadata
       FROM sys.sys_visualization_node_layouts nl
       JOIN unnest($1::uuid[], $2::uuid[]) AS ml(old_id, new_id) ON ml.old_id = nl.layout_id
       JOIN unnest($3::uuid[], $4::uuid[]) AS mn(old_id, new_id) ON mn.old_id = nl.node_id`,
    [
      [...layoutIdMap.keys()], [...layoutIdMap.values()],
      [...nodeIdMap.keys()], [...nodeIdMap.values()],
    ],
  );
  return { copiedLayouts: layouts.rowCount ?? 0, copiedNodePositions: positions.rowCount ?? 0 };
}

/**
 * Copia gli stili sulla nuova versione (#153).
 *
 * Mancava, e non era una dimenticanza innocua: `sys_visualization_styles` lega
 * un aspetto a una COPPIA (grafo, tipo di nodo), quindi una versione nuova
 * nasceva con tutti i suoi nodi e nessuna regola per disegnarli. Misurato sul
 * reale: la v2 dell'organigramma di RTL, creata da una persona il 2026-08-02,
 * aveva 158 nodi e zero stili, e da allora la custodia settimanale falliva sul
 * check C11a(iv).
 *
 * Nessuna mappa di id da rimappare, a differenza di nodi e disposizioni: lo
 * stile punta a un TIPO (`style_node_type`), che è una stringa e resta valida
 * nella copia. Per questo basta una INSERT…SELECT.
 */
export async function copyGraphStyles(
  q: DbConnector, sourceGraphId: string, targetGraphId: string,
): Promise<number> {
  const res = await q.query(
    `INSERT INTO sys.sys_visualization_styles (
        style_graph_id, style_node_type, style_color, style_icon, style_metadata)
     SELECT $2, s.style_node_type, s.style_color, s.style_icon, s.style_metadata
       FROM sys.sys_visualization_styles s
      WHERE s.style_graph_id = $1`,
    [sourceGraphId, targetGraphId],
  );
  return res.rowCount ?? 0;
}

export async function deleteGraph(q: DbConnector, id: string): Promise<boolean> {
  const res = await q.query(`DELETE FROM sys.sys_visualization_graphs WHERE graph_id = $1`, [id]);
  return (res.rowCount ?? 0) === 1;
}
