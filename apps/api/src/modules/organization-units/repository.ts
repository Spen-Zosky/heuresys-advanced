/**
 * apps/api/src/modules/organization-units/repository.ts
 * Raw SQL for sys.sys_organization_units.
 */

import type { Pool, PoolClient } from "pg";
import type {
  OrganizationUnit,
  OrganizationUnitListQuery,
  CreateOrganizationUnitBody,
  UpdateOrganizationUnitBody,
} from "@heuresys/shared";

export type DbConnector = Pool | PoolClient;

interface Row {
  organization_unit_id: string;
  organization_unit_tenant_id: string;
  organization_unit_code: string;
  organization_unit_name: string;
  organization_unit_type_id: string | null;
  organization_unit_type: string | null;
  organization_unit_parent_id: string | null;
  organization_unit_manager_user_id: string | null;
  organization_unit_effective_from: Date;
  organization_unit_effective_to: Date | null;
  organization_unit_is_active: boolean;
  organization_unit_metadata: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
  parent_name?: string | null; // G-02: resolved on the list query, undefined elsewhere
}

const COLS = `organization_unit_id, organization_unit_tenant_id,
  organization_unit_code, organization_unit_name,
  organization_unit_type_id, organization_unit_type,
  organization_unit_parent_id, organization_unit_manager_user_id,
  organization_unit_effective_from, organization_unit_effective_to,
  organization_unit_is_active, organization_unit_metadata,
  created_at, updated_at`;

function dateOnly(d: Date | null): string | null {
  return d ? d.toISOString().slice(0, 10) : null;
}

function toOu(r: Row): OrganizationUnit {
  return {
    organizationUnitId: r.organization_unit_id,
    tenantId: r.organization_unit_tenant_id,
    code: r.organization_unit_code,
    name: r.organization_unit_name,
    typeId: r.organization_unit_type_id,
    type: r.organization_unit_type,
    parentId: r.organization_unit_parent_id,
    parentName: r.parent_name ?? null,
    managerUserId: r.organization_unit_manager_user_id,
    effectiveFrom: dateOnly(r.organization_unit_effective_from)!,
    effectiveTo: dateOnly(r.organization_unit_effective_to),
    isActive: r.organization_unit_is_active,
    metadata: r.organization_unit_metadata,
    createdAt: r.created_at.toISOString(),
    updatedAt: r.updated_at.toISOString(),
  };
}

export async function listOus(
  q: DbConnector,
  filter: { tenantId?: string; query: OrganizationUnitListQuery },
): Promise<{ items: OrganizationUnit[]; total: number }> {
  const where: string[] = [];
  const params: unknown[] = [];
  const add = (col: string, value: unknown) => {
    params.push(value);
    where.push(`${col} = $${params.length}`);
  };
  if (filter.tenantId) add("organization_unit_tenant_id", filter.tenantId);
  if (filter.query.isActive !== undefined) add("organization_unit_is_active", filter.query.isActive);
  if (filter.query.parentId) add("organization_unit_parent_id", filter.query.parentId);
  if (filter.query.managerUserId) add("organization_unit_manager_user_id", filter.query.managerUserId);
  const whereClause = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";

  const totalRow = await q.query<{ total: string }>(
    `SELECT count(*)::text AS total FROM sys.sys_organization_units ${whereClause}`,
    params,
  );
  const total = Number(totalRow.rows[0]?.total ?? 0);

  params.push(filter.query.limit);
  const limIdx = params.length;
  params.push(filter.query.offset);
  const offIdx = params.length;

  const res = await q.query<Row>(
    `SELECT ${COLS},
            (SELECT p.organization_unit_name FROM sys.sys_organization_units p
              WHERE p.organization_unit_id = sys.sys_organization_units.organization_unit_parent_id) AS parent_name
       FROM sys.sys_organization_units ${whereClause}
      ORDER BY organization_unit_code LIMIT $${limIdx} OFFSET $${offIdx}`,
    params,
  );
  return { items: res.rows.map(toOu), total };
}

