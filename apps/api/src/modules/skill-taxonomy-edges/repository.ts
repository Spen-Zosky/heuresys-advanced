/**
 * apps/api/src/modules/skill-taxonomy-edges/repository.ts
 * Raw SQL for sys.sys_skill_taxonomy_edges.
 * Edges are immutable: create/get/list/delete only (no UPDATE path).
 * Visibility joins twice on sys_skills (parent + child).
 */

import type { Pool, PoolClient } from "pg";
import type {
  SkillTaxonomyEdge,
  SkillTaxonomyEdgeListQuery,
  CreateSkillTaxonomyEdgeBody,
  SkillEdgeKind,
} from "@heuresys/shared";

export type DbConnector = Pool | PoolClient;

interface Row {
  skill_taxonomy_edge_id: string;
  skill_taxonomy_edge_parent_id: string;
  skill_taxonomy_edge_child_id: string;
  skill_taxonomy_edge_kind: SkillEdgeKind;
  skill_taxonomy_edge_metadata: Record<string, unknown>;
  created_at: Date;
}

const COLS = `e.skill_taxonomy_edge_id, e.skill_taxonomy_edge_parent_id,
  e.skill_taxonomy_edge_child_id, e.skill_taxonomy_edge_kind,
  e.skill_taxonomy_edge_metadata, e.created_at`;

function toEdge(r: Row): SkillTaxonomyEdge {
  return {
    edgeId: r.skill_taxonomy_edge_id,
    parentSkillId: r.skill_taxonomy_edge_parent_id,
    childSkillId: r.skill_taxonomy_edge_child_id,
    kind: r.skill_taxonomy_edge_kind,
    metadata: r.skill_taxonomy_edge_metadata,
    createdAt: r.created_at.toISOString(),
  };
}

export interface ListFilter {
  /** When defined, restrict edges where both endpoints are global OR own tenant. */
  tenantId?: string;
  query: SkillTaxonomyEdgeListQuery;
}

function visibilityClause(params: unknown[], tenantId: string | undefined): string {
  if (!tenantId) return "";
  params.push(tenantId);
  const idx = params.length;
  return `(sp.skill_is_global OR sp.skill_tenant_id = $${idx})
       AND (sc.skill_is_global OR sc.skill_tenant_id = $${idx})`;
}

export async function listEdges(
  q: DbConnector,
  filter: ListFilter,
): Promise<{ items: SkillTaxonomyEdge[]; total: number }> {
  const where: string[] = [];
  const params: unknown[] = [];
  const vis = visibilityClause(params, filter.tenantId);
  if (vis) where.push(vis);
  if (filter.query.parentSkillId) {
    params.push(filter.query.parentSkillId);
    where.push(`e.skill_taxonomy_edge_parent_id = $${params.length}`);
  }
  if (filter.query.childSkillId) {
    params.push(filter.query.childSkillId);
    where.push(`e.skill_taxonomy_edge_child_id = $${params.length}`);
  }
  if (filter.query.kind) {
    params.push(filter.query.kind);
    where.push(`e.skill_taxonomy_edge_kind = $${params.length}`);
  }
  const whereClause = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";

  const totalRow = await q.query<{ total: string }>(
    `SELECT count(*)::text AS total FROM sys.sys_skill_taxonomy_edges AS e
       JOIN sys.sys_skills AS sp ON e.skill_taxonomy_edge_parent_id = sp.skill_id
       JOIN sys.sys_skills AS sc ON e.skill_taxonomy_edge_child_id = sc.skill_id
       ${whereClause}`,
    params,
  );
  const total = Number(totalRow.rows[0]?.total ?? 0);

  params.push(filter.query.limit);
  const lim = params.length;
  params.push(filter.query.offset);
  const off = params.length;
  const res = await q.query<Row>(
    `SELECT ${COLS} FROM sys.sys_skill_taxonomy_edges AS e
       JOIN sys.sys_skills AS sp ON e.skill_taxonomy_edge_parent_id = sp.skill_id
       JOIN sys.sys_skills AS sc ON e.skill_taxonomy_edge_child_id = sc.skill_id
       ${whereClause}
      ORDER BY e.created_at DESC, e.skill_taxonomy_edge_id
      LIMIT $${lim} OFFSET $${off}`,
    params,
  );
  return { items: res.rows.map(toEdge), total };
}

