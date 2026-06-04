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
// repoRoot normally derives from this file's location (apps/api/src/config → 4 levels up). When the
// API is BUNDLED for production (the single dist/server.js sits at a different depth), that relative
// calc is wrong, so allow an explicit override via HEURESYS_REPO_ROOT (set by the prod systemd
// unit). Dev/test leave it unset → the cwd-independent import.meta.url calc is used, unchanged.
const repoRoot = process.env.HEURESYS_REPO_ROOT
  ? resolve(process.env.HEURESYS_REPO_ROOT)
  : resolve(__dirname, "..", "..", "..", "..");
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

  // Cookie `Secure` flag for the auth cookies (access/refresh/csrf). When unset it
  // defaults to (NODE_ENV === 'production') — Secure cookies require HTTPS, so a
  // browser DROPS them over plain HTTP, breaking login. Set COOKIE_SECURE=false
  // explicitly when serving production over HTTP without TLS (e.g. the OCI VM demo
  // on http://<ip>:3013); set true once behind a TLS reverse proxy. Parsed as an
  // explicit 'true'/'false' string (z.coerce.boolean would turn "false" into true).
  COOKIE_SECURE: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === "true")),

  // MFA encryption key (S935 SEC base — required in production, optional in dev).
  // Format: base64-encoded 32-byte random string. Generate with:
  //   openssl rand -base64 32
  // Required when NODE_ENV=production OR MFA feature is enabled at any tenant
  // (mfa-service throws MFA_ENCRYPTION_KEY_MISSING at boot if absent and used).
  MFA_ENCRYPTION_KEY: z
    .string()
    .min(32, "MFA_ENCRYPTION_KEY must be at least 32 bytes (base64 of 24 raw bytes)")
    .optional(),
});

const parsed = EnvSchema.parse(process.env);

// S935 SEC base — soft-fail warning at boot when MFA key is absent in production.
// We don't hard-fail (back-compat with envs that don't have MFA enabled yet),
// but we make the gap loud rather than silent (mirror CW-B61 observability
// doctrine: every absence has a trace).
if (parsed.NODE_ENV === "production" && !parsed.MFA_ENCRYPTION_KEY) {
  console.warn(
    JSON.stringify({
      level: "warn",
      phase: "env-validation",
      sub_phase: "mfa-key-check",
      msg: "MFA_ENCRYPTION_KEY is not set in production environment. MFA features will throw MFA_ENCRYPTION_KEY_MISSING at runtime when invoked. Set the env var (openssl rand -base64 32) or disable MFA per tenant.",
    }),
  );
}

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
