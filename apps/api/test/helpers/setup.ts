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
// S983 WS-E / S1018 fix: the suite performs hundreds of logins per run — the
// per-IP /login rate-limit would starve it. "Explicit shell env wins" must be
// evaluated BEFORE dotenv: on a PROD-topology box (the VM) the repo .env carries
// a deliberately tight AUTH_LOGIN_RATELIMIT_MAX=10, and the old `??=` AFTER
// dotenv saw that value as "explicit" → mfa-policy et al. starved at 429. The
// .env value is prod hardening, not a test knob — tests always lift it unless
// the SHELL exported one (the explicit rate-limit tests pin their own value,
// see auth.integration.test.ts "11 attempts").
const explicitLoginRatelimit = process.env.AUTH_LOGIN_RATELIMIT_MAX;
dotenvConfig({ path: resolve(repoRoot, ".env") });
process.env.AUTH_LOGIN_RATELIMIT_MAX = explicitLoginRatelimit ?? "10000";

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
