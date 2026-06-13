-- ============================================================================
-- Migration 000113 — R1 Fase3 (S988): Engagement feedback domain (2 tables)
-- ----------------------------------------------------------------------------
-- ADR ref: ADR-0024 / I14 (employee-centric crosswalk). Sibling: 000077 (engagement surveys).
-- Creates 2 sys.* base tables for the legacy engagement_feedback + engagement_action_plans
-- cluster (no prior sys.* target):
--   1. sys.sys_engagement_feedback      (anonymous tenant-scoped feedback; mutable review -> updated_at + trigger)
--   2. sys.sys_engagement_action_plans  (post-survey/feedback action plans; mutable -> updated_at + trigger)
-- ----------------------------------------------------------------------------
-- Conventions mirror 000077 verbatim:
--   sys.sys_<plural>; column prefix <entity>_<field>; PK <entity>_id uuid DEFAULT gen_random_uuid();
--   <entity>_tenant_id uuid NOT NULL -> sys.sys_tenancies ON DELETE RESTRICT (I5, NO RLS);
--   person FK <entity>_<role>_user_id -> sys.sys_users ON DELETE SET NULL (I14; unresolved -> NULL +
--     legacy id in *_metadata); natural key + UQ(tenant_id, natural_key); metadata jsonb NOT NULL
--   DEFAULT '{}'; CHECK (RD-08, never ENUM); date/timestamptz (RD-09); updated_at + sys_set_updated_at
--   trigger on both (both are mutable: feedback gets reviewed; action plans progress).
-- Note (I14): feedback SUBMITTER is structurally anonymous (no legacy author column) -> NO submitter
--   FK. reviewer/owner/created_by = legacy users row -> bridged via users.employee_id ->
--   sys_users.user_external_code='LEGACY_EMP::'||employee_id. action_plan source_id is a polymorphic
--   legacy ref (survey/feedback/pulse id) -> stored as uuid, NO FK (cross-cluster).
-- Idempotent: CREATE TABLE IF NOT EXISTS + guarded ADD CONSTRAINT + CREATE INDEX IF NOT EXISTS +
--   guarded CREATE TRIGGER. Applied under `psql -1 -f` (single implicit txn). Purely additive.
-- Authored: 2026-06-13 (S988).
-- ============================================================================

-- =====================================================================
-- §1 — sys.sys_engagement_feedback  (<- legacy engagement_feedback)
--      anonymous feedback; reviewer + status mutable -> updated_at + trigger
-- =====================================================================

CREATE TABLE IF NOT EXISTS sys.sys_engagement_feedback (
  feedback_id                 uuid           PRIMARY KEY DEFAULT gen_random_uuid(),
  feedback_tenant_id          uuid           NOT NULL,
  feedback_natural_key        varchar(512)   NOT NULL,
  feedback_category           varchar(50)    NOT NULL DEFAULT 'other',
  feedback_message            text           NOT NULL,
  feedback_status             varchar(20)    NOT NULL DEFAULT 'new',
  feedback_reviewed_by_user_id uuid,
  feedback_reviewed_at        timestamptz,
  feedback_action_notes       text,
  feedback_metadata           jsonb          NOT NULL DEFAULT '{}'::jsonb,
  created_at                  timestamptz    NOT NULL DEFAULT now(),
  updated_at                  timestamptz    NOT NULL DEFAULT now()
);

