/**
 * db/scripts/seed-r1b-personas.ts
 * WS-4 R1b login provisioner — makes the TEAM_LEADER verify persona login-capable.
 *
 * Companion to migration 000054 (team roles/perms) + seed 13_teams_from_org.sql (which grants
 * TEAM_LEADER/TEAM_MEMBER to the real org leads/members). The grants are structural data; the
 * LOGIN (LOCAL identity + ARGON2ID credential) cannot run in SQL (argon2), so it lives here —
 * same idempotent ensureAuth pattern as seed-r2-personas.ts.
 *
 *   ┌──────────────────────────────┬─────────────────────┬──────────────────────────────────┐
 *   │ user                         │ role (seed 13)      │ note                              │
 *   ├──────────────────────────────┼─────────────────────┼──────────────────────────────────┤
 *   │ marco.rinaldi@rtl-bank.org   │ TEAM_LEADER+MEMBER  │ leads DIV-CFO, member of DIR-INFRA│
 *   └──────────────────────────────┴─────────────────────┴──────────────────────────────────┘
 *
 * (antonio.parisi — the TEAM_MEMBER verify persona, member of DIV-CFO — already has a login as
 *  the "outsider" persona; not provisioned here.)
 *
 * Idempotent: identity/credential checked before insert; re-run reports EXISTS. Never inserts
 * users / roles / positions. Set R1B_RESET_PASSWORD=1 to rotate the credential.
 *
 * Run: pnpm db:seed-r1b  (or: pnpm exec tsx db/scripts/seed-r1b-personas.ts)
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

/** R1b TEAM_LEADER verify persona that must become login-capable. */
const R1B_EMAILS: readonly string[] = ["marco.rinaldi@rtl-bank.org"];

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
    throw new Error(`R1b user not found: ${email} — run the RTL rebuild seeds first.`);
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
  // F-001: env-driven, no committed default; fail closed if unset.
  const password = process.env.R1B_PASSWORD ?? process.env.TEST_ADMIN_PASSWORD;
  if (!password) {
    console.error("Set TEST_ADMIN_PASSWORD (or R1B_PASSWORD) in .env — no committed default (F-001).");
    process.exit(1);
  }
  const wantsReset = process.env.R1B_RESET_PASSWORD === "1";

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
    for (const email of R1B_EMAILS) {
      report.push({ email, ...(await ensureAuth(client, email, password, wantsReset)) });
    }
    await client.query("COMMIT");

    console.log("─".repeat(76));
    console.log("R1b TEAM_LEADER persona auth seeded (real RTL_BANK user):");
    for (const r of report) {
      console.log(
        `  ${r.email.padEnd(34)} identity=${r.identityCreated ? "CREATED" : "EXISTS"} credential=${r.credentialCreated ? "CREATED" : "EXISTS"}`,
      );
    }
    console.log(`  password : (from env, ${password.length} chars — value never logged)`);
    console.log("─".repeat(76));
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("seed-r1b-personas FAILED:", err);
  process.exit(1);
});
