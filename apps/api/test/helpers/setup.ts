/**
 * apps/api/test/helpers/setup.ts
 * Vitest setup file — runs once before any test. Loads .env from repo root
 * so POSTGRES_HOST/PORT/USER/PASSWORD/DB + JWT key paths resolve the same
 * way as `pnpm dev`.
 */

import { config as dotenvConfig } from "dotenv";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import { beforeAll, afterAll } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..", "..", "..", "..");
dotenvConfig({ path: resolve(repoRoot, ".env") });

// S983 WS-E (mandatory-MFA total coverage): the suite performs hundreds of
// logins per run and with the policy live each is TWO requests (password +
// TOTP step-2) — the default per-IP /login rate-limit (10/5min) would starve
// it. Lift it suite-wide; the explicit rate-limit tests pin their own value
// (see auth.integration.test.ts "11 attempts"). ??= keeps any explicit env.
process.env.AUTH_LOGIN_RATELIMIT_MAX ??= "10000";

// D-52: file-level transactional isolation — every test file runs inside ONE real
// transaction on the live DB, rolled back at file end (zero residue, no inter-file
// coupling). Design + accepted deltas: helpers/tx-isolation.ts. The import is DYNAMIC
// so the pool module is only evaluated after dotenv above populated the env (static
// imports are hoisted before dotenvConfig runs). Escape hatch: TEST_TX_ISOLATION=0.
if (process.env.TEST_TX_ISOLATION !== "0") {
  const { beginFileTx, endFileTx } = await import("./tx-isolation.js");
  beforeAll(async () => {
    await beginFileTx();
  });
  afterAll(async () => {
    await endFileTx();
  });
}
