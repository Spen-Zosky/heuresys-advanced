/**
 * db/scripts/seed-service-user.ts
 * Integrazione #9 WI-A.2 — provision the headless Agent SDK service user.
 *
 * Creates (idempotently) a dedicated PLATFORM_ADMIN service account used by the
 * Agent SDK backend (apps/agent-gateway) to author the blueprint catalogue
 * headlessly, with a row in sys.sys_auth_mfa_exemptions so the mandatory-MFA
 * login gate (§3b) is bypassed FOR THIS ACCOUNT ONLY (mig 000116 + 000117).
 *
 *   • sys_users:                user_type='SERVICE', tenant = system tenant
 *   • sys_auth_identities:      LOCAL, active
 *   • sys_auth_credentials:     ARGON2ID (password from env, NEVER logged — R11)
 *   • sys_user_auth_roles:      PLATFORM_ADMIN, platform-wide (tenant_id NULL)
 *   • sys_auth_mfa_exemptions:  enabled (eligible via the PLATFORM_ADMIN grant)
 *
 * OPT-IN: a no-op unless BOTH AGENT_SERVICE_USER_EMAIL and
 * AGENT_SERVICE_USER_PASSWORD are set (no invented/committed credentials — R11).
 * The password lives ONLY in the per-host .env / secret store. Re-run is safe.
 *
 *   AGENT_SERVICE_USER_EMAIL        (required to provision)
 *   AGENT_SERVICE_USER_PASSWORD     (required to provision; secret, never logged)
 *   AGENT_SERVICE_USER_DISPLAY_NAME (optional, default "Agent SDK Service")
 *   AGENT_SERVICE_USER_TENANT_CODE  (optional; default = the tenant of admin@heuresys.com)
 *   AGENT_SERVICE_USER_RESET_PASSWORD=1  (optional; rotate the credential)
 *
 * Run: pnpm tsx db/scripts/seed-service-user.ts   (or add a package.json script)
 */

import { Client } from "pg";
import argon2 from "argon2";
import { config as dotenvConfig } from "dotenv";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolve(__dirname, "..", "..");
dotenvConfig({ path: resolve(repoRoot, ".env") });

const ARGON2_PARAMS = {
  type: argon2.argon2id,
  memoryCost: 65536,
  timeCost: 3,
  parallelism: 4,
  hashLength: 32,
} as const;

const EXTERNAL_CODE = "AGENT_SDK_SERVICE";

async function resolveTenantId(client: Client, code: string | undefined): Promise<string> {
  if (code) {
    const r = await client.query<{ tenant_id: string }>(
      `SELECT tenant_id FROM sys.sys_tenancies WHERE tenant_code = $1`,
      [code],
    );
    if (!r.rows[0]) throw new Error(`AGENT_SERVICE_USER_TENANT_CODE='${code}' not found in sys.sys_tenancies`);
    return r.rows[0].tenant_id;
  }
  // Default: co-locate with the native platform admin (admin@heuresys.com).
  const r = await client.query<{ user_tenant_id: string }>(
    `SELECT user_tenant_id FROM sys.sys_users WHERE lower(user_email) = lower($1)`,
    ["admin@heuresys.com"],
  );
  if (!r.rows[0]) {
    throw new Error("Cannot derive a tenant: admin@heuresys.com absent — set AGENT_SERVICE_USER_TENANT_CODE.");
  }
  return r.rows[0].user_tenant_id;
}

