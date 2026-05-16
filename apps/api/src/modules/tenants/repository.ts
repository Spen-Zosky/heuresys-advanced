/**
 * apps/api/src/modules/tenants/repository.ts
 * Raw parameterised SQL for sys.sys_tenancies. Pure data-access; the
 * service layer composes these calls and enforces business rules.
 *
 * Per TARGET_SCHEMA_DESIGN §2.1 + API_IMPLEMENTATION_PLAN §6.2.
 */

import type { Pool, PoolClient } from "pg";
import type {
  Tenant,
  TenantListQuery,
  CreateTenantBody,
  UpdateTenantBody,
} from "@heuresys/shared";

export type DbConnector = Pool | PoolClient;

interface RawTenantRow {
  tenant_id: string;
  tenant_code: string;
  tenant_name: string;
  tenant_legal_name: string | null;
  tenant_country_code: string | null;
  tenant_industry_code: string | null;
  tenant_size_band: string | null;
  tenant_status: string;
  tenant_metadata: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

function rowToTenant(r: RawTenantRow): Tenant {
  return {
    tenantId: r.tenant_id,
    tenantCode: r.tenant_code,
    tenantName: r.tenant_name,
    tenantLegalName: r.tenant_legal_name,
    tenantCountryCode: r.tenant_country_code,
    tenantIndustryCode: r.tenant_industry_code,
    tenantSizeBand: r.tenant_size_band as Tenant["tenantSizeBand"],
    tenantStatus: r.tenant_status as Tenant["tenantStatus"],
    tenantMetadata: r.tenant_metadata,
    createdAt: r.created_at.toISOString(),
    updatedAt: r.updated_at.toISOString(),
  };
}

const TENANT_COLUMNS = `tenant_id, tenant_code, tenant_name, tenant_legal_name,
       tenant_country_code, tenant_industry_code, tenant_size_band,
       tenant_status, tenant_metadata, created_at, updated_at`;

/* --- Read --------------------------------------------------------------- */

export interface ListFilter {
  /** When set, restrict result set to this single tenant (own-tenant scope). */
  ownTenantOnly?: string;
  query: TenantListQuery;
}

export async function listTenants(
  q: DbConnector,
  filter: ListFilter,
): Promise<{ items: Tenant[]; total: number }> {
  const where: string[] = [];
  const params: unknown[] = [];

  if (filter.ownTenantOnly) {
    params.push(filter.ownTenantOnly);
    where.push(`tenant_id = $${params.length}`);
  }
  if (filter.query.status) {
    params.push(filter.query.status);
    where.push(`tenant_status = $${params.length}`);
  }
  if (filter.query.countryCode) {
    params.push(filter.query.countryCode);
    where.push(`tenant_country_code = $${params.length}`);
  }
  if (filter.query.industryCode) {
    params.push(filter.query.industryCode);
    where.push(`tenant_industry_code = $${params.length}`);
  }
  if (filter.query.sizeBand) {
    params.push(filter.query.sizeBand);
    where.push(`tenant_size_band = $${params.length}`);
  }
  const whereClause = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";

  const totalRow = await q.query<{ total: string }>(
    `SELECT count(*)::text AS total FROM sys.sys_tenancies ${whereClause}`,
    params,
  );
  const total = Number(totalRow.rows[0]?.total ?? 0);

  params.push(filter.query.limit);
  const limitIdx = params.length;
  params.push(filter.query.offset);
  const offsetIdx = params.length;

  const itemsRes = await q.query<RawTenantRow>(
    `SELECT ${TENANT_COLUMNS}
       FROM sys.sys_tenancies
       ${whereClause}
      ORDER BY tenant_code
      LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
    params,
  );

  return { items: itemsRes.rows.map(rowToTenant), total };
}

export async function findTenantById(
  q: DbConnector,
  tenantId: string,
): Promise<Tenant | null> {
  const res = await q.query<RawTenantRow>(
    `SELECT ${TENANT_COLUMNS} FROM sys.sys_tenancies WHERE tenant_id = $1`,
    [tenantId],
  );
  return res.rows[0] ? rowToTenant(res.rows[0]) : null;
}

export async function findTenantByCode(
  q: DbConnector,
  code: string,
): Promise<Tenant | null> {
  const res = await q.query<RawTenantRow>(
    `SELECT ${TENANT_COLUMNS} FROM sys.sys_tenancies WHERE tenant_code = $1`,
    [code],
  );
  return res.rows[0] ? rowToTenant(res.rows[0]) : null;
}

/* --- Create ------------------------------------------------------------- */

export async function insertTenant(
  q: DbConnector,
  body: CreateTenantBody,
): Promise<Tenant> {
  const res = await q.query<RawTenantRow>(
    `INSERT INTO sys.sys_tenancies (
        tenant_code, tenant_name, tenant_legal_name, tenant_country_code,
        tenant_industry_code, tenant_size_band, tenant_status, tenant_metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
      RETURNING ${TENANT_COLUMNS}`,
    [
      body.tenantCode,
      body.tenantName,
      body.tenantLegalName ?? null,
      body.tenantCountryCode ?? null,
      body.tenantIndustryCode ?? null,
      body.tenantSizeBand ?? null,
      body.tenantStatus,
      JSON.stringify(body.tenantMetadata ?? {}),
    ],
  );
  return rowToTenant(res.rows[0]!);
}

/* --- Update (partial) --------------------------------------------------- */

export async function updateTenantPartial(
  q: DbConnector,
  tenantId: string,
  patch: UpdateTenantBody,
): Promise<Tenant | null> {
  const sets: string[] = [];
  const params: unknown[] = [];

  if (patch.tenantName !== undefined) {
    params.push(patch.tenantName);
    sets.push(`tenant_name = $${params.length}`);
  }
  if (patch.tenantLegalName !== undefined) {
    params.push(patch.tenantLegalName);
    sets.push(`tenant_legal_name = $${params.length}`);
  }
  if (patch.tenantCountryCode !== undefined) {
    params.push(patch.tenantCountryCode);
    sets.push(`tenant_country_code = $${params.length}`);
  }
  if (patch.tenantIndustryCode !== undefined) {
    params.push(patch.tenantIndustryCode);
    sets.push(`tenant_industry_code = $${params.length}`);
  }
  if (patch.tenantSizeBand !== undefined) {
    params.push(patch.tenantSizeBand);
    sets.push(`tenant_size_band = $${params.length}`);
  }
  if (patch.tenantStatus !== undefined) {
    params.push(patch.tenantStatus);
    sets.push(`tenant_status = $${params.length}`);
  }
  if (patch.tenantMetadata !== undefined) {
    params.push(JSON.stringify(patch.tenantMetadata));
    sets.push(`tenant_metadata = $${params.length}::jsonb`);
  }

  if (sets.length === 0) {
    // No-op patch: return the current row unchanged.
    return findTenantById(q, tenantId);
  }

  sets.push(`updated_at = now()`);
  params.push(tenantId);
  const res = await q.query<RawTenantRow>(
    `UPDATE sys.sys_tenancies
        SET ${sets.join(", ")}
      WHERE tenant_id = $${params.length}
      RETURNING ${TENANT_COLUMNS}`,
    params,
  );
  return res.rows[0] ? rowToTenant(res.rows[0]) : null;
}

/* --- Archive (soft delete) --------------------------------------------- */

/**
 * Soft-delete via tenant_status='ARCHIVED'. Returns true if the row was
 * archived now (was active/suspended/pending), false if already archived.
 */
export async function archiveTenant(
  q: DbConnector,
  tenantId: string,
): Promise<boolean> {
  const res = await q.query(
    `UPDATE sys.sys_tenancies
        SET tenant_status = 'ARCHIVED', updated_at = now()
      WHERE tenant_id = $1 AND tenant_status <> 'ARCHIVED'`,
    [tenantId],
  );
  return (res.rowCount ?? 0) === 1;
}
