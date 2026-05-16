/**
 * apps/api/src/modules/career-path-steps/repository.ts
 * Raw SQL for sys.sys_career_path_steps. Visibility derived via parent path JOIN.
 */

import type { Pool, PoolClient } from "pg";
import type {
  CareerPathStep,
  CareerPathStepListQuery,
  CreateCareerPathStepBody,
  UpdateCareerPathStepBody,
} from "@heuresys/shared";

export type DbConnector = Pool | PoolClient;

interface Row {
  career_path_step_id: string;
  career_path_step_path_id: string;
  career_path_step_ordinal: number;
  career_path_step_origin_position_id: string | null;
  career_path_step_target_position_id: string | null;
  career_path_step_required_proficiency_uplift: Record<string, unknown>;
  career_path_step_typical_duration_months: number | null;
  career_path_step_metadata: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

const COLS = `career_path_step_id, career_path_step_path_id, career_path_step_ordinal,
  career_path_step_origin_position_id, career_path_step_target_position_id,
  career_path_step_required_proficiency_uplift, career_path_step_typical_duration_months,
  career_path_step_metadata, created_at, updated_at`;

function toStep(r: Row): CareerPathStep {
  return {
    careerPathStepId: r.career_path_step_id,
    pathId: r.career_path_step_path_id,
    ordinal: r.career_path_step_ordinal,
    originPositionId: r.career_path_step_origin_position_id,
    targetPositionId: r.career_path_step_target_position_id,
    requiredProficiencyUplift: r.career_path_step_required_proficiency_uplift,
    typicalDurationMonths: r.career_path_step_typical_duration_months,
    metadata: r.career_path_step_metadata,
    createdAt: r.created_at.toISOString(),
    updatedAt: r.updated_at.toISOString(),
  };
}

export async function listSteps(
  q: DbConnector,
  filter: { tenantId?: string; query: CareerPathStepListQuery },
): Promise<{ items: CareerPathStep[]; total: number }> {
  const where: string[] = [];
  const params: unknown[] = [];
  if (filter.tenantId) {
    params.push(filter.tenantId);
    where.push(`(p.career_path_is_global = true OR p.career_path_tenant_id = $${params.length})`);
  }
  if (filter.query.pathId) {
    params.push(filter.query.pathId);
    where.push(`s.career_path_step_path_id = $${params.length}`);
  }
  if (filter.query.originPositionId) {
    params.push(filter.query.originPositionId);
    where.push(`s.career_path_step_origin_position_id = $${params.length}`);
  }
  if (filter.query.targetPositionId) {
    params.push(filter.query.targetPositionId);
    where.push(`s.career_path_step_target_position_id = $${params.length}`);
  }
  const whereClause = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";

  const totalRow = await q.query<{ total: string }>(
    `SELECT count(*)::text AS total
       FROM sys.sys_career_path_steps s
       JOIN sys.sys_career_paths p ON p.career_path_id = s.career_path_step_path_id
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
       FROM sys.sys_career_path_steps s
       JOIN sys.sys_career_paths p ON p.career_path_id = s.career_path_step_path_id
       ${whereClause}
       ORDER BY s.career_path_step_path_id, s.career_path_step_ordinal
       LIMIT $${lim} OFFSET $${off}`,
    params,
  );
  return { items: res.rows.map(toStep), total };
}

export async function findStepById(q: DbConnector, id: string): Promise<CareerPathStep | null> {
  const res = await q.query<Row>(
    `SELECT ${COLS} FROM sys.sys_career_path_steps WHERE career_path_step_id = $1`, [id],
  );
  return res.rows[0] ? toStep(res.rows[0]) : null;
}

export async function findStepByPathOrdinal(
  q: DbConnector,
  pathId: string,
  ordinal: number,
): Promise<CareerPathStep | null> {
  const res = await q.query<Row>(
    `SELECT ${COLS} FROM sys.sys_career_path_steps
      WHERE career_path_step_path_id = $1 AND career_path_step_ordinal = $2`,
    [pathId, ordinal],
  );
  return res.rows[0] ? toStep(res.rows[0]) : null;
}

export async function positionExists(q: DbConnector, positionId: string): Promise<boolean> {
  const res = await q.query<{ x: number }>(
    `SELECT 1 AS x FROM sys.sys_positions WHERE position_id = $1 LIMIT 1`, [positionId],
  );
  return res.rows.length > 0;
}

export async function insertStep(
  q: DbConnector,
  body: CreateCareerPathStepBody,
): Promise<CareerPathStep> {
  const res = await q.query<Row>(
    `INSERT INTO sys.sys_career_path_steps (
        career_path_step_path_id, career_path_step_ordinal,
        career_path_step_origin_position_id, career_path_step_target_position_id,
        career_path_step_required_proficiency_uplift,
        career_path_step_typical_duration_months, career_path_step_metadata
      ) VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7::jsonb)
      RETURNING ${COLS}`,
    [
      body.pathId,
      body.ordinal,
      body.originPositionId ?? null,
      body.targetPositionId ?? null,
      JSON.stringify(body.requiredProficiencyUplift ?? {}),
      body.typicalDurationMonths ?? null,
      JSON.stringify(body.metadata ?? {}),
    ],
  );
  return toStep(res.rows[0]!);
}

export async function updateStepPartial(
  q: DbConnector,
  id: string,
  patch: UpdateCareerPathStepBody,
): Promise<CareerPathStep | null> {
  const sets: string[] = [];
  const params: unknown[] = [];
  const addSet = (col: string, value: unknown) => {
    params.push(value);
    sets.push(`${col} = $${params.length}`);
  };
  if (patch.ordinal !== undefined) addSet("career_path_step_ordinal", patch.ordinal);
  if (patch.originPositionId !== undefined) addSet("career_path_step_origin_position_id", patch.originPositionId);
  if (patch.targetPositionId !== undefined) addSet("career_path_step_target_position_id", patch.targetPositionId);
  if (patch.typicalDurationMonths !== undefined) addSet("career_path_step_typical_duration_months", patch.typicalDurationMonths);
  if (patch.requiredProficiencyUplift !== undefined) {
    params.push(JSON.stringify(patch.requiredProficiencyUplift));
    sets.push(`career_path_step_required_proficiency_uplift = $${params.length}::jsonb`);
  }
  if (patch.metadata !== undefined) {
    params.push(JSON.stringify(patch.metadata));
    sets.push(`career_path_step_metadata = $${params.length}::jsonb`);
  }
  if (sets.length === 0) return findStepById(q, id);
  sets.push(`updated_at = now()`);
  params.push(id);
  const res = await q.query<Row>(
    `UPDATE sys.sys_career_path_steps SET ${sets.join(", ")}
      WHERE career_path_step_id = $${params.length}
      RETURNING ${COLS}`,
    params,
  );
  return res.rows[0] ? toStep(res.rows[0]) : null;
}

export async function deleteStep(q: DbConnector, id: string): Promise<boolean> {
  const res = await q.query(`DELETE FROM sys.sys_career_path_steps WHERE career_path_step_id = $1`, [id]);
  return (res.rowCount ?? 0) === 1;
}
