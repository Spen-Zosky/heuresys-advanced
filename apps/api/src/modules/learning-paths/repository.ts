/**
 * apps/api/src/modules/learning-paths/repository.ts
 * Raw SQL for sys.sys_learning_paths. Global+tenant visibility.
 */

import type { Pool, PoolClient } from "pg";
import type {
  LearningPath,
  LearningPathListQuery,
  CreateLearningPathBody,
  UpdateLearningPathBody,
} from "@heuresys/shared";

export type DbConnector = Pool | PoolClient;

interface Row {
  learning_path_id: string;
  learning_path_tenant_id: string | null;
  learning_path_code: string;
  learning_path_name: string;
  learning_path_description: string | null;
  learning_path_target_outcome: string | null;
  learning_path_is_global: boolean;
  learning_path_metadata: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

const COLS = `learning_path_id, learning_path_tenant_id, learning_path_code,
  learning_path_name, learning_path_description, learning_path_target_outcome,
  learning_path_is_global, learning_path_metadata, created_at, updated_at`;

function toLp(r: Row): LearningPath {
  return {
    learningPathId: r.learning_path_id,
    tenantId: r.learning_path_tenant_id,
    code: r.learning_path_code,
    name: r.learning_path_name,
    description: r.learning_path_description,
    targetOutcome: r.learning_path_target_outcome,
    isGlobal: r.learning_path_is_global,
    metadata: r.learning_path_metadata,
    createdAt: r.created_at.toISOString(),
    updatedAt: r.updated_at.toISOString(),
  };
}

export async function listPaths(
  q: DbConnector,
  filter: { tenantId?: string; query: LearningPathListQuery },
): Promise<{ items: LearningPath[]; total: number }> {
  const where: string[] = [];
  const params: unknown[] = [];
  if (filter.tenantId) {
    params.push(filter.tenantId);
    where.push(`(learning_path_is_global = true OR learning_path_tenant_id = $${params.length})`);
  }
  if (filter.query.isGlobal !== undefined) {
    params.push(filter.query.isGlobal);
    where.push(`learning_path_is_global = $${params.length}`);
  }
  if (filter.query.search) {
    params.push(`%${filter.query.search}%`);
    where.push(`(learning_path_name ILIKE $${params.length} OR learning_path_code ILIKE $${params.length})`);
  }
  const whereClause = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";

  const totalRow = await q.query<{ total: string }>(
    `SELECT count(*)::text AS total FROM sys.sys_learning_paths ${whereClause}`,
    params,
  );
  const total = Number(totalRow.rows[0]?.total ?? 0);

  params.push(filter.query.limit);
  const lim = params.length;
  params.push(filter.query.offset);
  const off = params.length;
  const res = await q.query<Row>(
    `SELECT ${COLS} FROM sys.sys_learning_paths ${whereClause}
      ORDER BY learning_path_name LIMIT $${lim} OFFSET $${off}`,
    params,
  );
  return { items: res.rows.map(toLp), total };
}

export async function findPathById(q: DbConnector, id: string): Promise<LearningPath | null> {
  const res = await q.query<Row>(
    `SELECT ${COLS} FROM sys.sys_learning_paths WHERE learning_path_id = $1`, [id],
  );
  return res.rows[0] ? toLp(res.rows[0]) : null;
}

export async function findPathByCodeInScope(
  q: DbConnector,
  tenantId: string | null,
  code: string,
): Promise<LearningPath | null> {
  const res = await q.query<Row>(
    `SELECT ${COLS} FROM sys.sys_learning_paths
      WHERE COALESCE(learning_path_tenant_id, '00000000-0000-0000-0000-000000000000'::uuid)
            = COALESCE($1::uuid, '00000000-0000-0000-0000-000000000000'::uuid)
        AND learning_path_code = $2`,
    [tenantId, code],
  );
  return res.rows[0] ? toLp(res.rows[0]) : null;
}

export async function insertPath(
  q: DbConnector,
  tenantId: string | null,
  body: CreateLearningPathBody,
  createdBy: string,
): Promise<LearningPath> {
  const res = await q.query<Row>(
    `INSERT INTO sys.sys_learning_paths (
        learning_path_tenant_id, learning_path_code, learning_path_name,
        learning_path_description, learning_path_target_outcome,
        learning_path_is_global, learning_path_metadata, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8)
      RETURNING ${COLS}`,
    [
      tenantId,
      body.code,
      body.name,
      body.description ?? null,
      body.targetOutcome ?? null,
      body.isGlobal,
      JSON.stringify(body.metadata ?? {}),
      createdBy,
    ],
  );
  return toLp(res.rows[0]!);
}

export async function updatePathPartial(
  q: DbConnector,
  id: string,
  patch: UpdateLearningPathBody,
  updatedBy: string,
): Promise<LearningPath | null> {
  const sets: string[] = [];
  const params: unknown[] = [];
  const addSet = (col: string, value: unknown) => {
    params.push(value);
    sets.push(`${col} = $${params.length}`);
  };
  if (patch.name !== undefined) addSet("learning_path_name", patch.name);
  if (patch.description !== undefined) addSet("learning_path_description", patch.description);
  if (patch.targetOutcome !== undefined) addSet("learning_path_target_outcome", patch.targetOutcome);
  if (patch.metadata !== undefined) {
    params.push(JSON.stringify(patch.metadata));
    sets.push(`learning_path_metadata = $${params.length}::jsonb`);
  }
  if (sets.length === 0) return findPathById(q, id);
  sets.push(`updated_at = now()`);
  params.push(updatedBy);
  sets.push(`updated_by = $${params.length}`);
  params.push(id);
  const res = await q.query<Row>(
    `UPDATE sys.sys_learning_paths SET ${sets.join(", ")}
      WHERE learning_path_id = $${params.length}
      RETURNING ${COLS}`,
    params,
  );
  return res.rows[0] ? toLp(res.rows[0]) : null;
}

export async function deletePath(q: DbConnector, id: string): Promise<boolean> {
  const res = await q.query(`DELETE FROM sys.sys_learning_paths WHERE learning_path_id = $1`, [id]);
  return (res.rowCount ?? 0) === 1;
}

export async function pathHasSteps(q: DbConnector, id: string): Promise<boolean> {
  const res = await q.query<{ x: number }>(
    `SELECT 1 AS x FROM sys.sys_learning_path_steps WHERE learning_path_step_path_id = $1 LIMIT 1`,
    [id],
  );
  return res.rows.length > 0;
}
