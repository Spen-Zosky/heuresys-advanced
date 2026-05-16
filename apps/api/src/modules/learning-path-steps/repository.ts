/**
 * apps/api/src/modules/learning-path-steps/repository.ts
 * Raw SQL for sys.sys_learning_path_steps. Visibility derived from parent path
 * via JOIN.
 */

import type { Pool, PoolClient } from "pg";
import type {
  LearningPathStep,
  LearningPathStepListQuery,
  CreateLearningPathStepBody,
  UpdateLearningPathStepBody,
} from "@heuresys/shared";

export type DbConnector = Pool | PoolClient;

interface Row {
  learning_path_step_id: string;
  learning_path_step_path_id: string;
  learning_path_step_module_id: string;
  learning_path_step_ordinal: number;
  learning_path_step_is_prerequisite_for: string[];
  learning_path_step_metadata: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

const COLS = `learning_path_step_id, learning_path_step_path_id, learning_path_step_module_id,
  learning_path_step_ordinal, learning_path_step_is_prerequisite_for,
  learning_path_step_metadata, created_at, updated_at`;

function toStep(r: Row): LearningPathStep {
  return {
    learningPathStepId: r.learning_path_step_id,
    pathId: r.learning_path_step_path_id,
    moduleId: r.learning_path_step_module_id,
    ordinal: r.learning_path_step_ordinal,
    isPrerequisiteFor: r.learning_path_step_is_prerequisite_for,
    metadata: r.learning_path_step_metadata,
    createdAt: r.created_at.toISOString(),
    updatedAt: r.updated_at.toISOString(),
  };
}

export async function listSteps(
  q: DbConnector,
  filter: { tenantId?: string; query: LearningPathStepListQuery },
): Promise<{ items: LearningPathStep[]; total: number }> {
  const where: string[] = [];
  const params: unknown[] = [];
  if (filter.tenantId) {
    params.push(filter.tenantId);
    where.push(`(p.learning_path_is_global = true OR p.learning_path_tenant_id = $${params.length})`);
  }
  if (filter.query.pathId) {
    params.push(filter.query.pathId);
    where.push(`s.learning_path_step_path_id = $${params.length}`);
  }
  if (filter.query.moduleId) {
    params.push(filter.query.moduleId);
    where.push(`s.learning_path_step_module_id = $${params.length}`);
  }
  const whereClause = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";

  const totalRow = await q.query<{ total: string }>(
    `SELECT count(*)::text AS total
       FROM sys.sys_learning_path_steps s
       JOIN sys.sys_learning_paths p ON p.learning_path_id = s.learning_path_step_path_id
       ${whereClause}`,
    params,
  );
  const total = Number(totalRow.rows[0]?.total ?? 0);

  params.push(filter.query.limit);
  const lim = params.length;
  params.push(filter.query.offset);
  const off = params.length;
  const res = await q.query<Row>(
    `SELECT ${COLS.split(",").map((c) => `s.${c.trim()}`).join(", ")}
       FROM sys.sys_learning_path_steps s
       JOIN sys.sys_learning_paths p ON p.learning_path_id = s.learning_path_step_path_id
       ${whereClause}
       ORDER BY s.learning_path_step_path_id, s.learning_path_step_ordinal
       LIMIT $${lim} OFFSET $${off}`,
    params,
  );
  return { items: res.rows.map(toStep), total };
}

export async function findStepById(q: DbConnector, id: string): Promise<LearningPathStep | null> {
  const res = await q.query<Row>(
    `SELECT ${COLS} FROM sys.sys_learning_path_steps WHERE learning_path_step_id = $1`,
    [id],
  );
  return res.rows[0] ? toStep(res.rows[0]) : null;
}

export async function findStepByPathOrdinal(
  q: DbConnector,
  pathId: string,
  ordinal: number,
): Promise<LearningPathStep | null> {
  const res = await q.query<Row>(
    `SELECT ${COLS} FROM sys.sys_learning_path_steps
      WHERE learning_path_step_path_id = $1 AND learning_path_step_ordinal = $2`,
    [pathId, ordinal],
  );
  return res.rows[0] ? toStep(res.rows[0]) : null;
}

export async function moduleExists(q: DbConnector, moduleId: string): Promise<boolean> {
  const res = await q.query<{ x: number }>(
    `SELECT 1 AS x FROM sys.sys_learning_modules WHERE learning_module_id = $1 LIMIT 1`,
    [moduleId],
  );
  return res.rows.length > 0;
}

export async function insertStep(
  q: DbConnector,
  body: CreateLearningPathStepBody,
): Promise<LearningPathStep> {
  const res = await q.query<Row>(
    `INSERT INTO sys.sys_learning_path_steps (
        learning_path_step_path_id, learning_path_step_module_id,
        learning_path_step_ordinal, learning_path_step_is_prerequisite_for,
        learning_path_step_metadata
      ) VALUES ($1, $2, $3, $4::jsonb, $5::jsonb)
      RETURNING ${COLS}`,
    [
      body.pathId,
      body.moduleId,
      body.ordinal,
      JSON.stringify(body.isPrerequisiteFor ?? []),
      JSON.stringify(body.metadata ?? {}),
    ],
  );
  return toStep(res.rows[0]!);
}

export async function updateStepPartial(
  q: DbConnector,
  id: string,
  patch: UpdateLearningPathStepBody,
): Promise<LearningPathStep | null> {
  const sets: string[] = [];
  const params: unknown[] = [];
  const addSet = (col: string, value: unknown) => {
    params.push(value);
    sets.push(`${col} = $${params.length}`);
  };
  if (patch.moduleId !== undefined) addSet("learning_path_step_module_id", patch.moduleId);
  if (patch.ordinal !== undefined) addSet("learning_path_step_ordinal", patch.ordinal);
  if (patch.isPrerequisiteFor !== undefined) {
    params.push(JSON.stringify(patch.isPrerequisiteFor));
    sets.push(`learning_path_step_is_prerequisite_for = $${params.length}::jsonb`);
  }
  if (patch.metadata !== undefined) {
    params.push(JSON.stringify(patch.metadata));
    sets.push(`learning_path_step_metadata = $${params.length}::jsonb`);
  }
  if (sets.length === 0) return findStepById(q, id);
  sets.push(`updated_at = now()`);
  params.push(id);
  const res = await q.query<Row>(
    `UPDATE sys.sys_learning_path_steps SET ${sets.join(", ")}
      WHERE learning_path_step_id = $${params.length}
      RETURNING ${COLS}`,
    params,
  );
  return res.rows[0] ? toStep(res.rows[0]) : null;
}

export async function deleteStep(q: DbConnector, id: string): Promise<boolean> {
  const res = await q.query(`DELETE FROM sys.sys_learning_path_steps WHERE learning_path_step_id = $1`, [id]);
  return (res.rowCount ?? 0) === 1;
}
