/**
 * apps/api/src/modules/mfa-policy/repository.ts
 * Raw parameterised SQL against sys.sys_auth_mfa_policies (MVP-4 par.2.5 #4).
 * One row per tenant (UNIQUE), default OFF. The login-time reader lives in
 * modules/auth/repository.ts (findMfaPolicyForTenant) — hot path; this file
 * is the admin CRUD surface.
 */

import type { Pool, PoolClient } from "pg";

export type DbConnector = Pool | PoolClient;

export interface MfaPolicyRecord {
  policyId: string;
  tenantId: string;
  enabled: boolean;
  roleCodes: string[] | null;
  createdAt: Date;
  updatedAt: Date;
}

interface PolicyRow {
  policy_id: string;
  tenant_id: string;
  enabled: boolean;
  role_codes: string[] | null;
  created_at: Date;
  updated_at: Date;
}

const SELECT_COLS = `
  auth_mfa_policy_id         AS policy_id,
  auth_mfa_policy_tenant_id  AS tenant_id,
  auth_mfa_policy_enabled    AS enabled,
  auth_mfa_policy_role_codes AS role_codes,
  created_at, updated_at
`;

function toRecord(r: PolicyRow): MfaPolicyRecord {
  return {
    policyId: r.policy_id,
    tenantId: r.tenant_id,
    enabled: r.enabled,
    roleCodes: r.role_codes,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

/** All policies (PLATFORM_ADMIN view), or the single tenant's (tenant scope). */
export async function listPolicies(
  db: DbConnector,
  tenantId: string | null,
): Promise<MfaPolicyRecord[]> {
  const result =
    tenantId === null
      ? await db.query<PolicyRow>(
          `SELECT ${SELECT_COLS} FROM sys.sys_auth_mfa_policies ORDER BY created_at`,
        )
      : await db.query<PolicyRow>(
          `SELECT ${SELECT_COLS} FROM sys.sys_auth_mfa_policies
            WHERE auth_mfa_policy_tenant_id = $1`,
          [tenantId],
        );
  return result.rows.map(toRecord);
}

/** Idempotent per-tenant upsert (the table is UNIQUE on tenant_id). */
export async function upsertPolicy(
  db: DbConnector,
  input: {
    tenantId: string;
    enabled: boolean;
    roleCodes: string[] | null;
    actorUserId: string;
  },
): Promise<MfaPolicyRecord> {
  const result = await db.query<PolicyRow>(
    `INSERT INTO sys.sys_auth_mfa_policies
       (auth_mfa_policy_tenant_id, auth_mfa_policy_enabled, auth_mfa_policy_role_codes,
        created_by, updated_by)
     VALUES ($1, $2, $3, $4, $4)
     ON CONFLICT (auth_mfa_policy_tenant_id) DO UPDATE SET
       auth_mfa_policy_enabled    = EXCLUDED.auth_mfa_policy_enabled,
       auth_mfa_policy_role_codes = EXCLUDED.auth_mfa_policy_role_codes,
       updated_by                 = EXCLUDED.updated_by
     RETURNING ${SELECT_COLS}`,
    [input.tenantId, input.enabled, input.roleCodes, input.actorUserId],
  );
  return toRecord(result.rows[0]!);
}

/** True if the tenant exists and is not archived (guards upsert target). */
export async function tenantExists(db: DbConnector, tenantId: string): Promise<boolean> {
  const result = await db.query<{ one: number }>(
    `SELECT 1 AS one FROM sys.sys_tenancies WHERE tenant_id = $1 AND tenant_status <> 'ARCHIVED'`,
    [tenantId],
  );
  return result.rows.length > 0;
}
