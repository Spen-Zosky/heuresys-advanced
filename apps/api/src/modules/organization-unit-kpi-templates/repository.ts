/**
 * apps/api/src/modules/organization-unit-kpi-templates/repository.ts
 * Tenant-scoped. Unique (unit, kpi).
 */
import type { Pool, PoolClient } from "pg";
import type {
  OrganizationUnitKpiTemplate, OrganizationUnitKpiTemplateListQuery,
  UpsertOrganizationUnitKpiTemplateBody,
} from "@heuresys/shared";

export type DbConnector = Pool | PoolClient;

interface Row {
  organization_unit_kpi_template_id: string;
  organization_unit_kpi_template_unit_id: string | null;
  organization_unit_kpi_template_unit_template_id: string | null;
  organization_unit_kpi_template_kpi_id: string;
  organization_unit_kpi_template_tenant_id: string | null;
  organization_unit_kpi_template_weight: string;
  organization_unit_kpi_template_target: Record<string, unknown>;
  organization_unit_kpi_template_metadata: Record<string, unknown>;
  created_at: Date; updated_at: Date;
}

const COLS = `organization_unit_kpi_template_id, organization_unit_kpi_template_unit_id,
  organization_unit_kpi_template_unit_template_id,
  organization_unit_kpi_template_kpi_id, organization_unit_kpi_template_tenant_id,
  organization_unit_kpi_template_weight, organization_unit_kpi_template_target,
  organization_unit_kpi_template_metadata, created_at, updated_at`;

function toRow(r: Row): OrganizationUnitKpiTemplate {
  return {
    organizationUnitKpiTemplateId: r.organization_unit_kpi_template_id,
    unitId: r.organization_unit_kpi_template_unit_id,
    unitTemplateId: r.organization_unit_kpi_template_unit_template_id,
    kpiId: r.organization_unit_kpi_template_kpi_id,
    tenantId: r.organization_unit_kpi_template_tenant_id,
    weight: Number(r.organization_unit_kpi_template_weight),
    target: r.organization_unit_kpi_template_target,
    metadata: r.organization_unit_kpi_template_metadata,
    createdAt: r.created_at.toISOString(),
    updatedAt: r.updated_at.toISOString(),
  };
}

export async function listTemplates(
  q: DbConnector, filter: { tenantId?: string; query: OrganizationUnitKpiTemplateListQuery },
): Promise<{ items: OrganizationUnitKpiTemplate[]; total: number }> {
  const where: string[] = []; const params: unknown[] = [];
  if (filter.tenantId) { params.push(filter.tenantId); where.push(`organization_unit_kpi_template_tenant_id = $${params.length}`); }
  if (filter.query.unitId) { params.push(filter.query.unitId); where.push(`organization_unit_kpi_template_unit_id = $${params.length}`); }
  if (filter.query.kpiId) { params.push(filter.query.kpiId); where.push(`organization_unit_kpi_template_kpi_id = $${params.length}`); }
  const w = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const tr = await q.query<{ total: string }>(`SELECT count(*)::text AS total FROM sys.sys_organization_unit_kpi_templates ${w}`, params);
  params.push(filter.query.limit); const lim = params.length;
  params.push(filter.query.offset); const off = params.length;
  const res = await q.query<Row>(
    `SELECT ${COLS} FROM sys.sys_organization_unit_kpi_templates ${w}
      ORDER BY created_at DESC LIMIT $${lim} OFFSET $${off}`, params,
  );
  return { items: res.rows.map(toRow), total: Number(tr.rows[0]?.total ?? 0) };
}

export async function findTemplateById(q: DbConnector, id: string): Promise<OrganizationUnitKpiTemplate | null> {
  const res = await q.query<Row>(`SELECT ${COLS} FROM sys.sys_organization_unit_kpi_templates WHERE organization_unit_kpi_template_id = $1`, [id]);
  return res.rows[0] ? toRow(res.rows[0]) : null;
}

export async function getUnitTenant(q: DbConnector, unitId: string): Promise<string | null> {
  const res = await q.query<{ t: string }>(
    `SELECT organization_unit_tenant_id AS t FROM sys.sys_organization_units WHERE organization_unit_id = $1`, [unitId],
  );
  return res.rows[0]?.t ?? null;
}

export async function kpiVisibleToTenant(q: DbConnector, kpiId: string, tenantId: string): Promise<boolean> {
  const res = await q.query<{ x: number }>(
    `SELECT 1 AS x FROM sys.sys_kpi_definitions
      WHERE kpi_definition_id = $1 AND (kpi_definition_is_global = true OR kpi_definition_tenant_id = $2)
      LIMIT 1`, [kpiId, tenantId],
  );
  return res.rows.length > 0;
}

export async function upsertTemplate(
  q: DbConnector, tenantId: string, body: UpsertOrganizationUnitKpiTemplateBody,
): Promise<OrganizationUnitKpiTemplate> {
  const res = await q.query<Row>(
    `INSERT INTO sys.sys_organization_unit_kpi_templates (
        organization_unit_kpi_template_unit_id, organization_unit_kpi_template_kpi_id,
        organization_unit_kpi_template_tenant_id, organization_unit_kpi_template_weight,
        organization_unit_kpi_template_target, organization_unit_kpi_template_metadata
      ) VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb)
      ON CONFLICT (organization_unit_kpi_template_unit_id, organization_unit_kpi_template_kpi_id) DO UPDATE SET
        organization_unit_kpi_template_weight = EXCLUDED.organization_unit_kpi_template_weight,
        organization_unit_kpi_template_target = EXCLUDED.organization_unit_kpi_template_target,
        organization_unit_kpi_template_metadata = EXCLUDED.organization_unit_kpi_template_metadata,
        updated_at = now()
      RETURNING ${COLS}`,
    [body.unitId, body.kpiId, tenantId, body.weight ?? 1.0,
     JSON.stringify(body.target ?? {}), JSON.stringify(body.metadata ?? {})],
  );
  return toRow(res.rows[0]!);
}

export async function deleteTemplate(q: DbConnector, id: string): Promise<boolean> {
  const res = await q.query(`DELETE FROM sys.sys_organization_unit_kpi_templates WHERE organization_unit_kpi_template_id = $1`, [id]);
  return (res.rowCount ?? 0) === 1;
}
