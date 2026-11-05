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

/* ── ADR-0050 D3, parte visibile (S-14): le esenzioni dal secondo fattore ─────────────── */

export interface MfaExemptionRecord {
  exemptionId: string;
  tenantId: string;
  userId: string;
  userEmail: string;
  userDisplayName: string | null;
  userType: string;
  reason: string;
  enabled: boolean;
  expired: boolean;
  expiresAt: Date | null;
  createdAt: Date;
  authorDisplayName: string | null;
  updatedAt: Date;
}

const EXEMPTION_SELECT = `
  SELECT e.auth_mfa_exemption_id AS exemption_id, u.user_tenant_id AS tenant_id,
         u.user_id, u.user_email, u.user_display_name, u.user_type,
         e.auth_mfa_exemption_reason AS reason, e.auth_mfa_exemption_enabled AS enabled,
         (e.auth_mfa_exemption_expires_at IS NULL OR e.auth_mfa_exemption_expires_at <= now()) AS expired,
         e.auth_mfa_exemption_expires_at AS expires_at, e.created_at,
         a.user_display_name AS author_display_name, e.updated_at
    FROM sys.sys_auth_mfa_exemptions e
    JOIN sys.sys_users u ON u.user_id = e.auth_mfa_exemption_user_id
    LEFT JOIN sys.sys_users a ON a.user_id = e.created_by`;

interface ExemptionRow {
  exemption_id: string;
  tenant_id: string;
  user_id: string;
  user_email: string;
  user_display_name: string | null;
  user_type: string;
  reason: string;
  enabled: boolean;
  expired: boolean;
  expires_at: Date | null;
  created_at: Date;
  author_display_name: string | null;
  updated_at: Date;
}

function toExemption(r: ExemptionRow): MfaExemptionRecord {
  return {
    exemptionId: r.exemption_id,
    tenantId: r.tenant_id,
    userId: r.user_id,
    userEmail: r.user_email,
    userDisplayName: r.user_display_name,
    userType: r.user_type,
    reason: r.reason,
    enabled: r.enabled,
    expired: r.expired,
    expiresAt: r.expires_at,
    createdAt: r.created_at,
    authorDisplayName: r.author_display_name,
    updatedAt: r.updated_at,
  };
}

/** Le esenzioni di un tenant (null = tutti, vista di piattaforma). Le accese per prime. */
export async function listExemptions(db: DbConnector, tenantId: string | null): Promise<MfaExemptionRecord[]> {
  const { rows } = await db.query<ExemptionRow>(
    `${EXEMPTION_SELECT}
      WHERE ($1::uuid IS NULL OR u.user_tenant_id = $1)
      ORDER BY e.auth_mfa_exemption_enabled DESC, e.auth_mfa_exemption_expires_at DESC NULLS LAST, u.user_email`,
    [tenantId],
  );
  return rows.map(toExemption);
}

export async function findExemption(db: DbConnector, exemptionId: string): Promise<MfaExemptionRecord | null> {
  const { rows } = await db.query<ExemptionRow>(`${EXEMPTION_SELECT} WHERE e.auth_mfa_exemption_id = $1`, [exemptionId]);
  return rows[0] ? toExemption(rows[0]) : null;
}

/** Spegne un'esenzione. Idempotente: una già spenta resta com'è. */
export async function disableExemption(db: DbConnector, exemptionId: string, actorUserId: string): Promise<void> {
  await db.query(
    `UPDATE sys.sys_auth_mfa_exemptions
        SET auth_mfa_exemption_enabled = false, updated_at = now(), updated_by = $2
      WHERE auth_mfa_exemption_id = $1 AND auth_mfa_exemption_enabled`,
    [exemptionId, actorUserId],
  );
}
