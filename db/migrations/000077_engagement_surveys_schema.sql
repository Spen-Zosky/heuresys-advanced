-- ============================================================================
-- Migration 000077 — SDBI B-10b milestone 2: Surveys / Engagement domain (3 tables)
-- ----------------------------------------------------------------------------
-- ADR ref: ADR-0014 (SDBI) · ADR-0024 / I14 (employee-centric crosswalk)
-- Sibling: 000072_mentorship_schema.sql (B-10b m1, S970). Same conventions verbatim.
-- Creates 3 sys.* base tables for the legacy engagement_* cluster (no prior sys.* target):
--   1. sys.sys_engagement_survey_templates  (reusable template; mutable -> updated_at + trigger)
--   2. sys.sys_engagement_surveys           (survey definition; mutable -> updated_at + trigger)
--   3. sys.sys_engagement_survey_responses  (immutable event log; one row per submitted response)
-- ----------------------------------------------------------------------------
-- Conventions mirror 000072 verbatim:
--   sys.sys_<plural>; column prefix <entity>_<field>; PK <entity>_id uuid DEFAULT gen_random_uuid();
--   <entity>_tenant_id uuid NOT NULL -> sys.sys_tenancies ON DELETE RESTRICT (I5, NO RLS);
--   person FK <entity>_<role>_user_id -> sys.sys_users ON DELETE SET NULL (I14; unresolved -> NULL +
--     legacy id in *_metadata, never dropped); natural key + UQ(tenant_id, natural_key);
--   questions/answers/metadata jsonb NOT NULL DEFAULT '{}'; CHECK (RD-08, never ENUM); date/timestamptz (RD-09);
--   updated_at + sys_set_updated_at trigger ONLY on mutable (templates, surveys).
--   Responses are an IMMUTABLE event log: no updated_at, no trigger.
-- Note (I14): surveys/templates author = legacy `users` row -> bridged via users.employee_id ->
--   sys_users.user_external_code='LEGACY_EMP::'||employee_id (the person, never the credential).
--   Responses subject = legacy employees.id directly. 0 anonymous rows in the data -> no anon path.
-- Idempotent: CREATE TABLE IF NOT EXISTS + guarded ADD CONSTRAINT + CREATE INDEX IF NOT EXISTS +
--   guarded CREATE TRIGGER. Applied under `psql -1 -f` (single implicit txn). Purely additive.
-- Authored: 2026-06-07 (S971).
-- ============================================================================

-- =====================================================================
-- §1 — sys.sys_engagement_survey_templates  (<- legacy engagement_survey_templates)
--      mutable reusable template -> updated_at + trigger
-- =====================================================================

CREATE TABLE IF NOT EXISTS sys.sys_engagement_survey_templates (
  template_id              uuid           PRIMARY KEY DEFAULT gen_random_uuid(),
  template_tenant_id       uuid           NOT NULL,
  template_natural_key     varchar(512)   NOT NULL,
  template_name            varchar(255)   NOT NULL,
  template_description      text,
  template_category        varchar(50)    NOT NULL DEFAULT 'custom',
  template_questions       jsonb          NOT NULL DEFAULT '{}'::jsonb,
  template_is_system       boolean        NOT NULL DEFAULT false,
  template_created_by_user_id uuid,
  template_metadata        jsonb          NOT NULL DEFAULT '{}'::jsonb,
  created_at               timestamptz    NOT NULL DEFAULT now(),
  updated_at               timestamptz    NOT NULL DEFAULT now()
);

