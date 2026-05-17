/**
 * apps/api/src/modules/auth/mfa-repository.ts
 *
 * Raw SQL access to sys.sys_auth_mfa_factors. Follows the same idioms as
 * the rest of apps/api: parameterised pg queries, no Drizzle query builder
 * (per CLAUDE.md invariant).
 */

import type { Pool, PoolClient } from "pg";

type DbConnector = Pool | PoolClient;

export type MfaKind = "TOTP" | "WEBAUTHN" | "EMAIL_OTP" | "SMS_OTP";

export interface MfaFactorRow {
  factorId: string;
  userId: string;
  kind: MfaKind;
  /** Stored as base32 for TOTP. For prod a KMS-wrapped ciphertext would
      replace this — schema column is `text` so a swap is non-breaking. */
  secret: string | null;
  metadata: Record<string, unknown>;
  verified: boolean;
  lastUsedAt: Date | null;
  createdAt: Date;
}

function mapRow(r: {
  auth_mfa_factor_id: string;
  auth_mfa_factor_user_id: string;
  auth_mfa_factor_kind: string;
  auth_mfa_factor_secret: string | null;
  auth_mfa_factor_metadata: Record<string, unknown>;
  auth_mfa_factor_verified: boolean;
  auth_mfa_factor_last_used_at: Date | null;
  created_at: Date;
}): MfaFactorRow {
  return {
    factorId: r.auth_mfa_factor_id,
    userId: r.auth_mfa_factor_user_id,
    kind: r.auth_mfa_factor_kind as MfaKind,
    secret: r.auth_mfa_factor_secret,
    metadata: r.auth_mfa_factor_metadata,
    verified: r.auth_mfa_factor_verified,
    lastUsedAt: r.auth_mfa_factor_last_used_at,
    createdAt: r.created_at,
  };
}

export async function insertMfaFactor(
  q: DbConnector,
  params: { userId: string; kind: MfaKind; secret: string },
): Promise<MfaFactorRow> {
  const { rows } = await q.query<Parameters<typeof mapRow>[0]>(
    `INSERT INTO sys.sys_auth_mfa_factors
       (auth_mfa_factor_user_id, auth_mfa_factor_kind, auth_mfa_factor_secret, auth_mfa_factor_verified)
     VALUES ($1, $2, $3, false)
     RETURNING *`,
    [params.userId, params.kind, params.secret],
  );
  return mapRow(rows[0]!);
}

export async function findMfaFactorById(
  q: DbConnector,
  factorId: string,
): Promise<MfaFactorRow | null> {
  const { rows } = await q.query<Parameters<typeof mapRow>[0]>(
    `SELECT * FROM sys.sys_auth_mfa_factors WHERE auth_mfa_factor_id = $1`,
    [factorId],
  );
  return rows[0] ? mapRow(rows[0]) : null;
}

export async function listMfaFactorsForUser(
  q: DbConnector,
  userId: string,
): Promise<MfaFactorRow[]> {
  const { rows } = await q.query<Parameters<typeof mapRow>[0]>(
    `SELECT * FROM sys.sys_auth_mfa_factors
      WHERE auth_mfa_factor_user_id = $1
      ORDER BY created_at DESC`,
    [userId],
  );
  return rows.map(mapRow);
}

export async function listVerifiedMfaFactorsForUser(
  q: DbConnector,
  userId: string,
): Promise<MfaFactorRow[]> {
  const { rows } = await q.query<Parameters<typeof mapRow>[0]>(
    `SELECT * FROM sys.sys_auth_mfa_factors
      WHERE auth_mfa_factor_user_id = $1
        AND auth_mfa_factor_verified = true
      ORDER BY created_at DESC`,
    [userId],
  );
  return rows.map(mapRow);
}

export async function markMfaFactorVerified(
  q: DbConnector,
  factorId: string,
): Promise<void> {
  await q.query(
    `UPDATE sys.sys_auth_mfa_factors
        SET auth_mfa_factor_verified = true
      WHERE auth_mfa_factor_id = $1`,
    [factorId],
  );
}

export async function markMfaFactorUsed(
  q: DbConnector,
  factorId: string,
): Promise<void> {
  await q.query(
    `UPDATE sys.sys_auth_mfa_factors
        SET auth_mfa_factor_last_used_at = now()
      WHERE auth_mfa_factor_id = $1`,
    [factorId],
  );
}

export async function deleteMfaFactor(
  q: DbConnector,
  factorId: string,
  userId: string,
): Promise<boolean> {
  const { rowCount } = await q.query(
    `DELETE FROM sys.sys_auth_mfa_factors
       WHERE auth_mfa_factor_id = $1
         AND auth_mfa_factor_user_id = $2`,
    [factorId, userId],
  );
  return (rowCount ?? 0) > 0;
}
