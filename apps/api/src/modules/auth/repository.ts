/**
 * apps/api/src/modules/auth/repository.ts
 * All SQL against sys.sys_auth_* + sys.sys_users + sys.sys_user_auth_roles
 * for the auth module. Raw parameterised SQL via pg.Pool — Drizzle schemas
 * for sys.* will be introspected post-MVP and queries progressively migrated.
 *
 * Functions are pure data-access: no business decisions, no logging.
 * The service layer composes these calls inside transactions where needed.
 *
 * Per AUTH_SECURITY_PLAN §2, §4, §6, §9 + I5 (tenant isolation in API layer).
 */

import { pool } from "../../db/client.js";
import type { Pool, PoolClient } from "pg";
import type { RoleCode } from "../../config/constants.js";

/** Query connector — pool for autocommit, client for in-transaction work. */
export type DbConnector = Pool | PoolClient;

/* === Login lookups ======================================================= */

export interface LoginCandidate {
  userId: string;
  userTenantId: string;
  userEmail: string;
  userDisplayName: string;
  identityId: string;
  credentialId: string;
  credentialHash: string;
  credentialMustRotate: boolean;
}

/**
 * Resolves a login candidate by email. Returns 0 or more rows — service layer
 * treats >1 as ambiguous (rejected with generic 401, no enumeration).
 * Filters to ACTIVE users with LOCAL provider + active identity + current
 * credential. Case-insensitive email match.
 */
export async function findLoginCandidatesByEmail(
  q: DbConnector,
  email: string,
): Promise<LoginCandidate[]> {
  const { rows } = await q.query<{
    user_id: string;
    user_tenant_id: string;
    user_email: string;
    user_display_name: string;
    auth_identity_id: string;
    auth_credential_id: string;
    auth_credential_hash: string;
    auth_credential_must_rotate: boolean;
  }>(
    `
    SELECT u.user_id, u.user_tenant_id, u.user_email, u.user_display_name,
           i.auth_identity_id,
           c.auth_credential_id, c.auth_credential_hash, c.auth_credential_must_rotate
      FROM sys.sys_users u
      JOIN sys.sys_auth_identities i ON i.auth_identity_user_id = u.user_id
                                    AND i.auth_identity_provider = 'LOCAL'
                                    AND i.auth_identity_is_active = true
      JOIN sys.sys_auth_credentials c ON c.auth_credential_identity_id = i.auth_identity_id
                                     AND c.auth_credential_is_current = true
     WHERE lower(u.user_email) = lower($1)
       AND u.user_status = 'ACTIVE'
    `,
    [email],
  );

  return rows.map((r) => ({
    userId: r.user_id,
    userTenantId: r.user_tenant_id,
    userEmail: r.user_email,
    userDisplayName: r.user_display_name,
    identityId: r.auth_identity_id,
    credentialId: r.auth_credential_id,
    credentialHash: r.auth_credential_hash,
    credentialMustRotate: r.auth_credential_must_rotate,
  }));
}

/**
 * Returns roles granted to a user. Each row indicates platform-scope
 * (tenantId NULL) or tenant-scope (tenantId populated). The service layer
 * chooses the JWT tenant_id claim based on the platform-role presence.
 */
export interface UserRoleGrant {
  roleCode: RoleCode;
  isPlatform: boolean;
  tenantId: string | null;
}

export async function getUserRoleGrants(
  q: DbConnector,
  userId: string,
): Promise<UserRoleGrant[]> {
  const { rows } = await q.query<{
    role_code: string;
    is_platform: boolean;
    tenant_id: string | null;
  }>(
    `
    SELECT r.auth_role_code        AS role_code,
           r.auth_role_is_platform AS is_platform,
           uar.user_auth_role_tenant_id AS tenant_id
      FROM sys.sys_user_auth_roles uar
      JOIN sys.sys_auth_roles r ON r.auth_role_id = uar.user_auth_role_role_id
     WHERE uar.user_auth_role_user_id = $1
       AND uar.user_auth_role_revoked_at IS NULL
    `,
    [userId],
  );

  return rows.map((r) => ({
    roleCode: r.role_code as RoleCode,
    isPlatform: r.is_platform,
    tenantId: r.tenant_id,
  }));
}

/* === Credential rotation ================================================= */

