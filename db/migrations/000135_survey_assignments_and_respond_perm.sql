-- ============================================================================
-- Migration 000135 — Surveys-M2: per-user survey assignment + ESS respond perm
-- ----------------------------------------------------------------------------
-- The normalized survey cluster (sys_surveys/_questions/_responses, mig 000097)
-- has NO assignment table: audience was an implicit number (survey_total_invitations).
-- M2 (Enzo's decision) makes "assigned to me" a real row: sys_survey_assignments
-- targets a survey to a user + tracks per-user completion. The ESS write-path
-- (/v1/me/surveys) gates "answerable" on an active assignment with no completed_at.
--   + new self-scope permission surveys:respond:self (action on the existing
--     `surveys` resource from mig 000078), granted to ALL roles (ESS-universal —
--     any employee can answer an assigned survey; mirror 000101).
-- ----------------------------------------------------------------------------
-- Conventions mirror 000121/000132: sys.sys_<plural>; FK fields prefixed; PK uuid
--   gen_random_uuid(); tenant_id NOT NULL -> sys.sys_tenancies ON DELETE CASCADE
--   (I5 = FK + middleware filter, NEVER RLS); RD-09 timestamptz; jsonb metadata;
--   updated_at + sys_set_updated_at trigger + CHECK(updated_at >= created_at).
-- Idempotent: CREATE TABLE/INDEX IF NOT EXISTS + guarded ADD CONSTRAINT/TRIGGER +
--   ON CONFLICT DO NOTHING. Twice-run = empty pg_dump diff.
-- Authored: 2026-06-18 (Surveys-M2 ESS self-response milestone).
-- ============================================================================

-- -----------------------------------------------------------------------------
-- 1. sys.sys_survey_assignments — per-user survey targeting + completion (M2)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sys.sys_survey_assignments (
  survey_assignment_id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_assignment_survey_id    uuid        NOT NULL,
  survey_assignment_user_id      uuid        NOT NULL,
  survey_assignment_tenant_id    uuid        NOT NULL,
  survey_assignment_assigned_at  timestamptz NOT NULL DEFAULT now(),
  survey_assignment_completed_at timestamptz,
  survey_assignment_metadata     jsonb       NOT NULL DEFAULT '{}'::jsonb,
  created_at                     timestamptz NOT NULL DEFAULT now(),
  updated_at                     timestamptz NOT NULL DEFAULT now()
);

DO $cs$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_survey_assignment_updated_after') THEN
    ALTER TABLE sys.sys_survey_assignments ADD CONSTRAINT sys_survey_assignment_updated_after
      CHECK (updated_at >= created_at);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_survey_assignment_completed_after') THEN
    ALTER TABLE sys.sys_survey_assignments ADD CONSTRAINT sys_survey_assignment_completed_after
      CHECK (survey_assignment_completed_at IS NULL OR survey_assignment_completed_at >= survey_assignment_assigned_at);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_survey_assignment_survey_fk') THEN
    ALTER TABLE sys.sys_survey_assignments ADD CONSTRAINT sys_survey_assignment_survey_fk
      FOREIGN KEY (survey_assignment_survey_id) REFERENCES sys.sys_surveys(survey_id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_survey_assignment_user_fk') THEN
    ALTER TABLE sys.sys_survey_assignments ADD CONSTRAINT sys_survey_assignment_user_fk
      FOREIGN KEY (survey_assignment_user_id) REFERENCES sys.sys_users(user_id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_survey_assignment_tenant_fk') THEN
    ALTER TABLE sys.sys_survey_assignments ADD CONSTRAINT sys_survey_assignment_tenant_fk
      FOREIGN KEY (survey_assignment_tenant_id) REFERENCES sys.sys_tenancies(tenant_id) ON DELETE CASCADE;
  END IF;
END;
$cs$;

-- A user is assigned a survey AT MOST ONCE (clean 23505 -> 409 path).
CREATE UNIQUE INDEX IF NOT EXISTS sys_survey_assignment_survey_user_uq
  ON sys.sys_survey_assignments (survey_assignment_survey_id, survey_assignment_user_id);
-- "my surveys" query (tenant-scoped).
CREATE INDEX IF NOT EXISTS sys_survey_assignment_user_idx
  ON sys.sys_survey_assignments (survey_assignment_user_id, survey_assignment_tenant_id);
CREATE INDEX IF NOT EXISTS sys_survey_assignment_survey_idx
  ON sys.sys_survey_assignments (survey_assignment_survey_id);

DO $trg$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'sys_survey_assignments_set_updated_at') THEN
    CREATE TRIGGER sys_survey_assignments_set_updated_at BEFORE UPDATE ON sys.sys_survey_assignments
      FOR EACH ROW EXECUTE FUNCTION sys.sys_set_updated_at();
  END IF;
END;
$trg$;

-- -----------------------------------------------------------------------------
-- 2. surveys:respond:self — ESS self-response permission (granted to ALL roles)
--    The `surveys` resource already exists (000078); this adds one action.
-- -----------------------------------------------------------------------------
INSERT INTO sys.sys_auth_permissions (auth_permission_code, auth_permission_name, auth_permission_resource, auth_permission_action)
VALUES ('surveys:respond:self', 'Submit own survey responses (ESS)', 'surveys', 'respond:self')
ON CONFLICT (auth_permission_code) DO NOTHING;

INSERT INTO sys.sys_auth_role_permissions (auth_role_id, auth_permission_id)
SELECT r.auth_role_id, p.auth_permission_id
FROM sys.sys_auth_roles r
CROSS JOIN sys.sys_auth_permissions p
WHERE p.auth_permission_code = 'surveys:respond:self'
ON CONFLICT (auth_role_id, auth_permission_id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 3. Reconciliation registry: 0-UNCLASSIFIED invariant (mirror 000132).
-- -----------------------------------------------------------------------------
INSERT INTO sys.sys_reconciliation_registry
  (reconciliation_registry_table_name, reconciliation_registry_bucket,
   reconciliation_registry_declared_status, reconciliation_registry_legacy_source,
   reconciliation_registry_rationale)
VALUES
  ('sys_survey_assignments', 'D', 'EXCLUDE', NULL,
   '[sign-off: EXCLUDE — app-authored Surveys-M2 per-user assignment/targeting table (mig 000135). Created in-app / by seed; no legacy 1:1 source. Not a reconciliation target.]')
ON CONFLICT (reconciliation_registry_table_name) DO NOTHING;

DO $rc$
DECLARE n_unclassified int;
BEGIN
  SELECT count(*) INTO n_unclassified FROM sys.v_reconciliation_status WHERE resolved_status = 'UNCLASSIFIED';
  IF n_unclassified <> 0 THEN
    RAISE EXCEPTION '000135: expected 0 UNCLASSIFIED after registering assignment table, found %', n_unclassified;
  END IF;
END $rc$;

-- ============================================================================
-- Post-condition (idempotent): table + permission present.
-- ============================================================================
DO $$
DECLARE n_tab int; n_perm int; n_roles int; n_grants int;
BEGIN
  SELECT count(*) INTO n_tab FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname='sys' AND c.relkind='r' AND c.relname='sys_survey_assignments';
  IF n_tab <> 1 THEN RAISE EXCEPTION '000135: expected sys_survey_assignments table, found %', n_tab; END IF;
  SELECT count(*) INTO n_perm FROM sys.sys_auth_permissions WHERE auth_permission_code='surveys:respond:self';
  IF n_perm <> 1 THEN RAISE EXCEPTION '000135: expected surveys:respond:self permission, found %', n_perm; END IF;
  SELECT count(*) INTO n_roles FROM sys.sys_auth_roles;
  SELECT count(*) INTO n_grants FROM sys.sys_auth_role_permissions rp
    JOIN sys.sys_auth_permissions p ON p.auth_permission_id=rp.auth_permission_id
    WHERE p.auth_permission_code='surveys:respond:self';
  IF n_grants <> n_roles THEN RAISE EXCEPTION '000135: expected % role grants, found %', n_roles, n_grants; END IF;
  RAISE NOTICE '000135: Surveys-M2 OK — assignment table + surveys:respond:self granted to % roles.', n_roles;
END $$;
