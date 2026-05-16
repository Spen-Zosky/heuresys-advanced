/**
 * apps/api/src/modules/skill-aliases/repository.ts
 * Raw SQL for sys.sys_skill_aliases.
 * Visibility filter is applied through a JOIN to sys_skills (alias inherits
 * the parent skill's scope: global OR own tenant).
 */

import type { Pool, PoolClient } from "pg";
import type {
  SkillAlias,
  SkillAliasListQuery,
  CreateSkillAliasBody,
  UpdateSkillAliasBody,
} from "@heuresys/shared";

export type DbConnector = Pool | PoolClient;

interface Row {
  skill_alias_id: string;
  skill_alias_skill_id: string;
  skill_alias_label: string;
  skill_alias_locale: string | null;
  skill_alias_metadata: Record<string, unknown>;
  created_at: Date;
}

interface SkillScopeRow {
  skill_id: string;
  skill_tenant_id: string | null;
  skill_is_global: boolean;
}

const COLS = `a.skill_alias_id, a.skill_alias_skill_id, a.skill_alias_label,
  a.skill_alias_locale, a.skill_alias_metadata, a.created_at`;

function toAlias(r: Row): SkillAlias {
  return {
    aliasId: r.skill_alias_id,
    skillId: r.skill_alias_skill_id,
    label: r.skill_alias_label,
    locale: r.skill_alias_locale,
    metadata: r.skill_alias_metadata,
    createdAt: r.created_at.toISOString(),
  };
}

export interface SkillScope {
  skillId: string;
  tenantId: string | null;
  isGlobal: boolean;
}

export async function getSkillScope(q: DbConnector, skillId: string): Promise<SkillScope | null> {
  const res = await q.query<SkillScopeRow>(
    `SELECT skill_id, skill_tenant_id, skill_is_global
       FROM sys.sys_skills WHERE skill_id = $1`,
    [skillId],
  );
  const r = res.rows[0];
  if (!r) return null;
  return { skillId: r.skill_id, tenantId: r.skill_tenant_id, isGlobal: r.skill_is_global };
}

export interface ListFilter {
  tenantId?: string; // undefined for PLATFORM_ADMIN → no filter
  query: SkillAliasListQuery;
}

function visibilityClause(params: unknown[], tenantId: string | undefined): string {
  if (!tenantId) return "";
  params.push(tenantId);
  return `(s.skill_is_global OR s.skill_tenant_id = $${params.length})`;
}

export async function listAliases(
  q: DbConnector,
  filter: ListFilter,
): Promise<{ items: SkillAlias[]; total: number }> {
  const where: string[] = [];
  const params: unknown[] = [];
  const vis = visibilityClause(params, filter.tenantId);
  if (vis) where.push(vis);
  if (filter.query.skillId) {
    params.push(filter.query.skillId);
    where.push(`a.skill_alias_skill_id = $${params.length}`);
  }
  if (filter.query.locale) {
    params.push(filter.query.locale);
    where.push(`a.skill_alias_locale = $${params.length}`);
  }
  if (filter.query.search) {
    params.push(`%${filter.query.search}%`);
    where.push(`a.skill_alias_label ILIKE $${params.length}`);
  }
  const whereClause = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";

  const totalRow = await q.query<{ total: string }>(
    `SELECT count(*)::text AS total FROM sys.sys_skill_aliases AS a
       JOIN sys.sys_skills AS s ON a.skill_alias_skill_id = s.skill_id
       ${whereClause}`,
    params,
  );
  const total = Number(totalRow.rows[0]?.total ?? 0);

  params.push(filter.query.limit);
  const lim = params.length;
  params.push(filter.query.offset);
  const off = params.length;
  const res = await q.query<Row>(
    `SELECT ${COLS} FROM sys.sys_skill_aliases AS a
       JOIN sys.sys_skills AS s ON a.skill_alias_skill_id = s.skill_id
       ${whereClause}
      ORDER BY a.skill_alias_label LIMIT $${lim} OFFSET $${off}`,
    params,
  );
  return { items: res.rows.map(toAlias), total };
}