export async function markCredentialNotCurrent(
  q: DbConnector,
  credentialId: string,
): Promise<void> {
  await q.query(
    `UPDATE sys.sys_auth_credentials
        SET auth_credential_is_current = false,
            rotated_at = now()
      WHERE auth_credential_id = $1`,
    [credentialId],
  );
}

export async function markAllCredentialsNotCurrentForUser(
  q: DbConnector,
  userId: string,
): Promise<void> {
  await q.query(
    `UPDATE sys.sys_auth_credentials c
        SET auth_credential_is_current = false,
            rotated_at = now()
       FROM sys.sys_auth_identities i
      WHERE c.auth_credential_identity_id = i.auth_identity_id
        AND i.auth_identity_user_id = $1
        AND c.auth_credential_is_current = true`,
    [userId],
  );
}

export async function insertCredential(
  q: DbConnector,
  params: { identityId: string; hash: string; mustRotate?: boolean },
): Promise<string> {
  const { rows } = await q.query<{ auth_credential_id: string }>(
    `INSERT INTO sys.sys_auth_credentials
       (auth_credential_identity_id, auth_credential_algorithm,
        auth_credential_hash, auth_credential_is_current,
        auth_credential_must_rotate)
     VALUES ($1, 'ARGON2ID', $2, true, $3)
     RETURNING auth_credential_id`,
    [params.identityId, params.hash, params.mustRotate ?? false],
  );
  return rows[0]!.auth_credential_id;
}

/* === Refresh token rotation chain ======================================== */

export interface RefreshTokenRow {
  refreshTokenId: string;
  userId: string;
  tenantId: string;
  familyId: string;
  previousId: string | null;
  usedAt: Date | null;
  revokedAt: Date | null;
  expiresAt: Date;
}

export interface InsertRefreshTokenParams {
  userId: string;
  tenantId: string;
  familyId: string;
  previousId: string | null;
  tokenHash: string;
  expiresAt: Date;
  ip: string | null;
  userAgent: string | null;
}

export async function insertRefreshToken(
  q: DbConnector,
  params: InsertRefreshTokenParams,
): Promise<{ refreshTokenId: string; issuedAt: Date }> {
  const { rows } = await q.query<{
    auth_refresh_token_id: string;
    auth_refresh_token_issued_at: Date;
  }>(
    `INSERT INTO sys.sys_auth_refresh_tokens
       (auth_refresh_token_user_id, auth_refresh_token_tenant_id,
        auth_refresh_token_family_id, auth_refresh_token_previous_id,
        auth_refresh_token_hash, auth_refresh_token_expires_at,
        auth_refresh_token_ip, auth_refresh_token_user_agent)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING auth_refresh_token_id, auth_refresh_token_issued_at`,
    [
      params.userId,
      params.tenantId,
      params.familyId,
      params.previousId,
      params.tokenHash,
      params.expiresAt,
      params.ip,
      params.userAgent,
    ],
  );
  return {
    refreshTokenId: rows[0]!.auth_refresh_token_id,
    issuedAt: rows[0]!.auth_refresh_token_issued_at,
  };
}

export async function findRefreshTokenByHash(
  q: DbConnector,
  tokenHash: string,
): Promise<RefreshTokenRow | null> {
  const { rows } = await q.query<{
    auth_refresh_token_id: string;
    auth_refresh_token_user_id: string;
    auth_refresh_token_tenant_id: string;
    auth_refresh_token_family_id: string;
    auth_refresh_token_previous_id: string | null;
    auth_refresh_token_used_at: Date | null;
    auth_refresh_token_revoked_at: Date | null;
    auth_refresh_token_expires_at: Date;
  }>(
    `SELECT auth_refresh_token_id, auth_refresh_token_user_id,
            auth_refresh_token_tenant_id, auth_refresh_token_family_id,
            auth_refresh_token_previous_id, auth_refresh_token_used_at,
            auth_refresh_token_revoked_at, auth_refresh_token_expires_at
       FROM sys.sys_auth_refresh_tokens
      WHERE auth_refresh_token_hash = $1`,
    [tokenHash],
  );
  if (rows.length === 0) return null;
  const r = rows[0]!;
  return {
    refreshTokenId: r.auth_refresh_token_id,
    userId: r.auth_refresh_token_user_id,
    tenantId: r.auth_refresh_token_tenant_id,
    familyId: r.auth_refresh_token_family_id,
    previousId: r.auth_refresh_token_previous_id,
    usedAt: r.auth_refresh_token_used_at,
    revokedAt: r.auth_refresh_token_revoked_at,
    expiresAt: r.auth_refresh_token_expires_at,
  };
}

