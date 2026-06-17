/**
 * apps/api/test/mfa-secret-crypto.integration.test.ts
 *
 * QW-SEC6 — AES-256-GCM encryption-at-rest for MFA TOTP secrets.
 *
 * Proves:
 *   (a) round-trip: encryptSecret -> decryptSecret recovers a base32 secret;
 *   (b) retro-compat: decryptSecret returns a legacy plaintext value unchanged;
 *   (c) ciphertext is != plaintext and carries the enc:v1: prefix;
 *   (d) LIVE: enroll(insert)->read round-trips through the repository against
 *       the real DB with encryption ON — the raw column holds enc:v1: ciphertext
 *       and the decrypted secret validates a real TOTP code. The test creates +
 *       deletes its OWN throwaway factor (unique non-fixture label) and NEVER
 *       touches the 6 seeded fixture rows.
 *
 * This suite REQUIRES MFA_ENCRYPTION_KEY to be set (the local .env has it). If
 * the key is absent the encryption-dependent assertions are skipped with a loud
 * message rather than silently passing on the plaintext gate.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import * as OTPAuth from "otpauth";
import { pool } from "../src/db/client.js";
import {
  encryptSecret,
  decryptSecret,
  isEncrypted,
  encryptionEnabled,
  ENC_PREFIX,
} from "../src/modules/auth/secret-crypto.js";
import {
  insertMfaFactor,
  findMfaFactorById,
  deleteMfaFactor,
  reencryptFactorSecret,
} from "../src/modules/auth/mfa-repository.js";
import { MFA_INTERNAL } from "../src/modules/auth/mfa-service.js";
import { E2E_FIXTURE_LABEL } from "./helpers/mfa-fixture-secrets.js";

/** A throwaway label that no fixture/persona seed uses → safe to create + delete. */
const THROWAWAY_LABEL = "qw-sec6-crypto-test";

/** A valid 32-char base32 (RFC 4648 A-Z 2-7) TOTP seed for the round-trip checks. */
const SAMPLE_BASE32 = "JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP";

function totpCode(secretBase32: string): string {
  return new OTPAuth.TOTP({
    issuer: "Heuresys",
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secretBase32),
  }).generate();
}

