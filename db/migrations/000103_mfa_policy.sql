-- ============================================================================
-- Migration 000103 — mandatory-MFA policy (MVP-4 §2.5 #4)
-- ----------------------------------------------------------------------------
-- Per-tenant opt-in policy that gates /v1/auth/login: when ENABLED, a user of
-- that tenant whose roles intersect the policy scope and who has NO verified
-- MFA factor receives `status: "mfa_enrollment_required"` (a restricted,
-- enrollment-only session — JWT claim `enr`, roles []) instead of a full
-- session. DEFAULT OFF — with no row (or enabled=false) login behaviour is
-- byte-identical to pre-000103 (no lockout risk on rollout).
--
--   • one row per tenant (UNIQUE), FK → sys.sys_tenancies ON DELETE CASCADE
--   • role_codes text[] NULL = applies to ALL roles of the tenant; otherwise
--     only users holding at least one of the listed role codes are in scope
--   • mutable → updated_at trigger (sys.sys_set_updated_at, mig 000002)
--
-- Also extends the sys_auth_login_events type CHECK with
-- 'LOGIN_MFA_ENROLLMENT_REQUIRED' (audit of the new gate outcome) with a
-- content-aware guard (and 000005's re-add is now guarded too - D-12(a) lesson:
-- a replay must never clobber a newer constraint).
--
-- Reconciliation registry: bucket D / EXCLUDE (app-authored policy config —
-- no legacy source) + 0-UNCLASSIFIED assertion.
-- Idempotent: twice-run = no-op. Authored: 2026-06-10 (S981, MVP-4 §2.5 #4).
-- ============================================================================

-- =====================================================================
-- §1 — sys.sys_auth_mfa_policies (one row per tenant, opt-in)
-- =====================================================================
CREATE TABLE IF NOT EXISTS sys.sys_auth_mfa_policies (
  auth_mfa_policy_id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_mfa_policy_tenant_id  uuid        NOT NULL,
  auth_mfa_policy_enabled    boolean     NOT NULL DEFAULT false,
  -- NULL = policy applies to every role; otherwise the in-scope role codes.
  auth_mfa_policy_role_codes text[],
  created_at                 timestamptz NOT NULL DEFAULT now(),
  created_by                 uuid,
  updated_at                 timestamptz NOT NULL DEFAULT now(),
  updated_by                 uuid
);

DO $cs$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_auth_mfa_policies_tenant_fk') THEN
    ALTER TABLE sys.sys_auth_mfa_policies
      ADD CONSTRAINT sys_auth_mfa_policies_tenant_fk
      FOREIGN KEY (auth_mfa_policy_tenant_id)
      REFERENCES sys.sys_tenancies(tenant_id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_auth_mfa_policies_tenant_uq') THEN
    ALTER TABLE sys.sys_auth_mfa_policies
      ADD CONSTRAINT sys_auth_mfa_policies_tenant_uq
      UNIQUE (auth_mfa_policy_tenant_id);
  END IF;
END;
$cs$;

DO $tr$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'sys_auth_mfa_policies_set_updated_at'
      AND tgrelid = 'sys.sys_auth_mfa_policies'::regclass
  ) THEN
    CREATE TRIGGER sys_auth_mfa_policies_set_updated_at
      BEFORE UPDATE ON sys.sys_auth_mfa_policies
      FOR EACH ROW EXECUTE FUNCTION sys.sys_set_updated_at();
  END IF;
END;
$tr$;

-- =====================================================================
-- §2 — extend the login-events type CHECK with the new gate outcome
-- =====================================================================
-- Content-aware extension (D-12(a) lesson): drop+re-add ONLY when the value is
-- still missing. A replay after a future migration extends the list further
-- must be a no-op here, never a clobber back to this snapshot.
DO $lec$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'sys_auth_login_events_type_check'
      AND pg_get_constraintdef(oid) LIKE '%LOGIN_MFA_ENROLLMENT_REQUIRED%'
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
        'LOGIN_MFA_ENROLLMENT_REQUIRED'
      ));
  END IF;
END;
$lec$;

-- =====================================================================
-- §3 — reconciliation registry (bucket D / EXCLUDE — app-authored config)
-- =====================================================================
INSERT INTO sys.sys_reconciliation_registry
  (reconciliation_registry_table_name, reconciliation_registry_bucket,
   reconciliation_registry_declared_status, reconciliation_registry_rationale)
VALUES
  ('sys_auth_mfa_policies', 'D', 'EXCLUDE',
   '[S981 MVP-4 §2.5 #4] Mandatory-MFA per-tenant policy — app-authored security configuration; no legacy source exists (legacy heuresys-evo has no MFA).')
ON CONFLICT (reconciliation_registry_table_name) DO NOTHING;

-- =====================================================================
-- §4 — post-conditions
-- =====================================================================
DO $pc$
DECLARE n int;
BEGIN
  IF to_regclass('sys.sys_auth_mfa_policies') IS NULL THEN
    RAISE EXCEPTION '000103: sys.sys_auth_mfa_policies missing';
  END IF;
  SELECT count(*) INTO n FROM sys.v_reconciliation_status WHERE resolved_status = 'UNCLASSIFIED';
  IF n <> 0 THEN
    RAISE EXCEPTION '000103: % UNCLASSIFIED tables in the reconciliation view (expected 0)', n;
  END IF;
  RAISE NOTICE '000103: sys_auth_mfa_policies ready (default OFF); login-events CHECK extended; registry row present.';
END;
$pc$;
