/**
 * apps/api/src/modules/tenant-materialization/repository.ts
 * #4 WI-C — raw parameterized SQL. Materializes an archetype's org-units + positions into a
 * target tenant. Every write is tagged with the (already-validated) tenant_id (I5). Idempotent:
 * ON CONFLICT (tenant, code) DO NOTHING. apply runs inside withTransaction (passed PoolClient);
 * plan is read-only (existence counts, no writes).
 */
import type { PoolClient } from "pg";
import { pool } from "../../db/client.js";
import type { Archetype } from "./blueprints.js";

export type DbConnector = typeof pool | PoolClient;

export interface MaterializeCounts {
  orgUnits: number;
  positions: number;
}

/** Tenant status for the M-1 validation (null = tenant does not exist). */
export async function findTenantStatus(q: DbConnector, tenantId: string): Promise<string | null> {
  const res = await q.query<{ tenant_status: string }>(
    `SELECT tenant_status FROM sys.sys_tenancies WHERE tenant_id = $1`,
    [tenantId],
  );
  return res.rows[0]?.tenant_status ?? null;
}

async function orgUnitTypeId(client: PoolClient, code: string, cache: Map<string, string | null>): Promise<string | null> {
  if (cache.has(code)) return cache.get(code)!;
  const res = await client.query<{ organization_unit_type_id: string }>(
    `SELECT organization_unit_type_id FROM sys.sys_organization_unit_types WHERE organization_unit_type_code = $1`,
    [code],
  );
  const id = res.rows[0]?.organization_unit_type_id ?? null;
  cache.set(code, id);
  return id;
}

/**
 * Materialize the archetype into `tenantId`.
 *   mode 'apply' (must be inside a transaction): INSERT ... ON CONFLICT DO NOTHING; `created`
 *     counts the rows actually inserted, `skipped` = total - created.
 *   mode 'plan' (read-only): `created` = the rows that WOULD be inserted (don't already exist).
 */
export async function materialize(
  client: PoolClient,
  tenantId: string,
  archetype: Archetype,
  mode: "plan" | "apply",
): Promise<MaterializeCounts> {
  const typeCache = new Map<string, string | null>();
  const codeToId = new Map<string, string>(); // org-unit code → id (apply: for position FK)
  let orgUnitsCreated = 0;

  for (const ou of archetype.orgUnits) {
    if (mode === "apply") {
      const typeId = await orgUnitTypeId(client, ou.type, typeCache);
      const parentId = ou.parentCode ? codeToId.get(ou.parentCode) ?? null : null;
      const ins = await client.query<{ organization_unit_id: string }>(
        `INSERT INTO sys.sys_organization_units
           (organization_unit_tenant_id, organization_unit_code, organization_unit_name,
            organization_unit_type_id, organization_unit_type, organization_unit_parent_id,
            organization_unit_is_active, organization_unit_metadata)
         VALUES ($1, $2, $3, $4, $5, $6, true, jsonb_build_object('materialized_from', $7::text))
         ON CONFLICT (organization_unit_tenant_id, organization_unit_code) DO NOTHING
         RETURNING organization_unit_id`,
        [tenantId, ou.code, ou.name, typeId, ou.type, parentId, archetype.key],
      );
      if (ins.rows[0]) {
        orgUnitsCreated++;
        codeToId.set(ou.code, ins.rows[0].organization_unit_id);
      } else {
        const ex = await client.query<{ organization_unit_id: string }>(
          `SELECT organization_unit_id FROM sys.sys_organization_units
            WHERE organization_unit_tenant_id = $1 AND organization_unit_code = $2`,
          [tenantId, ou.code],
        );
        codeToId.set(ou.code, ex.rows[0]!.organization_unit_id);
      }
    } else {
      const ex = await client.query(
        `SELECT 1 FROM sys.sys_organization_units
          WHERE organization_unit_tenant_id = $1 AND organization_unit_code = $2`,
        [tenantId, ou.code],
      );
      if (ex.rowCount === 0) orgUnitsCreated++;
    }
  }

  let positionsCreated = 0;
  for (const p of archetype.positions) {
    if (mode === "apply") {
      const ouId = codeToId.get(p.orgUnitCode) ?? null;
      const ins = await client.query<{ position_id: string }>(
        `INSERT INTO sys.sys_positions
           (position_tenant_id, position_code, position_title, position_organization_unit_id,
            position_criticality, position_is_active, position_economic_weight)
         VALUES ($1, $2, $3, $4, $5, true, $6)
         ON CONFLICT (position_tenant_id, position_code) DO NOTHING
         RETURNING position_id`,
        [tenantId, p.code, p.title, ouId, p.criticality, p.economicWeight],
      );
      if (ins.rows[0]) positionsCreated++;
    } else {
      const ex = await client.query(
        `SELECT 1 FROM sys.sys_positions WHERE position_tenant_id = $1 AND position_code = $2`,
        [tenantId, p.code],
      );
      if (ex.rowCount === 0) positionsCreated++;
    }
  }

  return { orgUnits: orgUnitsCreated, positions: positionsCreated };
}