async function main() {
  const email = process.env.AGENT_SERVICE_USER_EMAIL;
  const password = process.env.AGENT_SERVICE_USER_PASSWORD;
  if (!email || !password) {
    console.log(
      "[seed-service-user] SKIPPED — set AGENT_SERVICE_USER_EMAIL + AGENT_SERVICE_USER_PASSWORD " +
        "(per-host .env / secret store) to provision the Agent SDK service user. No-op (R11: no invented credentials).",
    );
    return;
  }
  const displayName = process.env.AGENT_SERVICE_USER_DISPLAY_NAME ?? "Agent SDK Service";
  const tenantCode = process.env.AGENT_SERVICE_USER_TENANT_CODE;
  const wantsReset = process.env.AGENT_SERVICE_USER_RESET_PASSWORD === "1";

  const client = new Client({
    host: process.env.POSTGRES_HOST,
    port: Number(process.env.POSTGRES_PORT),
    database: process.env.POSTGRES_DB,
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
  });
  await client.connect();
  console.log(`Connected to ${process.env.POSTGRES_HOST}:${process.env.POSTGRES_PORT}/${process.env.POSTGRES_DB}`);

  try {
    await client.query("BEGIN");
    const tenantId = await resolveTenantId(client, tenantCode);

    // 1. sys_users (SERVICE). Idempotent by (tenant, lower(email)).
    let userRes = await client.query<{ user_id: string }>(
      `SELECT user_id FROM sys.sys_users WHERE user_tenant_id = $1 AND lower(user_email) = lower($2)`,
      [tenantId, email],
    );
    let userCreated = false;
    if (userRes.rows.length === 0) {
      userRes = await client.query<{ user_id: string }>(
        `INSERT INTO sys.sys_users
           (user_tenant_id, user_external_code, user_email, user_display_name,
            user_status, user_type)
         VALUES ($1, $2, $3, $4, 'ACTIVE', 'SERVICE')
         RETURNING user_id`,
        [tenantId, EXTERNAL_CODE, email, displayName],
      );
      userCreated = true;
    }
    const userId = userRes.rows[0]!.user_id;

    // 2. LOCAL identity.
    const idt = await client.query<{ auth_identity_id: string }>(
      `SELECT auth_identity_id FROM sys.sys_auth_identities
        WHERE auth_identity_user_id = $1 AND auth_identity_provider = 'LOCAL'`,
      [userId],
    );
    let identityId: string;
    if (idt.rows.length > 0) {
      identityId = idt.rows[0]!.auth_identity_id;
    } else {
      const ins = await client.query<{ auth_identity_id: string }>(
        `INSERT INTO sys.sys_auth_identities
           (auth_identity_user_id, auth_identity_provider, auth_identity_email_verified, auth_identity_is_active)
         VALUES ($1, 'LOCAL', true, true)
         RETURNING auth_identity_id`,
        [userId],
      );
      identityId = ins.rows[0]!.auth_identity_id;
    }

    // 3. ARGON2ID credential (current). Reset rotates.
    const cred = await client.query<{ auth_credential_id: string }>(
      `SELECT auth_credential_id FROM sys.sys_auth_credentials
        WHERE auth_credential_identity_id = $1 AND auth_credential_is_current = true`,
      [identityId],
    );
    let credentialWritten = false;
    if (cred.rows.length === 0 || wantsReset) {
      if (cred.rows.length > 0) {
        await client.query(
          `UPDATE sys.sys_auth_credentials SET auth_credential_is_current = false, rotated_at = now()
            WHERE auth_credential_id = $1`,
          [cred.rows[0]!.auth_credential_id],
        );
      }
      const hash = await argon2.hash(password, ARGON2_PARAMS);
      await client.query(
        `INSERT INTO sys.sys_auth_credentials
           (auth_credential_identity_id, auth_credential_algorithm, auth_credential_hash,
            auth_credential_is_current, auth_credential_must_rotate)
         VALUES ($1, 'ARGON2ID', $2, true, false)`,
        [identityId, hash],
      );
      credentialWritten = true;
    }

    // 4. PLATFORM_ADMIN grant, platform-wide (tenant_id NULL). Idempotent pre-check.
    const role = await client.query<{ auth_role_id: string }>(
      `SELECT auth_role_id FROM sys.sys_auth_roles WHERE auth_role_code = 'PLATFORM_ADMIN'`,
    );
    if (!role.rows[0]) throw new Error("PLATFORM_ADMIN role missing (run migrations).");
    const roleId = role.rows[0].auth_role_id;
    const grant = await client.query(
      `SELECT 1 FROM sys.sys_user_auth_roles
        WHERE user_auth_role_user_id = $1 AND user_auth_role_role_id = $2
          AND user_auth_role_tenant_id IS NULL AND user_auth_role_revoked_at IS NULL`,
      [userId, roleId],
    );
    let grantCreated = false;
    if (grant.rowCount === 0) {
      await client.query(
        `INSERT INTO sys.sys_user_auth_roles (user_auth_role_user_id, user_auth_role_role_id, user_auth_role_tenant_id)
         VALUES ($1, $2, NULL)`,
        [userId, roleId],
      );
      grantCreated = true;
    }

    // 5. MFA exemption (eligible via the PLATFORM_ADMIN grant — trigger 000117).
    const exempt = await client.query(
      `INSERT INTO sys.sys_auth_mfa_exemptions
         (auth_mfa_exemption_user_id, auth_mfa_exemption_reason, auth_mfa_exemption_enabled)
       VALUES ($1, $2, true)
       ON CONFLICT (auth_mfa_exemption_user_id) DO UPDATE SET auth_mfa_exemption_enabled = true
       RETURNING auth_mfa_exemption_id`,
      [userId, "Agent SDK headless service account (#9 WI-A)"],
    );

    await client.query("COMMIT");
    console.log("─".repeat(76));
    console.log("Agent SDK service user provisioned (PLATFORM_ADMIN, MFA-exempt):");
    console.log(`  email      : ${email}`);
    console.log(`  user_id    : ${userId}`);
    console.log(`  user       : ${userCreated ? "CREATED" : "EXISTS"}  (type=SERVICE)`);
    console.log(`  credential : ${credentialWritten ? (wantsReset ? "ROTATED" : "CREATED") : "EXISTS"}`);
    console.log(`  grant      : ${grantCreated ? "CREATED" : "EXISTS"}  (PLATFORM_ADMIN, platform-wide)`);
    console.log(`  exemption  : ${exempt.rowCount ? "ENSURED" : "EXISTS"}  (sys_auth_mfa_exemptions)`);
    console.log("  password   : (from env — not logged, R11)");
    console.log("─".repeat(76));
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("seed-service-user FAILED:", err);
  process.exit(1);
});
