/**
 * apps/api/src/modules/position-career-paths/repository.ts
 * Many-to-many link between sys_positions and sys_career_paths.
 */

import type { Pool, PoolClient } from "pg";
import type {
  PositionCareerPath,
  PositionCareerPathListQuery,
  CreatePositionCareerPathBody,
} from "@heuresys/shared";

export type DbConnector = Pool | PoolClient;

interface Row {
  position_career_path_id: string;
  position_id: string;
  position_career_path_tenant_id: string;
  career_path_id: string;
  position_career_path_metadata: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

const COLS = `position_career_path_id, position_id, position_career_path_tenant_id,
  career_path_id, position_career_path_metadata, created_at, updated_at`;

function toLink(r: Row): PositionCareerPath {
  return {
    positionCareerPathId: r.position_career_path_id,
    positionId: r.position_id,
    tenantId: r.position_career_path_tenant_id,
    careerPathId: r.career_path_id,
    metadata: r.position_career_path_metadata,
    createdAt: r.created_at.toISOString(),
    updatedAt: r.updated_at.toISOString(),
  };
}

export async function listLinks(
  q: DbConnector,
  filter: { tenantId?: string; query: PositionCareerPathListQuery },
): Promise<{ items: PositionCareerPath[]; total: number }> {
  const where: string[] = [];
  const params: unknown[] = [];
  if (filter.tenantId) {
    params.push(filter.tenantId);
    where.push(`position_career_path_tenant_id = $${params.length}`);
  }
  if (filter.query.positionId) {
    params.push(filter.query.positionId);
    where.push(`position_id = $${params.length}`);
  }
  if (filter.query.careerPathId) {
    params.push(filter.query.careerPathId);
    where.push(`career_path_id = $${params.length}`);
  }
  const whereClause = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";

  const totalRow = await q.query<{ total: string }>(
    `SELECT count(*)::text AS total FROM sys.sys_position_career_paths ${whereClause}`,
    params,
  );
  const total = Number(totalRow.rows[0]?.total ?? 0);

  params.push(filter.query.limit);
  const lim = params.length;
  params.push(filter.query.offset);
  const off = params.length;
  const res = await q.query<Row>(
    `SELECT ${COLS} FROM sys.sys_position_career_paths ${whereClause}
      ORDER BY created_at DESC LIMIT $${lim} OFFSET $${off}`,
    params,
  );
  return { items: res.rows.map(toLink), total };
}

export async function findLinkById(q: DbConnector, id: string): Promise<PositionCareerPath | null> {
  const res = await q.query<Row>(
    `SELECT ${COLS} FROM sys.sys_position_career_paths WHERE position_career_path_id = $1`, [id],
  );
  return res.rows[0] ? toLink(res.rows[0]) : null;
}

export async function findExisting(
  q: DbConnector,
  positionId: string,
  careerPathId: string,
): Promise<PositionCareerPath | null> {
  const res = await q.query<Row>(
    `SELECT ${COLS} FROM sys.sys_position_career_paths
      WHERE position_id = $1 AND career_path_id = $2`,
    [positionId, careerPathId],
  );
  return res.rows[0] ? toLink(res.rows[0]) : null;
}

export async function positionInTenant(
  q: DbConnector,
  positionId: string,
  tenantId: string,
): Promise<{ exists: boolean; sameTenant: boolean }> {
  const res = await q.query<{ position_tenant_id: string }>(
    `SELECT position_tenant_id FROM sys.sys_positions WHERE position_id = $1`, [positionId],
  );
  if (res.rows.length === 0) return { exists: false, sameTenant: false };
  return { exists: true, sameTenant: res.rows[0]!.position_tenant_id === tenantId };
}

export async function careerPathVisibleToTenant(
  q: DbConnector,
  careerPathId: string,
  tenantId: string,
): Promise<boolean> {
  const res = await q.query<{ x: number }>(
    `SELECT 1 AS x FROM sys.sys_career_paths
      WHERE career_path_id = $1 AND (career_path_is_global = true OR career_path_tenant_id = $2)
      LIMIT 1`,
    [careerPathId, tenantId],
  );
  return res.rows.length > 0;
}

export async function insertLink(
  q: DbConnector,
  tenantId: string,
  body: CreatePositionCareerPathBody,
  createdBy: string,
): Promise<PositionCareerPath> {
  const res = await q.query<Row>(
    `INSERT INTO sys.sys_position_career_paths (
        position_id, position_career_path_tenant_id, career_path_id,
        position_career_path_metadata, created_by
      ) VALUES ($1, $2, $3, $4::jsonb, $5)
      RETURNING ${COLS}`,
    [body.positionId, tenantId, body.careerPathId, JSON.stringify(body.metadata ?? {}), createdBy],
  );
  return toLink(res.rows[0]!);
}

export async function deleteLink(q: DbConnector, id: string): Promise<boolean> {
  const res = await q.query(`DELETE FROM sys.sys_position_career_paths WHERE position_career_path_id = $1`, [id]);
  return (res.rowCount ?? 0) === 1;
}
