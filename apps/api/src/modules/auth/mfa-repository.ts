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
  params: { userId: string; kind: MfaKind; secret: string | null },
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

/* === EMAIL_OTP challenge store ====================================== */
/* sys.sys_auth_mfa_otp_challenges (migration 000081). One row per issued
 * code; the code is stored HASHED (Argon2id) in auth_mfa_otp_code_hash —
 * never plaintext. expires_at + attempt_count + consumed_at enforce the
 * TTL / lockout / single-use security invariants. */

export type MfaOtpPurpose = "ENROLL" | "LOGIN";

export interface MfaOtpChallengeRow {
  otpId: string;
  userId: string;
  factorId: string;
  purpose: MfaOtpPurpose;
  /** Argon2id hash of the 6-digit code — never the plaintext. */
  codeHash: string;
  expiresAt: Date;
  attemptCount: number;
  consumedAt: Date | null;
  createdAt: Date;
}

function mapOtpRow(r: {
  auth_mfa_otp_id: string;
  auth_mfa_otp_user_id: string;
  auth_mfa_otp_factor_id: string;
  auth_mfa_otp_purpose: string;
  auth_mfa_otp_code_hash: string;
  auth_mfa_otp_expires_at: Date;
  auth_mfa_otp_attempt_count: number;
  auth_mfa_otp_consumed_at: Date | null;
  created_at: Date;
}): MfaOtpChallengeRow {
  return {
    otpId: r.auth_mfa_otp_id,
    userId: r.auth_mfa_otp_user_id,
    factorId: r.auth_mfa_otp_factor_id,
    purpose: r.auth_mfa_otp_purpose as MfaOtpPurpose,
    codeHash: r.auth_mfa_otp_code_hash,
    expiresAt: r.auth_mfa_otp_expires_at,
    attemptCount: r.auth_mfa_otp_attempt_count,
    consumedAt: r.auth_mfa_otp_consumed_at,
    createdAt: r.created_at,
  };
}

/**
 * Invalidate (consume) any still-active OTP challenge for this factor+purpose,
 * then insert a fresh one. Single-active-code invariant: issuing a new code
 * voids the previous one so an attacker can't keep N codes alive in parallel.
 */
export async function issueOtpChallenge(
  q: DbConnector,
  params: {
    userId: string;
    factorId: string;
    purpose: MfaOtpPurpose;
    codeHash: string;
    expiresAt: Date;
  },
): Promise<MfaOtpChallengeRow> {
  await q.query(
    `UPDATE sys.sys_auth_mfa_otp_challenges
        SET auth_mfa_otp_consumed_at = now()
      WHERE auth_mfa_otp_factor_id = $1
        AND auth_mfa_otp_purpose = $2
        AND auth_mfa_otp_consumed_at IS NULL`,
    [params.factorId, params.purpose],
  );
  const { rows } = await q.query<Parameters<typeof mapOtpRow>[0]>(
    `INSERT INTO sys.sys_auth_mfa_otp_challenges
       (auth_mfa_otp_user_id, auth_mfa_otp_factor_id, auth_mfa_otp_purpose,
        auth_mfa_otp_code_hash, auth_mfa_otp_expires_at)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [params.userId, params.factorId, params.purpose, params.codeHash, params.expiresAt],
  );
  return mapOtpRow(rows[0]!);
}

/** Most-recent active (unconsumed) OTP challenge for a factor+purpose, if any. */
export async function findActiveOtpChallenge(
  q: DbConnector,
  factorId: string,
  purpose: MfaOtpPurpose,
): Promise<MfaOtpChallengeRow | null> {
  const { rows } = await q.query<Parameters<typeof mapOtpRow>[0]>(
    `SELECT * FROM sys.sys_auth_mfa_otp_challenges
      WHERE auth_mfa_otp_factor_id = $1
        AND auth_mfa_otp_purpose = $2
        AND auth_mfa_otp_consumed_at IS NULL
      ORDER BY created_at DESC
      LIMIT 1`,
    [factorId, purpose],
  );
  return rows[0] ? mapOtpRow(rows[0]) : null;
}

/** Increment the attempt counter (called on a failed verification). */
export async function incrementOtpAttempt(
  q: DbConnector,
  otpId: string,
): Promise<number> {
  const { rows } = await q.query<{ auth_mfa_otp_attempt_count: number }>(
    `UPDATE sys.sys_auth_mfa_otp_challenges
        SET auth_mfa_otp_attempt_count = auth_mfa_otp_attempt_count + 1
      WHERE auth_mfa_otp_id = $1
      RETURNING auth_mfa_otp_attempt_count`,
    [otpId],
  );
  return rows[0]?.auth_mfa_otp_attempt_count ?? 0;
}

/** Mark a challenge consumed (on success OR on lockout invalidation). */
export async function consumeOtpChallenge(
  q: DbConnector,
  otpId: string,
): Promise<void> {
  await q.query(
    `UPDATE sys.sys_auth_mfa_otp_challenges
        SET auth_mfa_otp_consumed_at = now()
      WHERE auth_mfa_otp_id = $1
        AND auth_mfa_otp_consumed_at IS NULL`,
    [otpId],
  );
}

/* --- recovery codes (MVP-4 §2.5) ----------------------------------- */

/** Replace a user's recovery-code set (regenerate): delete old, insert the new hashes. */
export async function replaceRecoveryCodes(
  q: DbConnector,
  userId: string,
  hashes: string[],
): Promise<void> {
  await q.query(`DELETE FROM sys.sys_auth_mfa_recovery_codes WHERE recovery_code_user_id = $1`, [userId]);
  if (hashes.length === 0) return;
  // unnest a parallel array of hashes against a single user id.
  await q.query(
    `INSERT INTO sys.sys_auth_mfa_recovery_codes (recovery_code_user_id, recovery_code_hash)
     SELECT $1, h FROM unnest($2::text[]) AS h`,
    [userId, hashes],
  );
}

/** Atomically consume one unused recovery code (single-use). Returns true if a code was burned. */
export async function consumeRecoveryCode(
  q: DbConnector,
  userId: string,
  codeHash: string,
): Promise<boolean> {
  const res = await q.query(
    `UPDATE sys.sys_auth_mfa_recovery_codes
        SET recovery_code_used_at = now()
      WHERE recovery_code_user_id = $1
        AND recovery_code_hash = $2
        AND recovery_code_used_at IS NULL
      RETURNING recovery_code_id`,
    [userId, codeHash],
  );
  return (res.rowCount ?? 0) > 0;
}

/** Count a user's remaining (unused) recovery codes. */
export async function countUnusedRecoveryCodes(q: DbConnector, userId: string): Promise<number> {
  const res = await q.query<{ n: string }>(
    `SELECT count(*)::text AS n FROM sys.sys_auth_mfa_recovery_codes
      WHERE recovery_code_user_id = $1 AND recovery_code_used_at IS NULL`,
    [userId],
  );
  return Number(res.rows[0]?.n ?? "0");
}