export async function findEdgeById(
  q: DbConnector,
  id: string,
  tenantId: string | undefined,
): Promise<SkillTaxonomyEdge | null> {
  const params: unknown[] = [id];
  const vis = visibilityClause(params, tenantId);
  const visClause = vis ? `AND ${vis}` : "";
  const res = await q.query<Row>(
    `SELECT ${COLS} FROM sys.sys_skill_taxonomy_edges AS e
       JOIN sys.sys_skills AS sp ON e.skill_taxonomy_edge_parent_id = sp.skill_id
       JOIN sys.sys_skills AS sc ON e.skill_taxonomy_edge_child_id = sc.skill_id
      WHERE e.skill_taxonomy_edge_id = $1 ${visClause}`,
    params,
  );
  return res.rows[0] ? toEdge(res.rows[0]) : null;
}

export async function findEdgeByPairKind(
  q: DbConnector,
  parentId: string,
  childId: string,
  kind: SkillEdgeKind,
): Promise<SkillTaxonomyEdge | null> {
  const res = await q.query<Row>(
    `SELECT ${COLS} FROM sys.sys_skill_taxonomy_edges AS e
      WHERE e.skill_taxonomy_edge_parent_id = $1
        AND e.skill_taxonomy_edge_child_id = $2
        AND e.skill_taxonomy_edge_kind = $3`,
    [parentId, childId, kind],
  );
  return res.rows[0] ? toEdge(res.rows[0]) : null;
}

export async function skillExists(q: DbConnector, skillId: string): Promise<boolean> {
  const res = await q.query<{ x: number }>(
    `SELECT 1 AS x FROM sys.sys_skills WHERE skill_id = $1 LIMIT 1`,
    [skillId],
  );
  return res.rows.length > 0;
}

/** #62 G3 — acyclicity guard. Adding parent→child creates a cycle iff `parent`
 *  is already reachable FROM `child` walking existing same-kind edges downward
 *  (child→…→parent would close the loop). Recursive CTE, cycle-safe walk. */
export async function wouldCreateCycle(
  q: DbConnector,
  parentSkillId: string,
  childSkillId: string,
  kind: string,
): Promise<boolean> {
  const res = await q.query<{ found: boolean }>(
    `WITH RECURSIVE walk AS (
        SELECT e.skill_taxonomy_edge_child_id AS node,
               ARRAY[e.skill_taxonomy_edge_parent_id, e.skill_taxonomy_edge_child_id] AS path
          FROM sys.sys_skill_taxonomy_edges e
         WHERE e.skill_taxonomy_edge_parent_id = $2 AND e.skill_taxonomy_edge_kind = $3
        UNION ALL
        SELECT e.skill_taxonomy_edge_child_id, w.path || e.skill_taxonomy_edge_child_id
          FROM sys.sys_skill_taxonomy_edges e
          JOIN walk w ON w.node = e.skill_taxonomy_edge_parent_id
         WHERE e.skill_taxonomy_edge_kind = $3
           AND NOT e.skill_taxonomy_edge_child_id = ANY(w.path)
     )
     SELECT true AS found FROM walk WHERE node = $1 LIMIT 1`,
    [parentSkillId, childSkillId, kind],
  );
  return res.rows.length > 0;
}

export async function insertEdge(
  q: DbConnector,
  body: CreateSkillTaxonomyEdgeBody,
): Promise<SkillTaxonomyEdge> {
  const res = await q.query<Row>(
    `INSERT INTO sys.sys_skill_taxonomy_edges (
        skill_taxonomy_edge_parent_id, skill_taxonomy_edge_child_id,
        skill_taxonomy_edge_kind, skill_taxonomy_edge_metadata
      ) VALUES ($1, $2, $3, $4::jsonb)
      RETURNING skill_taxonomy_edge_id AS "skill_taxonomy_edge_id",
                skill_taxonomy_edge_parent_id AS "skill_taxonomy_edge_parent_id",
                skill_taxonomy_edge_child_id AS "skill_taxonomy_edge_child_id",
                skill_taxonomy_edge_kind AS "skill_taxonomy_edge_kind",
                skill_taxonomy_edge_metadata AS "skill_taxonomy_edge_metadata",
                created_at`,
    [body.parentSkillId, body.childSkillId, body.kind ?? "IS_A", JSON.stringify(body.metadata ?? {})],
  );
  return toEdge(res.rows[0]!);
}

export async function deleteEdge(q: DbConnector, id: string): Promise<boolean> {
  const res = await q.query(
    `DELETE FROM sys.sys_skill_taxonomy_edges WHERE skill_taxonomy_edge_id = $1`,
    [id],
  );
  return (res.rowCount ?? 0) === 1;
}
