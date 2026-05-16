/**
 * apps/api/src/modules/blueprint-families/repository.ts
 * Global catalog (no tenant). Unique code.
 */
import type { Pool, PoolClient } from "pg";
import type {
  BlueprintFamily, BlueprintFamilyListQuery,
  CreateBlueprintFamilyBody, UpdateBlueprintFamilyBody,
} from "@heuresys/shared";

export type DbConnector = Pool | PoolClient;

interface Row {
  blueprint_family_id: string; blueprint_family_code: string;
  blueprint_family_name: string; blueprint_family_description: string | null;
  blueprint_family_metadata: Record<string, unknown>;
  created_at: Date; updated_at: Date;
}

const COLS = `blueprint_family_id, blueprint_family_code, blueprint_family_name,
  blueprint_family_description, blueprint_family_metadata, created_at, updated_at`;

function toFam(r: Row): BlueprintFamily {
  return {
    blueprintFamilyId: r.blueprint_family_id,
    code: r.blueprint_family_code, name: r.blueprint_family_name,
    description: r.blueprint_family_description, metadata: r.blueprint_family_metadata,
    createdAt: r.created_at.toISOString(), updatedAt: r.updated_at.toISOString(),
  };
}

export async function listFamilies(
  q: DbConnector, query: BlueprintFamilyListQuery,
): Promise<{ items: BlueprintFamily[]; total: number }> {
  const where: string[] = []; const params: unknown[] = [];
  if (query.search) { params.push(`%${query.search}%`); where.push(`(blueprint_family_name ILIKE $${params.length} OR blueprint_family_code ILIKE $${params.length})`); }
  const w = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const tr = await q.query<{ total: string }>(`SELECT count(*)::text AS total FROM sys.sys_blueprint_families ${w}`, params);
  params.push(query.limit); const lim = params.length;
  params.push(query.offset); const off = params.length;
  const res = await q.query<Row>(
    `SELECT ${COLS} FROM sys.sys_blueprint_families ${w}
      ORDER BY blueprint_family_code LIMIT $${lim} OFFSET $${off}`, params,
  );
  return { items: res.rows.map(toFam), total: Number(tr.rows[0]?.total ?? 0) };
}

export async function findFamilyById(q: DbConnector, id: string): Promise<BlueprintFamily | null> {
  const res = await q.query<Row>(`SELECT ${COLS} FROM sys.sys_blueprint_families WHERE blueprint_family_id = $1`, [id]);
  return res.rows[0] ? toFam(res.rows[0]) : null;
}

export async function findFamilyByCode(q: DbConnector, code: string): Promise<BlueprintFamily | null> {
  const res = await q.query<Row>(`SELECT ${COLS} FROM sys.sys_blueprint_families WHERE blueprint_family_code = $1`, [code]);
  return res.rows[0] ? toFam(res.rows[0]) : null;
}

export async function insertFamily(q: DbConnector, body: CreateBlueprintFamilyBody): Promise<BlueprintFamily> {
  const res = await q.query<Row>(
    `INSERT INTO sys.sys_blueprint_families (
        blueprint_family_code, blueprint_family_name,
        blueprint_family_description, blueprint_family_metadata
      ) VALUES ($1, $2, $3, $4::jsonb) RETURNING ${COLS}`,
    [body.code, body.name, body.description ?? null, JSON.stringify(body.metadata ?? {})],
  );
  return toFam(res.rows[0]!);
}

export async function updateFamilyPartial(
  q: DbConnector, id: string, patch: UpdateBlueprintFamilyBody,
): Promise<BlueprintFamily | null> {
  const sets: string[] = []; const params: unknown[] = [];
  const add = (col: string, v: unknown) => { params.push(v); sets.push(`${col} = $${params.length}`); };
  if (patch.name !== undefined) add("blueprint_family_name", patch.name);
  if (patch.description !== undefined) add("blueprint_family_description", patch.description);
  if (patch.metadata !== undefined) { params.push(JSON.stringify(patch.metadata)); sets.push(`blueprint_family_metadata = $${params.length}::jsonb`); }
  if (sets.length === 0) return findFamilyById(q, id);
  sets.push(`updated_at = now()`);
  params.push(id);
  const res = await q.query<Row>(
    `UPDATE sys.sys_blueprint_families SET ${sets.join(", ")}
      WHERE blueprint_family_id = $${params.length} RETURNING ${COLS}`, params,
  );
  return res.rows[0] ? toFam(res.rows[0]) : null;
}

export async function deleteFamily(q: DbConnector, id: string): Promise<boolean> {
  const res = await q.query(`DELETE FROM sys.sys_blueprint_families WHERE blueprint_family_id = $1`, [id]);
  return (res.rowCount ?? 0) === 1;
}

export async function familyHasVariants(q: DbConnector, id: string): Promise<boolean> {
  const res = await q.query<{ x: number }>(
    `SELECT 1 AS x FROM sys.sys_blueprint_variants WHERE blueprint_variant_family_id = $1 LIMIT 1`, [id],
  );
  return res.rows.length > 0;
}
