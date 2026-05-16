/**
 * apps/api/src/modules/operating-models/repository.ts
 */
import type { Pool, PoolClient } from "pg";
import type { OperatingModel, UpsertOperatingModelBody } from "@heuresys/shared";

export type DbConnector = Pool | PoolClient;

interface Row {
  operating_model_id: string; operating_model_code: string;
  operating_model_name: string; operating_model_description: string | null;
  operating_model_metadata: Record<string, unknown>;
  created_at: Date; updated_at: Date;
}

const COLS = `operating_model_id, operating_model_code, operating_model_name,
  operating_model_description, operating_model_metadata, created_at, updated_at`;

function toOm(r: Row): OperatingModel {
  return {
    operatingModelId: r.operating_model_id,
    code: r.operating_model_code, name: r.operating_model_name,
    description: r.operating_model_description, metadata: r.operating_model_metadata,
    createdAt: r.created_at.toISOString(), updatedAt: r.updated_at.toISOString(),
  };
}

export async function listOm(q: DbConnector): Promise<{ items: OperatingModel[]; total: number }> {
  const res = await q.query<Row>(`SELECT ${COLS} FROM sys.sys_operating_model_catalog ORDER BY operating_model_code`);
  return { items: res.rows.map(toOm), total: res.rows.length };
}

export async function findOmById(q: DbConnector, id: string): Promise<OperatingModel | null> {
  const res = await q.query<Row>(`SELECT ${COLS} FROM sys.sys_operating_model_catalog WHERE operating_model_id = $1`, [id]);
  return res.rows[0] ? toOm(res.rows[0]) : null;
}

export async function upsertOm(q: DbConnector, body: UpsertOperatingModelBody): Promise<OperatingModel> {
  const res = await q.query<Row>(
    `INSERT INTO sys.sys_operating_model_catalog (
        operating_model_code, operating_model_name,
        operating_model_description, operating_model_metadata
      ) VALUES ($1, $2, $3, $4::jsonb)
      ON CONFLICT (operating_model_code) DO UPDATE SET
        operating_model_name = EXCLUDED.operating_model_name,
        operating_model_description = EXCLUDED.operating_model_description,
        operating_model_metadata = EXCLUDED.operating_model_metadata,
        updated_at = now()
      RETURNING ${COLS}`,
    [body.code, body.name, body.description ?? null, JSON.stringify(body.metadata ?? {})],
  );
  return toOm(res.rows[0]!);
}

export async function deleteOm(q: DbConnector, id: string): Promise<boolean> {
  const res = await q.query(`DELETE FROM sys.sys_operating_model_catalog WHERE operating_model_id = $1`, [id]);
  return (res.rowCount ?? 0) === 1;
}
