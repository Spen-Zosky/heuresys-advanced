-- ============================================================================
-- Migration 000048 — SDBI Feedback target schema (4 tables)
-- ADR-0014 SDBI MVP-4 2.4 — Feedback macro-area. Mapping card FEEDBACK-MAP-01.
-- Tables: sys_feedback_360, sys_continuous_feedback, sys_feedback_requests,
--   sys_feedback_responses. Cross-cluster FKs (review_cycle, performance_review,
--   goal) resolved at consolidation via sys.* natural_key/metadata.
-- Conventions: I5 tenant FK, RD-09 date/timestamptz, varchar (CHECK TODO), natural_key UQ.
-- Idempotent. Authored 2026-05-27 (MVP-4 2.4.9).
-- ============================================================================
BEGIN;

CREATE TABLE IF NOT EXISTS sys.sys_feedback_360 (
  feedback_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feedback_tenant_id uuid NOT NULL REFERENCES sys.sys_tenancies (tenant_id),
  feedback_natural_key text NOT NULL,
  feedback_target_user_id uuid REFERENCES sys.sys_users (user_id),
  feedback_reviewer_user_id uuid REFERENCES sys.sys_users (user_id),
  feedback_review_cycle_id uuid REFERENCES sys.sys_review_cycles (cycle_id),
  feedback_performance_review_id uuid REFERENCES sys.sys_performance_reviews (review_id),
  feedback_relationship_type varchar(50),
  feedback_overall_rating numeric(4,2),
  feedback_strengths text,
  feedback_areas_for_improvement text,
  feedback_is_anonymous boolean,
  feedback_status varchar(30),
  feedback_legacy_questionnaire_id uuid,
  feedback_legacy_request_id uuid,
  feedback_question_responses jsonb,
  feedback_sentiment_score numeric(5,3),
  feedback_submission_time_seconds integer,
  feedback_completed_at timestamptz,
  feedback_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS sys_feedback_360_nk_uq ON sys.sys_feedback_360 (feedback_tenant_id, feedback_natural_key);

CREATE TABLE IF NOT EXISTS sys.sys_continuous_feedback (
  cf_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cf_tenant_id uuid NOT NULL REFERENCES sys.sys_tenancies (tenant_id),
  cf_natural_key text NOT NULL,
  cf_from_user_id uuid REFERENCES sys.sys_users (user_id),
  cf_to_user_id uuid REFERENCES sys.sys_users (user_id),
  cf_feedback_type varchar(50),
  cf_message text,
  cf_is_private boolean,
  cf_related_goal_id uuid REFERENCES sys.sys_goals (goal_id),
  cf_legacy_competency_id uuid,
  cf_sentiment_score numeric(5,3),
  cf_acknowledged boolean,
  cf_acknowledged_at timestamptz,
  cf_visibility varchar(30),
  cf_tags jsonb,
  cf_category varchar(100),
  cf_performance_review_id uuid REFERENCES sys.sys_performance_reviews (review_id),
  cf_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS sys_continuous_feedback_nk_uq ON sys.sys_continuous_feedback (cf_tenant_id, cf_natural_key);

CREATE TABLE IF NOT EXISTS sys.sys_feedback_requests (
  request_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_tenant_id uuid NOT NULL REFERENCES sys.sys_tenancies (tenant_id),
  request_natural_key text NOT NULL,
  request_requestee_user_id uuid REFERENCES sys.sys_users (user_id),
  request_reviewer_user_id uuid REFERENCES sys.sys_users (user_id),
  request_feedback_type varchar(50),
  request_status varchar(30),
  request_due_date date,
  request_completed_at timestamptz,
  request_is_anonymous boolean,
  request_review_cycle_id uuid REFERENCES sys.sys_review_cycles (cycle_id),
  request_performance_review_id uuid REFERENCES sys.sys_performance_reviews (review_id),
  request_legacy_questionnaire_id uuid,
  request_relationship_type varchar(50),
  request_reminder_sent_at timestamptz,
  request_legacy_feedback_360_id uuid,
  request_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS sys_feedback_requests_nk_uq ON sys.sys_feedback_requests (request_tenant_id, request_natural_key);

CREATE TABLE IF NOT EXISTS sys.sys_feedback_responses (
  response_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  response_tenant_id uuid NOT NULL REFERENCES sys.sys_tenancies (tenant_id),
  response_natural_key text NOT NULL,
  response_request_id uuid REFERENCES sys.sys_feedback_requests (request_id) ON DELETE CASCADE,
  response_overall_rating integer,
  response_strengths text,
  response_areas_for_improvement text,
  response_additional_comments text,
  response_competency_ratings jsonb,
  response_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS sys_feedback_responses_nk_uq ON sys.sys_feedback_responses (response_tenant_id, response_natural_key);
CREATE INDEX IF NOT EXISTS sys_feedback_responses_request_idx ON sys.sys_feedback_responses (response_request_id);

COMMIT;
