-- ============================================================================
-- Migration 000049 — SDBI Surveys/Engagement target schema (4 tables)
-- ADR-0014 SDBI MVP-4 2.4 — Surveys/Engagement macro-area. Card SURVEYS-MAP-01.
-- Tables: sys_surveys, sys_survey_responses, sys_engagement_surveys,
--   sys_engagement_survey_responses. Conventions: I5 tenant FK, RD-09, natural_key UQ.
-- Idempotent. Authored 2026-05-27 (MVP-4 2.4.10).
-- ============================================================================
BEGIN;

CREATE TABLE IF NOT EXISTS sys.sys_surveys (
  survey_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_tenant_id uuid NOT NULL REFERENCES sys.sys_tenancies (tenant_id),
  survey_natural_key text NOT NULL,
  survey_title varchar(255) NOT NULL,
  survey_description text,
  survey_type varchar(50),
  survey_status varchar(30),
  survey_start_date date,
  survey_end_date date,
  survey_is_anonymous boolean,
  survey_is_active boolean,
  survey_questions jsonb,
  survey_total_invitations integer,
  survey_deleted_at timestamptz,
  survey_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS sys_surveys_nk_uq ON sys.sys_surveys (survey_tenant_id, survey_natural_key);

CREATE TABLE IF NOT EXISTS sys.sys_survey_responses (
  response_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  response_tenant_id uuid NOT NULL REFERENCES sys.sys_tenancies (tenant_id),
  response_natural_key text NOT NULL,
  response_survey_id uuid REFERENCES sys.sys_surveys (survey_id) ON DELETE CASCADE,
  response_legacy_question_id uuid,
  response_respondent_user_id uuid REFERENCES sys.sys_users (user_id),
  response_rating_value integer,
  response_text_value text,
  response_choice_value varchar(255),
  response_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS sys_survey_responses_nk_uq ON sys.sys_survey_responses (response_tenant_id, response_natural_key);
CREATE INDEX IF NOT EXISTS sys_survey_responses_survey_idx ON sys.sys_survey_responses (response_survey_id);

CREATE TABLE IF NOT EXISTS sys.sys_engagement_surveys (
  esurvey_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  esurvey_tenant_id uuid NOT NULL REFERENCES sys.sys_tenancies (tenant_id),
  esurvey_natural_key text NOT NULL,
  esurvey_legacy_template_id uuid,
  esurvey_title varchar(255) NOT NULL,
  esurvey_description text,
  esurvey_questions jsonb,
  esurvey_is_anonymous boolean,
  esurvey_status varchar(30),
  esurvey_audience_type varchar(50),
  esurvey_audience_ids jsonb,
  esurvey_start_date timestamptz,
  esurvey_end_date timestamptz,
  esurvey_reminder_days jsonb,
  esurvey_total_invitations integer,
  esurvey_total_responses integer,
  esurvey_created_by_user_id uuid REFERENCES sys.sys_users (user_id),
  esurvey_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS sys_engagement_surveys_nk_uq ON sys.sys_engagement_surveys (esurvey_tenant_id, esurvey_natural_key);

CREATE TABLE IF NOT EXISTS sys.sys_engagement_survey_responses (
  eresponse_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  eresponse_tenant_id uuid NOT NULL REFERENCES sys.sys_tenancies (tenant_id),
  eresponse_natural_key text NOT NULL,
  eresponse_survey_id uuid REFERENCES sys.sys_engagement_surveys (esurvey_id) ON DELETE CASCADE,
  eresponse_respondent_user_id uuid REFERENCES sys.sys_users (user_id),
  eresponse_anonymous_token varchar(255),
  eresponse_answers jsonb,
  eresponse_started_at timestamptz,
  eresponse_completed_at timestamptz,
  eresponse_is_complete boolean,
  eresponse_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS sys_engagement_survey_responses_nk_uq ON sys.sys_engagement_survey_responses (eresponse_tenant_id, eresponse_natural_key);
CREATE INDEX IF NOT EXISTS sys_engagement_survey_responses_survey_idx ON sys.sys_engagement_survey_responses (eresponse_survey_id);

COMMIT;
