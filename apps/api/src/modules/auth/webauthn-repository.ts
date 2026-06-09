/**
 * apps/api/src/modules/auth/webauthn-repository.ts
 *
 * Raw SQL access to sys.sys_auth_mfa_webauthn_credentials (migration 000102).
 * One row per registered authenticator (passkey / security key); the parent
 * factor row lives in sys.sys_auth_mfa_factors (kind='WEBAUTHN'). Same idioms
 * as mfa-repository.ts: parameterised pg queries, no Drizzle query builder.
 *
 * The COSE public key is stored as `bytea` <-> a Node Buffer (bound directly as
 * a $ param — node-postgres maps a Buffer to bytea). The base64url credential
 * id is stored as `text` (UNIQUE) and is the lookup key at authentication time.
 */

import type { Pool, PoolClient } from "pg";

type DbConnector = Pool | PoolClient;

export interface WebauthnCredentialRow {
  credId: string;
  factorId: string;
  userId: string;
  credentialId: string;
  /** COSE public key as a Node Buffer (bytea column). */
  publicKey: Buffer;
  counter: number;
  /** JSON-array string of AuthenticatorTransportFuture values. */
  transports: string;
  aaguid: string | null;
  deviceLabel: string;
  backupEligible: boolean;
  backupState: boolean;
  lastUsedAt: Date | null;
  createdAt: Date;
}

function mapRow(r: {
  auth_webauthn_cred_id: string;
  auth_webauthn_cred_factor_id: string;
  auth_webauthn_cred_user_id: string;
  auth_webauthn_cred_credential_id: string;
  auth_webauthn_cred_public_key: Buffer;
  // bigint comes back from node-postgres as a string by default.
  auth_webauthn_cred_counter: string | number;
  auth_webauthn_cred_transports: string;
  auth_webauthn_cred_aaguid: string | null;
  auth_webauthn_cred_device_label: string;
  auth_webauthn_cred_backup_eligible: boolean;
  auth_webauthn_cred_backup_state: boolean;
  auth_webauthn_cred_last_used_at: Date | null;
  created_at: Date;
}): WebauthnCredentialRow {
  return {
    credId: r.auth_webauthn_cred_id,
    factorId: r.auth_webauthn_cred_factor_id,
    userId: r.auth_webauthn_cred_user_id,
    credentialId: r.auth_webauthn_cred_credential_id,
    publicKey: r.auth_webauthn_cred_public_key,
    counter: Number(r.auth_webauthn_cred_counter),
    transports: r.auth_webauthn_cred_transports,
    aaguid: r.auth_webauthn_cred_aaguid,
    deviceLabel: r.auth_webauthn_cred_device_label,
    backupEligible: r.auth_webauthn_cred_backup_eligible,
    backupState: r.auth_webauthn_cred_backup_state,
    lastUsedAt: r.auth_webauthn_cred_last_used_at,
    createdAt: r.created_at,
  };
}

export async function insertWebauthnCredential(
  q: DbConnector,
  params: {
    factorId: string;
    userId: string;
    credentialId: string;
    publicKey: Buffer;
    counter: number;
    transports: string[];
    aaguid: string | null;
    deviceLabel: string;
    backupEligible?: boolean;
    backupState?: boolean;
  },
): Promise<WebauthnCredentialRow> {
  const { rows } = await q.query<Parameters<typeof mapRow>[0]>(
    `INSERT INTO sys.sys_auth_mfa_webauthn_credentials
       (auth_webauthn_cred_factor_id, auth_webauthn_cred_user_id,
        auth_webauthn_cred_credential_id, auth_webauthn_cred_public_key,
        auth_webauthn_cred_counter, auth_webauthn_cred_transports,
        auth_webauthn_cred_aaguid, auth_webauthn_cred_device_label,
        auth_webauthn_cred_backup_eligible, auth_webauthn_cred_backup_state)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING *`,
    [
      params.factorId,
      params.userId,
      params.credentialId,
      params.publicKey,
      params.counter,
      JSON.stringify(params.transports ?? []),
      params.aaguid,
      params.deviceLabel,
      params.backupEligible ?? false,
      params.backupState ?? false,
    ],
  );
  return mapRow(rows[0]!);
}

/** All credentials for a user (used to build allowCredentials / excludeCredentials). */
export async function findCredentialsForUser(
  q: DbConnector,
  userId: string,
): Promise<WebauthnCredentialRow[]> {
  const { rows } = await q.query<Parameters<typeof mapRow>[0]>(
    `SELECT * FROM sys.sys_auth_mfa_webauthn_credentials
      WHERE auth_webauthn_cred_user_id = $1
      ORDER BY created_at DESC`,
    [userId],
  );
  return rows.map(mapRow);
}

/** Single credential by its base64url credential id (the assertion lookup key). */
export async function findCredentialByCredentialId(
  q: DbConnector,
  credentialId: string,
): Promise<WebauthnCredentialRow | null> {
  const { rows } = await q.query<Parameters<typeof mapRow>[0]>(
    `SELECT * FROM sys.sys_auth_mfa_webauthn_credentials
      WHERE auth_webauthn_cred_credential_id = $1`,
    [credentialId],
  );
  return rows[0] ? mapRow(rows[0]) : null;
}

/** Advance the stored signature counter + stamp last-used (post-assertion replay defence). */
export async function updateCredentialCounter(
  q: DbConnector,
  credentialId: string,
  newCounter: number,
): Promise<void> {
  await q.query(
    `UPDATE sys.sys_auth_mfa_webauthn_credentials
        SET auth_webauthn_cred_counter = $2,
            auth_webauthn_cred_last_used_at = now()
      WHERE auth_webauthn_cred_credential_id = $1`,
    [credentialId, newCounter],
  );
}
