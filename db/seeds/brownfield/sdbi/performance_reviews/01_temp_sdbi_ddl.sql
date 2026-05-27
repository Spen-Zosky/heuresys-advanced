-- db/seeds/brownfield/sdbi/performance_reviews/01_temp_sdbi_ddl.sql
-- SDBI PerformanceReviews pilot — Phase 3 temp_sdbi staging DDL (8 tables).
-- Mirror of sys.sys_performance_* / sys_review_* targets (no FK), with
-- _legacy_source_id + _import_run_id bookkeeping for two-pass FK resolution.
-- Idempotent: DROP + CREATE (TRUNCATE-and-retry policy, ADR-0014 §3.2).
-- Run via psql -v ON_ERROR_STOP=1.

BEGIN;

DROP TABLE IF EXISTS temp_sdbi.competency_review_ratings;
DROP TABLE IF EXISTS temp_sdbi.goal_review_ratings;
DROP TABLE IF EXISTS temp_sdbi.self_reviews;
DROP TABLE IF EXISTS temp_sdbi.performance_reviews;
DROP TABLE IF EXISTS temp_sdbi.review_cycle_participants;
DROP TABLE IF EXISTS temp_sdbi.review_cycle_phases;
DROP TABLE IF EXISTS temp_sdbi.review_cycles;
DROP TABLE IF EXISTS temp_sdbi.performance_review_templates;

CREATE TABLE temp_sdbi.performance_review_templates (
  template_id uuid DEFAULT gen_random_uuid(),
  _legacy_source_id uuid UNIQUE, _import_run_id uuid,
  template_tenant_id uuid, template_natural_key text, template_name varchar(255),
  template_description text, template_type varchar(50), template_rating_scale_type varchar(20),
  template_rating_scale_config jsonb, template_sections jsonb, template_competencies jsonb,
  template_include_goals boolean, template_include_development_plan boolean,
  template_is_default boolean, template_is_active boolean, template_deleted_at timestamptz,
  template_metadata jsonb, created_at timestamptz, updated_at timestamptz
);

CREATE TABLE temp_sdbi.review_cycles (
  cycle_id uuid DEFAULT gen_random_uuid(),
  _legacy_source_id uuid UNIQUE, _legacy_source_template_id uuid, _import_run_id uuid,
  cycle_tenant_id uuid, cycle_natural_key text, cycle_name varchar(255), cycle_description text,
  cycle_type varchar(50), cycle_status varchar(50), cycle_start_date date, cycle_end_date date,
  cycle_self_review_deadline date, cycle_manager_review_deadline date, cycle_calibration_deadline date,
  cycle_feedback_deadline date, cycle_acknowledgment_deadline date, cycle_finalization_deadline date,
  cycle_feedback_360_deadline date, cycle_include_self_review boolean, cycle_include_peer_review boolean,
  cycle_include_upward_review boolean, cycle_include_360_feedback boolean,
  cycle_require_goal_assessment boolean, cycle_require_competency_rating boolean,
  cycle_feedback_360_anonymous boolean, cycle_feedback_360_min_responses integer,
  cycle_review_template_id uuid, cycle_competency_framework_id uuid, cycle_rating_scale_id uuid,
  cycle_rating_scale_type varchar(20), cycle_rating_scale_config jsonb,
  cycle_eligible_employees_filter jsonb, cycle_launched_at timestamptz, cycle_completed_at timestamptz,
  cycle_metadata jsonb, created_at timestamptz, updated_at timestamptz
);

CREATE TABLE temp_sdbi.review_cycle_phases (
  phase_id uuid DEFAULT gen_random_uuid(),
  _legacy_source_id uuid UNIQUE, _legacy_source_cycle_id uuid, _import_run_id uuid,
  phase_tenant_id uuid, phase_cycle_id uuid, phase_natural_key text, phase_name varchar(50),
  phase_order integer, phase_start_date date, phase_end_date date, phase_status varchar(20),
  phase_instructions text, phase_reminder_days_before integer, phase_escalation_days_after integer,
  phase_is_required boolean, phase_metadata jsonb, created_at timestamptz, updated_at timestamptz
);

CREATE TABLE temp_sdbi.review_cycle_participants (
  participant_id uuid DEFAULT gen_random_uuid(),
  _legacy_source_id uuid UNIQUE, _legacy_source_cycle_id uuid, _import_run_id uuid,
  participant_tenant_id uuid, participant_cycle_id uuid, participant_natural_key text,
  participant_employee_user_id uuid, participant_manager_user_id uuid, participant_status varchar(30),
  participant_self_review_completed boolean, participant_self_review_completed_at timestamptz,
  participant_manager_review_completed boolean, participant_manager_review_completed_at timestamptz,
  participant_calibrated boolean, participant_calibrated_at timestamptz,
  participant_acknowledged boolean, participant_acknowledged_at timestamptz,
  participant_excluded_reason text, participant_metadata jsonb, created_at timestamptz, updated_at timestamptz
);