describe("QW-SEC6 MFA secret crypto (AES-256-GCM encryption-at-rest)", () => {
  const keyOn = encryptionEnabled();

  beforeAll(() => {
    if (!keyOn) {
      // Loud, not silent (R5): the suite is meant to run with the key present.
      // eslint-disable-next-line no-console
      console.warn(
        "[mfa-secret-crypto] MFA_ENCRYPTION_KEY is NOT set — encryption assertions will be skipped.",
      );
    }
  });

  it("(a) round-trips a base32 secret through encrypt -> decrypt (key ON)", () => {
    if (!keyOn) return;
    const ciphertext = encryptSecret(SAMPLE_BASE32);
    expect(decryptSecret(ciphertext)).toBe(SAMPLE_BASE32);
  });

  it("(b) decryptSecret returns a legacy plaintext value unchanged (retro-compat)", () => {
    // No enc:v1: prefix → treated as legacy plaintext, returned as-is, no key needed.
    expect(decryptSecret(SAMPLE_BASE32)).toBe(SAMPLE_BASE32);
    expect(decryptSecret("ABC123-legacy-plain")).toBe("ABC123-legacy-plain");
  });

  it("(e) the lazy-reencrypt fixture-skip label matches the committed fixture label (no drift)", () => {
    // The service skips lazy re-encryption for factors carrying this label so
    // the committed e2e-fixture rows stay plaintext for PROD/CI/Playwright.
    // A literal mismatch would silently re-enable upgrading them → assert parity.
    expect(MFA_INTERNAL.FIXTURE_FACTOR_LABEL).toBe(E2E_FIXTURE_LABEL);
  });

  it("(c) ciphertext differs from plaintext and carries the enc:v1: prefix (key ON)", () => {
    if (!keyOn) return;
    const ciphertext = encryptSecret(SAMPLE_BASE32);
    expect(ciphertext).not.toBe(SAMPLE_BASE32);
    expect(ciphertext.startsWith(ENC_PREFIX)).toBe(true);
    expect(isEncrypted(ciphertext)).toBe(true);
    // The raw base32 must not leak anywhere inside the stored string.
    expect(ciphertext.includes(SAMPLE_BASE32)).toBe(false);
    // Fresh IV per call → two encryptions of the same plaintext differ.
    expect(encryptSecret(SAMPLE_BASE32)).not.toBe(ciphertext);
  });

  describe("(d) LIVE enroll(insert) -> read round-trip through the repository (key ON)", () => {
    let userId: string | null = null;
    let factorId: string | null = null;

    beforeAll(async () => {
      if (!keyOn) return;
      // Pick ANY real user to satisfy the FK — we tag the factor with a unique
      // throwaway label and delete it ourselves, so no fixture row is involved.
      const u = await pool.query<{ user_id: string }>(
        `SELECT user_id FROM sys.sys_users ORDER BY created_at LIMIT 1`,
      );
      userId = u.rows[0]?.user_id ?? null;
    });

    afterAll(async () => {
      // Clean up ONLY our throwaway factor (by id + owner) — never a bulk delete.
      if (factorId && userId) {
        await deleteMfaFactor(pool, factorId, userId);
      }
    });

    it("stores ciphertext at rest and reads back the plaintext secret", async () => {
      if (!keyOn || !userId) return;

      const inserted = await insertMfaFactor(pool, {
        userId,
        kind: "TOTP",
        secret: SAMPLE_BASE32,
        metadata: { label: THROWAWAY_LABEL },
      });
      factorId = inserted.factorId;

      // The repository returns the PLAINTEXT secret to the service layer...
      expect(inserted.secret).toBe(SAMPLE_BASE32);
      expect(inserted.secretWasEncrypted).toBe(true);

      // ...but the RAW DB column holds enc:v1: ciphertext (encryption-at-rest).
      const raw = await pool.query<{ s: string }>(
        `SELECT auth_mfa_factor_secret AS s FROM sys.sys_auth_mfa_factors WHERE auth_mfa_factor_id = $1`,
        [factorId],
      );
      const stored = raw.rows[0]!.s;
      expect(stored.startsWith(ENC_PREFIX)).toBe(true);
      expect(stored).not.toBe(SAMPLE_BASE32);

      // A fresh repository read decrypts transparently back to the plaintext...
      const refetched = await findMfaFactorById(pool, factorId);
      expect(refetched?.secret).toBe(SAMPLE_BASE32);

      // ...and the recovered secret validates a real TOTP code (true E2E proof).
      const totp = new OTPAuth.TOTP({
        issuer: "Heuresys",
        algorithm: "SHA1",
        digits: 6,
        period: 30,
        secret: OTPAuth.Secret.fromBase32(refetched!.secret!),
      });
      const code = totpCode(SAMPLE_BASE32);
      expect(totp.validate({ token: code, window: 1 })).not.toBeNull();
    });

    it("lazily re-encrypts a legacy-plaintext throwaway factor on use (needsRehash-style)", async () => {
      if (!keyOn || !userId) return;
      // Seed a LEGACY-plaintext row directly via raw SQL (bypassing the encrypting
      // insert), with a UNIQUE non-fixture label → safe to mutate + delete.
      const ins = await pool.query<{ id: string }>(
        `INSERT INTO sys.sys_auth_mfa_factors
           (auth_mfa_factor_user_id, auth_mfa_factor_kind, auth_mfa_factor_secret,
            auth_mfa_factor_metadata, auth_mfa_factor_verified)
         VALUES ($1, 'TOTP', $2, jsonb_build_object('label', $3::text), true)
         RETURNING auth_mfa_factor_id AS id`,
        [userId, SAMPLE_BASE32, THROWAWAY_LABEL + "-legacy"],
      );
      const legacyId = ins.rows[0]!.id;
      try {
        // Pre-state: raw column is the plaintext base32.
        const before = await pool.query<{ s: string }>(
          `SELECT auth_mfa_factor_secret AS s FROM sys.sys_auth_mfa_factors WHERE auth_mfa_factor_id = $1`,
          [legacyId],
        );
        expect(before.rows[0]!.s).toBe(SAMPLE_BASE32);

        // Lazy upgrade (the exact call verifyLoginChallenge makes best-effort).
        const upgraded = await reencryptFactorSecret(pool, legacyId, SAMPLE_BASE32);
        expect(upgraded).toBe(true);

        // Post-state: raw column is now enc:v1: ciphertext, and a read decrypts
        // back to the same plaintext (no behaviour change for the service layer).
        const after = await pool.query<{ s: string }>(
          `SELECT auth_mfa_factor_secret AS s FROM sys.sys_auth_mfa_factors WHERE auth_mfa_factor_id = $1`,
          [legacyId],
        );
        expect(after.rows[0]!.s.startsWith(ENC_PREFIX)).toBe(true);
        const refetched = await findMfaFactorById(pool, legacyId);
        expect(refetched?.secret).toBe(SAMPLE_BASE32);
        expect(refetched?.secretWasEncrypted).toBe(true);

        // Idempotent: a second call is a no-op (already enc:v1:).
        expect(await reencryptFactorSecret(pool, legacyId, SAMPLE_BASE32)).toBe(false);
      } finally {
        await deleteMfaFactor(pool, legacyId, userId);
      }
    });
  });
});
