/**
 * apps/api/src/modules/enterprise-typing-profiles/repository.ts
 * 1:1 with tenant (unique on tenant_id). Upsert by tenant.
 */
import type { Pool, PoolClient } from "pg";
import type {
  EnterpriseTypingProfile, RegulatoryIntensity,
  EnterpriseTypingProfileListQuery, UpsertEnterpriseTypingProfileBody,
} from "@heuresys/shared";

export type DbConnector = Pool | PoolClient;

interface Row {
  enterprise_typing_profile_id: string;
  enterprise_typing_tenant_id: string;
  enterprise_typing_industry_class_id: string | null;
  enterprise_typing_size_band_id: string | null;
  enterprise_typing_operating_model_id: string | null;
  enterprise_typing_regulatory_intensity: RegulatoryIntensity;
  enterprise_typing_employee_count: number | null;
  enterprise_typing_revenue_eur: string | null;
  enterprise_typing_country_code: string | null;
  enterprise_typing_assessed_at: Date;
  enterprise_typing_metadata: Record<string, unknown>;
  created_at: Date; updated_at: Date;
}

const COLS = `enterprise_typing_profile_id, enterprise_typing_tenant_id,
  enterprise_typing_industry_class_id, enterprise_typing_size_band_id,
  enterprise_typing_operating_model_id, enterprise_typing_regulatory_intensity,
  enterprise_typing_employee_count, enterprise_typing_revenue_eur,
  enterprise_typing_country_code, enterprise_typing_assessed_at,
  enterprise_typing_metadata, created_at, updated_at`;

function toProfile(r: Row): EnterpriseTypingProfile {
  return {
    enterpriseTypingProfileId: r.enterprise_typing_profile_id,
    tenantId: r.enterprise_typing_tenant_id,
    industryClassId: r.enterprise_typing_industry_class_id,
    sizeBandId: r.enterprise_typing_size_band_id,
    operatingModelId: r.enterprise_typing_operating_model_id,
    regulatoryIntensity: r.enterprise_typing_regulatory_intensity,
    employeeCount: r.enterprise_typing_employee_count,
    revenueEur: r.enterprise_typing_revenue_eur === null ? null : Number(r.enterprise_typing_revenue_eur),
    countryCode: r.enterprise_typing_country_code,
    assessedAt: r.enterprise_typing_assessed_at.toISOString(),
    metadata: r.enterprise_typing_metadata,
    createdAt: r.created_at.toISOString(),
    updatedAt: r.updated_at.toISOString(),
  };
}

export async function listProfiles(
  q: DbConnector, filter: { tenantId?: string; query: EnterpriseTypingProfileListQuery },
): Promise<{ items: EnterpriseTypingProfile[]; total: number }> {
  const where: string[] = []; const params: unknown[] = [];
  if (filter.tenantId) { params.push(filter.tenantId); where.push(`enterprise_typing_tenant_id = $${params.length}`); }
  if (filter.query.regulatoryIntensity) { params.push(filter.query.regulatoryIntensity); where.push(`enterprise_typing_regulatory_intensity = $${params.length}`); }
  if (filter.query.industryClassId) { params.push(filter.query.industryClassId); where.push(`enterprise_typing_industry_class_id = $${params.length}`); }
  if (filter.query.sizeBandId) { params.push(filter.query.sizeBandId); where.push(`enterprise_typing_size_band_id = $${params.length}`); }
  const w = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const tr = await q.query<{ total: string }>(`SELECT count(*)::text AS total FROM sys.sys_enterprise_typing_profiles ${w}`, params);
  params.push(filter.query.limit); const lim = params.length;
  params.push(filter.query.offset); const off = params.length;
  const res = await q.query<Row>(
    `SELECT ${COLS} FROM sys.sys_enterprise_typing_profiles ${w}
      ORDER BY created_at DESC LIMIT $${lim} OFFSET $${off}`, params,
  );
  return { items: res.rows.map(toProfile), total: Number(tr.rows[0]?.total ?? 0) };
}

export async function findProfileById(q: DbConnector, id: string): Promise<EnterpriseTypingProfile | null> {
  const res = await q.query<Row>(`SELECT ${COLS} FROM sys.sys_enterprise_typing_profiles WHERE enterprise_typing_profile_id = $1`, [id]);
  return res.rows[0] ? toProfile(res.rows[0]) : null;
}

export async function upsertProfile(
  q: DbConnector, tenantId: string, body: UpsertEnterpriseTypingProfileBody, byUserId: string,
): Promise<EnterpriseTypingProfile> {
  const res = await q.query<Row>(
    `INSERT INTO sys.sys_enterprise_typing_profiles (
        enterprise_typing_tenant_id, enterprise_typing_industry_class_id,
        enterprise_typing_size_band_id, enterprise_typing_operating_model_id,
        enterprise_typing_regulatory_intensity, enterprise_typing_employee_count,
        enterprise_typing_revenue_eur, enterprise_typing_country_code,
        enterprise_typing_metadata, created_by, updated_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $10)
      ON CONFLICT (enterprise_typing_tenant_id) DO UPDATE SET
        enterprise_typing_industry_class_id = EXCLUDED.enterprise_typing_industry_class_id,
        enterprise_typing_size_band_id = EXCLUDED.enterprise_typing_size_band_id,
        enterprise_typing_operating_model_id = EXCLUDED.enterprise_typing_operating_model_id,
        enterprise_typing_regulatory_intensity = EXCLUDED.enterprise_typing_regulatory_intensity,
        enterprise_typing_employee_count = EXCLUDED.enterprise_typing_employee_count,
        enterprise_typing_revenue_eur = EXCLUDED.enterprise_typing_revenue_eur,
        enterprise_typing_country_code = EXCLUDED.enterprise_typing_country_code,
        enterprise_typing_metadata = EXCLUDED.enterprise_typing_metadata,
        enterprise_typing_assessed_at = now(),
        updated_at = now(),
        updated_by = EXCLUDED.updated_by
      RETURNING ${COLS}`,
    [tenantId, body.industryClassId ?? null, body.sizeBandId ?? null,
     body.operatingModelId ?? null, body.regulatoryIntensity ?? "MEDIUM",
     body.employeeCount ?? null, body.revenueEur ?? null, body.countryCode ?? null,
     JSON.stringify(body.metadata ?? {}), byUserId],
  );
  return toProfile(res.rows[0]!);
}

export async function deleteProfile(q: DbConnector, id: string): Promise<boolean> {
  const res = await q.query(`DELETE FROM sys.sys_enterprise_typing_profiles WHERE enterprise_typing_profile_id = $1`, [id]);
  return (res.rowCount ?? 0) === 1;
}
