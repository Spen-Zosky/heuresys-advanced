/**
 * apps/api/src/modules/skill-categories/repository.ts
 * Raw SQL for sys.sys_skill_categories (FK skill_family_id).
 */

import type { Pool, PoolClient } from "pg";
import type {
  SkillCategory,
  SkillCategoryListQuery,
  CreateSkillCategoryBody,
  UpdateSkillCategoryBody,
} from "@heuresys/shared";

export type DbConnector = Pool | PoolClient;

interface Row {
  skill_category_id: string;
  skill_category_family_id: string;
  skill_category_code: string;
  skill_category_name: string;
  skill_category_description: string | null;
  skill_category_metadata: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

const COLS = `skill_category_id, skill_category_family_id, skill_category_code,
  skill_category_name, skill_category_description, skill_category_metadata,
  created_at, updated_at`;

function toSc(r: Row): SkillCategory {
  return {
    skillCategoryId: r.skill_category_id,
    familyId: r.skill_category_family_id,
    code: r.skill_category_code,
    name: r.skill_category_name,
    description: r.skill_category_description,
    metadata: r.skill_category_metadata,
    createdAt: r.created_at.toISOString(),
    updatedAt: r.updated_at.toISOString(),
  };
}

export async function listSkillCategories(
  q: DbConnector,
  query: SkillCategoryListQuery,
): Promise<{ items: SkillCategory[]; total: number }> {
  const where: string[] = [];
  const params: unknown[] = [];
  if (query.familyId) {
    params.push(query.familyId);
    where.push(`skill_category_family_id = $${params.length}`);
  }
  if (query.search) {
    params.push(`%${query.search}%`);
    where.push(`(skill_category_name ILIKE $${params.length} OR skill_category_code ILIKE $${params.length})`);
  }
  const whereClause = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";

  const totalRow = await q.query<{ total: string }>(
    `SELECT count(*)::text AS total FROM sys.sys_skill_categories ${whereClause}`,
    params,
  );
  const total = Number(totalRow.rows[0]?.total ?? 0);

  params.push(query.limit);
  const lim = params.length;
  params.push(query.offset);
  const off = params.length;
  const res = await q.query<Row>(
    `SELECT ${COLS} FROM sys.sys_skill_categories ${whereClause}
      ORDER BY skill_category_code LIMIT $${lim} OFFSET $${off}`,
    params,
  );
  return { items: res.rows.map(toSc), total };
}

export async function findSkillCategoryById(q: DbConnector, id: string): Promise<SkillCategory | null> {
  const res = await q.query<Row>(`SELECT ${COLS} FROM sys.sys_skill_categories WHERE skill_category_id = $1`, [id]);
  return res.rows[0] ? toSc(res.rows[0]) : null;
}

export async function findSkillCategoryByCode(q: DbConnector, code: string): Promise<SkillCategory | null> {
  const res = await q.query<Row>(`SELECT ${COLS} FROM sys.sys_skill_categories WHERE skill_category_code = $1`, [code]);
  return res.rows[0] ? toSc(res.rows[0]) : null;
}

export async function insertSkillCategory(q: DbConnector, body: CreateSkillCategoryBody): Promise<SkillCategory> {
  const res = await q.query<Row>(
    `INSERT INTO sys.sys_skill_categories (
        skill_category_family_id, skill_category_code, skill_category_name,
        skill_category_description, skill_category_metadata
      ) VALUES ($1, $2, $3, $4, $5::jsonb)
      RETURNING ${COLS}`,
    [body.familyId, body.code, body.name, body.description ?? null, JSON.stringify(body.metadata ?? {})],
  );
  return toSc(res.rows[0]!);
}

export async function updateSkillCategoryPartial(
  q: DbConnector,
  id: string,
  patch: UpdateSkillCategoryBody,
): Promise<SkillCategory | null> {
  const sets: string[] = [];
  const params: unknown[] = [];
  const addSet = (col: string, value: unknown) => {
    params.push(value);
    sets.push(`${col} = $${params.length}`);
  };
  if (patch.familyId !== undefined) addSet("skill_category_family_id", patch.familyId);
  if (patch.name !== undefined) addSet("skill_category_name", patch.name);
  if (patch.description !== undefined) addSet("skill_category_description", patch.description);
  if (patch.metadata !== undefined) {
    params.push(JSON.stringify(patch.metadata));
    sets.push(`skill_category_metadata = $${params.length}::jsonb`);
  }
  if (sets.length === 0) return findSkillCategoryById(q, id);
  sets.push(`updated_at = now()`);
  params.push(id);
  const res = await q.query<Row>(
    `UPDATE sys.sys_skill_categories SET ${sets.join(", ")}
      WHERE skill_category_id = $${params.length}
      RETURNING ${COLS}`,
    params,
  );
  return res.rows[0] ? toSc(res.rows[0]) : null;
}

export async function deleteSkillCategory(q: DbConnector, id: string): Promise<boolean> {
  const res = await q.query(`DELETE FROM sys.sys_skill_categories WHERE skill_category_id = $1`, [id]);
  return (res.rowCount ?? 0) === 1;
}

export async function familyExists(q: DbConnector, familyId: string): Promise<boolean> {
  const res = await q.query<{ x: number }>(
    `SELECT 1 AS x FROM sys.sys_skill_families WHERE skill_family_id = $1 LIMIT 1`,
    [familyId],
  );
  return res.rows.length > 0;
}

export async function countSkillsInCategory(q: DbConnector, categoryId: string): Promise<number> {
  const res = await q.query<{ n: string }>(
    `SELECT count(*)::text AS n FROM sys.sys_skills WHERE skill_category_id = $1`,
    [categoryId],
  );
  return Number(res.rows[0]?.n ?? 0);
}