DO $cs$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_estmpl_category_check') THEN
    ALTER TABLE sys.sys_engagement_survey_templates ADD CONSTRAINT sys_estmpl_category_check CHECK (
      template_category IN ('engagement','wellbeing','exit','onboarding','custom'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_estmpl_updated_after') THEN
    ALTER TABLE sys.sys_engagement_survey_templates ADD CONSTRAINT sys_estmpl_updated_after CHECK (updated_at >= created_at);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_estmpl_tenant_fk') THEN
    ALTER TABLE sys.sys_engagement_survey_templates ADD CONSTRAINT sys_estmpl_tenant_fk FOREIGN KEY (template_tenant_id) REFERENCES sys.sys_tenancies(tenant_id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_estmpl_created_by_fk') THEN
    ALTER TABLE sys.sys_engagement_survey_templates ADD CONSTRAINT sys_estmpl_created_by_fk FOREIGN KEY (template_created_by_user_id) REFERENCES sys.sys_users(user_id) ON DELETE SET NULL;
  END IF;
END;
$cs$;

CREATE UNIQUE INDEX IF NOT EXISTS sys_estmpl_natural_key_uq ON sys.sys_engagement_survey_templates (template_tenant_id, template_natural_key);
CREATE INDEX IF NOT EXISTS sys_estmpl_tenant_idx   ON sys.sys_engagement_survey_templates (template_tenant_id);
CREATE INDEX IF NOT EXISTS sys_estmpl_category_idx ON sys.sys_engagement_survey_templates (template_tenant_id, template_category);

DO $trg$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'sys_engagement_survey_templates_set_updated_at') THEN
    CREATE TRIGGER sys_engagement_survey_templates_set_updated_at BEFORE UPDATE ON sys.sys_engagement_survey_templates
      FOR EACH ROW EXECUTE FUNCTION sys.sys_set_updated_at();
  END IF;
END;
$trg$;

-- =====================================================================
-- §2 — sys.sys_engagement_surveys  (<- legacy engagement_surveys)
--      mutable survey definition -> updated_at + trigger
-- =====================================================================

CREATE TABLE IF NOT EXISTS sys.sys_engagement_surveys (
  survey_id                 uuid           PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_tenant_id          uuid           NOT NULL,
  survey_natural_key        varchar(512)   NOT NULL,
  survey_template_id        uuid,
  survey_title              varchar(255)   NOT NULL,
  survey_description        text,
  survey_questions          jsonb          NOT NULL DEFAULT '{}'::jsonb,
  survey_status             varchar(20)    NOT NULL DEFAULT 'draft',
  survey_audience_type      varchar(20)    NOT NULL DEFAULT 'all',
  survey_audience_ids       uuid[],
  survey_is_anonymous       boolean        NOT NULL DEFAULT false,
  survey_total_invitations  integer        NOT NULL DEFAULT 0,
  survey_total_responses    integer        NOT NULL DEFAULT 0,
  survey_created_by_user_id uuid,
  survey_start_date         timestamptz,
  survey_end_date           timestamptz,
  survey_metadata           jsonb          NOT NULL DEFAULT '{}'::jsonb,
  created_at                timestamptz    NOT NULL DEFAULT now(),
  updated_at                timestamptz    NOT NULL DEFAULT now()
);

DO $cs$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_esurv_status_check') THEN
    ALTER TABLE sys.sys_engagement_surveys ADD CONSTRAINT sys_esurv_status_check CHECK (
      survey_status IN ('draft','active','closed'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_esurv_audience_check') THEN
    ALTER TABLE sys.sys_engagement_surveys ADD CONSTRAINT sys_esurv_audience_check CHECK (
      survey_audience_type IN ('all','department','org_unit','location','custom'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_esurv_totals_nonneg') THEN
    ALTER TABLE sys.sys_engagement_surveys ADD CONSTRAINT sys_esurv_totals_nonneg CHECK (
      survey_total_invitations >= 0 AND survey_total_responses >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_esurv_updated_after') THEN
    ALTER TABLE sys.sys_engagement_surveys ADD CONSTRAINT sys_esurv_updated_after CHECK (updated_at >= created_at);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_esurv_tenant_fk') THEN
    ALTER TABLE sys.sys_engagement_surveys ADD CONSTRAINT sys_esurv_tenant_fk FOREIGN KEY (survey_tenant_id) REFERENCES sys.sys_tenancies(tenant_id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_esurv_template_fk') THEN
    ALTER TABLE sys.sys_engagement_surveys ADD CONSTRAINT sys_esurv_template_fk FOREIGN KEY (survey_template_id) REFERENCES sys.sys_engagement_survey_templates(template_id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_esurv_created_by_fk') THEN
    ALTER TABLE sys.sys_engagement_surveys ADD CONSTRAINT sys_esurv_created_by_fk FOREIGN KEY (survey_created_by_user_id) REFERENCES sys.sys_users(user_id) ON DELETE SET NULL;
  END IF;
END;
$cs$;

CREATE UNIQUE INDEX IF NOT EXISTS sys_esurv_natural_key_uq ON sys.sys_engagement_surveys (survey_tenant_id, survey_natural_key);
CREATE INDEX IF NOT EXISTS sys_esurv_tenant_idx   ON sys.sys_engagement_surveys (survey_tenant_id);
CREATE INDEX IF NOT EXISTS sys_esurv_status_idx   ON sys.sys_engagement_surveys (survey_tenant_id, survey_status);
CREATE INDEX IF NOT EXISTS sys_esurv_template_idx ON sys.sys_engagement_surveys (survey_template_id) WHERE survey_template_id IS NOT NULL;

DO $trg$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'sys_engagement_surveys_set_updated_at') THEN
    CREATE TRIGGER sys_engagement_surveys_set_updated_at BEFORE UPDATE ON sys.sys_engagement_surveys
      FOR EACH ROW EXECUTE FUNCTION sys.sys_set_updated_at();
  END IF;
END;
$trg$;

-- =====================================================================
-- §3 — sys.sys_engagement_survey_responses  (<- legacy engagement_survey_responses)
--      immutable event log, child of survey (CASCADE) -> NO updated_at/trigger
--      one row per submitted response (legacy UNIQUE(survey_id, employee_id))
-- =====================================================================

CREATE TABLE IF NOT EXISTS sys.sys_engagement_survey_responses (
  response_id              uuid           PRIMARY KEY DEFAULT gen_random_uuid(),
  response_tenant_id       uuid           NOT NULL,
  response_natural_key     varchar(512)   NOT NULL,
  response_survey_id       uuid           NOT NULL,
  response_subject_user_id uuid,
  response_answers         jsonb          NOT NULL DEFAULT '{}'::jsonb,
  response_is_complete     boolean        NOT NULL DEFAULT false,
  response_started_at      timestamptz,
  response_completed_at    timestamptz,
  response_metadata        jsonb          NOT NULL DEFAULT '{}'::jsonb,
  created_at               timestamptz    NOT NULL DEFAULT now()
);

DO $cs$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_esresp_tenant_fk') THEN
    ALTER TABLE sys.sys_engagement_survey_responses ADD CONSTRAINT sys_esresp_tenant_fk FOREIGN KEY (response_tenant_id) REFERENCES sys.sys_tenancies(tenant_id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_esresp_survey_fk') THEN
    ALTER TABLE sys.sys_engagement_survey_responses ADD CONSTRAINT sys_esresp_survey_fk FOREIGN KEY (response_survey_id) REFERENCES sys.sys_engagement_surveys(survey_id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_esresp_subject_user_fk') THEN
    ALTER TABLE sys.sys_engagement_survey_responses ADD CONSTRAINT sys_esresp_subject_user_fk FOREIGN KEY (response_subject_user_id) REFERENCES sys.sys_users(user_id) ON DELETE SET NULL;
  END IF;
END;
$cs$;

CREATE UNIQUE INDEX IF NOT EXISTS sys_esresp_natural_key_uq ON sys.sys_engagement_survey_responses (response_tenant_id, response_natural_key);
CREATE INDEX IF NOT EXISTS sys_esresp_tenant_idx  ON sys.sys_engagement_survey_responses (response_tenant_id);
CREATE INDEX IF NOT EXISTS sys_esresp_survey_idx  ON sys.sys_engagement_survey_responses (response_survey_id);
CREATE INDEX IF NOT EXISTS sys_esresp_subject_idx ON sys.sys_engagement_survey_responses (response_subject_user_id) WHERE response_subject_user_id IS NOT NULL;

-- §3 is an immutable event log: no updated_at column, no set_updated_at trigger.

-- ============================================================================
-- Post-conditions (idempotent): assert the 3 base tables exist.
-- ============================================================================
DO $$
DECLARE n_tables int;
BEGIN
  SELECT count(*) INTO n_tables
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'sys' AND c.relkind = 'r'
    AND c.relname IN ('sys_engagement_survey_templates','sys_engagement_surveys',
                      'sys_engagement_survey_responses');
  IF n_tables <> 3 THEN
    RAISE EXCEPTION '000077: expected 3 engagement survey base tables, found %', n_tables;
  END IF;
  RAISE NOTICE '000077: engagement surveys schema OK — 3/3 base tables present.';
END $$;
