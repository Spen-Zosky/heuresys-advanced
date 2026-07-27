/**
 * apps/api/src/modules/auth/secret-crypto.ts
 *
 * QW-SEC6 — AES-256-GCM encryption-at-rest for MFA TOTP factor secrets.
 *
 * The base32 TOTP seed stored in sys.sys_auth_mfa_factors.auth_mfa_factor_secret
 * (column type `text`) is wrapped here at the repository boundary. The column
 * accepts the ciphertext string with NO migration (the seam the mfa-service /
 * mfa-repository headers always documented).
 *
 * ── Stored format (self-identifying) ──────────────────────────────────────
 *   enc:v1:<base64(iv)>:<base64(authTag)>:<base64(ciphertext)>
 *   • prefix `enc:v1:` marks the value as ciphertext (legacy plaintext has none)
 *   • iv      = 12 random bytes (GCM nonce), fresh per record
 *   • authTag = 16-byte GCM authentication tag (integrity + authenticity)
 *   • ciphertext = AES-256-GCM(plaintext)
 *   base64 is std (not url) — safe inside a `text` column, never in a URL.
 *
 * ── Key-presence gate (non-breaking, opt-in via key presence) ─────────────
 *   • encryptSecret(plain):
 *       MFA_ENCRYPTION_KEY SET   → returns `enc:v1:…` ciphertext
 *       MFA_ENCRYPTION_KEY UNSET → returns `plain` unchanged (current behaviour)
 *   • decryptSecret(stored):
 *       value has `enc:v1:` prefix → DECRYPT (requires the key; throws
 *                                    MFA_ENCRYPTION_KEY_MISSING if the key is gone)
 *       otherwise                 → returns the value AS-IS (legacy plaintext,
 *                                    full retro-compat — no key needed)
 *   This makes the feature safe in any env: without the key nothing changes;
 *   with the key, new writes are encrypted and old plaintext keeps working.
 *
 * ── Key derivation (32 raw bytes for AES-256) ─────────────────────────────
 *   The env value MFA_ENCRYPTION_KEY is interpreted, in order:
 *     1. exactly 64 hex chars  → decoded to 32 raw bytes, used directly
 *     2. base64 of exactly 32 bytes → decoded, used directly
 *     3. anything else (any string ≥ the zod min-32 length) → scrypt-derived
 *        to 32 bytes with a FIXED app-domain salt (deterministic; the same env
 *        value always yields the same AES key, so ciphertext round-trips across
 *        process restarts and machines that share the env value).
 *   scrypt params: N=2^14, r=8, p=1 (Node defaults) — one-shot at first use,
 *   memoised, so it never costs more than once per process.
 *
 * SECURITY: the same key MUST be present on every box that reads ciphertext.
 * It propagates to PROD via scripts/align-clones.sh (NOT on the env-key-merge
 * denylist — verified) before any legacy row is encrypted. Generate a strong
 * key with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))".
 */

import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";
import { InternalError } from "../../errors/index.js";
import { env } from "../../config/env.js";

/** Marks a stored secret as AES-256-GCM ciphertext (vs legacy plaintext). */
export const ENC_PREFIX = "enc:v1:";

const ALGO = "aes-256-gcm";
const IV_BYTES = 12; // GCM standard nonce length
const KEY_BYTES = 32; // AES-256
/** Fixed app-domain salt for the scrypt fallback path (NOT a secret; the input
 *  entropy is MFA_ENCRYPTION_KEY itself). Stable so derivation is deterministic. */
const SCRYPT_SALT = "heuresys.mfa.totp.secret.v1";

/** Raised when a value is ciphertext but the env key needed to decrypt is absent.
 *  `InternalError` (500), non ApiError generico: è un guasto di configurazione
 *  del server, e come 400 appariva come una richiesta malformata del client. */
export class MfaEncryptionKeyMissingError extends InternalError {
  constructor() {
    super(
      "MFA_ENCRYPTION_KEY_MISSING",
      "Stored MFA secret is encrypted (enc:v1:) but MFA_ENCRYPTION_KEY is not set — cannot decrypt.",
      "MFA secret unavailable",
    );
  }
}

/** Raised when a stored enc:v1: value is structurally malformed (tampered/truncated),
 *  o quando la chiave configurata NON è quella con cui il dato è stato cifrato —
 *  il caso che ha reso rossa la CI in S1032 (chiave del runner divergente). */
export class MfaCiphertextMalformedError extends InternalError {
  constructor() {
    super(
      "MFA_CIPHERTEXT_MALFORMED",
      "Stored MFA secret ciphertext is malformed, or the configured MFA_ENCRYPTION_KEY is not the one it was encrypted with.",
      "MFA secret unavailable",
    );
  }
}

