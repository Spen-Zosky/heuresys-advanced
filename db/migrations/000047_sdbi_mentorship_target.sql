-- ============================================================================
-- Migration 000047 — SDBI Mentorship target schema (4 tables)
-- ADR-0014 SDBI MVP-4 2.4 — Mentorship macro-area. Mapping card MENTORSHIP-MAP-01.
-- Conventions: sys.sys_<plural>, *_tenant_id FK (I5 no RLS), varchar (CHECK TODO,
--   source values uppercased), date/timestamptz (RD-09), natural_key UQ, ARRAY→jsonb.
-- Idempotent: CREATE ... IF NOT EXISTS. Reversibility: DROP 4 tables reverse FK order.
-- Authored: 2026-05-27 (MVP-4 2.4.8).
-- ============================================================================
BEGIN;

CREATE TABLE IF NOT EXISTS sys.sys_mentorship_programs (
  program_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_tenant_id uuid NOT NULL REFERENCES sys.sys_tenancies (tenant_id),
  program_natural_key text NOT NULL,
  program_name varchar(255) NOT NULL,
  program_description text,
  program_type varchar(50),
  program_status varchar(30),
  program_duration_months integer,
  program_max_participants integer,
  program_focus_areas jsonb,
  program_eligibility_criteria jsonb,
  program_start_date date,
  program_end_date date,
  program_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS sys_mentorship_programs_nk_uq
  ON sys.sys_mentorship_programs (program_tenant_id, program_natural_key);

CREATE TABLE IF NOT EXISTS sys.sys_mentorships (
  mentorship_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mentorship_tenant_id uuid NOT NULL REFERENCES sys.sys_tenancies (tenant_id),
  mentorship_natural_key text NOT NULL,
  mentorship_program_id uuid REFERENCES sys.sys_mentorship_programs (program_id),
  mentorship_mentor_user_id uuid REFERENCES sys.sys_users (user_id),
  mentorship_mentee_user_id uuid REFERENCES sys.sys_users (user_id),
  mentorship_status varchar(30),
  mentorship_focus_areas jsonb,
  mentorship_meeting_frequency varchar(30),
  mentorship_goals jsonb,
  mentorship_match_score numeric(6,2),
  mentorship_start_date date,
  mentorship_end_date date,
  mentorship_notes text,
  mentorship_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS sys_mentorships_nk_uq
  ON sys.sys_mentorships (mentorship_tenant_id, mentorship_natural_key);
CREATE INDEX IF NOT EXISTS sys_mentorships_program_idx
  ON sys.sys_mentorships (mentorship_program_id) WHERE mentorship_program_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS sys.sys_mentorship_sessions (
  session_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_tenant_id uuid NOT NULL REFERENCES sys.sys_tenancies (tenant_id),
  session_natural_key text NOT NULL,
  session_mentorship_id uuid NOT NULL REFERENCES sys.sys_mentorships (mentorship_id) ON DELETE CASCADE,
  session_date timestamptz NOT NULL,
  session_duration_minutes integer,
  session_status varchar(30),
  session_topics jsonb,
  session_notes text,
  session_rating smallint,
  session_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS sys_mentorship_sessions_nk_uq
  ON sys.sys_mentorship_sessions (session_tenant_id, session_natural_key);
CREATE INDEX IF NOT EXISTS sys_mentorship_sessions_mentorship_idx
  ON sys.sys_mentorship_sessions (session_mentorship_id);

CREATE TABLE IF NOT EXISTS sys.sys_mentor_match_scores (
  match_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_tenant_id uuid NOT NULL REFERENCES sys.sys_tenancies (tenant_id),
  match_natural_key text NOT NULL,
  match_mentee_user_id uuid REFERENCES sys.sys_users (user_id),
  match_mentor_user_id uuid REFERENCES sys.sys_users (user_id),
  match_legacy_skill_id uuid,
  match_skill_name varchar(255),
  match_mentee_level numeric(6,2),
  match_mentor_level numeric(6,2),
  match_score numeric(6,2),
  match_factors jsonb,
  match_is_recommended boolean,
  match_recommendation_rank integer,
  match_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS sys_mentor_match_scores_nk_uq
  ON sys.sys_mentor_match_scores (match_tenant_id, match_natural_key);

COMMIT;