/**
 * Atomically marks a refresh token used. Returns true on success, false if
 * the token was already used or revoked (race-condition safe via RETURNING).
 */
export async function tryMarkRefreshTokenUsed(
  q: DbConnector,
  refreshTokenId: string,
): Promise<boolean> {
  const { rowCount } = await q.query(
    `UPDATE sys.sys_auth_refresh_tokens
        SET auth_refresh_token_used_at = now()
      WHERE auth_refresh_token_id = $1
        AND auth_refresh_token_used_at IS NULL
        AND auth_refresh_token_revoked_at IS NULL`,
    [refreshTokenId],
  );
  return (rowCount ?? 0) === 1;
}

export async function revokeRefreshFamily(
  q: DbConnector,
  familyId: string,
  reason: string,
): Promise<number> {
  const { rowCount } = await q.query(
    `UPDATE sys.sys_auth_refresh_tokens
        SET auth_refresh_token_revoked_at = now(),
            auth_refresh_token_revoke_reason = $2
      WHERE auth_refresh_token_family_id = $1
        AND auth_refresh_token_revoked_at IS NULL`,
    [familyId, reason],
  );
  return rowCount ?? 0;
}

export async function revokeAllRefreshTokensForUser(
  q: DbConnector,
  userId: string,
  reason: string,
): Promise<number> {
  const { rowCount } = await q.query(
    `UPDATE sys.sys_auth_refresh_tokens
        SET auth_refresh_token_revoked_at = now(),
            auth_refresh_token_revoke_reason = $2
      WHERE auth_refresh_token_user_id = $1
        AND auth_refresh_token_revoked_at IS NULL`,
    [userId, reason],
  );
  return rowCount ?? 0;
}

/* === Login event log ===================================================== */

export interface InsertLoginEventParams {
  userId: string | null;
  tenantId: string | null;
  type: string;
  ip: string | null;
  userAgent: string | null;
  details?: Record<string, unknown>;
}

