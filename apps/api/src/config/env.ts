/**
 * apps/api/src/config/env.ts
 * Zod-validated env loader. Reads .env at repo root, falls back to
 * .env in apps/api/ if needed.
 *
 * JWT keys are loaded from .secrets/jwt_{private,public}.pem if the env
 * vars JWT_PRIVATE_KEY_PATH / JWT_PUBLIC_KEY_PATH point there; otherwise
 * the values come straight from JWT_PRIVATE_KEY / JWT_PUBLIC_KEY env vars
 * (PEM block with \n-escaped newlines per .env convention).
 */

import { config as dotenvConfig } from "dotenv";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { z } from "zod";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolve(__dirname, "..", "..", "..", "..");
const envPath = resolve(repoRoot, ".env");
if (existsSync(envPath)) {
  dotenvConfig({ path: envPath });
}

function readKeyMaterial(envVar: string, defaultPath: string): string {
  const value = process.env[envVar];
  // If the value looks like a PEM block already, use it directly.
  if (value && value.includes("BEGIN") && value.includes("END")) {
    return value.replace(/\\n/g, "\n");
  }
  // Otherwise, try the secrets file (default convention).
  const filePath = resolve(repoRoot, defaultPath);
  if (existsSync(filePath)) {
    return readFileSync(filePath, "utf8");
  }
  throw new Error(
    `${envVar} is missing and ${filePath} does not exist. ` +
      `Generate keys via: node -e "...generateKeyPairSync..." or set the env var explicitly.`,
  );
}

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  HOST: z.string().default("0.0.0.0"),
  PORT: z.coerce.number().int().positive().default(3001),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
  TRUST_PROXY: z.coerce.boolean().default(false),

  // Database
  POSTGRES_HOST: z.string(),
  POSTGRES_PORT: z.coerce.number().int().positive(),
  POSTGRES_DB: z.string(),
  POSTGRES_USER: z.string(),
  POSTGRES_PASSWORD: z.string(),
  POSTGRES_SCHEMA: z.string().default("sys"),
  POSTGRES_SSL: z.enum(["disable", "require"]).default("disable"),

  // Auth
  COOKIE_SECRET: z.string().min(32),
  ADMIN_ORIGIN: z.string().url().default("http://localhost:3000"),

  // Optional MFA (post-MVP)
  MFA_ENCRYPTION_KEY: z.string().optional(),
});

const parsed = EnvSchema.parse(process.env);

// Load JWT key material AFTER zod validation so the error messages above
// don't get masked by a key-material error.
const jwtPrivateKey = readKeyMaterial("JWT_PRIVATE_KEY", ".secrets/jwt_private.pem");
const jwtPublicKey  = readKeyMaterial("JWT_PUBLIC_KEY",  ".secrets/jwt_public.pem");

export const env = {
  ...parsed,
  JWT_PRIVATE_KEY: jwtPrivateKey,
  JWT_PUBLIC_KEY:  jwtPublicKey,
};

export type Env = typeof env;