let cachedKey: Buffer | null = null;
let cachedFromEnvValue: string | null = null;

/**
 * Derive (and memoise) the 32-byte AES key from MFA_ENCRYPTION_KEY.
 * Returns null when the env key is unset (gate: caller must treat as "no encryption").
 */
function deriveKey(): Buffer | null {
  const raw = env.MFA_ENCRYPTION_KEY;
  if (!raw) return null;
  // Re-derive only if the env value changed (it never does at runtime, but this
  // keeps the cache correct if a test mutates env before re-importing).
  if (cachedKey && cachedFromEnvValue === raw) return cachedKey;

  let key: Buffer;
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    // 1. 64 hex chars → 32 raw bytes.
    key = Buffer.from(raw, "hex");
  } else {
    const asB64 = tryBase64(raw);
    if (asB64 && asB64.length === KEY_BYTES) {
      // 2. base64 of exactly 32 bytes → use directly.
      key = asB64;
    } else {
      // 3. fallback: scrypt-derive 32 bytes from the UTF-8 string (deterministic).
      key = scryptSync(raw, SCRYPT_SALT, KEY_BYTES);
    }
  }
  cachedKey = key;
  cachedFromEnvValue = raw;
  return key;
}

/** Decode base64 only if it is valid AND round-trips (avoids false positives). */
function tryBase64(s: string): Buffer | null {
  try {
    const buf = Buffer.from(s, "base64");
    if (buf.length === 0) return null;
    // base64 round-trip check: re-encoding must reproduce the input (modulo
    // padding) so a plain ASCII passphrase is not mistaken for base64 bytes.
    if (buf.toString("base64").replace(/=+$/, "") !== s.replace(/=+$/, "")) return null;
    return buf;
  } catch {
    return null;
  }
}

/** True if a stored value is AES-256-GCM ciphertext produced by encryptSecret. */
export function isEncrypted(stored: string): boolean {
  return stored.startsWith(ENC_PREFIX);
}

/**
 * Encrypt a plaintext secret for storage.
 * KEY PRESENCE GATE: if MFA_ENCRYPTION_KEY is unset, returns `plain` unchanged
 * (current plaintext behaviour) so the feature is opt-in via key presence.
 * Idempotent: an already-`enc:v1:` value is returned as-is (never double-wraps).
 */
export function encryptSecret(plain: string): string {
  const key = deriveKey();
  if (!key) return plain; // gate: no key → plaintext passthrough
  if (isEncrypted(plain)) return plain; // already ciphertext → no double-wrap
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGO, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return (
    ENC_PREFIX +
    [iv.toString("base64"), authTag.toString("base64"), ciphertext.toString("base64")].join(":")
  );
}

/**
 * Decrypt a stored secret back to plaintext.
 * RETRO-COMPAT: a value WITHOUT the `enc:v1:` prefix is legacy plaintext and is
 * returned unchanged (no key required). A value WITH the prefix is decrypted —
 * this requires MFA_ENCRYPTION_KEY (throws MFA_ENCRYPTION_KEY_MISSING if absent).
 */
export function decryptSecret(stored: string): string {
  if (!isEncrypted(stored)) return stored; // legacy plaintext → as-is
  const key = deriveKey();
  if (!key) throw new MfaEncryptionKeyMissingError();
  const parts = stored.slice(ENC_PREFIX.length).split(":");
  if (parts.length !== 3) throw new MfaCiphertextMalformedError();
  const [ivB64, tagB64, dataB64] = parts as [string, string, string];
  let plaintext: string;
  try {
    const iv = Buffer.from(ivB64, "base64");
    const authTag = Buffer.from(tagB64, "base64");
    const data = Buffer.from(dataB64, "base64");
    if (iv.length !== IV_BYTES || authTag.length !== 16) throw new MfaCiphertextMalformedError();
    const decipher = createDecipheriv(ALGO, key, iv);
    decipher.setAuthTag(authTag);
    plaintext = Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
  } catch (err) {
    if (err instanceof MfaCiphertextMalformedError) throw err;
    // GCM auth failure (wrong key / tampered) or any decode error.
    throw new MfaCiphertextMalformedError();
  }
  return plaintext;
}

/** True when an encryption key is configured (the gate is ON). Test/observability helper. */
export function encryptionEnabled(): boolean {
  return deriveKey() !== null;
}

/** Test-only: drop the memoised key so a test that mutates env re-derives. */
export function __resetKeyCacheForTests(): void {
  cachedKey = null;
  cachedFromEnvValue = null;
}
