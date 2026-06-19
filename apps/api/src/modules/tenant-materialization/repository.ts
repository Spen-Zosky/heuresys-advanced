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
import { archetypeUsers } from "./blueprints.js";

export type DbConnector = typeof pool | PoolClient;

export interface MaterializeCounts {
  orgUnits: number;
  positions: number;
  users: number;
  assignments: number;
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

  const posCodeToId = new Map<string, string>(); // position code → id (apply: for the assignment FK)
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
      if (ins.rows[0]) {
        positionsCreated++;
        posCodeToId.set(p.code, ins.rows[0].position_id);
      } else {
        const ex = await client.query<{ position_id: string }>(
          `SELECT position_id FROM sys.sys_positions WHERE position_tenant_id = $1 AND position_code = $2`,
          [tenantId, p.code],
        );
        posCodeToId.set(p.code, ex.rows[0]!.position_id);
      }
    } else {
      const ex = await client.query(
        `SELECT 1 FROM sys.sys_positions WHERE position_tenant_id = $1 AND position_code = $2`,
        [tenantId, p.code],
      );
      if (ex.rowCount === 0) positionsCreated++;
    }
  }

  // slice-2a: one SYNTHETIC_REFERENCE incumbent per position + a PRIMARY ACTIVE assignment.
  // Mirrors db/scripts/seed-reference-bank.ts (user_type='SYNTHETIC_REFERENCE', user_is_synthetic,
  // user_external_code='SYN_...', NEVER 'LEGACY_EMP::' — that is the brownfield real-person key, I14).
  // Idempotent: user via ON CONFLICT (tenant, lower(email)); assignment via an existence check (the
  // partial unique sys_upa_one_primary_active_per_user allows exactly one PRIMARY ACTIVE per user).
  let usersCreated = 0;
  let assignmentsCreated = 0;
  for (const su of archetypeUsers(archetype)) {
    if (mode === "apply") {
      const ins = await client.query<{ user_id: string }>(
        `INSERT INTO sys.sys_users
           (user_tenant_id, user_external_code, user_email, user_display_name,
            user_first_name, user_last_name, user_status, user_type,
            user_is_synthetic, user_locale, user_timezone)
         VALUES ($1, $2, $3, $4, $5, $6, 'ACTIVE', 'SYNTHETIC_REFERENCE', true, 'it-IT', 'Europe/Rome')
         ON CONFLICT (user_tenant_id, lower(user_email)) DO NOTHING
         RETURNING user_id`,
        [tenantId, su.externalCode, su.email, su.displayName, su.firstName, su.lastName],
      );
      let userId: string;
      if (ins.rows[0]) {
        usersCreated++;
        userId = ins.rows[0].user_id;
      } else {
        const ex = await client.query<{ user_id: string }>(
          `SELECT user_id FROM sys.sys_users WHERE user_tenant_id = $1 AND lower(user_email) = lower($2)`,
          [tenantId, su.email],
        );
        userId = ex.rows[0]!.user_id;
      }
      const posId = posCodeToId.get(su.positionCode);
      if (posId) {
        const existing = await client.query(
          `SELECT 1 FROM sys.sys_user_position_assignments
            WHERE user_position_assignment_user_id = $1 AND user_position_assignment_position_id = $2
              AND user_position_assignment_kind = 'PRIMARY' AND user_position_assignment_status = 'ACTIVE'`,
          [userId, posId],
        );
        if (existing.rowCount === 0) {
          await client.query(
            `INSERT INTO sys.sys_user_position_assignments
               (user_position_assignment_tenant_id, user_position_assignment_user_id,
                user_position_assignment_position_id, user_position_assignment_kind,
                user_position_assignment_fte, user_position_assignment_start_date,
                user_position_assignment_status)
             VALUES ($1, $2, $3, 'PRIMARY', 1.000, '2024-01-01', 'ACTIVE')`,
            [tenantId, userId, posId],
          );
          assignmentsCreated++;
        }
      }
    } else {
      // plan: count what WOULD be created (user absent / no PRIMARY ACTIVE assignment yet).
      const ux = await client.query(
        `SELECT 1 FROM sys.sys_users WHERE user_tenant_id = $1 AND lower(user_email) = lower($2)`,
        [tenantId, su.email],
      );
      if (ux.rowCount === 0) usersCreated++;
      const ax = await client.query(
        `SELECT 1 FROM sys.sys_user_position_assignments a
           JOIN sys.sys_users u ON u.user_id = a.user_position_assignment_user_id
           JOIN sys.sys_positions p ON p.position_id = a.user_position_assignment_position_id
          WHERE u.user_tenant_id = $1 AND lower(u.user_email) = lower($2) AND p.position_code = $3
            AND a.user_position_assignment_kind = 'PRIMARY' AND a.user_position_assignment_status = 'ACTIVE'`,
        [tenantId, su.email, su.positionCode],
      );
      if (ax.rowCount === 0) assignmentsCreated++;
    }
  }

  return { orgUnits: orgUnitsCreated, positions: positionsCreated, users: usersCreated, assignments: assignmentsCreated };
}