export async function insertLoginEvent(
  q: DbConnector,
  params: InsertLoginEventParams,
): Promise<void> {
  await q.query(
    `INSERT INTO sys.sys_auth_login_events
       (auth_login_event_user_id, auth_login_event_tenant_id,
        auth_login_event_type, auth_login_event_ip,
        auth_login_event_user_agent, auth_login_event_details)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
    [
      params.userId,
      params.tenantId,
      params.type,
      params.ip,
      params.userAgent,
      JSON.stringify(params.details ?? {}),
    ],
  );
}

/* === /auth/me lookup ===================================================== */

export interface MeRecord {
  userId: string;
  email: string;
  userTenantId: string;
}

export async function findUserForMe(
  q: DbConnector,
  userId: string,
): Promise<MeRecord | null> {
  const { rows } = await q.query<{
    user_id: string;
    user_email: string;
    user_tenant_id: string;
  }>(
    `SELECT user_id, user_email, user_tenant_id
       FROM sys.sys_users
      WHERE user_id = $1
        AND user_status = 'ACTIVE'`,
    [userId],
  );
  if (rows.length === 0) return null;
  const r = rows[0]!;
  return { userId: r.user_id, email: r.user_email, userTenantId: r.user_tenant_id };
}

/* === Password reset ====================================================== */

export interface InsertPasswordResetTokenParams {
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  requesterIp: string | null;
}

export async function insertPasswordResetToken(
  q: DbConnector,
  params: InsertPasswordResetTokenParams,
): Promise<string> {
  const { rows } = await q.query<{ auth_password_reset_token_id: string }>(
    `INSERT INTO sys.sys_auth_password_reset_tokens
       (auth_password_reset_user_id, auth_password_reset_token_hash,
        auth_password_reset_expires_at, auth_password_reset_requester_ip)
     VALUES ($1, $2, $3, $4)
     RETURNING auth_password_reset_token_id`,
    [params.userId, params.tokenHash, params.expiresAt, params.requesterIp],
  );
  return rows[0]!.auth_password_reset_token_id;
}

export interface PasswordResetTokenRow {
  tokenId: string;
  userId: string;
  expiresAt: Date;
}

export async function findActivePasswordResetByHash(
  q: DbConnector,
  tokenHash: string,
): Promise<PasswordResetTokenRow | null> {
  const { rows } = await q.query<{
    auth_password_reset_token_id: string;
    auth_password_reset_user_id: string;
    auth_password_reset_expires_at: Date;
  }>(
    `SELECT auth_password_reset_token_id, auth_password_reset_user_id,
            auth_password_reset_expires_at
       FROM sys.sys_auth_password_reset_tokens
      WHERE auth_password_reset_token_hash = $1
        AND auth_password_reset_used_at IS NULL
        AND auth_password_reset_expires_at > now()`,
    [tokenHash],
  );
  if (rows.length === 0) return null;
  const r = rows[0]!;
  return {
    tokenId: r.auth_password_reset_token_id,
    userId: r.auth_password_reset_user_id,
    expiresAt: r.auth_password_reset_expires_at,
  };
}

/**
 * Atomically marks a password-reset token used. Returns true on success,
 * false if the token was already used (race-condition safe via WHERE clause).
 */
export async function tryMarkPasswordResetUsed(
  q: DbConnector,
  tokenId: string,
): Promise<boolean> {
  const { rowCount } = await q.query(
    `UPDATE sys.sys_auth_password_reset_tokens
        SET auth_password_reset_used_at = now()
      WHERE auth_password_reset_token_id = $1
        AND auth_password_reset_used_at IS NULL`,
    [tokenId],
  );
  return (rowCount ?? 0) === 1;
}

/**
 * Returns the LOCAL identity for a user (single row expected by schema's
 * partial unique index). Used by password-reset complete to know which
 * identity to attach the new credential to.
 */
export async function findLocalIdentityForUser(
  q: DbConnector,
  userId: string,
): Promise<{ identityId: string } | null> {
  const { rows } = await q.query<{ auth_identity_id: string }>(
    `SELECT auth_identity_id
       FROM sys.sys_auth_identities
      WHERE auth_identity_user_id = $1
        AND auth_identity_provider = 'LOCAL'
        AND auth_identity_is_active = true
      LIMIT 1`,
    [userId],
  );
  if (rows.length === 0) return null;
  return { identityId: rows[0]!.auth_identity_id };
}

/**
 * Lookup user by email for password-reset request. Returns rows (0..N) —
 * service layer returns 204 regardless of count (no enumeration).
 */
export async function findUsersByEmailForReset(
  q: DbConnector,
  email: string,
): Promise<Array<{ userId: string; tenantId: string }>> {
  const { rows } = await q.query<{ user_id: string; user_tenant_id: string }>(
    `SELECT user_id, user_tenant_id
       FROM sys.sys_users
      WHERE lower(user_email) = lower($1)
        AND user_status = 'ACTIVE'`,
    [email],
  );
  return rows.map((r) => ({ userId: r.user_id, tenantId: r.user_tenant_id }));
}

/* === Transaction helper ================================================== */

/**
 * Runs the callback inside a single transaction. Auto-commits on success,
 * rolls back on any thrown error. The callback receives the PoolClient and
 * passes it to the repository functions to ensure all queries share the
 * same transaction.
 */
export async function withTransaction<T>(
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/* --- Role × Permission matrix (read-only, MVP-2a /admin/roles) -------- */

export async function listRolePermissions(
  q: DbConnector,
): Promise<Array<{
  roleCode: string;
  permissionCode: string;
  permissionResource: string;
  permissionAction: string;
}>> {
  const res = await q.query<{
    role_code: string;
    permission_code: string;
    permission_resource: string;
    permission_action: string;
  }>(
    `SELECT r.auth_role_code        AS role_code,
            p.auth_permission_code  AS permission_code,
            p.auth_permission_resource AS permission_resource,
            p.auth_permission_action   AS permission_action
       FROM sys.sys_auth_role_permissions rp
       JOIN sys.sys_auth_roles r ON r.auth_role_id = rp.auth_role_id
       JOIN sys.sys_auth_permissions p ON p.auth_permission_id = rp.auth_permission_id
      ORDER BY r.auth_role_code, p.auth_permission_code`,
  );
  return res.rows.map((row) => ({
    roleCode: row.role_code,
    permissionCode: row.permission_code,
    permissionResource: row.permission_resource,
    permissionAction: row.permission_action,
  }));
}
