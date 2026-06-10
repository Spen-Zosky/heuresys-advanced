-- =============================================================================
-- 000108_mfa_enroll_confirm.sql
-- -----------------------------------------------------------------------------
-- TOFU v2 hardening (MVP-4 §2.5, S982) — out-of-band confirmation on the FIRST
-- MFA factor enrollment + enrollment audit event.
--
-- Context: the mandatory-MFA gate (mig 000103) documented its known limit as
-- "trust-on-first-use: out-of-band confirmation on first enrollment is the v2
-- hardening" (auth/service.ts §3b). This migration ships the two DB bits:
--
--   1. CHECK extension on sys_auth_mfa_otp_challenges.auth_mfa_otp_purpose:
--      + 'CONFIRM_ENROLL' — the email-delivered confirmation code issued before
--      a self-owned factor (TOTP / WEBAUTHN / SMS_OTP) flips to verified when
--      the enroll-confirm mode resolves ON (env MFA_ENROLL_CONFIRM=auto|on|off;
--      auto = on only with a real mailer — ConsoleMailer environments keep the
--      pre-v2 behaviour). EMAIL_OTP enrollment is already out-of-band by design
--      and never requires the extra confirm.
--
--   2. CHECK extension on sys_auth_login_events.auth_login_event_type:
--      + 'MFA_FACTOR_ENROLLED' — audit row written every time a factor flips to
--      verified (all kinds, confirm-mode independent), alongside the
--      "new MFA method added" notification email.
--
-- TRANSACTION: migrate.sh applies with `psql -1` — NO BEGIN/COMMIT here.
-- IDEMPOTENT: content-aware guards (pattern of 000103) — re-runs are no-ops.
-- =============================================================================

-- 1) purpose CHECK: ENROLL / LOGIN -> + CONFIRM_ENROLL
DO $purp$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'sys_auth_mfa_otp_purpose_check'
      AND pg_get_constraintdef(oid) LIKE '%CONFIRM_ENROLL%'
  ) THEN
    ALTER TABLE sys.sys_auth_mfa_otp_challenges
      DROP CONSTRAINT IF EXISTS sys_auth_mfa_otp_purpose_check;
    ALTER TABLE sys.sys_auth_mfa_otp_challenges
      ADD CONSTRAINT sys_auth_mfa_otp_purpose_check
      CHECK (auth_mfa_otp_purpose IN ('ENROLL', 'LOGIN', 'CONFIRM_ENROLL'));
  END IF;
END;
$purp$;

-- 2) login-event type CHECK: + MFA_FACTOR_ENROLLED
DO $lec$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'sys_auth_login_events_type_check'
      AND pg_get_constraintdef(oid) LIKE '%MFA_FACTOR_ENROLLED%'
  ) THEN
    ALTER TABLE sys.sys_auth_login_events
      DROP CONSTRAINT IF EXISTS sys_auth_login_events_type_check;
    ALTER TABLE sys.sys_auth_login_events
      ADD CONSTRAINT sys_auth_login_events_type_check
      CHECK (auth_login_event_type IN (
        'LOGIN_SUCCESS', 'LOGIN_FAILED', 'LOGIN_UNKNOWN_USER', 'LOGOUT',
        'REFRESH_OK', 'REFRESH_REPLAY_DETECTED', 'REFRESH_EXPIRED',
        'PASSWORD_RESET_REQUESTED', 'PASSWORD_RESET_COMPLETED', 'PASSWORD_CHANGED_BY_USER',
        'MFA_OK', 'MFA_FAIL', 'REVOKED_BY_ADMIN', 'ACCOUNT_LOCKED',
        'ROLE_GRANTED', 'ROLE_REVOKED',
        'LOGIN_MFA_ENROLLMENT_REQUIRED',
        'MFA_FACTOR_ENROLLED'
      ));
  END IF;
END;
$lec$;

-- 3) Post-condition assert.
DO $$
DECLARE purp_ok int; lec_ok int;
BEGIN
  SELECT count(*) INTO purp_ok FROM pg_constraint
   WHERE conname = 'sys_auth_mfa_otp_purpose_check'
     AND pg_get_constraintdef(oid) LIKE '%CONFIRM_ENROLL%';
  SELECT count(*) INTO lec_ok FROM pg_constraint
   WHERE conname = 'sys_auth_login_events_type_check'
     AND pg_get_constraintdef(oid) LIKE '%MFA_FACTOR_ENROLLED%';
  RAISE NOTICE '000108: purpose CONFIRM_ENROLL=% login-event MFA_FACTOR_ENROLLED=% (expect 1/1)', purp_ok, lec_ok;
  IF purp_ok <> 1 OR lec_ok <> 1 THEN
    RAISE EXCEPTION '000108: CHECK extension failed purpose=% event=%', purp_ok, lec_ok;
  END IF;
END $$;
