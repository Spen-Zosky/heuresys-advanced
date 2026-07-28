/**
 * apps/api/src/modules/organization-unit-history/repository.ts
 * Raw SQL per sys.sys_organization_unit_history. Tenant-scoped, append-only.
 */

import type { Pool, PoolClient } from "pg";
import type {
  OrganizationUnitHistory,
  OrganizationUnitHistoryListQuery,
  OrganizationUnitChangeType,
  CreateOrganizationUnitHistoryBody,
} from "@heuresys/shared";

export type DbConnector = Pool | PoolClient;

interface Row {
  organization_unit_history_id: string;
  organization_unit_history_unit_id: string;
  organization_unit_history_tenant_id: string;
  organization_unit_history_change_type: OrganizationUnitChangeType;
  organization_unit_history_old_value: Record<string, unknown>;
  organization_unit_history_new_value: Record<string, unknown>;
  organization_unit_history_effective_at: Date;
  organization_unit_history_actor_user_id: string | null;
  organization_unit_history_notes: string | null;
  created_at: Date;
}

const COLS = `organization_unit_history_id, organization_unit_history_unit_id,
  organization_unit_history_tenant_id, organization_unit_history_change_type,
  organization_unit_history_old_value, organization_unit_history_new_value,
  organization_unit_history_effective_at, organization_unit_history_actor_user_id,
  organization_unit_history_notes, created_at`;

function toOuh(r: Row): OrganizationUnitHistory {
  return {
    organizationUnitHistoryId: r.organization_unit_history_id,
    unitId: r.organization_unit_history_unit_id,
    tenantId: r.organization_unit_history_tenant_id,
    changeType: r.organization_unit_history_change_type,
    oldValue: r.organization_unit_history_old_value,
    newValue: r.organization_unit_history_new_value,
    effectiveAt: r.organization_unit_history_effective_at.toISOString(),
    actorUserId: r.organization_unit_history_actor_user_id,
    notes: r.organization_unit_history_notes,
    createdAt: r.created_at.toISOString(),
  };
}

export async function listHistory(
  q: DbConnector,
  filter: { tenantId?: string; query: OrganizationUnitHistoryListQuery },
): Promise<{ items: OrganizationUnitHistory[]; total: number }> {
  const where: string[] = [];
  const params: unknown[] = [];
  if (filter.tenantId) {
    params.push(filter.tenantId);
    where.push(`organization_unit_history_tenant_id = $${params.length}`);
  }
  if (filter.query.unitId) {
    params.push(filter.query.unitId);
    where.push(`organization_unit_history_unit_id = $${params.length}`);
  }
  if (filter.query.changeType) {
    params.push(filter.query.changeType);
    where.push(`organization_unit_history_change_type = $${params.length}`);
  }
  if (filter.query.effectiveFrom) {
    params.push(filter.query.effectiveFrom);
    where.push(`organization_unit_history_effective_at >= $${params.length}::date`);
  }
  if (filter.query.effectiveTo) {
    params.push(filter.query.effectiveTo);
    where.push(`organization_unit_history_effective_at < ($${params.length}::date + 1)`);
  }
  const whereClause = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";

  const totalRow = await q.query<{ total: string }>(
    `SELECT count(*)::text AS total FROM sys.sys_organization_unit_history ${whereClause}`,
    params,
  );
  const total = Number(totalRow.rows[0]?.total ?? 0);

  params.push(filter.query.limit);
  const lim = params.length;
  params.push(filter.query.offset);
  const off = params.length;
  const res = await q.query<Row>(
    `SELECT ${COLS} FROM sys.sys_organization_unit_history ${whereClause}
      ORDER BY organization_unit_history_effective_at DESC, organization_unit_history_id
      LIMIT $${lim} OFFSET $${off}`,
    params,
  );
  return { items: res.rows.map(toOuh), total };
}

export async function findHistoryById(
  q: DbConnector, id: string,
): Promise<OrganizationUnitHistory | null> {
  const res = await q.query<Row>(
    `SELECT ${COLS} FROM sys.sys_organization_unit_history
      WHERE organization_unit_history_id = $1`, [id],
  );
  return res.rows[0] ? toOuh(res.rows[0]) : null;
}

export async function unitInTenant(
  q: DbConnector, unitId: string, tenantId: string,
): Promise<{ exists: boolean; sameTenant: boolean }> {
  const res = await q.query<{ organization_unit_tenant_id: string }>(
    `SELECT organization_unit_tenant_id FROM sys.sys_organization_units
      WHERE organization_unit_id = $1`, [unitId],
  );
  if (res.rows.length === 0) return { exists: false, sameTenant: false };
  return { exists: true, sameTenant: res.rows[0]!.organization_unit_tenant_id === tenantId };
}

export async function insertHistory(
  q: DbConnector,
  tenantId: string,
  body: CreateOrganizationUnitHistoryBody,
  actorUserId: string,
): Promise<OrganizationUnitHistory> {
  const res = await q.query<Row>(
    `INSERT INTO sys.sys_organization_unit_history (
        organization_unit_history_unit_id, organization_unit_history_tenant_id,
        organization_unit_history_change_type, organization_unit_history_old_value,
        organization_unit_history_new_value, organization_unit_history_effective_at,
        organization_unit_history_actor_user_id, organization_unit_history_notes
      ) VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, COALESCE($6::timestamptz, now()), $7, $8)
      RETURNING ${COLS}`,
    [
      body.unitId,
      tenantId,
      body.changeType,
      JSON.stringify(body.oldValue),
      JSON.stringify(body.newValue),
      body.effectiveAt ?? null,
      actorUserId,
      body.notes ?? null,
    ],
  );
  return toOuh(res.rows[0]!);
}
