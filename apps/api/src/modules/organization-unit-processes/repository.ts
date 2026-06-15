/**
 * apps/api/src/modules/organization-unit-processes/repository.ts
 * T2.5 — raw parameterized SQL for the org-unit ↔ business-process assignment.
 *
 * Tenant isolation is pinned on org_unit_process_tenant_id ONLY (I5, NEVER RLS): the
 * blueprint catalog (sys_blueprint_*) is GLOBAL and carries no tenant_id. PLATFORM_ADMIN
 * sees all tenants' assignments; everyone else is pinned to their own. The assignment
 * row's tenant is inherited from the scope-checked org unit (set by the service).
 */
import type { PoolClient } from "pg";
import { pool } from "../../db/client.js";

export type DbConnector = typeof pool | PoolClient;

/** Tenant scope: PLATFORM_ADMIN is cross-tenant; everyone else is pinned to their own. */
export interface ScopeFilter {
  isPlatform: boolean;
  tenantId: string | null;
}

export interface OrgUnitProcessRow {
  orgUnitProcessId: string;
  tenantId: string;
  orgUnitId: string;
  blueprintProcessId: string;
  role: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface OrgUnitProcessForOuRow {
  orgUnitProcessId: string;
  role: string;
  blueprintProcessId: string;
  blueprintProcessCode: string;
  blueprintProcessName: string;
  blueprintProcessOrdinal: number;
  blueprintVariantId: string;
  blueprintVariantName: string;
  createdAt: string;
}

export interface OrgUnitProcessForProcessRow {
  orgUnitProcessId: string;
  role: string;
  orgUnitId: string;
  orgUnitCode: string;
  orgUnitName: string;
  blueprintProcessId: string;
  blueprintProcessName: string;
  createdAt: string;
}

const iso = (d: unknown): string => (d as Date).toISOString();
const OUP_COLS = `organization_unit_process_id, org_unit_process_tenant_id, org_unit_process_org_unit_id,
  org_unit_process_blueprint_process_id, org_unit_process_role, org_unit_process_metadata, created_at, updated_at`;

function mapRow(r: Record<string, unknown>): OrgUnitProcessRow {
  return {
    orgUnitProcessId: r.organization_unit_process_id as string,
    tenantId: r.org_unit_process_tenant_id as string,
    orgUnitId: r.org_unit_process_org_unit_id as string,
    blueprintProcessId: r.org_unit_process_blueprint_process_id as string,
    role: r.org_unit_process_role as string,
    metadata: (r.org_unit_process_metadata as Record<string, unknown>) ?? {},
    createdAt: iso(r.created_at),
    updatedAt: iso(r.updated_at),
  };
}

/** The org unit's tenant, scope-checked (I5). null = not found / out of scope (no leak). */
export async function findOuScoped(q: DbConnector, scope: ScopeFilter, ouId: string): Promise<{ ouId: string; tenantId: string } | null> {
  const params: unknown[] = [ouId];
  let tenant = "";
  if (!scope.isPlatform) { params.push(scope.tenantId); tenant = ` AND organization_unit_tenant_id = $2`; }
  const res = await q.query(
    `SELECT organization_unit_id, organization_unit_tenant_id
       FROM sys.sys_organization_units WHERE organization_unit_id = $1${tenant}`,
    params,
  );
  const row = res.rows[0];
  return row ? { ouId: row.organization_unit_id as string, tenantId: row.organization_unit_tenant_id as string } : null;
}

/** Confirm a global blueprint process exists. */
export async function findProcessById(q: DbConnector, processId: string): Promise<{ processId: string } | null> {
  const res = await q.query(
    `SELECT blueprint_process_id FROM sys.sys_blueprint_process_registry WHERE blueprint_process_id = $1`,
    [processId],
  );
  const row = res.rows[0];
  return row ? { processId: row.blueprint_process_id as string } : null;
}

export interface InsertOrgUnitProcessInput {
  tenantId: string;
  orgUnitId: string;
  blueprintProcessId: string;
  role: string;
}

export async function insertOrgUnitProcess(q: DbConnector, input: InsertOrgUnitProcessInput): Promise<OrgUnitProcessRow> {
  const res = await q.query(
    `INSERT INTO sys.sys_organization_unit_processes
       (org_unit_process_tenant_id, org_unit_process_org_unit_id, org_unit_process_blueprint_process_id, org_unit_process_role)
     VALUES ($1, $2, $3, $4)
     RETURNING ${OUP_COLS}`,
    [input.tenantId, input.orgUnitId, input.blueprintProcessId, input.role],
  );
  return mapRow(res.rows[0]!);
}

export async function deleteOrgUnitProcess(q: DbConnector, scope: ScopeFilter, id: string): Promise<boolean> {
  const params: unknown[] = [id];
  let tenant = "";
  if (!scope.isPlatform) { params.push(scope.tenantId); tenant = ` AND org_unit_process_tenant_id = $2`; }
  const res = await q.query(`DELETE FROM sys.sys_organization_unit_processes WHERE organization_unit_process_id = $1${tenant}`, params);
  return (res.rowCount ?? 0) > 0;
}

/** Assignments attached to an org unit, with the blueprint process/variant denormalized. */
export async function listProcessesForOu(q: DbConnector, scope: ScopeFilter, ouId: string): Promise<OrgUnitProcessForOuRow[]> {
  const params: unknown[] = [ouId];
  let tenant = "";
  if (!scope.isPlatform) { params.push(scope.tenantId); tenant = ` AND a.org_unit_process_tenant_id = $2`; }
  const res = await q.query(
    `SELECT a.organization_unit_process_id, a.org_unit_process_role,
            a.org_unit_process_blueprint_process_id, r.blueprint_process_code, r.blueprint_process_name,
            r.blueprint_process_ordinal, r.blueprint_process_variant_id, v.blueprint_variant_name, a.created_at
       FROM sys.sys_organization_unit_processes a
       JOIN sys.sys_blueprint_process_registry r ON r.blueprint_process_id = a.org_unit_process_blueprint_process_id
       JOIN sys.sys_blueprint_variants v ON v.blueprint_variant_id = r.blueprint_process_variant_id
      WHERE a.org_unit_process_org_unit_id = $1${tenant}
      ORDER BY r.blueprint_process_ordinal, r.blueprint_process_name`,
    params,
  );
  return res.rows.map((r: Record<string, unknown>) => ({
    orgUnitProcessId: r.organization_unit_process_id as string,
    role: r.org_unit_process_role as string,
    blueprintProcessId: r.org_unit_process_blueprint_process_id as string,
    blueprintProcessCode: r.blueprint_process_code as string,
    blueprintProcessName: r.blueprint_process_name as string,
    blueprintProcessOrdinal: Number(r.blueprint_process_ordinal),
    blueprintVariantId: r.blueprint_process_variant_id as string,
    blueprintVariantName: r.blueprint_variant_name as string,
    createdAt: iso(r.created_at),
  }));
}

/** Org units assigned to a single process step (tenant-filtered, I5). */
export async function listOusForProcess(q: DbConnector, scope: ScopeFilter, blueprintProcessId: string): Promise<OrgUnitProcessForProcessRow[]> {
  const params: unknown[] = [blueprintProcessId];
  let tenant = "";
  if (!scope.isPlatform) { params.push(scope.tenantId); tenant = ` AND a.org_unit_process_tenant_id = $2`; }
  const res = await q.query(
    `SELECT a.organization_unit_process_id, a.org_unit_process_role, a.org_unit_process_org_unit_id,
            o.organization_unit_code, o.organization_unit_name,
            a.org_unit_process_blueprint_process_id, r.blueprint_process_name, a.created_at
       FROM sys.sys_organization_unit_processes a
       JOIN sys.sys_organization_units o ON o.organization_unit_id = a.org_unit_process_org_unit_id
       JOIN sys.sys_blueprint_process_registry r ON r.blueprint_process_id = a.org_unit_process_blueprint_process_id
      WHERE a.org_unit_process_blueprint_process_id = $1${tenant}
      ORDER BY o.organization_unit_name`,
    params,
  );
  return res.rows.map((r: Record<string, unknown>) => ({
    orgUnitProcessId: r.organization_unit_process_id as string,
    role: r.org_unit_process_role as string,
    orgUnitId: r.org_unit_process_org_unit_id as string,
    orgUnitCode: r.organization_unit_code as string,
    orgUnitName: r.organization_unit_name as string,
    blueprintProcessId: r.org_unit_process_blueprint_process_id as string,
    blueprintProcessName: r.blueprint_process_name as string,
    createdAt: iso(r.created_at),
  }));
}
