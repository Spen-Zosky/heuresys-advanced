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

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..", "..", "..", "..");
dotenvConfig({ path: resolve(repoRoot, ".env") });

// S983 WS-E (mandatory-MFA total coverage): the suite performs hundreds of
// logins per run and with the policy live each is TWO requests (password +
// TOTP step-2) — the default per-IP /login rate-limit (10/5min) would starve
// it. Lift it suite-wide; the explicit rate-limit tests pin their own value
// (see auth.integration.test.ts "11 attempts"). ??= keeps any explicit env.
process.env.AUTH_LOGIN_RATELIMIT_MAX ??= "10000";
