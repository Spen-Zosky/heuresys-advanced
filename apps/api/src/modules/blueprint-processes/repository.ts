/**
 * apps/api/src/modules/blueprint-processes/repository.ts
 * Process registry rows scoped to a variant. Unique (variant_id, code).
 */
import type { Pool, PoolClient } from "pg";
import type {
  BlueprintProcess, BlueprintProcessListQuery,
  CreateBlueprintProcessBody, UpdateBlueprintProcessBody,
} from "@heuresys/shared";

export type DbConnector = Pool | PoolClient;

interface Row {
  blueprint_process_id: string; blueprint_process_variant_id: string;
  blueprint_process_code: string; blueprint_process_name: string;
  blueprint_process_ordinal: number; blueprint_process_description: string | null;
  blueprint_process_is_optional: boolean;
  blueprint_process_metadata: Record<string, unknown>;
  created_at: Date; updated_at: Date;
}

const COLS = `blueprint_process_id, blueprint_process_variant_id, blueprint_process_code,
  blueprint_process_name, blueprint_process_ordinal, blueprint_process_description,
  blueprint_process_is_optional, blueprint_process_metadata, created_at, updated_at`;

function toProc(r: Row): BlueprintProcess {
  return {
    blueprintProcessId: r.blueprint_process_id,
    variantId: r.blueprint_process_variant_id,
    code: r.blueprint_process_code, name: r.blueprint_process_name,
    ordinal: r.blueprint_process_ordinal,
    description: r.blueprint_process_description,
    isOptional: r.blueprint_process_is_optional,
    metadata: r.blueprint_process_metadata,
    createdAt: r.created_at.toISOString(),
    updatedAt: r.updated_at.toISOString(),
  };
}

export async function listProcesses(
  q: DbConnector, query: BlueprintProcessListQuery,
): Promise<{ items: BlueprintProcess[]; total: number }> {
  const where: string[] = []; const params: unknown[] = [];
  if (query.variantId) { params.push(query.variantId); where.push(`blueprint_process_variant_id = $${params.length}`); }
  if (query.isOptional !== undefined) { params.push(query.isOptional); where.push(`blueprint_process_is_optional = $${params.length}`); }
  const w = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const tr = await q.query<{ total: string }>(`SELECT count(*)::text AS total FROM sys.sys_blueprint_process_registry ${w}`, params);
  params.push(query.limit); const lim = params.length;
  params.push(query.offset); const off = params.length;
  const res = await q.query<Row>(
    `SELECT ${COLS} FROM sys.sys_blueprint_process_registry ${w}
      ORDER BY blueprint_process_variant_id, blueprint_process_ordinal
      LIMIT $${lim} OFFSET $${off}`, params,
  );
  return { items: res.rows.map(toProc), total: Number(tr.rows[0]?.total ?? 0) };
}

export async function findProcessById(q: DbConnector, id: string): Promise<BlueprintProcess | null> {
  const res = await q.query<Row>(`SELECT ${COLS} FROM sys.sys_blueprint_process_registry WHERE blueprint_process_id = $1`, [id]);
  return res.rows[0] ? toProc(res.rows[0]) : null;
}

export async function findProcessByVariantCode(
  q: DbConnector, variantId: string, code: string,
): Promise<BlueprintProcess | null> {
  const res = await q.query<Row>(
    `SELECT ${COLS} FROM sys.sys_blueprint_process_registry
      WHERE blueprint_process_variant_id = $1 AND blueprint_process_code = $2`,
    [variantId, code],
  );
  return res.rows[0] ? toProc(res.rows[0]) : null;
}

export async function variantExists(q: DbConnector, id: string): Promise<boolean> {
  const res = await q.query<{ x: number }>(`SELECT 1 AS x FROM sys.sys_blueprint_variants WHERE blueprint_variant_id = $1 LIMIT 1`, [id]);
  return res.rows.length > 0;
}

export async function insertProcess(q: DbConnector, body: CreateBlueprintProcessBody): Promise<BlueprintProcess> {
  const res = await q.query<Row>(
    `INSERT INTO sys.sys_blueprint_process_registry (
        blueprint_process_variant_id, blueprint_process_code, blueprint_process_name,
        blueprint_process_ordinal, blueprint_process_description,
        blueprint_process_is_optional, blueprint_process_metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb) RETURNING ${COLS}`,
    [body.variantId, body.code, body.name, body.ordinal,
     body.description ?? null, body.isOptional, JSON.stringify(body.metadata ?? {})],
  );
  return toProc(res.rows[0]!);
}

export async function updateProcessPartial(
  q: DbConnector, id: string, patch: UpdateBlueprintProcessBody,
): Promise<BlueprintProcess | null> {
  const sets: string[] = []; const params: unknown[] = [];
  const add = (col: string, v: unknown) => { params.push(v); sets.push(`${col} = $${params.length}`); };
  if (patch.name !== undefined) add("blueprint_process_name", patch.name);
  if (patch.ordinal !== undefined) add("blueprint_process_ordinal", patch.ordinal);
  if (patch.description !== undefined) add("blueprint_process_description", patch.description);
  if (patch.isOptional !== undefined) add("blueprint_process_is_optional", patch.isOptional);
  if (patch.metadata !== undefined) { params.push(JSON.stringify(patch.metadata)); sets.push(`blueprint_process_metadata = $${params.length}::jsonb`); }
  if (sets.length === 0) return findProcessById(q, id);
  sets.push(`updated_at = now()`);
  params.push(id);
  const res = await q.query<Row>(
    `UPDATE sys.sys_blueprint_process_registry SET ${sets.join(", ")}
      WHERE blueprint_process_id = $${params.length} RETURNING ${COLS}`, params,
  );
  return res.rows[0] ? toProc(res.rows[0]) : null;
}

export async function deleteProcess(q: DbConnector, id: string): Promise<boolean> {
  const res = await q.query(`DELETE FROM sys.sys_blueprint_process_registry WHERE blueprint_process_id = $1`, [id]);
  return (res.rowCount ?? 0) === 1;
}
