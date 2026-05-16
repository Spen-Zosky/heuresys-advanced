/**
 * apps/api/src/modules/blueprint-variants/repository.ts
 * Global catalog. Unique variant code.
 */
import type { Pool, PoolClient } from "pg";
import type {
  BlueprintVariant, BlueprintVariantListQuery,
  CreateBlueprintVariantBody, UpdateBlueprintVariantBody,
} from "@heuresys/shared";

export type DbConnector = Pool | PoolClient;

interface Row {
  blueprint_variant_id: string; blueprint_variant_family_id: string;
  blueprint_variant_code: string; blueprint_variant_name: string;
  blueprint_variant_description: string | null;
  blueprint_variant_size_band_id: string | null;
  blueprint_variant_metadata: Record<string, unknown>;
  created_at: Date; updated_at: Date;
}

const COLS = `blueprint_variant_id, blueprint_variant_family_id, blueprint_variant_code,
  blueprint_variant_name, blueprint_variant_description, blueprint_variant_size_band_id,
  blueprint_variant_metadata, created_at, updated_at`;

function toVar(r: Row): BlueprintVariant {
  return {
    blueprintVariantId: r.blueprint_variant_id,
    familyId: r.blueprint_variant_family_id,
    code: r.blueprint_variant_code, name: r.blueprint_variant_name,
    description: r.blueprint_variant_description,
    sizeBandId: r.blueprint_variant_size_band_id,
    metadata: r.blueprint_variant_metadata,
    createdAt: r.created_at.toISOString(),
    updatedAt: r.updated_at.toISOString(),
  };
}

export async function listVariants(
  q: DbConnector, query: BlueprintVariantListQuery,
): Promise<{ items: BlueprintVariant[]; total: number }> {
  const where: string[] = []; const params: unknown[] = [];
  if (query.familyId) { params.push(query.familyId); where.push(`blueprint_variant_family_id = $${params.length}`); }
  if (query.sizeBandId) { params.push(query.sizeBandId); where.push(`blueprint_variant_size_band_id = $${params.length}`); }
  if (query.search) { params.push(`%${query.search}%`); where.push(`(blueprint_variant_name ILIKE $${params.length} OR blueprint_variant_code ILIKE $${params.length})`); }
  const w = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const tr = await q.query<{ total: string }>(`SELECT count(*)::text AS total FROM sys.sys_blueprint_variants ${w}`, params);
  params.push(query.limit); const lim = params.length;
  params.push(query.offset); const off = params.length;
  const res = await q.query<Row>(
    `SELECT ${COLS} FROM sys.sys_blueprint_variants ${w}
      ORDER BY blueprint_variant_code LIMIT $${lim} OFFSET $${off}`, params,
  );
  return { items: res.rows.map(toVar), total: Number(tr.rows[0]?.total ?? 0) };
}

export async function findVariantById(q: DbConnector, id: string): Promise<BlueprintVariant | null> {
  const res = await q.query<Row>(`SELECT ${COLS} FROM sys.sys_blueprint_variants WHERE blueprint_variant_id = $1`, [id]);
  return res.rows[0] ? toVar(res.rows[0]) : null;
}

export async function findVariantByCode(q: DbConnector, code: string): Promise<BlueprintVariant | null> {
  const res = await q.query<Row>(`SELECT ${COLS} FROM sys.sys_blueprint_variants WHERE blueprint_variant_code = $1`, [code]);
  return res.rows[0] ? toVar(res.rows[0]) : null;
}

export async function familyExists(q: DbConnector, id: string): Promise<boolean> {
  const res = await q.query<{ x: number }>(`SELECT 1 AS x FROM sys.sys_blueprint_families WHERE blueprint_family_id = $1 LIMIT 1`, [id]);
  return res.rows.length > 0;
}

export async function sizeBandExists(q: DbConnector, id: string): Promise<boolean> {
  const res = await q.query<{ x: number }>(`SELECT 1 AS x FROM sys.sys_enterprise_size_bands WHERE enterprise_size_band_id = $1 LIMIT 1`, [id]);
  return res.rows.length > 0;
}

export async function insertVariant(q: DbConnector, body: CreateBlueprintVariantBody): Promise<BlueprintVariant> {
  const res = await q.query<Row>(
    `INSERT INTO sys.sys_blueprint_variants (
        blueprint_variant_family_id, blueprint_variant_code, blueprint_variant_name,
        blueprint_variant_description, blueprint_variant_size_band_id, blueprint_variant_metadata
      ) VALUES ($1, $2, $3, $4, $5, $6::jsonb) RETURNING ${COLS}`,
    [body.familyId, body.code, body.name, body.description ?? null,
     body.sizeBandId ?? null, JSON.stringify(body.metadata ?? {})],
  );
  return toVar(res.rows[0]!);
}

export async function updateVariantPartial(
  q: DbConnector, id: string, patch: UpdateBlueprintVariantBody,
): Promise<BlueprintVariant | null> {
  const sets: string[] = []; const params: unknown[] = [];
  const add = (col: string, v: unknown) => { params.push(v); sets.push(`${col} = $${params.length}`); };
  if (patch.name !== undefined) add("blueprint_variant_name", patch.name);
  if (patch.description !== undefined) add("blueprint_variant_description", patch.description);
  if (patch.sizeBandId !== undefined) add("blueprint_variant_size_band_id", patch.sizeBandId);
  if (patch.metadata !== undefined) { params.push(JSON.stringify(patch.metadata)); sets.push(`blueprint_variant_metadata = $${params.length}::jsonb`); }
  if (sets.length === 0) return findVariantById(q, id);
  sets.push(`updated_at = now()`);
  params.push(id);
  const res = await q.query<Row>(
    `UPDATE sys.sys_blueprint_variants SET ${sets.join(", ")}
      WHERE blueprint_variant_id = $${params.length} RETURNING ${COLS}`, params,
  );
  return res.rows[0] ? toVar(res.rows[0]) : null;
}

export async function deleteVariant(q: DbConnector, id: string): Promise<boolean> {
  const res = await q.query(`DELETE FROM sys.sys_blueprint_variants WHERE blueprint_variant_id = $1`, [id]);
  return (res.rowCount ?? 0) === 1;
}
