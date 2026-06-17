/**
 * db/scripts/encrypt-totp-secrets.ts
 *
 * QW-SEC6 — ONE-TIME bulk encryption-at-rest of the existing plaintext TOTP
 * factor secrets in sys.sys_auth_mfa_factors. Wraps every legacy-plaintext
 * `auth_mfa_factor_secret` as AES-256-GCM ciphertext (enc:v1:… prefix) using the
 * SAME helper the running API uses (apps/api/src/modules/auth/secret-crypto.ts),
 * so the derivation/format are byte-for-byte identical.
 *
 * ┌─ DEPLOY-GATED — DO NOT RUN BEFORE THE NEW CODE + KEY SHIP TO PROD ─────────┐
 * │ The shared OCI VM PROD database is read by the CURRENTLY-DEPLOYED API,     │
 * │ which expects PLAINTEXT base32 secrets. Encrypting the live rows BEFORE    │
 * │ the QW-SEC6 code (decryptSecret on read) + MFA_ENCRYPTION_KEY are live in  │
 * │ PROD would instantly break MFA verification (the old code would read the   │
 * │ enc:v1:… string as a base32 secret → every TOTP check fails).             │
 * │                                                                            │
 * │ CORRECT POST-DEPLOY SEQUENCE:                                              │
 * │   1. Ship the QW-SEC6 code to PROD (decrypt-on-read live).                 │
 * │   2. Ensure MFA_ENCRYPTION_KEY is present in the PROD .env (same value on  │
 * │      every box that reads the DB) — propagated via align-clones.sh.        │
 * │   3. THEN run this once:  pnpm db:encrypt-totp                              │
 * │ Until all three hold, this is blocked-on-deploy.                          │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * SAFETY / IDEMPOTENCY:
 *   • Rows already `enc:v1:`-prefixed are SKIPPED (re-run is a no-op).
 *   • Rows with NULL secret (EMAIL_OTP / SMS_OTP) are SKIPPED (no secret at rest).
 *   • Requires MFA_ENCRYPTION_KEY to be set — refuses to run otherwise (a no-key
 *     run would write plaintext back, achieving nothing).
 *   • Each row is verified to decrypt back to its original plaintext BEFORE the
 *     UPDATE is issued (fail-closed: a row that would not round-trip is left
 *     untouched and the run aborts).
 *   • DRY-RUN by default-safe usage: pass --apply to actually write. Without it
 *     the script reports what WOULD change and writes nothing.
 *
 * Run (after deploy):  pnpm db:encrypt-totp -- --apply
 * Preview only:        pnpm db:encrypt-totp
 */

import { Client } from "pg";
import { config as dotenvConfig } from "dotenv";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  encryptSecret,
  decryptSecret,
  isEncrypted,
  encryptionEnabled,
} from "../../apps/api/src/modules/auth/secret-crypto.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolve(__dirname, "..", "..");
dotenvConfig({ path: resolve(repoRoot, ".env") });

const APPLY = process.argv.includes("--apply");

async function main() {
  if (!encryptionEnabled()) {
    console.error(
      "[encrypt-totp-secrets] ABORT — MFA_ENCRYPTION_KEY is not set. Encrypting with no key " +
        "would write plaintext back (no-op). Set the key first (and ensure PROD has it).",
    );
    process.exit(1);
  }

  const client = new Client({
    host: process.env.POSTGRES_HOST,
    port: Number(process.env.POSTGRES_PORT),
    database: process.env.POSTGRES_DB,
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
  });
  await client.connect();
  console.log(`Connected to ${process.env.POSTGRES_HOST}:${process.env.POSTGRES_PORT}/${process.env.POSTGRES_DB}`);
  console.log(`Mode: ${APPLY ? "APPLY (will UPDATE rows)" : "DRY-RUN (no writes — pass --apply to write)"}`);

  try {
    // Only TOTP rows carry a secret at rest; restrict to non-null + not-yet-encrypted.
    const { rows } = await client.query<{ id: string; secret: string }>(
      `SELECT auth_mfa_factor_id AS id, auth_mfa_factor_secret AS secret
         FROM sys.sys_auth_mfa_factors
        WHERE auth_mfa_factor_secret IS NOT NULL`,
    );

    let encrypted = 0;
    let alreadyEncrypted = 0;
    for (const row of rows) {
      if (isEncrypted(row.secret)) {
        alreadyEncrypted += 1;
        continue;
      }
      const ciphertext = encryptSecret(row.secret);
      // Fail-closed round-trip check: never persist a value that won't decrypt back.
      if (!isEncrypted(ciphertext) || decryptSecret(ciphertext) !== row.secret) {
        throw new Error(`Round-trip check FAILED for factor ${row.id} — aborting, no rows written.`);
      }
      if (APPLY) {
        // Guarded UPDATE: only rewrite while the stored value is STILL the exact
        // plaintext we read (concurrency-safe; idempotent on re-run).
        await client.query(
          `UPDATE sys.sys_auth_mfa_factors
              SET auth_mfa_factor_secret = $2
            WHERE auth_mfa_factor_id = $1
              AND auth_mfa_factor_secret = $3`,
          [row.id, ciphertext, row.secret],
        );
      }
      encrypted += 1;
    }

    console.log("─".repeat(76));
    console.log(`TOTP factors with a secret : ${rows.length}`);
    console.log(`Already enc:v1: (skipped)  : ${alreadyEncrypted}`);
    console.log(`${APPLY ? "Encrypted (written)" : "Would encrypt"}        : ${encrypted}`);
    console.log("─".repeat(76));
    if (!APPLY && encrypted > 0) {
      console.log("DRY-RUN — re-run with `-- --apply` to write the ciphertext.");
    }
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("encrypt-totp-secrets FAILED:", err);
  process.exit(1);
});
