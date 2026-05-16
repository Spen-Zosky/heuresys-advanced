/**
 * apps/api/src/modules/activity-classification-mappings/repository.ts
 */
import type { Pool, PoolClient } from "pg";
import type {
  ActivityClassificationMapping, ActivityMappingKind, ActivityMappingListQuery,
  CreateActivityMappingBody,
} from "@heuresys/shared";

export type DbConnector = Pool | PoolClient;

interface Row {
  activity_class_mapping_id: string;
  activity_class_mapping_source_id: string;
  activity_class_mapping_target_id: string;
  activity_class_mapping_kind: ActivityMappingKind;
  activity_class_mapping_confidence: string;
  activity_class_mapping_metadata: Record<string, unknown>;
  created_at: Date; updated_at: Date;
}

const COLS = `activity_class_mapping_id, activity_class_mapping_source_id,
  activity_class_mapping_target_id, activity_class_mapping_kind,
  activity_class_mapping_confidence, activity_class_mapping_metadata,
  created_at, updated_at`;

function toMap(r: Row): ActivityClassificationMapping {
  return {
    activityClassMappingId: r.activity_class_mapping_id,
    sourceId: r.activity_class_mapping_source_id,
    targetId: r.activity_class_mapping_target_id,
    kind: r.activity_class_mapping_kind,
    confidence: Number(r.activity_class_mapping_confidence),
    metadata: r.activity_class_mapping_metadata,
    createdAt: r.created_at.toISOString(),
    updatedAt: r.updated_at.toISOString(),
  };
}

export async function listMappings(
  q: DbConnector, query: ActivityMappingListQuery,
): Promise<{ items: ActivityClassificationMapping[]; total: number }> {
  const where: string[] = []; const params: unknown[] = [];
  if (query.sourceId) { params.push(query.sourceId); where.push(`activity_class_mapping_source_id = $${params.length}`); }
  if (query.targetId) { params.push(query.targetId); where.push(`activity_class_mapping_target_id = $${params.length}`); }
  if (query.kind) { params.push(query.kind); where.push(`activity_class_mapping_kind = $${params.length}`); }
  const w = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const tr = await q.query<{ total: string }>(`SELECT count(*)::text AS total FROM sys.sys_activity_classification_mappings ${w}`, params);
  params.push(query.limit); const lim = params.length;
  params.push(query.offset); const off = params.length;
  const res = await q.query<Row>(
    `SELECT ${COLS} FROM sys.sys_activity_classification_mappings ${w}
      ORDER BY created_at DESC LIMIT $${lim} OFFSET $${off}`, params,
  );
  return { items: res.rows.map(toMap), total: Number(tr.rows[0]?.total ?? 0) };
}

export async function findMappingById(q: DbConnector, id: string): Promise<ActivityClassificationMapping | null> {
  const res = await q.query<Row>(`SELECT ${COLS} FROM sys.sys_activity_classification_mappings WHERE activity_class_mapping_id = $1`, [id]);
  return res.rows[0] ? toMap(res.rows[0]) : null;
}

export async function findExistingMapping(
  q: DbConnector, sourceId: string, targetId: string,
): Promise<ActivityClassificationMapping | null> {
  const res = await q.query<Row>(
    `SELECT ${COLS} FROM sys.sys_activity_classification_mappings
      WHERE activity_class_mapping_source_id = $1 AND activity_class_mapping_target_id = $2`,
    [sourceId, targetId],
  );
  return res.rows[0] ? toMap(res.rows[0]) : null;
}

export async function acExists(q: DbConnector, id: string): Promise<boolean> {
  const res = await q.query<{ x: number }>(`SELECT 1 AS x FROM sys.sys_activity_classifications WHERE activity_classification_id = $1 LIMIT 1`, [id]);
  return res.rows.length > 0;
}

export async function insertMapping(q: DbConnector, body: CreateActivityMappingBody): Promise<ActivityClassificationMapping> {
  const res = await q.query<Row>(
    `INSERT INTO sys.sys_activity_classification_mappings (
        activity_class_mapping_source_id, activity_class_mapping_target_id,
        activity_class_mapping_kind, activity_class_mapping_confidence,
        activity_class_mapping_metadata
      ) VALUES ($1, $2, $3, $4, $5::jsonb) RETURNING ${COLS}`,
    [body.sourceId, body.targetId, body.kind, body.confidence, JSON.stringify(body.metadata ?? {})],
  );
  return toMap(res.rows[0]!);
}

export async function deleteMapping(q: DbConnector, id: string): Promise<boolean> {
  const res = await q.query(`DELETE FROM sys.sys_activity_classification_mappings WHERE activity_class_mapping_id = $1`, [id]);
  return (res.rowCount ?? 0) === 1;
}
