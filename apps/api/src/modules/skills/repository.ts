/**
 * apps/api/src/modules/skills/repository.ts
 * Raw SQL for sys.sys_skills.
 */

import type { Pool, PoolClient } from "pg";
import type {
  Skill,
  SkillListQuery,
  CreateSkillBody,
  UpdateSkillBody,
} from "@heuresys/shared";

export type DbConnector = Pool | PoolClient;

interface Row {
  skill_id: string;
  skill_tenant_id: string | null;
  skill_category_id: string | null;
  skill_code: string;
  skill_name: string;
  skill_description: string | null;
  skill_esco_uri: string | null;
  skill_is_global: boolean;
  skill_metadata: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

const COLS = `skill_id, skill_tenant_id, skill_category_id, skill_code,
  skill_name, skill_description, skill_esco_uri, skill_is_global,
  skill_metadata, created_at, updated_at`;

function toSkill(r: Row): Skill {
  return {
    skillId: r.skill_id,
    tenantId: r.skill_tenant_id,
    categoryId: r.skill_category_id,
    code: r.skill_code,
    name: r.skill_name,
    description: r.skill_description,
    escoUri: r.skill_esco_uri,
    isGlobal: r.skill_is_global,
    metadata: r.skill_metadata,
    createdAt: r.created_at.toISOString(),
    updatedAt: r.updated_at.toISOString(),
  };
}

/**
 * Visibility filter: returns skills where
 *   skill_is_global = true  (visible to all authenticated)
 *   OR skill_tenant_id = $tenantId (own tenant)
 * For PLATFORM_ADMIN, pass tenantId=undefined → no tenant filter.
 */
export interface ListFilter {
  tenantId?: string;
  query: SkillListQuery;
}

export async function listSkills(
  q: DbConnector,
  filter: ListFilter,
): Promise<{ items: Skill[]; total: number }> {
  const where: string[] = [];
  const params: unknown[] = [];
  if (filter.tenantId) {
    params.push(filter.tenantId);
    where.push(`(skill_is_global = true OR skill_tenant_id = $${params.length})`);
  }
  if (filter.query.isGlobal !== undefined) {
    params.push(filter.query.isGlobal);
    where.push(`skill_is_global = $${params.length}`);
  }
  if (filter.query.categoryId) {
    params.push(filter.query.categoryId);
    where.push(`skill_category_id = $${params.length}`);
  }
  if (filter.query.search) {
    params.push(`%${filter.query.search}%`);
    where.push(`(skill_name ILIKE $${params.length} OR skill_code ILIKE $${params.length})`);
  }
  const whereClause = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";

  const totalRow = await q.query<{ total: string }>(
    `SELECT count(*)::text AS total FROM sys.sys_skills ${whereClause}`,
    params,
  );
  const total = Number(totalRow.rows[0]?.total ?? 0);

  params.push(filter.query.limit);
  const limIdx = params.length;
  params.push(filter.query.offset);
  const offIdx = params.length;

  const res = await q.query<Row>(
    `SELECT ${COLS} FROM sys.sys_skills ${whereClause}
      ORDER BY skill_name LIMIT $${limIdx} OFFSET $${offIdx}`,
    params,
  );
  return { items: res.rows.map(toSkill), total };
}

export async function findSkillById(q: DbConnector, id: string): Promise<Skill | null> {
  const res = await q.query<Row>(
    `SELECT ${COLS} FROM sys.sys_skills WHERE skill_id = $1`,
    [id],
  );
  return res.rows[0] ? toSkill(res.rows[0]) : null;
}

export async function findSkillByCodeInScope(
  q: DbConnector,
  tenantId: string | null,
  code: string,
): Promise<Skill | null> {
  // Mirrors the partial unique index COALESCE(skill_tenant_id, zero-uuid),
  // skill_code) so we can produce a clean 409 before the DB throws.
  const res = await q.query<Row>(
    `SELECT ${COLS} FROM sys.sys_skills
      WHERE COALESCE(skill_tenant_id, '00000000-0000-0000-0000-000000000000'::uuid)
            = COALESCE($1::uuid, '00000000-0000-0000-0000-000000000000'::uuid)
        AND skill_code = $2`,
    [tenantId, code],
  );
  return res.rows[0] ? toSkill(res.rows[0]) : null;
}

export async function insertSkill(
  q: DbConnector,
  tenantId: string | null,
  body: CreateSkillBody,
  createdBy: string,
): Promise<Skill> {
  const res = await q.query<Row>(
    `INSERT INTO sys.sys_skills (
        skill_tenant_id, skill_category_id, skill_code, skill_name,
        skill_description, skill_esco_uri, skill_is_global,
        skill_metadata, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9)
      RETURNING ${COLS}`,
    [
      tenantId,
      body.categoryId ?? null,
      body.code,
      body.name,
      body.description ?? null,
      body.escoUri ?? null,
      body.isGlobal,
      JSON.stringify(body.metadata ?? {}),
      createdBy,
    ],
  );
  return toSkill(res.rows[0]!);
}

export async function updateSkillPartial(
  q: DbConnector,
  id: string,
  patch: UpdateSkillBody,
  updatedBy: string,
): Promise<Skill | null> {
  const sets: string[] = [];
  const params: unknown[] = [];
  const addSet = (col: string, value: unknown) => {
    params.push(value);
    sets.push(`${col} = $${params.length}`);
  };
  if (patch.name !== undefined) addSet("skill_name", patch.name);
  if (patch.description !== undefined) addSet("skill_description", patch.description);
  if (patch.categoryId !== undefined) addSet("skill_category_id", patch.categoryId);
  if (patch.escoUri !== undefined) addSet("skill_esco_uri", patch.escoUri);
  if (patch.metadata !== undefined) {
    params.push(JSON.stringify(patch.metadata));
    sets.push(`skill_metadata = $${params.length}::jsonb`);
  }
  if (sets.length === 0) return findSkillById(q, id);
  sets.push(`updated_at = now()`);
  params.push(updatedBy);
  sets.push(`updated_by = $${params.length}`);
  params.push(id);
  const res = await q.query<Row>(
    `UPDATE sys.sys_skills SET ${sets.join(", ")}
      WHERE skill_id = $${params.length}
      RETURNING ${COLS}`,
    params,
  );
  return res.rows[0] ? toSkill(res.rows[0]) : null;
}