CREATE TABLE temp_sdbi.performance_reviews (
  review_id uuid DEFAULT gen_random_uuid(),
  _legacy_source_id uuid UNIQUE, _legacy_source_cycle_id uuid, _legacy_source_template_id uuid, _import_run_id uuid,
  review_tenant_id uuid, review_natural_key text, review_cycle_id uuid, review_template_id uuid,
  review_employee_user_id uuid, review_reviewer_user_id uuid, review_period_start date, review_period_end date,
  review_type varchar(50), review_status varchar(50), review_overall_rating numeric(4,2),
  review_goal_achievement_rating numeric(4,2), review_competency_rating numeric(4,2),
  review_potential_rating varchar(20), review_performance_box smallint, review_potential_box smallint,
  review_pre_calibration_rating numeric(4,2), review_calibrated_rating numeric(4,2),
  review_calibrated_by_user_id uuid, review_self_rating numeric(4,2),
  review_strengths text, review_areas_for_improvement text, review_manager_comments text,
  review_employee_comments text, review_self_comments text, review_development_plan text,
  review_career_aspirations text, review_calibration_notes text,
  review_competency_ratings jsonb, review_goal_ratings jsonb, review_section_ratings jsonb,
  review_recommended_actions jsonb, review_goals_auto_populated boolean, review_goals_count integer,
  review_competencies_count integer, review_self_assessment_status varchar(20),
  review_self_assessment_started_at timestamptz, review_self_submitted_at timestamptz,
  review_manager_submitted_at timestamptz, review_submitted_at timestamptz, review_acknowledged_at timestamptz,
  review_self_review_completed_at timestamptz, review_calibrated_at timestamptz, review_shared_at timestamptz,
  review_finalized_at timestamptz, review_finalized_by_user_id uuid,
  review_metadata jsonb, created_at timestamptz, updated_at timestamptz
);

CREATE TABLE temp_sdbi.self_reviews (
  self_review_id uuid DEFAULT gen_random_uuid(),
  _legacy_source_id uuid UNIQUE, _legacy_source_review_id uuid, _import_run_id uuid,
  self_review_tenant_id uuid, self_review_natural_key text, self_review_performance_review_id uuid,
  self_review_employee_user_id uuid, self_review_overall_rating numeric(4,2),
  self_review_goal_rating numeric(4,2), self_review_competency_rating numeric(4,2),
  self_review_achievements text, self_review_challenges text, self_review_learnings text,
  self_review_goals_for_next_period text, self_review_feedback_for_manager text,
  self_review_competency_self_ratings jsonb, self_review_goal_self_assessments jsonb,
  self_review_goal_ratings jsonb, self_review_ksaba_ratings jsonb, self_review_status varchar(20),
  self_review_evidence_count integer, self_review_submitted_at timestamptz,
  self_review_last_saved_at timestamptz, self_review_metadata jsonb, created_at timestamptz, updated_at timestamptz
);

CREATE TABLE temp_sdbi.goal_review_ratings (
  goal_rating_id uuid DEFAULT gen_random_uuid(),
  _legacy_source_id uuid UNIQUE, _legacy_source_review_id uuid, _legacy_source_goal_id uuid, _import_run_id uuid,
  goal_rating_tenant_id uuid, goal_rating_natural_key text, goal_rating_performance_review_id uuid,
  goal_rating_goal_id uuid, goal_rating_employee_user_id uuid, goal_rating_self_rating numeric(4,2),
  goal_rating_self_comment text, goal_rating_achievement_description text, goal_rating_manager_rating numeric(4,2),
  goal_rating_manager_comment text, goal_rating_weight numeric(5,2), goal_rating_metadata jsonb,
  created_at timestamptz, updated_at timestamptz
);

CREATE TABLE temp_sdbi.competency_review_ratings (
  competency_rating_id uuid DEFAULT gen_random_uuid(),
  _legacy_source_id uuid UNIQUE, _legacy_source_review_id uuid, _import_run_id uuid,
  competency_rating_tenant_id uuid, competency_rating_natural_key text,
  competency_rating_performance_review_id uuid, competency_rating_employee_user_id uuid,
  competency_rating_legacy_competency_id uuid, competency_rating_ksaba_dimension varchar(20),
  competency_rating_competency_name varchar(100), competency_rating_self_rating numeric(4,2),
  competency_rating_self_comment text, competency_rating_self_evidence jsonb,
  competency_rating_manager_rating numeric(4,2), competency_rating_manager_comment text,
  competency_rating_weight numeric(5,2), competency_rating_metadata jsonb,
  created_at timestamptz, updated_at timestamptz
);

COMMIT;
