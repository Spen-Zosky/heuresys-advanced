/**
 * apps/api/src/modules/enterprise-size-bands/repository.ts
 * Global catalog, upsert by code.
 */
import type { Pool, PoolClient } from "pg";
import type {
  EnterpriseSizeBand, EnterpriseSizeBandCode, UpsertEnterpriseSizeBandBody,
} from "@heuresys/shared";

export type DbConnector = Pool | PoolClient;

interface Row {
  enterprise_size_band_id: string;
  enterprise_size_band_code: EnterpriseSizeBandCode;
  enterprise_size_band_name: string;
  enterprise_size_band_min_employees: number | null;
  enterprise_size_band_max_employees: number | null;
  enterprise_size_band_min_revenue_eur: string | null;
  enterprise_size_band_max_revenue_eur: string | null;
  enterprise_size_band_description: string | null;
  enterprise_size_band_metadata: Record<string, unknown>;
  created_at: Date; updated_at: Date;
}

const COLS = `enterprise_size_band_id, enterprise_size_band_code, enterprise_size_band_name,
  enterprise_size_band_min_employees, enterprise_size_band_max_employees,
  enterprise_size_band_min_revenue_eur, enterprise_size_band_max_revenue_eur,
  enterprise_size_band_description, enterprise_size_band_metadata,
  created_at, updated_at`;

function toBand(r: Row): EnterpriseSizeBand {
  return {
    enterpriseSizeBandId: r.enterprise_size_band_id,
    code: r.enterprise_size_band_code,
    name: r.enterprise_size_band_name,
    minEmployees: r.enterprise_size_band_min_employees,
    maxEmployees: r.enterprise_size_band_max_employees,
    minRevenueEur: r.enterprise_size_band_min_revenue_eur === null ? null : Number(r.enterprise_size_band_min_revenue_eur),
    maxRevenueEur: r.enterprise_size_band_max_revenue_eur === null ? null : Number(r.enterprise_size_band_max_revenue_eur),
    description: r.enterprise_size_band_description,
    metadata: r.enterprise_size_band_metadata,
    createdAt: r.created_at.toISOString(),
    updatedAt: r.updated_at.toISOString(),
  };
}

export async function listBands(q: DbConnector): Promise<{ items: EnterpriseSizeBand[]; total: number }> {
  const res = await q.query<Row>(`SELECT ${COLS} FROM sys.sys_enterprise_size_bands ORDER BY enterprise_size_band_code`);
  return { items: res.rows.map(toBand), total: res.rows.length };
}

export async function findBandById(q: DbConnector, id: string): Promise<EnterpriseSizeBand | null> {
  const res = await q.query<Row>(`SELECT ${COLS} FROM sys.sys_enterprise_size_bands WHERE enterprise_size_band_id = $1`, [id]);
  return res.rows[0] ? toBand(res.rows[0]) : null;
}

export async function upsertBand(q: DbConnector, body: UpsertEnterpriseSizeBandBody): Promise<EnterpriseSizeBand> {
  const res = await q.query<Row>(
    `INSERT INTO sys.sys_enterprise_size_bands (
        enterprise_size_band_code, enterprise_size_band_name,
        enterprise_size_band_min_employees, enterprise_size_band_max_employees,
        enterprise_size_band_min_revenue_eur, enterprise_size_band_max_revenue_eur,
        enterprise_size_band_description, enterprise_size_band_metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
      ON CONFLICT (enterprise_size_band_code) DO UPDATE SET
        enterprise_size_band_name = EXCLUDED.enterprise_size_band_name,
        enterprise_size_band_min_employees = EXCLUDED.enterprise_size_band_min_employees,
        enterprise_size_band_max_employees = EXCLUDED.enterprise_size_band_max_employees,
        enterprise_size_band_min_revenue_eur = EXCLUDED.enterprise_size_band_min_revenue_eur,
        enterprise_size_band_max_revenue_eur = EXCLUDED.enterprise_size_band_max_revenue_eur,
        enterprise_size_band_description = EXCLUDED.enterprise_size_band_description,
        enterprise_size_band_metadata = EXCLUDED.enterprise_size_band_metadata,
        updated_at = now()
      RETURNING ${COLS}`,
    [body.code, body.name, body.minEmployees ?? null, body.maxEmployees ?? null,
     body.minRevenueEur ?? null, body.maxRevenueEur ?? null,
     body.description ?? null, JSON.stringify(body.metadata ?? {})],
  );
  return toBand(res.rows[0]!);
}

export async function deleteBand(q: DbConnector, id: string): Promise<boolean> {
  const res = await q.query(`DELETE FROM sys.sys_enterprise_size_bands WHERE enterprise_size_band_id = $1`, [id]);
  return (res.rowCount ?? 0) === 1;
}
