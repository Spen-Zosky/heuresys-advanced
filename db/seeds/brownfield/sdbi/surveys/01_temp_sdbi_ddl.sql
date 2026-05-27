-- SDBI Surveys/Engagement pilot — Phase 3 temp_sdbi DDL. Idempotent.
BEGIN;
DROP TABLE IF EXISTS temp_sdbi.engagement_survey_responses;
DROP TABLE IF EXISTS temp_sdbi.engagement_surveys;
DROP TABLE IF EXISTS temp_sdbi.survey_responses;
DROP TABLE IF EXISTS temp_sdbi.surveys;

CREATE TABLE temp_sdbi.surveys (
  survey_id uuid DEFAULT gen_random_uuid(), _legacy_source_id uuid UNIQUE, _import_run_id uuid,
  survey_tenant_id uuid, survey_natural_key text, survey_title varchar(255), survey_description text,
  survey_type varchar(50), survey_status varchar(30), survey_start_date date, survey_end_date date,
  survey_is_anonymous boolean, survey_is_active boolean, survey_questions jsonb, survey_total_invitations integer,
  survey_deleted_at timestamptz, survey_metadata jsonb, created_at timestamptz, updated_at timestamptz);

CREATE TABLE temp_sdbi.survey_responses (
  response_id uuid DEFAULT gen_random_uuid(), _legacy_source_id uuid UNIQUE, _legacy_survey_id uuid, _import_run_id uuid,
  response_tenant_id uuid, response_natural_key text, response_legacy_question_id uuid, response_rating_value integer,
  response_text_value text, response_choice_value varchar(255), response_metadata jsonb, created_at timestamptz, updated_at timestamptz);

CREATE TABLE temp_sdbi.engagement_surveys (
  esurvey_id uuid DEFAULT gen_random_uuid(), _legacy_source_id uuid UNIQUE, _import_run_id uuid,
  esurvey_tenant_id uuid, esurvey_natural_key text, esurvey_legacy_template_id uuid, esurvey_title varchar(255),
  esurvey_description text, esurvey_questions jsonb, esurvey_is_anonymous boolean, esurvey_status varchar(30),
  esurvey_audience_type varchar(50), esurvey_audience_ids jsonb, esurvey_start_date timestamptz, esurvey_end_date timestamptz,
  esurvey_reminder_days jsonb, esurvey_total_invitations integer, esurvey_total_responses integer,
  esurvey_metadata jsonb, created_at timestamptz, updated_at timestamptz);

CREATE TABLE temp_sdbi.engagement_survey_responses (
  eresponse_id uuid DEFAULT gen_random_uuid(), _legacy_source_id uuid UNIQUE, _legacy_survey_id uuid, _import_run_id uuid,
  eresponse_tenant_id uuid, eresponse_natural_key text, eresponse_anonymous_token varchar(255), eresponse_answers jsonb,
  eresponse_started_at timestamptz, eresponse_completed_at timestamptz, eresponse_is_complete boolean,
  eresponse_metadata jsonb, created_at timestamptz, updated_at timestamptz);
COMMIT;
