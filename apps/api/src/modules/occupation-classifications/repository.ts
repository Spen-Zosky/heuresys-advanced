/**
 * apps/api/src/modules/occupation-classifications/repository.ts
 * Global occupation catalog ISCO-08 + CP2021 (no tenant). Unique (scheme, code).
 * Mirrors activity-classifications (asse ATTIVITÀ ↔ asse PROFESSIONE).
 */
import type { Pool, PoolClient } from "pg";
import type {
  OccupationClassification, OccupationClassScheme, OccupationClassificationListQuery,
  CreateOccupationClassificationBody, UpdateOccupationClassificationBody,
} from "@heuresys/shared";

export type DbConnector = Pool | PoolClient;

interface Row {
  occupation_classification_id: string;
  occupation_classification_scheme: OccupationClassScheme;
  occupation_classification_code: string;
  occupation_classification_parent_code: string | null;
  occupation_classification_name: string;
  occupation_classification_description: string | null;
  occupation_classification_level: number | null;
  occupation_classification_metadata: Record<string, unknown>;
  created_at: Date; updated_at: Date;
}

const COLS = `occupation_classification_id, occupation_classification_scheme,
  occupation_classification_code, occupation_classification_parent_code,
  occupation_classification_name, occupation_classification_description,
  occupation_classification_level, occupation_classification_metadata,
  created_at, updated_at`;

function toOc(r: Row): OccupationClassification {
  return {
    occupationClassificationId: r.occupation_classification_id,
    scheme: r.occupation_classification_scheme,
    code: r.occupation_classification_code,
    parentCode: r.occupation_classification_parent_code,
    name: r.occupation_classification_name,
    description: r.occupation_classification_description,
    level: r.occupation_classification_level,
    metadata: r.occupation_classification_metadata,
    createdAt: r.created_at.toISOString(),
    updatedAt: r.updated_at.toISOString(),
  };
}

export async function listOc(
  q: DbConnector, query: OccupationClassificationListQuery,
): Promise<{ items: OccupationClassification[]; total: number }> {
  const where: string[] = []; const params: unknown[] = [];
  if (query.scheme) { params.push(query.scheme); where.push(`occupation_classification_scheme = $${params.length}`); }
  if (query.parentCode) { params.push(query.parentCode); where.push(`occupation_classification_parent_code = $${params.length}`); }
  if (query.search) { params.push(`%${query.search}%`); where.push(`(occupation_classification_name ILIKE $${params.length} OR occupation_classification_code ILIKE $${params.length})`); }
  const w = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const tr = await q.query<{ total: string }>(`SELECT count(*)::text AS total FROM sys.sys_occupation_classifications ${w}`, params);
  params.push(query.limit); const lim = params.length;
  params.push(query.offset); const off = params.length;
  const res = await q.query<Row>(
    `SELECT ${COLS} FROM sys.sys_occupation_classifications ${w}
      ORDER BY occupation_classification_scheme, occupation_classification_code
      LIMIT $${lim} OFFSET $${off}`, params,
  );
  return { items: res.rows.map(toOc), total: Number(tr.rows[0]?.total ?? 0) };
}

export async function findOcById(q: DbConnector, id: string): Promise<OccupationClassification | null> {
  const res = await q.query<Row>(`SELECT ${COLS} FROM sys.sys_occupation_classifications WHERE occupation_classification_id = $1`, [id]);
  return res.rows[0] ? toOc(res.rows[0]) : null;
}

export async function findOcBySchemeCode(
  q: DbConnector, scheme: string, code: string,
): Promise<OccupationClassification | null> {
  const res = await q.query<Row>(
    `SELECT ${COLS} FROM sys.sys_occupation_classifications
      WHERE occupation_classification_scheme = $1 AND occupation_classification_code = $2`,
    [scheme, code],
  );
  return res.rows[0] ? toOc(res.rows[0]) : null;
}

export async function insertOc(q: DbConnector, body: CreateOccupationClassificationBody): Promise<OccupationClassification> {
  const res = await q.query<Row>(
    `INSERT INTO sys.sys_occupation_classifications (
        occupation_classification_scheme, occupation_classification_code,
        occupation_classification_parent_code, occupation_classification_name,
        occupation_classification_description, occupation_classification_level,
        occupation_classification_metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb) RETURNING ${COLS}`,
    [body.scheme, body.code, body.parentCode ?? null, body.name,
     body.description ?? null, body.level ?? null, JSON.stringify(body.metadata ?? {})],
  );
  return toOc(res.rows[0]!);
}

export async function updateOcPartial(
  q: DbConnector, id: string, patch: UpdateOccupationClassificationBody,
): Promise<OccupationClassification | null> {
  const sets: string[] = []; const params: unknown[] = [];
  const add = (col: string, v: unknown) => { params.push(v); sets.push(`${col} = $${params.length}`); };
  if (patch.name !== undefined) add("occupation_classification_name", patch.name);
  if (patch.description !== undefined) add("occupation_classification_description", patch.description);
  if (patch.parentCode !== undefined) add("occupation_classification_parent_code", patch.parentCode);
  if (patch.level !== undefined) add("occupation_classification_level", patch.level);
  if (patch.metadata !== undefined) { params.push(JSON.stringify(patch.metadata)); sets.push(`occupation_classification_metadata = $${params.length}::jsonb`); }
  if (sets.length === 0) return findOcById(q, id);
  sets.push(`updated_at = now()`);
  params.push(id);
  const res = await q.query<Row>(
    `UPDATE sys.sys_occupation_classifications SET ${sets.join(", ")}
      WHERE occupation_classification_id = $${params.length} RETURNING ${COLS}`, params,
  );
  return res.rows[0] ? toOc(res.rows[0]) : null;
}

export async function deleteOc(q: DbConnector, id: string): Promise<boolean> {
  const res = await q.query(`DELETE FROM sys.sys_occupation_classifications WHERE occupation_classification_id = $1`, [id]);
  return (res.rowCount ?? 0) === 1;
}
