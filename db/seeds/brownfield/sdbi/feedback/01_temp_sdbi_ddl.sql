-- SDBI Feedback pilot — Phase 3 temp_sdbi DDL. Idempotent.
BEGIN;
DROP TABLE IF EXISTS temp_sdbi.feedback_responses;
DROP TABLE IF EXISTS temp_sdbi.feedback_requests;
DROP TABLE IF EXISTS temp_sdbi.continuous_feedback;
DROP TABLE IF EXISTS temp_sdbi.feedback_360;

CREATE TABLE temp_sdbi.feedback_360 (
  feedback_id uuid DEFAULT gen_random_uuid(), _legacy_source_id uuid UNIQUE,
  _legacy_review_cycle_id uuid, _legacy_performance_review_id uuid, _import_run_id uuid,
  feedback_tenant_id uuid, feedback_natural_key text, feedback_relationship_type varchar(50),
  feedback_overall_rating numeric(4,2), feedback_strengths text, feedback_areas_for_improvement text,
  feedback_is_anonymous boolean, feedback_status varchar(30), feedback_legacy_questionnaire_id uuid,
  feedback_legacy_request_id uuid, feedback_question_responses jsonb, feedback_sentiment_score numeric(5,3),
  feedback_submission_time_seconds integer, feedback_completed_at timestamptz,
  feedback_metadata jsonb, created_at timestamptz, updated_at timestamptz);

CREATE TABLE temp_sdbi.continuous_feedback (
  cf_id uuid DEFAULT gen_random_uuid(), _legacy_source_id uuid UNIQUE,
  _legacy_goal_id uuid, _legacy_performance_review_id uuid, _import_run_id uuid,
  cf_tenant_id uuid, cf_natural_key text, cf_feedback_type varchar(50), cf_message text, cf_is_private boolean,
  cf_legacy_competency_id uuid, cf_sentiment_score numeric(5,3), cf_acknowledged boolean,
  cf_acknowledged_at timestamptz, cf_visibility varchar(30), cf_tags jsonb, cf_category varchar(100),
  cf_metadata jsonb, created_at timestamptz, updated_at timestamptz);

CREATE TABLE temp_sdbi.feedback_requests (
  request_id uuid DEFAULT gen_random_uuid(), _legacy_source_id uuid UNIQUE,
  _legacy_review_cycle_id uuid, _legacy_performance_review_id uuid, _import_run_id uuid,
  request_tenant_id uuid, request_natural_key text, request_feedback_type varchar(50), request_status varchar(30),
  request_due_date date, request_completed_at timestamptz, request_is_anonymous boolean,
  request_legacy_questionnaire_id uuid, request_relationship_type varchar(50), request_reminder_sent_at timestamptz,
  request_legacy_feedback_360_id uuid, request_metadata jsonb, created_at timestamptz, updated_at timestamptz);

CREATE TABLE temp_sdbi.feedback_responses (
  response_id uuid DEFAULT gen_random_uuid(), _legacy_source_id uuid UNIQUE, _legacy_request_id uuid, _import_run_id uuid,
  response_tenant_id uuid, response_natural_key text, response_overall_rating integer, response_strengths text,
  response_areas_for_improvement text, response_additional_comments text, response_competency_ratings jsonb,
  response_metadata jsonb, created_at timestamptz, updated_at timestamptz);
COMMIT;