export async function findOuById(q: DbConnector, id: string): Promise<OrganizationUnit | null> {
  const res = await q.query<Row>(
    `SELECT ${COLS} FROM sys.sys_organization_units WHERE organization_unit_id = $1`,
    [id],
  );
  return res.rows[0] ? toOu(res.rows[0]) : null;
}

export async function findOuByCodeInTenant(
  q: DbConnector,
  tenantId: string,
  code: string,
): Promise<OrganizationUnit | null> {
  const res = await q.query<Row>(
    `SELECT ${COLS} FROM sys.sys_organization_units
      WHERE organization_unit_tenant_id = $1 AND organization_unit_code = $2`,
    [tenantId, code],
  );
  return res.rows[0] ? toOu(res.rows[0]) : null;
}

export async function insertOu(
  q: DbConnector,
  tenantId: string,
  body: CreateOrganizationUnitBody,
  createdBy: string,
): Promise<OrganizationUnit> {
  const res = await q.query<Row>(
    `INSERT INTO sys.sys_organization_units (
        organization_unit_tenant_id, organization_unit_code, organization_unit_name,
        organization_unit_type_id, organization_unit_type, organization_unit_parent_id,
        organization_unit_manager_user_id, organization_unit_effective_from,
        organization_unit_effective_to, organization_unit_is_active,
        organization_unit_metadata, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7,
                COALESCE($8::date, CURRENT_DATE), $9, $10, $11::jsonb, $12)
      RETURNING ${COLS}`,
    [
      tenantId,
      body.code,
      body.name,
      body.typeId ?? null,
      body.type ?? null,
      body.parentId ?? null,
      body.managerUserId ?? null,
      body.effectiveFrom ?? null,
      body.effectiveTo ?? null,
      body.isActive,
      JSON.stringify(body.metadata ?? {}),
      createdBy,
    ],
  );
  return toOu(res.rows[0]!);
}

export async function updateOuPartial(
  q: DbConnector,
  id: string,
  patch: UpdateOrganizationUnitBody,
  updatedBy: string,
): Promise<OrganizationUnit | null> {
  const sets: string[] = [];
  const params: unknown[] = [];
  const addSet = (col: string, value: unknown) => {
    params.push(value);
    sets.push(`${col} = $${params.length}`);
  };
  if (patch.name !== undefined) addSet("organization_unit_name", patch.name);
  if (patch.typeId !== undefined) addSet("organization_unit_type_id", patch.typeId);
  if (patch.type !== undefined) addSet("organization_unit_type", patch.type);
  if (patch.parentId !== undefined) addSet("organization_unit_parent_id", patch.parentId);
  if (patch.managerUserId !== undefined) addSet("organization_unit_manager_user_id", patch.managerUserId);
  if (patch.effectiveFrom !== undefined) addSet("organization_unit_effective_from", patch.effectiveFrom);
  if (patch.effectiveTo !== undefined) addSet("organization_unit_effective_to", patch.effectiveTo);
  if (patch.isActive !== undefined) addSet("organization_unit_is_active", patch.isActive);
  if (patch.metadata !== undefined) {
    params.push(JSON.stringify(patch.metadata));
    sets.push(`organization_unit_metadata = $${params.length}::jsonb`);
  }
  if (sets.length === 0) return findOuById(q, id);
  sets.push(`updated_at = now()`);
  params.push(updatedBy);
  sets.push(`updated_by = $${params.length}`);
  params.push(id);
  const res = await q.query<Row>(
    `UPDATE sys.sys_organization_units SET ${sets.join(", ")}
      WHERE organization_unit_id = $${params.length}
      RETURNING ${COLS}`,
    params,
  );
  return res.rows[0] ? toOu(res.rows[0]) : null;
}

export async function softDeleteOu(q: DbConnector, id: string): Promise<boolean> {
  const res = await q.query(
    `UPDATE sys.sys_organization_units
        SET organization_unit_is_active = false, updated_at = now()
      WHERE organization_unit_id = $1 AND organization_unit_is_active = true`,
    [id],
  );
  return (res.rowCount ?? 0) === 1;
}
