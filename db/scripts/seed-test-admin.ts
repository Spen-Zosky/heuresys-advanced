/**
 * db/scripts/seed-test-admin.ts
 * E2E / integration persona AUTH seeder — idempotent, deterministic.
 *
 * Post RTL-rebuild (2026-05-30): the test personas are now REAL users wired into
 * the real RTL_BANK org by the rebuild seeds (db/seeds/rtl-rebuild/*) — they already
 * have positions, RBAC roles and assignments. This script's SOLE job is to make those
 * real users LOGIN-CAPABLE with the shared test password by ensuring a LOCAL auth
 * identity + a current ARGON2ID credential. It does NOT create users, grant roles, or
 * build positions (those come from the rebuild seeds).
 *
 *   ┌───────────────┬─────────────────────────────────┬──────────────────────────────┐
 *   │ persona       │ real user                       │ role / scope                  │
 *   ├───────────────┼─────────────────────────────────┼──────────────────────────────┤
 *   │ platformAdmin │ admin@heuresys.com              │ PLATFORM_ADMIN (native)       │
 *   │ tenantAdmin   │ federica.marchetti@rtl-bank.org │ TENANT_ADMIN  (RTL_BANK)      │
 *   │ manager       │ paolo.caputo@rtl-bank.org       │ MANAGER (manages tommaso)     │
 *   │ employee      │ tommaso.fiore@rtl-bank.org      │ USER (paolo's subordinate)    │
 *   │ outsider      │ antonio.parisi@rtl-bank.org     │ USER (claudia's team, not     │
 *   │               │                                 │   in paolo's team)            │
 *   └───────────────┴─────────────────────────────────┴──────────────────────────────┘
 *
 * The manager→employee reports-to edge and the outsider's separate team are REAL org
 * relationships (verified from sys_positions.reports_to + assignments), so the AUTH §6
 * scope matrix tests assert against authentic hierarchy, not a synthetic TEST_ scaffold.
 *
 * Idempotent: identity/credential are checked before insert; re-run reports EXISTS.
 * Set TEST_ADMIN_RESET_PASSWORD=1 to rotate the credential to the (default/env) password.
 *
 * Run: pnpm db:seed-test-admin
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

const DEFAULT_PASSWORD = "Admin#PassW0rd!";

/** The five E2E/integration personas, by real email. Order = display order. */
const PERSONA_EMAILS: readonly string[] = [
  "admin@heuresys.com",
  "federica.marchetti@rtl-bank.org",
  "paolo.caputo@rtl-bank.org",
  "tommaso.fiore@rtl-bank.org",
  "antonio.parisi@rtl-bank.org",
];

const ARGON2_PARAMS = {
  type: argon2.argon2id,
  memoryCost: 65536,
  timeCost: 3,
  parallelism: 4,
  hashLength: 32,
} as const;

interface EnsureResult {
  userId: string;
  identityCreated: boolean;
  credentialCreated: boolean;
}

/**
 * Ensure a real persona user has a LOCAL identity + a current ARGON2ID credential for
 * `password`. The user MUST already exist (created by the rebuild seeds). Never inserts
 * users / roles / positions.
 */
async function ensureAuth(
  client: Client,
  email: string,
  password: string,
  wantsReset: boolean,
): Promise<EnsureResult> {
  const userRes = await client.query<{ user_id: string }>(
    `SELECT user_id FROM sys.sys_users WHERE lower(user_email) = lower($1)`,
    [email],
  );
  if (userRes.rows.length === 0) {
    throw new Error(
      `persona user not found: ${email} — run the RTL rebuild seeds (db/seeds/rtl-rebuild) first.`,
    );
  }
  const userId = userRes.rows[0]!.user_id;

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

  const credExisting = await client.query<{ auth_credential_id: string }>(
    `SELECT auth_credential_id FROM sys.sys_auth_credentials
      WHERE auth_credential_identity_id = $1 AND auth_credential_is_current = true`,
    [identityId],
  );
  let credentialCreated = false;
  if (credExisting.rows.length === 0 || wantsReset) {
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

  return { userId, identityCreated, credentialCreated };
}

async function main() {
  const password = process.env.TEST_ADMIN_PASSWORD ?? DEFAULT_PASSWORD;
  const wantsReset = process.env.TEST_ADMIN_RESET_PASSWORD === "1";

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

    const report: Array<{ email: string } & EnsureResult> = [];
    for (const email of PERSONA_EMAILS) {
      const r = await ensureAuth(client, email, password, wantsReset);
      report.push({ email, ...r });
    }

    await client.query("COMMIT");

    console.log("─".repeat(76));
    console.log("E2E/integration persona auth seeded (real RTL_BANK users):");
    for (const r of report) {
      const flags = [
        r.identityCreated ? "identity=CREATED" : "identity=EXISTS",
        r.credentialCreated ? "credential=CREATED" : "credential=EXISTS",
      ];
      console.log(`  ${r.email.padEnd(34)} ${flags.join(" ")}`);
    }
    console.log(
      `  password : ${password}` +
        (process.env.TEST_ADMIN_PASSWORD ? " (env)" : " (default — set TEST_ADMIN_PASSWORD to override)"),
    );
    console.log("─".repeat(76));
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