export async function findAliasById(
  q: DbConnector,
  id: string,
  tenantId: string | undefined,
): Promise<SkillAlias | null> {
  const params: unknown[] = [id];
  const vis = visibilityClause(params, tenantId);
  const visClause = vis ? `AND ${vis}` : "";
  const res = await q.query<Row>(
    `SELECT ${COLS} FROM sys.sys_skill_aliases AS a
       JOIN sys.sys_skills AS s ON a.skill_alias_skill_id = s.skill_id
      WHERE a.skill_alias_id = $1 ${visClause}`,
    params,
  );
  return res.rows[0] ? toAlias(res.rows[0]) : null;
}

export async function findAliasByLabel(
  q: DbConnector,
  skillId: string,
  label: string,
  locale: string | null,
): Promise<SkillAlias | null> {
  const res = await q.query<Row>(
    `SELECT ${COLS} FROM sys.sys_skill_aliases AS a
      WHERE a.skill_alias_skill_id = $1
        AND lower(a.skill_alias_label) = lower($2)
        AND COALESCE(a.skill_alias_locale, '') = COALESCE($3, '')`,
    [skillId, label, locale],
  );
  return res.rows[0] ? toAlias(res.rows[0]) : null;
}

export async function insertAlias(
  q: DbConnector,
  body: CreateSkillAliasBody,
): Promise<SkillAlias> {
  const res = await q.query<Row>(
    `INSERT INTO sys.sys_skill_aliases (
        skill_alias_skill_id, skill_alias_label, skill_alias_locale, skill_alias_metadata
      ) VALUES ($1, $2, $3, $4::jsonb)
      RETURNING skill_alias_id AS "skill_alias_id",
                skill_alias_skill_id AS "skill_alias_skill_id",
                skill_alias_label AS "skill_alias_label",
                skill_alias_locale AS "skill_alias_locale",
                skill_alias_metadata AS "skill_alias_metadata",
                created_at`,
    [body.skillId, body.label, body.locale ?? null, JSON.stringify(body.metadata ?? {})],
  );
  return toAlias(res.rows[0]!);
}

export async function updateAliasPartial(
  q: DbConnector,
  id: string,
  patch: UpdateSkillAliasBody,
): Promise<SkillAlias | null> {
  const sets: string[] = [];
  const params: unknown[] = [];
  const addSet = (col: string, value: unknown) => {
    params.push(value);
    sets.push(`${col} = $${params.length}`);
  };
  if (patch.label !== undefined) addSet("skill_alias_label", patch.label);
  if (patch.locale !== undefined) addSet("skill_alias_locale", patch.locale);
  if (patch.metadata !== undefined) {
    params.push(JSON.stringify(patch.metadata));
    sets.push(`skill_alias_metadata = $${params.length}::jsonb`);
  }
  if (sets.length === 0) {
    // No-op patch — re-fetch without visibility filter (caller already vetted).
    const res = await q.query<Row>(
      `SELECT ${COLS} FROM sys.sys_skill_aliases AS a WHERE a.skill_alias_id = $1`,
      [id],
    );
    return res.rows[0] ? toAlias(res.rows[0]) : null;
  }
  params.push(id);
  const res = await q.query<Row>(
    `UPDATE sys.sys_skill_aliases AS a SET ${sets.join(", ")}
      WHERE a.skill_alias_id = $${params.length}
      RETURNING skill_alias_id AS "skill_alias_id",
                skill_alias_skill_id AS "skill_alias_skill_id",
                skill_alias_label AS "skill_alias_label",
                skill_alias_locale AS "skill_alias_locale",
                skill_alias_metadata AS "skill_alias_metadata",
                created_at`,
    params,
  );
  return res.rows[0] ? toAlias(res.rows[0]) : null;
}

export async function deleteAlias(q: DbConnector, id: string): Promise<boolean> {
  const res = await q.query(`DELETE FROM sys.sys_skill_aliases WHERE skill_alias_id = $1`, [id]);
  return (res.rowCount ?? 0) === 1;
}
