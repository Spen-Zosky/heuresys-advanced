/**
 * db/scripts/seed-test-admin.ts
 * MVP-1 step 5.1.3f — Idempotent seed of a PLATFORM_ADMIN test user used for
 * local development and integration testing of the /v1/auth/* endpoints.
 *
 * Identity:
 *   email    : admin@heuresys.com
 *   password : TEST_ADMIN_PASSWORD env var, default Admin#PassW0rd!
 *   role     : PLATFORM_ADMIN (platform-scoped, user_auth_role_tenant_id NULL)
 *
 * The sys_users row needs a non-NULL user_tenant_id by schema; we anchor it
 * to the RTL_BANK_REFERENCE tenant (already present from MVP-0 5.0.7). The
 * platform-role grant has tenant_id NULL so the issued JWT carries
 * tenant_id=null and the user operates cross-tenant per AUTH §7.3.
 *
 * Idempotency: every step checks for an existing row before inserting.
 * Re-running this script after a clean install reports "already seeded" and
 * exits cleanly.
 *
 * Run: pnpm --filter @heuresys/api exec tsx db/scripts/seed-test-admin.ts
 *      (or via package.json script `pnpm db:seed-test-admin`)
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

const TEST_ADMIN_EMAIL = "admin@heuresys.com";
const TEST_ADMIN_DEFAULT_PASSWORD = "Admin#PassW0rd!";
const TEST_ADMIN_DISPLAY_NAME = "Heuresys Test Admin";

const ARGON2_PARAMS = {
  type: argon2.argon2id,
  memoryCost: 65536,
  timeCost: 3,
  parallelism: 4,
  hashLength: 32,
} as const;

async function main() {
  const password = process.env.TEST_ADMIN_PASSWORD ?? TEST_ADMIN_DEFAULT_PASSWORD;

  const client = new Client({
    host: process.env.POSTGRES_HOST,
    port: Number(process.env.POSTGRES_PORT),
    database: process.env.POSTGRES_DB,
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
  });

  await client.connect();
  console.log(
    `Connected to ${process.env.POSTGRES_HOST}:${process.env.POSTGRES_PORT}/${process.env.POSTGRES_DB}`,
  );

  try {
    await client.query("BEGIN");

    // 1. Resolve the anchor tenant (RTL_BANK_REFERENCE).
    const tenantRes = await client.query<{ tenant_id: string }>(
      `SELECT tenant_id FROM sys.sys_tenancies WHERE tenant_code = 'RTL_BANK_REFERENCE'`,
    );
    if (tenantRes.rows.length === 0) {
      throw new Error(
        "RTL_BANK_REFERENCE tenant not found — run db:seed first (MVP-0 5.0.7).",
      );
    }
    const anchorTenantId = tenantRes.rows[0]!.tenant_id;

    // 2. Resolve the PLATFORM_ADMIN role.
    const roleRes = await client.query<{ auth_role_id: string }>(
      `SELECT auth_role_id FROM sys.sys_auth_roles WHERE auth_role_code = 'PLATFORM_ADMIN'`,
    );
    if (roleRes.rows.length === 0) {
      throw new Error(
        "PLATFORM_ADMIN role not found — auth migration 000005 seed missing.",
      );
    }
    const platformRoleId = roleRes.rows[0]!.auth_role_id;

    // 3. Find or create the user.
    const userExisting = await client.query<{ user_id: string }>(
      `SELECT user_id FROM sys.sys_users
        WHERE user_tenant_id = $1 AND lower(user_email) = lower($2)`,
      [anchorTenantId, TEST_ADMIN_EMAIL],
    );
    let userId: string;
    let userCreated = false;
    if (userExisting.rows.length > 0) {
      userId = userExisting.rows[0]!.user_id;
    } else {
      const ins = await client.query<{ user_id: string }>(
        `INSERT INTO sys.sys_users (
            user_tenant_id, user_email, user_display_name,
            user_first_name, user_last_name,
            user_status, user_type, user_is_synthetic, user_metadata
          ) VALUES ($1, $2, $3, $4, $5, 'ACTIVE', 'STANDARD', false, '{"seed":"test-admin"}'::jsonb)
          RETURNING user_id`,
        [anchorTenantId, TEST_ADMIN_EMAIL, TEST_ADMIN_DISPLAY_NAME, "Test", "Admin"],
      );
      userId = ins.rows[0]!.user_id;
      userCreated = true;
    }

    // 4. Find or create the LOCAL identity.
    const idtExisting = await client.query<{ auth_identity_id: string }>(
      `SELECT auth_identity_id FROM sys.sys_auth_identities
        WHERE auth_identity_user_id = $1 AND auth_identity_provider = 'LOCAL'`,
      [userId],
    );
    let identityId: string;
    let identityCreated = false;
    if (idtExisting.rows.length > 0) {
      identityId = idtExisting.rows[0]!.auth_identity_id;
    } else {
      const ins = await client.query<{ auth_identity_id: string }>(
        `INSERT INTO sys.sys_auth_identities
            (auth_identity_user_id, auth_identity_provider,
             auth_identity_email_verified, auth_identity_is_active)
          VALUES ($1, 'LOCAL', true, true)
          RETURNING auth_identity_id`,
        [userId],
      );
      identityId = ins.rows[0]!.auth_identity_id;
      identityCreated = true;
    }

    // 5. Ensure a current credential exists with the requested password.
    //    If a current credential exists, leave it alone (idempotent). To
    //    force a rotation, run with TEST_ADMIN_RESET_PASSWORD=1 — that
    //    marks the existing one not-current and inserts a fresh hash.
    const credExisting = await client.query<{ auth_credential_id: string }>(
      `SELECT auth_credential_id FROM sys.sys_auth_credentials
        WHERE auth_credential_identity_id = $1 AND auth_credential_is_current = true`,
      [identityId],
    );
    const wantsReset = process.env.TEST_ADMIN_RESET_PASSWORD === "1";
    let credentialCreated = false;
    if (credExisting.rows.length > 0 && !wantsReset) {
      // already has a current credential — keep it
    } else {
      if (credExisting.rows.length > 0) {
        await client.query(
          `UPDATE sys.sys_auth_credentials
              SET auth_credential_is_current = false, rotated_at = now()
            WHERE auth_credential_id = $1`,
          [credExisting.rows[0]!.auth_credential_id],
        );
      }
      const hash = await argon2.hash(password, ARGON2_PARAMS);
      await client.query(
        `INSERT INTO sys.sys_auth_credentials
            (auth_credential_identity_id, auth_credential_algorithm,
             auth_credential_hash, auth_credential_is_current,
             auth_credential_must_rotate)
          VALUES ($1, 'ARGON2ID', $2, true, false)`,
        [identityId, hash],
      );
      credentialCreated = true;
    }

    // 6. Ensure the PLATFORM_ADMIN role grant exists (tenant_id NULL).
    //    The partial unique index uses COALESCE(tenant_id, zero-uuid) so a
    //    duplicate insert is blocked by the DB. We pre-check to give a
    //    cleaner log message.
    const grantExisting = await client.query<{ user_auth_role_id: string }>(
      `SELECT user_auth_role_id FROM sys.sys_user_auth_roles
        WHERE user_auth_role_user_id = $1
          AND user_auth_role_role_id = $2
          AND user_auth_role_tenant_id IS NULL
          AND user_auth_role_revoked_at IS NULL`,
      [userId, platformRoleId],
    );
    let grantCreated = false;
    if (grantExisting.rows.length === 0) {
      await client.query(
        `INSERT INTO sys.sys_user_auth_roles
            (user_auth_role_user_id, user_auth_role_role_id,
             user_auth_role_tenant_id, user_auth_role_granted_by)
          VALUES ($1, $2, NULL, NULL)`,
        [userId, platformRoleId],
      );
      grantCreated = true;
    }

    await client.query("COMMIT");

    console.log("─".repeat(70));
    console.log("Test admin seeded:");
    console.log(`  email     : ${TEST_ADMIN_EMAIL}`);
    console.log(`  user_id   : ${userId}`);
    console.log(`  tenant    : RTL_BANK_REFERENCE (${anchorTenantId})`);
    console.log(`  role      : PLATFORM_ADMIN (tenant_id NULL, platform-scoped)`);
    console.log(
      `  status    : user=${userCreated ? "CREATED" : "EXISTS"}` +
        ` identity=${identityCreated ? "CREATED" : "EXISTS"}` +
        ` credential=${credentialCreated ? "CREATED" : "EXISTS"}` +
        ` role=${grantCreated ? "CREATED" : "EXISTS"}`,
    );
    if (credentialCreated) {
      console.log(
        `  password  : ${password}` +
          (process.env.TEST_ADMIN_PASSWORD
            ? " (from TEST_ADMIN_PASSWORD env)"
            : " (default — override via TEST_ADMIN_PASSWORD env)"),
      );
    } else {
      console.log(
        "  password  : unchanged. To rotate, re-run with TEST_ADMIN_RESET_PASSWORD=1.",
      );
    }
    console.log("─".repeat(70));
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("seed-test-admin FAILED:", err);
  process.exit(1);
});
