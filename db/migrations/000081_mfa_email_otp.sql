-- ============================================================================
-- Migration 000081 — MVP-4: EMAIL_OTP MFA factor (challenge store)
-- ----------------------------------------------------------------------------
-- ADR ref: ADR-0005 (Argon2id) · AUTH_SECURITY_PLAN §3 (MFA) · I7 (auth split)
-- Adds the persistent challenge store for the EMAIL_OTP second-factor kind.
--
-- The factor itself reuses the kind-agnostic sys.sys_auth_mfa_factors table
-- (000005_auth_foundation.sql §2.7) whose CHECK constraint ALREADY admits
-- 'EMAIL_OTP' (auth_mfa_factor_kind IN ('TOTP','WEBAUTHN','EMAIL_OTP','SMS_OTP')).
-- => No CHECK-constraint change needed (RD-08 already satisfied). TOTP keeps
--    its shared secret in auth_mfa_factor_secret; EMAIL_OTP stores NO secret
--    there (auth_mfa_factor_secret stays NULL) — the per-attempt one-time
--    codes live HASHED in this new challenge table instead.
--
-- Security design (SECURITY-CRITICAL — mirrors the password/refresh doctrine):
--   * OTP is generated server-side with a CSPRNG (crypto.randomInt), 6 digits.
--   * OTP is stored HASHED AT REST (Argon2id, ADR-0005 params) — never plaintext.
--   * Short TTL via expires_at (server-side check), single-use via consumed_at,
--     bounded attempts via attempt_count + a CHECK cap (defense-in-depth; the
--     service enforces the lockout, the column documents the invariant).
--   * Purpose discriminates ENROLL (setup confirmation) vs LOGIN (step-up gate)
--     so an enrollment code can't be replayed as a login code and vice-versa.
--   * FK -> sys_users ON DELETE CASCADE (deleting a user purges their codes).
--
-- Conventions mirror 000005 (sys_auth_*) + 000072 (immutable child table):
--   sys.sys_auth_<plural>; column prefix auth_mfa_otp_<field>; PK uuid
--   DEFAULT gen_random_uuid(); FK person -> sys.sys_users ON DELETE CASCADE;
--   timestamptz (RD-09); CHECK (RD-08, never ENUM); created_at only (immutable).
-- Idempotent: CREATE TABLE IF NOT EXISTS + guarded ADD CONSTRAINT + CREATE INDEX
--   IF NOT EXISTS. Applied under `psql -1 -f` (single implicit txn). Purely additive.
-- Authored: 2026-06-07 (S974, A8 MVP-4 EMAIL_OTP).
-- ============================================================================

-- =====================================================================
-- §1 — sys.sys_auth_mfa_otp_challenges  (per-attempt one-time codes)
--      immutable-ish: a row is created on issuance, then only its
--      attempt_count / consumed_at are mutated by the verify path.
-- =====================================================================

CREATE TABLE IF NOT EXISTS sys.sys_auth_mfa_otp_challenges (
  auth_mfa_otp_id            uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_mfa_otp_user_id       uuid         NOT NULL
                               REFERENCES sys.sys_users(user_id) ON DELETE CASCADE,
  -- The MFA factor this code belongs to (the EMAIL_OTP factor row).
  auth_mfa_otp_factor_id     uuid         NOT NULL
                               REFERENCES sys.sys_auth_mfa_factors(auth_mfa_factor_id) ON DELETE CASCADE,
  -- 'ENROLL' (setup confirmation) | 'LOGIN' (step-up challenge).
  auth_mfa_otp_purpose       varchar(16)  NOT NULL,
  -- Argon2id hash of the 6-digit code. NEVER the plaintext code (security-critical).
  auth_mfa_otp_code_hash     text         NOT NULL,
  auth_mfa_otp_expires_at    timestamptz  NOT NULL,
  auth_mfa_otp_attempt_count integer      NOT NULL DEFAULT 0,
  -- Set on successful verification (single-use) OR on lockout invalidation.
  auth_mfa_otp_consumed_at   timestamptz,
  created_at                 timestamptz  NOT NULL DEFAULT now()
);

