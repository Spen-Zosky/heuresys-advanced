-- SDBI Mentorship pilot — Phase 3 temp_sdbi staging DDL. Idempotent (DROP+CREATE).
BEGIN;
DROP TABLE IF EXISTS temp_sdbi.mentor_match_scores;
DROP TABLE IF EXISTS temp_sdbi.mentorship_sessions;
DROP TABLE IF EXISTS temp_sdbi.mentorships;
DROP TABLE IF EXISTS temp_sdbi.mentorship_programs;

CREATE TABLE temp_sdbi.mentorship_programs (
  program_id uuid DEFAULT gen_random_uuid(), _legacy_source_id uuid UNIQUE, _import_run_id uuid,
  program_tenant_id uuid, program_natural_key text, program_name varchar(255), program_description text,
  program_type varchar(50), program_status varchar(30), program_duration_months integer,
  program_max_participants integer, program_focus_areas jsonb, program_eligibility_criteria jsonb,
  program_start_date date, program_end_date date, program_metadata jsonb, created_at timestamptz, updated_at timestamptz);

CREATE TABLE temp_sdbi.mentorships (
  mentorship_id uuid DEFAULT gen_random_uuid(), _legacy_source_id uuid UNIQUE, _legacy_source_program_id uuid, _import_run_id uuid,
  mentorship_tenant_id uuid, mentorship_natural_key text, mentorship_program_id uuid,
  mentorship_mentor_user_id uuid, mentorship_mentee_user_id uuid, mentorship_status varchar(30),
  mentorship_focus_areas jsonb, mentorship_meeting_frequency varchar(30), mentorship_goals jsonb,
  mentorship_match_score numeric(6,2), mentorship_start_date date, mentorship_end_date date,
  mentorship_notes text, mentorship_metadata jsonb, created_at timestamptz, updated_at timestamptz);

CREATE TABLE temp_sdbi.mentorship_sessions (
  session_id uuid DEFAULT gen_random_uuid(), _legacy_source_id uuid UNIQUE, _legacy_source_mentorship_id uuid, _import_run_id uuid,
  session_tenant_id uuid, session_natural_key text, session_date timestamptz, session_duration_minutes integer,
  session_status varchar(30), session_topics jsonb, session_notes text, session_rating smallint,
  session_metadata jsonb, created_at timestamptz, updated_at timestamptz);

CREATE TABLE temp_sdbi.mentor_match_scores (
  match_id uuid DEFAULT gen_random_uuid(), _legacy_source_id uuid UNIQUE, _import_run_id uuid,
  match_tenant_id uuid, match_natural_key text, match_legacy_skill_id uuid, match_skill_name varchar(255),
  match_mentee_level numeric(6,2), match_mentor_level numeric(6,2), match_score numeric(6,2),
  match_factors jsonb, match_is_recommended boolean, match_recommendation_rank integer,
  match_metadata jsonb, created_at timestamptz, expires_at timestamptz);
COMMIT;