DO $cs$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_efb_category_check') THEN
    ALTER TABLE sys.sys_engagement_feedback ADD CONSTRAINT sys_efb_category_check CHECK (
      feedback_category IN ('concern','recognition','suggestion','other'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_efb_status_check') THEN
    ALTER TABLE sys.sys_engagement_feedback ADD CONSTRAINT sys_efb_status_check CHECK (
      feedback_status IN ('new','reviewed','actioned','archived'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_efb_updated_after') THEN
    ALTER TABLE sys.sys_engagement_feedback ADD CONSTRAINT sys_efb_updated_after CHECK (updated_at >= created_at);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_efb_tenant_fk') THEN
    ALTER TABLE sys.sys_engagement_feedback ADD CONSTRAINT sys_efb_tenant_fk FOREIGN KEY (feedback_tenant_id) REFERENCES sys.sys_tenancies(tenant_id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_efb_reviewed_by_fk') THEN
    ALTER TABLE sys.sys_engagement_feedback ADD CONSTRAINT sys_efb_reviewed_by_fk FOREIGN KEY (feedback_reviewed_by_user_id) REFERENCES sys.sys_users(user_id) ON DELETE SET NULL;
  END IF;
END;
$cs$;

CREATE UNIQUE INDEX IF NOT EXISTS sys_efb_natural_key_uq ON sys.sys_engagement_feedback (feedback_tenant_id, feedback_natural_key);
CREATE INDEX IF NOT EXISTS sys_efb_tenant_idx   ON sys.sys_engagement_feedback (feedback_tenant_id);
CREATE INDEX IF NOT EXISTS sys_efb_status_idx   ON sys.sys_engagement_feedback (feedback_tenant_id, feedback_status);
CREATE INDEX IF NOT EXISTS sys_efb_category_idx ON sys.sys_engagement_feedback (feedback_tenant_id, feedback_category);

DO $trg$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'sys_engagement_feedback_set_updated_at') THEN
    CREATE TRIGGER sys_engagement_feedback_set_updated_at BEFORE UPDATE ON sys.sys_engagement_feedback
      FOR EACH ROW EXECUTE FUNCTION sys.sys_set_updated_at();
  END IF;
END;
$trg$;

-- =====================================================================
-- §2 — sys.sys_engagement_action_plans  (<- legacy engagement_action_plans)
--      post-survey/feedback action plans; mutable progress -> updated_at + trigger
-- =====================================================================

CREATE TABLE IF NOT EXISTS sys.sys_engagement_action_plans (
  action_plan_id              uuid           PRIMARY KEY DEFAULT gen_random_uuid(),
  action_plan_tenant_id       uuid           NOT NULL,
  action_plan_natural_key     varchar(512)   NOT NULL,
  action_plan_source_type     varchar(20)    NOT NULL DEFAULT 'feedback',
  action_plan_source_id       uuid,
  action_plan_title           varchar(255)   NOT NULL,
  action_plan_description     text,
  action_plan_owner_user_id   uuid,
  action_plan_status          varchar(20)    NOT NULL DEFAULT 'planned',
  action_plan_priority        varchar(20)    NOT NULL DEFAULT 'medium',
  action_plan_due_date        date,
  action_plan_completed_at    timestamptz,
  action_plan_created_by_user_id uuid,
  action_plan_metadata        jsonb          NOT NULL DEFAULT '{}'::jsonb,
  created_at                  timestamptz    NOT NULL DEFAULT now(),
  updated_at                  timestamptz    NOT NULL DEFAULT now()
);

DO $cs$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_eap_source_type_check') THEN
    ALTER TABLE sys.sys_engagement_action_plans ADD CONSTRAINT sys_eap_source_type_check CHECK (
      action_plan_source_type IN ('feedback','pulse','survey'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_eap_status_check') THEN
    ALTER TABLE sys.sys_engagement_action_plans ADD CONSTRAINT sys_eap_status_check CHECK (
      action_plan_status IN ('planned','in_progress','completed'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_eap_priority_check') THEN
    ALTER TABLE sys.sys_engagement_action_plans ADD CONSTRAINT sys_eap_priority_check CHECK (
      action_plan_priority IN ('low','medium','high','critical'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_eap_updated_after') THEN
    ALTER TABLE sys.sys_engagement_action_plans ADD CONSTRAINT sys_eap_updated_after CHECK (updated_at >= created_at);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_eap_tenant_fk') THEN
    ALTER TABLE sys.sys_engagement_action_plans ADD CONSTRAINT sys_eap_tenant_fk FOREIGN KEY (action_plan_tenant_id) REFERENCES sys.sys_tenancies(tenant_id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_eap_owner_fk') THEN
    ALTER TABLE sys.sys_engagement_action_plans ADD CONSTRAINT sys_eap_owner_fk FOREIGN KEY (action_plan_owner_user_id) REFERENCES sys.sys_users(user_id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_eap_created_by_fk') THEN
    ALTER TABLE sys.sys_engagement_action_plans ADD CONSTRAINT sys_eap_created_by_fk FOREIGN KEY (action_plan_created_by_user_id) REFERENCES sys.sys_users(user_id) ON DELETE SET NULL;
  END IF;
END;
$cs$;

CREATE UNIQUE INDEX IF NOT EXISTS sys_eap_natural_key_uq ON sys.sys_engagement_action_plans (action_plan_tenant_id, action_plan_natural_key);
CREATE INDEX IF NOT EXISTS sys_eap_tenant_idx ON sys.sys_engagement_action_plans (action_plan_tenant_id);
CREATE INDEX IF NOT EXISTS sys_eap_status_idx ON sys.sys_engagement_action_plans (action_plan_tenant_id, action_plan_status);

DO $trg$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'sys_engagement_action_plans_set_updated_at') THEN
    CREATE TRIGGER sys_engagement_action_plans_set_updated_at BEFORE UPDATE ON sys.sys_engagement_action_plans
      FOR EACH ROW EXECUTE FUNCTION sys.sys_set_updated_at();
  END IF;
END;
$trg$;

-- ============================================================================
-- Post-conditions (idempotent): assert the 2 base tables exist.
-- ============================================================================
DO $$
DECLARE n_tables int;
BEGIN
  SELECT count(*) INTO n_tables
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'sys' AND c.relkind = 'r'
    AND c.relname IN ('sys_engagement_feedback','sys_engagement_action_plans');
  IF n_tables <> 2 THEN
    RAISE EXCEPTION '000113: expected 2 engagement feedback base tables, found %', n_tables;
  END IF;
  RAISE NOTICE '000113: engagement feedback schema OK — 2/2 base tables present.';
END $$;
