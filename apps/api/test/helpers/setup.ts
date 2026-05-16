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
