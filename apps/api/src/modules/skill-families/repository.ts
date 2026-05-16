/**
 * apps/api/src/modules/skill-families/repository.ts
 * Raw SQL for sys.sys_skill_families (platform-level, no tenant_id).
 */

import type { Pool, PoolClient } from "pg";
import type {
  SkillFamily,
  SkillFamilyListQuery,
  CreateSkillFamilyBody,
  UpdateSkillFamilyBody,
} from "@heuresys/shared";

export type DbConnector = Pool | PoolClient;

interface Row {
  skill_family_id: string;
  skill_family_code: string;
  skill_family_name: string;
  skill_family_description: string | null;
  skill_family_metadata: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

const COLS = `skill_family_id, skill_family_code, skill_family_name,
  skill_family_description, skill_family_metadata, created_at, updated_at`;

function toSf(r: Row): SkillFamily {
  return {
    skillFamilyId: r.skill_family_id,
    code: r.skill_family_code,
    name: r.skill_family_name,
    description: r.skill_family_description,
    metadata: r.skill_family_metadata,
    createdAt: r.created_at.toISOString(),
    updatedAt: r.updated_at.toISOString(),
  };
}

export async function listSkillFamilies(
  q: DbConnector,
  query: SkillFamilyListQuery,
): Promise<{ items: SkillFamily[]; total: number }> {
  const where: string[] = [];
  const params: unknown[] = [];
  if (query.search) {
    params.push(`%${query.search}%`);
    where.push(`(skill_family_name ILIKE $${params.length} OR skill_family_code ILIKE $${params.length})`);
  }
  const whereClause = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";

  const totalRow = await q.query<{ total: string }>(
    `SELECT count(*)::text AS total FROM sys.sys_skill_families ${whereClause}`,
    params,
  );
  const total = Number(totalRow.rows[0]?.total ?? 0);

  params.push(query.limit);
  const lim = params.length;
  params.push(query.offset);
  const off = params.length;
  const res = await q.query<Row>(
    `SELECT ${COLS} FROM sys.sys_skill_families ${whereClause}
      ORDER BY skill_family_code LIMIT $${lim} OFFSET $${off}`,
    params,
  );
  return { items: res.rows.map(toSf), total };
}

export async function findSkillFamilyById(q: DbConnector, id: string): Promise<SkillFamily | null> {
  const res = await q.query<Row>(`SELECT ${COLS} FROM sys.sys_skill_families WHERE skill_family_id = $1`, [id]);
  return res.rows[0] ? toSf(res.rows[0]) : null;
}

export async function findSkillFamilyByCode(q: DbConnector, code: string): Promise<SkillFamily | null> {
  const res = await q.query<Row>(`SELECT ${COLS} FROM sys.sys_skill_families WHERE skill_family_code = $1`, [code]);
  return res.rows[0] ? toSf(res.rows[0]) : null;
}

export async function insertSkillFamily(q: DbConnector, body: CreateSkillFamilyBody): Promise<SkillFamily> {
  const res = await q.query<Row>(
    `INSERT INTO sys.sys_skill_families (
        skill_family_code, skill_family_name, skill_family_description, skill_family_metadata
      ) VALUES ($1, $2, $3, $4::jsonb)
      RETURNING ${COLS}`,
    [body.code, body.name, body.description ?? null, JSON.stringify(body.metadata ?? {})],
  );
  return toSf(res.rows[0]!);
}

export async function updateSkillFamilyPartial(
  q: DbConnector,
  id: string,
  patch: UpdateSkillFamilyBody,
): Promise<SkillFamily | null> {
  const sets: string[] = [];
  const params: unknown[] = [];
  const addSet = (col: string, value: unknown) => {
    params.push(value);
    sets.push(`${col} = $${params.length}`);
  };
  if (patch.name !== undefined) addSet("skill_family_name", patch.name);
  if (patch.description !== undefined) addSet("skill_family_description", patch.description);
  if (patch.metadata !== undefined) {
    params.push(JSON.stringify(patch.metadata));
    sets.push(`skill_family_metadata = $${params.length}::jsonb`);
  }
  if (sets.length === 0) return findSkillFamilyById(q, id);
  sets.push(`updated_at = now()`);
  params.push(id);
  const res = await q.query<Row>(
    `UPDATE sys.sys_skill_families SET ${sets.join(", ")}
      WHERE skill_family_id = $${params.length}
      RETURNING ${COLS}`,
    params,
  );
  return res.rows[0] ? toSf(res.rows[0]) : null;
}

export async function deleteSkillFamily(q: DbConnector, id: string): Promise<boolean> {
  const res = await q.query(`DELETE FROM sys.sys_skill_families WHERE skill_family_id = $1`, [id]);
  return (res.rowCount ?? 0) === 1;
}
