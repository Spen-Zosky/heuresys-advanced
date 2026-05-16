/**
 * apps/api/src/modules/career-paths/repository.ts
 * Raw SQL for sys.sys_career_paths. Global+tenant visibility.
 */

import type { Pool, PoolClient } from "pg";
import type {
  CareerPath,
  CareerPathKind,
  CareerPathListQuery,
  CreateCareerPathBody,
  UpdateCareerPathBody,
} from "@heuresys/shared";

export type DbConnector = Pool | PoolClient;

interface Row {
  career_path_id: string;
  career_path_tenant_id: string | null;
  career_path_code: string;
  career_path_name: string;
  career_path_description: string | null;
  career_path_kind: CareerPathKind;
  career_path_is_global: boolean;
  career_path_metadata: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

const COLS = `career_path_id, career_path_tenant_id, career_path_code,
  career_path_name, career_path_description, career_path_kind,
  career_path_is_global, career_path_metadata, created_at, updated_at`;

function toCp(r: Row): CareerPath {
  return {
    careerPathId: r.career_path_id,
    tenantId: r.career_path_tenant_id,
    code: r.career_path_code,
    name: r.career_path_name,
    description: r.career_path_description,
    kind: r.career_path_kind,
    isGlobal: r.career_path_is_global,
    metadata: r.career_path_metadata,
    createdAt: r.created_at.toISOString(),
    updatedAt: r.updated_at.toISOString(),
  };
}

export async function listCareerPaths(
  q: DbConnector,
  filter: { tenantId?: string; query: CareerPathListQuery },
): Promise<{ items: CareerPath[]; total: number }> {
  const where: string[] = [];
  const params: unknown[] = [];
  if (filter.tenantId) {
    params.push(filter.tenantId);
    where.push(`(career_path_is_global = true OR career_path_tenant_id = $${params.length})`);
  }
  if (filter.query.isGlobal !== undefined) {
    params.push(filter.query.isGlobal);
    where.push(`career_path_is_global = $${params.length}`);
  }
  if (filter.query.kind) {
    params.push(filter.query.kind);
    where.push(`career_path_kind = $${params.length}`);
  }
  if (filter.query.search) {
    params.push(`%${filter.query.search}%`);
    where.push(`(career_path_name ILIKE $${params.length} OR career_path_code ILIKE $${params.length})`);
  }
  const whereClause = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";

  const totalRow = await q.query<{ total: string }>(
    `SELECT count(*)::text AS total FROM sys.sys_career_paths ${whereClause}`,
    params,
  );
  const total = Number(totalRow.rows[0]?.total ?? 0);

  params.push(filter.query.limit);
  const lim = params.length;
  params.push(filter.query.offset);
  const off = params.length;
  const res = await q.query<Row>(
    `SELECT ${COLS} FROM sys.sys_career_paths ${whereClause}
      ORDER BY career_path_name LIMIT $${lim} OFFSET $${off}`,
    params,
  );
  return { items: res.rows.map(toCp), total };
}

export async function findCareerPathById(q: DbConnector, id: string): Promise<CareerPath | null> {
  const res = await q.query<Row>(
    `SELECT ${COLS} FROM sys.sys_career_paths WHERE career_path_id = $1`, [id],
  );
  return res.rows[0] ? toCp(res.rows[0]) : null;
}

export async function findCareerPathByCodeInScope(
  q: DbConnector,
  tenantId: string | null,
  code: string,
): Promise<CareerPath | null> {
  const res = await q.query<Row>(
    `SELECT ${COLS} FROM sys.sys_career_paths
      WHERE COALESCE(career_path_tenant_id, '00000000-0000-0000-0000-000000000000'::uuid)
            = COALESCE($1::uuid, '00000000-0000-0000-0000-000000000000'::uuid)
        AND career_path_code = $2`,
    [tenantId, code],
  );
  return res.rows[0] ? toCp(res.rows[0]) : null;
}

export async function insertCareerPath(
  q: DbConnector,
  tenantId: string | null,
  body: CreateCareerPathBody,
  createdBy: string,
): Promise<CareerPath> {
  const res = await q.query<Row>(
    `INSERT INTO sys.sys_career_paths (
        career_path_tenant_id, career_path_code, career_path_name,
        career_path_description, career_path_kind, career_path_is_global,
        career_path_metadata, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8)
      RETURNING ${COLS}`,
    [
      tenantId,
      body.code,
      body.name,
      body.description ?? null,
      body.kind,
      body.isGlobal,
      JSON.stringify(body.metadata ?? {}),
      createdBy,
    ],
  );
  return toCp(res.rows[0]!);
}

export async function updateCareerPathPartial(
  q: DbConnector,
  id: string,
  patch: UpdateCareerPathBody,
  updatedBy: string,
): Promise<CareerPath | null> {
  const sets: string[] = [];
  const params: unknown[] = [];
  const addSet = (col: string, value: unknown) => {
    params.push(value);
    sets.push(`${col} = $${params.length}`);
  };
  if (patch.name !== undefined) addSet("career_path_name", patch.name);
  if (patch.description !== undefined) addSet("career_path_description", patch.description);
  if (patch.kind !== undefined) addSet("career_path_kind", patch.kind);
  if (patch.metadata !== undefined) {
    params.push(JSON.stringify(patch.metadata));
    sets.push(`career_path_metadata = $${params.length}::jsonb`);
  }
  if (sets.length === 0) return findCareerPathById(q, id);
  sets.push(`updated_at = now()`);
  params.push(updatedBy);
  sets.push(`updated_by = $${params.length}`);
  params.push(id);
  const res = await q.query<Row>(
    `UPDATE sys.sys_career_paths SET ${sets.join(", ")}
      WHERE career_path_id = $${params.length}
      RETURNING ${COLS}`,
    params,
  );
  return res.rows[0] ? toCp(res.rows[0]) : null;
}

export async function careerPathHasSteps(q: DbConnector, id: string): Promise<boolean> {
  const res = await q.query<{ x: number }>(
    `SELECT 1 AS x FROM sys.sys_career_path_steps WHERE career_path_step_path_id = $1 LIMIT 1`,
    [id],
  );
  return res.rows.length > 0;
}

export async function deleteCareerPath(q: DbConnector, id: string): Promise<boolean> {
  const res = await q.query(`DELETE FROM sys.sys_career_paths WHERE career_path_id = $1`, [id]);
  return (res.rowCount ?? 0) === 1;
}