DO $cs$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_auth_mfa_otp_purpose_check') THEN
    ALTER TABLE sys.sys_auth_mfa_otp_challenges
      ADD CONSTRAINT sys_auth_mfa_otp_purpose_check
      CHECK (auth_mfa_otp_purpose IN ('ENROLL', 'LOGIN'));
  END IF;
  -- Defense-in-depth cap mirroring the service-side max-attempts lockout (5).
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_auth_mfa_otp_attempts_check') THEN
    ALTER TABLE sys.sys_auth_mfa_otp_challenges
      ADD CONSTRAINT sys_auth_mfa_otp_attempts_check
      CHECK (auth_mfa_otp_attempt_count >= 0 AND auth_mfa_otp_attempt_count <= 5);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_auth_mfa_otp_expires_after') THEN
    ALTER TABLE sys.sys_auth_mfa_otp_challenges
      ADD CONSTRAINT sys_auth_mfa_otp_expires_after
      CHECK (auth_mfa_otp_expires_at > created_at);
  END IF;
END
$cs$;

-- Lookup of the active (unconsumed) challenge for a (user, factor, purpose).
CREATE INDEX IF NOT EXISTS sys_auth_mfa_otp_active_idx
  ON sys.sys_auth_mfa_otp_challenges (auth_mfa_otp_user_id, auth_mfa_otp_factor_id, auth_mfa_otp_purpose)
  WHERE auth_mfa_otp_consumed_at IS NULL;

-- Sweep support (housekeeping of expired/consumed rows).
CREATE INDEX IF NOT EXISTS sys_auth_mfa_otp_expires_idx
  ON sys.sys_auth_mfa_otp_challenges (auth_mfa_otp_expires_at);

-- =====================================================================
-- §2 — Reconciliation registry: keep the "0 UNCLASSIFIED" invariant.
--      sys.v_reconciliation_status flags ANY sys.* table absent from the
--      registry as UNCLASSIFIED. This new table is APP-GENERATED auth infra
--      (per-attempt one-time codes; no legacy source) — classify it
--      EXCLUDE / bucket D, mirroring sys_auth_sessions (NO_SOURCE infra) and
--      the embedding sidecar tables (mig 000062). Same idempotent shape.
-- =====================================================================

INSERT INTO sys.sys_reconciliation_registry
  (reconciliation_registry_table_name,
   reconciliation_registry_bucket,
   reconciliation_registry_declared_status,
   reconciliation_registry_legacy_source,
   reconciliation_registry_rationale)
VALUES
  ('sys_auth_mfa_otp_challenges', 'D', 'EXCLUDE', NULL,
   '[sign-off: EXCLUDE — app-generated auth infra (MVP-4 EMAIL_OTP MFA, mig 000081). Per-attempt one-time codes hashed-at-rest with TTL/attempt/consumed lifecycle; runtime-generated by the MFA service, never imported from legacy. Mirrors sys_auth_sessions (NO_SOURCE infra) — not a reconciliation target.]')
ON CONFLICT (reconciliation_registry_table_name) DO NOTHING;

DO $rc$
DECLARE n_unclassified int;
BEGIN
  SELECT count(*) INTO n_unclassified
  FROM sys.v_reconciliation_status
  WHERE resolved_status = 'UNCLASSIFIED';
  IF n_unclassified <> 0 THEN
    RAISE EXCEPTION '000081: expected 0 UNCLASSIFIED after registering sys_auth_mfa_otp_challenges, found %', n_unclassified;
  END IF;
  RAISE NOTICE '000081: EMAIL_OTP challenge table registered EXCLUDE; reconciliation registry 0 UNCLASSIFIED restored.';
END $rc$;
