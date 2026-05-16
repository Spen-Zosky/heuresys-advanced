/**
 * apps/api/src/modules/activity-classifications/repository.ts
 * Global catalog (no tenant). Unique (scheme, code).
 */
import type { Pool, PoolClient } from "pg";
import type {
  ActivityClassification, ActivityClassScheme, ActivityClassificationListQuery,
  CreateActivityClassificationBody, UpdateActivityClassificationBody,
} from "@heuresys/shared";

export type DbConnector = Pool | PoolClient;

interface Row {
  activity_classification_id: string;
  activity_classification_scheme: ActivityClassScheme;
  activity_classification_code: string;
  activity_classification_parent_code: string | null;
  activity_classification_name: string;
  activity_classification_description: string | null;
  activity_classification_level: number | null;
  activity_classification_metadata: Record<string, unknown>;
  created_at: Date; updated_at: Date;
}

const COLS = `activity_classification_id, activity_classification_scheme,
  activity_classification_code, activity_classification_parent_code,
  activity_classification_name, activity_classification_description,
  activity_classification_level, activity_classification_metadata,
  created_at, updated_at`;

function toAc(r: Row): ActivityClassification {
  return {
    activityClassificationId: r.activity_classification_id,
    scheme: r.activity_classification_scheme,
    code: r.activity_classification_code,
    parentCode: r.activity_classification_parent_code,
    name: r.activity_classification_name,
    description: r.activity_classification_description,
    level: r.activity_classification_level,
    metadata: r.activity_classification_metadata,
    createdAt: r.created_at.toISOString(),
    updatedAt: r.updated_at.toISOString(),
  };
}

export async function listAc(
  q: DbConnector, query: ActivityClassificationListQuery,
): Promise<{ items: ActivityClassification[]; total: number }> {
  const where: string[] = []; const params: unknown[] = [];
  if (query.scheme) { params.push(query.scheme); where.push(`activity_classification_scheme = $${params.length}`); }
  if (query.parentCode) { params.push(query.parentCode); where.push(`activity_classification_parent_code = $${params.length}`); }
  if (query.search) { params.push(`%${query.search}%`); where.push(`(activity_classification_name ILIKE $${params.length} OR activity_classification_code ILIKE $${params.length})`); }
  const w = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const tr = await q.query<{ total: string }>(`SELECT count(*)::text AS total FROM sys.sys_activity_classifications ${w}`, params);
  params.push(query.limit); const lim = params.length;
  params.push(query.offset); const off = params.length;
  const res = await q.query<Row>(
    `SELECT ${COLS} FROM sys.sys_activity_classifications ${w}
      ORDER BY activity_classification_scheme, activity_classification_code
      LIMIT $${lim} OFFSET $${off}`, params,
  );
  return { items: res.rows.map(toAc), total: Number(tr.rows[0]?.total ?? 0) };
}

export async function findAcById(q: DbConnector, id: string): Promise<ActivityClassification | null> {
  const res = await q.query<Row>(`SELECT ${COLS} FROM sys.sys_activity_classifications WHERE activity_classification_id = $1`, [id]);
  return res.rows[0] ? toAc(res.rows[0]) : null;
}

export async function findAcBySchemeCode(
  q: DbConnector, scheme: string, code: string,
): Promise<ActivityClassification | null> {
  const res = await q.query<Row>(
    `SELECT ${COLS} FROM sys.sys_activity_classifications
      WHERE activity_classification_scheme = $1 AND activity_classification_code = $2`,
    [scheme, code],
  );
  return res.rows[0] ? toAc(res.rows[0]) : null;
}

export async function insertAc(q: DbConnector, body: CreateActivityClassificationBody): Promise<ActivityClassification> {
  const res = await q.query<Row>(
    `INSERT INTO sys.sys_activity_classifications (
        activity_classification_scheme, activity_classification_code,
        activity_classification_parent_code, activity_classification_name,
        activity_classification_description, activity_classification_level,
        activity_classification_metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb) RETURNING ${COLS}`,
    [body.scheme, body.code, body.parentCode ?? null, body.name,
     body.description ?? null, body.level ?? null, JSON.stringify(body.metadata ?? {})],
  );
  return toAc(res.rows[0]!);
}

export async function updateAcPartial(
  q: DbConnector, id: string, patch: UpdateActivityClassificationBody,
): Promise<ActivityClassification | null> {
  const sets: string[] = []; const params: unknown[] = [];
  const add = (col: string, v: unknown) => { params.push(v); sets.push(`${col} = $${params.length}`); };
  if (patch.name !== undefined) add("activity_classification_name", patch.name);
  if (patch.description !== undefined) add("activity_classification_description", patch.description);
  if (patch.parentCode !== undefined) add("activity_classification_parent_code", patch.parentCode);
  if (patch.level !== undefined) add("activity_classification_level", patch.level);
  if (patch.metadata !== undefined) { params.push(JSON.stringify(patch.metadata)); sets.push(`activity_classification_metadata = $${params.length}::jsonb`); }
  if (sets.length === 0) return findAcById(q, id);
  sets.push(`updated_at = now()`);
  params.push(id);
  const res = await q.query<Row>(
    `UPDATE sys.sys_activity_classifications SET ${sets.join(", ")}
      WHERE activity_classification_id = $${params.length} RETURNING ${COLS}`, params,
  );
  return res.rows[0] ? toAc(res.rows[0]) : null;
}

export async function deleteAc(q: DbConnector, id: string): Promise<boolean> {
  const res = await q.query(`DELETE FROM sys.sys_activity_classifications WHERE activity_classification_id = $1`, [id]);
  return (res.rowCount ?? 0) === 1;
}
