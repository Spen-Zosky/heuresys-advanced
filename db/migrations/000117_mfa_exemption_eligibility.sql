-- ============================================================================
-- Migration 000117 — MFA exemption eligibility guard (integrazione #9, M-8)
-- ----------------------------------------------------------------------------
-- Re-review post-WI-A (COWORK_INBOX 2026-06-15, M-8 HIGH): isUserMfaExempt keys
-- only on (user_id, enabled), so a row on a HUMAN tenant-scoped user would
-- silently disable their MFA. Constrain the SCOPE of an exemption at the DB:
-- a row may target ONLY a platform-level (user_tenant_id IS NULL) OR a
-- PLATFORM_ADMIN user (the headless service account). Anything else is rejected.
--
-- A static CHECK can't cross-reference sys_users / roles → use a BEFORE
-- INSERT OR UPDATE trigger (also guards direct psql writes, not just the app).
-- Note: admin@heuresys.com has a NON-null tenant_id but IS PLATFORM_ADMIN →
-- eligible via the role branch (hence "tenant-null OR PLATFORM_ADMIN", not
-- tenant-null alone). Invariant I7: auth-only table (000116).
--
-- Does NOT touch the reconciliation registry (the table was registered in 000116).
-- Idempotent: CREATE OR REPLACE FUNCTION + guarded trigger create. Authored 2026-06-15.
-- ============================================================================

CREATE OR REPLACE FUNCTION sys.sys_auth_mfa_exemption_eligibility()
RETURNS trigger
LANGUAGE plpgsql
AS $fn$
BEGIN
  IF NOT (
    EXISTS (
      SELECT 1 FROM sys.sys_users u
       WHERE u.user_id = NEW.auth_mfa_exemption_user_id
         AND u.user_tenant_id IS NULL
    )
    OR EXISTS (
      SELECT 1
        FROM sys.sys_user_auth_roles uar
        JOIN sys.sys_auth_roles r ON r.auth_role_id = uar.user_auth_role_role_id
       WHERE uar.user_auth_role_user_id = NEW.auth_mfa_exemption_user_id
         AND uar.user_auth_role_revoked_at IS NULL
         AND r.auth_role_code = 'PLATFORM_ADMIN'
    )
  ) THEN
    RAISE EXCEPTION
      'MFA exemption allowed only for platform-level (tenant-null) or PLATFORM_ADMIN users (user_id=%)',
      NEW.auth_mfa_exemption_user_id
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$fn$;

DO $tr$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'sys_auth_mfa_exemptions_eligibility'
      AND tgrelid = 'sys.sys_auth_mfa_exemptions'::regclass
  ) THEN
    CREATE TRIGGER sys_auth_mfa_exemptions_eligibility
      BEFORE INSERT OR UPDATE ON sys.sys_auth_mfa_exemptions
      FOR EACH ROW EXECUTE FUNCTION sys.sys_auth_mfa_exemption_eligibility();
  END IF;
END;
$tr$;

-- =====================================================================
-- post-conditions
-- =====================================================================
DO $pc$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'sys_auth_mfa_exemptions_eligibility'
      AND tgrelid = 'sys.sys_auth_mfa_exemptions'::regclass
  ) THEN
    RAISE EXCEPTION '000117: eligibility trigger missing';
  END IF;
  RAISE NOTICE '000117: MFA exemption eligibility trigger ready (platform-level OR PLATFORM_ADMIN only).';
END;
$pc$;
