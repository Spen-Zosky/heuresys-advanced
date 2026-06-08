-- 000099_mfa_recovery_codes.sql
-- MVP-4 §2.5 MFA multi-kind residuo — RECOVERY CODES.
--
-- One-time backup codes that let a user complete the login second factor when their
-- TOTP/EMAIL_OTP device is unavailable. High-entropy (64-bit) random codes hashed at
-- rest with SHA-256 (the same fast hash used for refresh tokens — NOT Argon2id: codes
-- are high-entropy so a slow KDF buys nothing and 10× Argon2/login would be a DoS).
-- Single-use (recovery_code_used_at stamped on consume). Owned per sys_user, cascade.
--
-- IDEMPOTENT: CREATE TABLE/INDEX IF NOT EXISTS.

CREATE TABLE IF NOT EXISTS sys.sys_auth_mfa_recovery_codes (
  recovery_code_id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recovery_code_user_id  uuid NOT NULL REFERENCES sys.sys_users(user_id) ON DELETE CASCADE,
  recovery_code_hash     text NOT NULL,
  recovery_code_used_at  timestamptz,
  created_at             timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sys_auth_mfa_recovery_codes_hash_uq UNIQUE (recovery_code_hash)
);
-- Partial index: consume looks up unused codes by (user, hash).
CREATE INDEX IF NOT EXISTS sys_auth_mfa_recovery_codes_user_active_idx
  ON sys.sys_auth_mfa_recovery_codes (recovery_code_user_id)
  WHERE recovery_code_used_at IS NULL;

-- Classify in the reconciliation registry (app-generated auth artifact, no legacy source →
-- bucket D / EXCLUDE, like sys_auth_mfa_otp_challenges) so the view stays 0-UNCLASSIFIED.
INSERT INTO sys.sys_reconciliation_registry
  (reconciliation_registry_table_name, reconciliation_registry_bucket,
   reconciliation_registry_declared_status, reconciliation_registry_legacy_source,
   reconciliation_registry_wall, reconciliation_registry_rationale, reconciliation_registry_decided_at)
VALUES
  ('sys_auth_mfa_recovery_codes', 'D', 'EXCLUDE', NULL, NULL,
   '[MVP-4 §2.5 S978] App-generated MFA backup codes (SHA-256 hashed, single-use). No legacy source — security artifact, not a reconciliation target.', now())
ON CONFLICT (reconciliation_registry_table_name) DO NOTHING;

DO $$
BEGIN
  RAISE NOTICE 'MFA recovery codes table ready (sys_auth_mfa_recovery_codes).';
END $$;
