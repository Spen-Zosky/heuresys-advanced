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
import { parseTrustProxy } from "./trust-proxy.js";

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

/**
 * Budget di login per finestra di 5 minuti (guardia brute-force). Estratto come
 * schema a se' perche' serve in due momenti diversi: alla validazione del boot
 * (dentro EnvSchema, cosi' un valore malformato ferma il processo) e a OGNI
 * costruzione dell'app (`loginRateLimitMax()`), perche' la suite lo pilota
 * per-app — il test del limitatore lo fissa a 10 mentre il resto della suite
 * lavora con un budget alto.
 */
const LoginRateLimitSchema = z.coerce.number().int().min(1).max(100_000).default(10);

/**
 * Rilegge e RI-VALIDA il budget di login al momento in cui la route viene
 * registrata. Fino a S1029 la route faceva `Number(process.env.X) || 10`: un
 * refuso diventava 10 in silenzio e un valore assurdo passava — su un parametro
 * di sicurezza. Qui un valore non valido non degrada di nascosto: fallisce.
 */
export function loginRateLimitMax(): number {
  return LoginRateLimitSchema.parse(process.env.AUTH_LOGIN_RATELIMIT_MAX);
}

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  HOST: z.string().default("0.0.0.0"),
  PORT: z.coerce.number().int().positive().default(3001),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
  // Login brute-force budget per 5-minute window. Consumed by modules/auth/routes.ts,
  // which until S1029 read it straight from process.env with a `|| 10` fallback: a typo
  // (`AUTH_LOGIN_RATELIMIT_MAX=abc`) silently became 10, and a hostile-looking value
  // (`=100000`) was accepted without a word. It is a SECURITY parameter, so it belongs
  // here, validated and bounded, like every other one. The E2E suites raise it because
  // five persona logins plus retries legitimately exceed the production budget.
  // Il tetto e' alto di proposito: `test/helpers/setup.ts` alza il budget a 10000
  // perche' l'intera suite condivide una finestra di 5 minuti. Serve a fermare i
  // refusi (0, negativi, 1e9), non a imporre una policy — quella e' il default 10.
  // Vedi anche `loginRateLimitMax()` in fondo: il valore va RI-letto a ogni
  // costruzione dell'app, non congelato qui.
  AUTH_LOGIN_RATELIMIT_MAX: LoginRateLimitSchema,
  // Connection ceiling of the singleton pg pool. Was hardcoded to 20 in db/client.ts,
  // which is fine for one API process and wrong the moment PROD runs more than one:
  // N processes x 20 silently exceeds Postgres max_connections.
  POSTGRES_POOL_MAX: z.coerce.number().int().min(1).max(200).default(20),
  // Reverse-proxy trust for req.ip (drives per-IP rate-limiting). Parsed via parseTrustProxy,
  // NOT z.coerce.boolean — that turns "false" into true (the same footgun COOKIE_SECURE avoids,
  // see below). D-28 / S-100X-A2 F-WS-H-1: PROD behind the nginx TLS proxy MUST set TRUST_PROXY=1
  // (one hop) so the login brute-force limiter keys on the genuine client IP and a forged
  // X-Forwarded-For cannot evade it. "false"/"" = direct (no proxy); "true" = trust-all (spoofable);
  // "<n>" = hop count; "<ip|cidr>[,…]" = trust-list. Yields boolean | number | string.
  TRUST_PROXY: z.string().default("false").transform(parseTrustProxy),

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
  ADMIN_ORIGIN: z.url().default("http://localhost:3000"),

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

  // MFA encryption key (QW-SEC6, D-30 RESOLVED 2026-06-17): AES-256-GCM
  // encryption-at-rest for TOTP factor secrets in sys_auth_mfa_factors. NOW
  // CONSUMED by modules/auth/secret-crypto.ts at the mfa-repository boundary.
  // KEY-PRESENCE GATE (non-breaking): UNSET → secrets stay base32-plaintext
  // (legacy behaviour, full retro-compat); SET → new writes are encrypted
  // (enc:v1:… prefix) and legacy plaintext still decrypts/reads unchanged.
  // Derivation (secret-crypto.ts): 64-hex → 32 raw bytes; base64-of-32 → direct;
  // else scrypt-derive to 32 bytes. Generate a strong key with:
  //   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  // MUST be present (same value) on every box that stores/reads ciphertext —
  // propagates to PROD via align-clones.sh (NOT on the env-key-merge denylist).
  MFA_ENCRYPTION_KEY: z
    .string()
    .min(32, "MFA_ENCRYPTION_KEY must be at least 32 chars (e.g. 64-hex or base64 of 32 bytes)")
    .optional(),

  // AI ② Semantic Matching — Voyage embeddings API key. OPTIONAL: only the
  // embedding BACKFILL script (pnpm embeddings:backfill) needs it. The serving
  // API never calls Voyage (kNN runs over precomputed pgvector rows), so a
  // missing key does NOT break the server — it only fails the backfill loudly.
  VOYAGE_API_KEY: z.string().min(1).optional(),

  // cap4 CMS P3 - media object store root (local-disk default, S980 decision;
  // S3/MinIO becomes a different driver behind the same seam, see media-store.ts).
  MEDIA_STORAGE_DIR: z.string().min(1).default(".data/media"),

  // AI ②·Fase 2 — free-text matching feature flag. Default OFF. When OFF the
  // GET /v1/matching/search route returns a clean typed 404 (MATCHING_FREETEXT_DISABLED).
  // When ON the query is embedded AT REQUEST TIME via the injectable Embedder seam
  // (the SAME seam the backfill uses) — this is the first-ever query-time external
  // dependency on the serving path, so it stays strictly behind this default-OFF flag
  // to keep the normal serving path Voyage-free. Requires VOYAGE_API_KEY when ON in prod.
  // Parsed as an explicit 'true'/'false' string, NOT z.coerce.boolean — the latter
  // turns the literal "false" into true (QW-J1 / WS-J F-J-2 footgun), so writing
  // MATCHING_FREETEXT_ENABLED=false to DISABLE it would ENABLE it. Same fix already
  // applied to COOKIE_SECURE / TRUST_PROXY / MFA_ENFORCEMENT_ENABLED.
  MATCHING_FREETEXT_ENABLED: z.enum(["true", "false"]).default("false").transform((v) => v === "true"),

  // Transactional mailer (SMTP). All OPTIONAL: when SMTP_HOST + MAIL_FROM are
  // set, buildApp wires the real SmtpMailer (nodemailer); otherwise it falls
  // back to the dev ConsoleMailer so the server never hard-fails on a missing
  // mail backend. SMTP_SECURE is parsed as an explicit 'true'/'false' string
  // (z.coerce.boolean would turn "false" into true). See modules/auth/smtp-mailer.ts.
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().optional(),
  SMTP_SECURE: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === "true")),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  MAIL_FROM: z.string().optional(),

  // TOFU v2 (MVP-4 §2.5): out-of-band email confirmation on the FIRST MFA
  // factor enrollment for self-owned kinds (TOTP/WEBAUTHN/SMS_OTP). "auto"
  // (default) = ON only when a real mailer is configured (SMTP_HOST+MAIL_FROM);
  // ConsoleMailer environments keep the pre-v2 behaviour (a blocking confirm
  // whose code only lands in server logs would lock real users out).
  MFA_ENROLL_CONFIRM: z.enum(["auto", "on", "off"]).default("auto"),

  // Mandatory-MFA login ENFORCEMENT kill-switch (dev/test neutralization seam,
  // S989). DEFAULT true: the login §3b gate (mfa_required for accounts WITH a
  // verified factor + mfa_enrollment_required for in-scope accounts WITHOUT one)
  // is enforced everywhere unless explicitly turned off. PROD/VM/linuxpc leave it
  // UNSET → true → zero security regression (mandatory-MFA stays live). Set
  // MFA_ENFORCEMENT_ENABLED=false ONLY in a dev/test .env to bypass the gate
  // entirely so development + automated testing proceed without a second factor.
  // The MFA capability, enrolled factors and the per-tenant policy DATA all stay
  // intact — only login-time enforcement is suspended; re-enable = config only.
  // Parsed as an explicit 'true'/'false' string (z.coerce.boolean would turn the
  // literal "false" into true — the COOKIE_SECURE / TRUST_PROXY / D-28 footgun).
  // Per-machine topology: on the env-key-merge denylist so a dev 'false' can
  // never propagate to PROD via scripts/align-clones.sh.
  MFA_ENFORCEMENT_ENABLED: z
    .enum(["true", "false"])
    .default("true")
    .transform((v) => v === "true"),

  // SMS provider (SMS_OTP MFA factor — code-only slice). OPTIONAL: no real
  // provider is implemented yet; makeSmsSender always returns ConsoleSms (not
  // production-capable -> SMS_OTP enrollment disabled). When a provider lands
  // (e.g. "twilio"), these become the activation switch. See
  // modules/auth/sms-sender.ts.
  SMS_PROVIDER: z.string().optional(),
  SMS_FROM: z.string().optional(),

  // WebAuthn / FIDO2 passkey MFA factor (@simplewebauthn/server). RP config:
  //  - WEBAUTHN_RP_ID: the Relying Party ID == the effective domain (NO scheme,
  //    NO port). "localhost" for local dev. PROD must set its own registrable
  //    domain (e.g. "app.heuresys.com").
  //  - WEBAUTHN_RP_NAME: human-readable RP name shown by the authenticator UI.
  //  - WEBAUTHN_ORIGINS: comma-separated allowlist of the EXACT origins the
  //    ceremony may run on (scheme + host + port), e.g.
  //    "http://localhost:3000,https://app.heuresys.com".
  // SECURITY: WebAuthn requires a secure context. `localhost` is exempt, but a
  // plain-HTTP non-localhost origin is NOT — so passkeys are UNUSABLE on the
  // current HTTP PROD origin (http://<ip>:3013) until TLS lands. PROD must set
  // WEBAUTHN_RP_ID to its real domain + an https:// origin in WEBAUTHN_ORIGINS.
  WEBAUTHN_RP_ID: z.string().default("localhost"),
  WEBAUTHN_RP_NAME: z.string().default("Heuresys"),
  WEBAUTHN_ORIGINS: z.string().default("http://localhost:3000"),

  // R6 (100X): OpenAPI/Swagger exposure of the Zod-typed routes — Swagger UI at
  // /docs + the OpenAPI spec at /openapi.json. DEFAULT OFF: the full API surface
  // (~407 /v1/* endpoints) must not be public on the production origin without a
  // deliberate decision. Enable in dev/staging (API_DOCS_ENABLED=true), or behind
  // an authenticated edge in prod. When OFF neither route is registered.
  // Explicit 'true'/'false' string, NOT z.coerce.boolean (QW-J1 / WS-J F-J-2): with
  // coerce, API_DOCS_ENABLED=false would EXPOSE the full ~407-endpoint Swagger on
  // prod (Boolean("false")===true) — a fail-open. Mirrors the other gate flags.
  API_DOCS_ENABLED: z.enum(["true", "false"]).default("false").transform((v) => v === "true"),

  // D-09 observability: expose GET /metrics (Prometheus text format), loopback-only.
  // Explicit 'true'/'false' string, NOT z.coerce.boolean (the COOKIE_SECURE footgun).
  // Default OFF = prod-safe: no default-metrics timers, no collection, no exposure.
  // Enable on the VM so the local systemd collector can scrape 127.0.0.1:<api>/metrics.
  PROM_METRICS_ENABLED: z.enum(["true", "false"]).default("false").transform((v) => v === "true"),
  // D-14 F2: kill-switch for POST /v1/tenants/provision. Default ON (the route
  // is already PLATFORM_ADMIN-gated + CSRF); set 'false' to disable tenant
  // self-provisioning entirely (e.g. during an incident or a controlled rollout).
  TENANT_PROVISION_ENABLED: z.enum(["true", "false"]).default("true").transform((v) => v === "true"),
});

const parsed = EnvSchema.parse(process.env);

// QW-SEC6 (D-30 RESOLVED 2026-06-17): MFA_ENCRYPTION_KEY now drives AES-256-GCM
// encryption-at-rest for TOTP factor secrets (modules/auth/secret-crypto.ts).
// KEY-PRESENCE GATE: when UNSET, secrets stay base32-plaintext (non-breaking,
// retro-compatible) — so its absence is still harmless, NOT a hard failure. The
// PROD warn below now flags that encryption-at-rest is OFF (the key was not
// supplied) so a deployment that intends ciphertext notices the gap before
// running the one-time bulk-encrypt (db:encrypt-totp).
if (parsed.NODE_ENV === "production" && !parsed.MFA_ENCRYPTION_KEY) {
  console.warn(
    JSON.stringify({
      level: "warn",
      phase: "env-validation",
      sub_phase: "mfa-key-check",
      msg: "MFA_ENCRYPTION_KEY is not set — MFA TOTP encryption-at-rest is DISABLED (secrets stored as base32 plaintext, the legacy non-breaking mode). Set it (e.g. node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\") on every box, then run db:encrypt-totp once, to enable AES-256-GCM encryption-at-rest.",
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
