/**
 * db/scripts/seed-r2-personas.ts
 * R2 (S955) login provisioner — makes the R2 role-holders LOGIN-CAPABLE.
 *
 * Companion to migration 000049 (which grants the 4 holderless auth-roles). The grants are
 * structural data (SQL migration); the LOGIN (LOCAL identity + ARGON2ID credential) cannot run
 * in SQL (argon2), so it lives here — same idempotent ensureAuth pattern as seed-test-admin.ts.
 *
 *   ┌──────────────────────────────────┬───────────────────┬────────────────────────┐
 *   │ user                             │ role (mig 000049) │ pattern                 │
 *   ├──────────────────────────────────┼───────────────────┼────────────────────────┤
 *   │ luca.bianchi@rtl-bank.org        │ PROCESS_OWNER     │ B: grant + login (new) │
 *   │ quintino.bellini@rtl-bank.org    │ BLUEPRINT_MANAGER │ B: grant + login (new) │
 *   │ alberto.rossetti@rtl-bank.org    │ READ_ONLY         │ B: grant + login (new) │
 *   │ maria.colombo@rtl-bank.org       │ HRMS_MANAGER      │ A: login-only (held)   │
 *   │ valentina.conti@rtl-bank.org     │ HRMS_MANAGER      │ A: login-only (held)   │
 *   └──────────────────────────────────┴───────────────────┴────────────────────────┘
 *
 * (federica.marchetti — CEO grant — already has a login; not provisioned here.)
 *
 * Idempotent: identity/credential checked before insert; re-run reports EXISTS. Never inserts
 * users / roles / positions. Set R2_RESET_PASSWORD=1 to rotate the credential.
 *
 * Run: pnpm exec tsx db/scripts/seed-r2-personas.ts
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

/** R2 role-holders that must become login-capable. */
const R2_EMAILS: readonly string[] = [
  "luca.bianchi@rtl-bank.org",
  "quintino.bellini@rtl-bank.org",
  "alberto.rossetti@rtl-bank.org",
  "maria.colombo@rtl-bank.org",
  "valentina.conti@rtl-bank.org",
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

/** Ensure a real user has a LOCAL identity + a current ARGON2ID credential. User MUST exist. */
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
    throw new Error(`R2 user not found: ${email} — run the RTL rebuild seeds first.`);
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
  const password = process.env.R2_PASSWORD ?? DEFAULT_PASSWORD;
  const wantsReset = process.env.R2_RESET_PASSWORD === "1";

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
    for (const email of R2_EMAILS) {
      report.push({ email, ...(await ensureAuth(client, email, password, wantsReset)) });
    }
    await client.query("COMMIT");

    console.log("─".repeat(76));
    console.log("R2 role-holder auth seeded (real RTL_BANK users):");
    for (const r of report) {
      console.log(
        `  ${r.email.padEnd(34)} identity=${r.identityCreated ? "CREATED" : "EXISTS"} credential=${r.credentialCreated ? "CREATED" : "EXISTS"}`,
      );
    }
    console.log(`  password : ${password}${process.env.R2_PASSWORD ? " (env)" : " (default)"}`);
    console.log("─".repeat(76));
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("seed-r2-personas FAILED:", err);
  process.exit(1);
});
