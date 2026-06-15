-- ============================================================================
-- Migration 000118 — M-8b: MFA exemption SERVICE-only + audit trail
-- ----------------------------------------------------------------------------
-- Re-review hardening M-8b (COWORK_INBOX 2026-06-15): restrict the exemption
-- scope further — a HUMAN PLATFORM_ADMIN must NOT be exemptable; only the
-- dedicated SERVICE account (user_type='SERVICE', the headless Agent SDK user)
-- may carry an MFA exemption. Supersedes 000117's "tenant-null OR PLATFORM_ADMIN"
-- criterion (which let a human admin be exempted). + an audit trail of every
-- exemption mutation (who/what/when) for review/alert.
--
-- Invariant I7 (auth-only tables). ADDITIVE + REVERSIBLE (down at the tail).
-- Idempotent: CREATE OR REPLACE fn + IF NOT EXISTS table/trigger. 2026-06-15.
-- ============================================================================

-- =====================================================================
-- §1 — eligibility: ONLY user_type='SERVICE' (block human PLATFORM_ADMIN)
-- =====================================================================
CREATE OR REPLACE FUNCTION sys.sys_auth_mfa_exemption_eligibility()
RETURNS trigger
LANGUAGE plpgsql
AS $fn$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM sys.sys_users u
     WHERE u.user_id = NEW.auth_mfa_exemption_user_id
       AND u.user_type = 'SERVICE'
  ) THEN
    RAISE EXCEPTION
      'MFA exemption allowed ONLY for SERVICE accounts (user_type=SERVICE); user % is not a service account (M-8b)',
      NEW.auth_mfa_exemption_user_id
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$fn$;
-- (trigger sys_auth_mfa_exemptions_eligibility from 000117 already BEFORE INSERT OR UPDATE.)

-- =====================================================================
-- §2 — audit trail table + registry row (D / EXCLUDE)
-- =====================================================================
CREATE TABLE IF NOT EXISTS sys.sys_auth_mfa_exemption_audit (
  auth_mfa_exemption_audit_id      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_mfa_exemption_audit_user_id uuid        NOT NULL,
  auth_mfa_exemption_audit_action  varchar(16) NOT NULL,
  auth_mfa_exemption_audit_enabled boolean,
  auth_mfa_exemption_audit_reason  text,
  auth_mfa_exemption_audit_actor   uuid,
  created_at                       timestamptz NOT NULL DEFAULT now()
);

INSERT INTO sys.sys_reconciliation_registry
  (reconciliation_registry_table_name, reconciliation_registry_bucket,
   reconciliation_registry_declared_status, reconciliation_registry_rationale)
VALUES
  ('sys_auth_mfa_exemption_audit', 'D', 'EXCLUDE',
   '[#9 M-8b] Audit trail of MFA-exemption mutations — app-authored auth config; no legacy source. Invariant I7.')
ON CONFLICT (reconciliation_registry_table_name) DO NOTHING;

-- =====================================================================
-- §3 — audit trigger (AFTER INSERT/UPDATE/DELETE → append a row)
-- =====================================================================
CREATE OR REPLACE FUNCTION sys.sys_auth_mfa_exemption_audit_fn()
RETURNS trigger
LANGUAGE plpgsql
AS $af$
BEGIN
  INSERT INTO sys.sys_auth_mfa_exemption_audit
    (auth_mfa_exemption_audit_user_id, auth_mfa_exemption_audit_action,
     auth_mfa_exemption_audit_enabled, auth_mfa_exemption_audit_reason, auth_mfa_exemption_audit_actor)
  VALUES (
    COALESCE(NEW.auth_mfa_exemption_user_id, OLD.auth_mfa_exemption_user_id),
    TG_OP,
    NEW.auth_mfa_exemption_enabled,
    NEW.auth_mfa_exemption_reason,
    COALESCE(NEW.updated_by, NEW.created_by)
  );
  RETURN NULL;
END;
$af$;

DO $tr$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'sys_auth_mfa_exemptions_audit'
      AND tgrelid = 'sys.sys_auth_mfa_exemptions'::regclass
  ) THEN
    CREATE TRIGGER sys_auth_mfa_exemptions_audit
      AFTER INSERT OR UPDATE OR DELETE ON sys.sys_auth_mfa_exemptions
      FOR EACH ROW EXECUTE FUNCTION sys.sys_auth_mfa_exemption_audit_fn();
  END IF;
END;
$tr$;

-- =====================================================================
-- §4 — post-conditions
-- =====================================================================
DO $pc$
DECLARE n int;
BEGIN
  IF to_regclass('sys.sys_auth_mfa_exemption_audit') IS NULL THEN
    RAISE EXCEPTION '000118: audit table missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='sys_auth_mfa_exemptions_audit' AND tgrelid='sys.sys_auth_mfa_exemptions'::regclass) THEN
    RAISE EXCEPTION '000118: audit trigger missing';
  END IF;
  SELECT count(*) INTO n FROM sys.v_reconciliation_status WHERE resolved_status = 'UNCLASSIFIED';
  IF n <> 0 THEN
    RAISE EXCEPTION '000118: % UNCLASSIFIED tables (expected 0)', n;
  END IF;
  RAISE NOTICE '000118: exemption SERVICE-only + audit trail ready.';
END;
$pc$;

-- ============================================================================
-- DOWN (manual rollback, reversible):
--   DROP TRIGGER IF EXISTS sys_auth_mfa_exemptions_audit ON sys.sys_auth_mfa_exemptions;
--   DROP FUNCTION IF EXISTS sys.sys_auth_mfa_exemption_audit_fn();
--   DROP TABLE IF EXISTS sys.sys_auth_mfa_exemption_audit;
--   DELETE FROM sys.sys_reconciliation_registry WHERE reconciliation_registry_table_name='sys_auth_mfa_exemption_audit';
--   -- restore 000117 eligibility (tenant-null OR PLATFORM_ADMIN):
--   CREATE OR REPLACE FUNCTION sys.sys_auth_mfa_exemption_eligibility() RETURNS trigger LANGUAGE plpgsql AS $r$
--   BEGIN IF NOT (EXISTS (SELECT 1 FROM sys.sys_users u WHERE u.user_id=NEW.auth_mfa_exemption_user_id AND u.user_tenant_id IS NULL)
--     OR EXISTS (SELECT 1 FROM sys.sys_user_auth_roles uar JOIN sys.sys_auth_roles r ON r.auth_role_id=uar.user_auth_role_role_id
--       WHERE uar.user_auth_role_user_id=NEW.auth_mfa_exemption_user_id AND uar.user_auth_role_revoked_at IS NULL AND r.auth_role_code='PLATFORM_ADMIN')) THEN
--     RAISE EXCEPTION 'MFA exemption allowed only for platform-level or PLATFORM_ADMIN users (user_id=%)', NEW.auth_mfa_exemption_user_id USING ERRCODE='check_violation'; END IF; RETURN NEW; END; $r$;
-- ============================================================================
