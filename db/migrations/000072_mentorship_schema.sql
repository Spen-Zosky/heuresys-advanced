-- ============================================================================
-- Migration 000072 — SDBI B-10b milestone 1: Mentorship domain (4 tables)
-- ----------------------------------------------------------------------------
-- ADR ref: ADR-0014 (SDBI) · ADR-0024 / I14 (employee-centric crosswalk)
-- Design: S970 mentorship discovery+design (workflow), verified adversarial.
-- Creates 4 sys.* base tables for the legacy mentorship domain (no prior sys.* target):
--   1. sys.sys_mentorship_programs   (catalog; mutable -> updated_at + trigger)
--   2. sys.sys_mentorships           (mentor-mentee pairing; mutable -> trigger)
--   3. sys.sys_mentorship_sessions   (event/child of pairing, CASCADE; immutable)
--   4. sys.sys_mentor_match_scores   (parallel pre-match scoring; immutable)
-- ----------------------------------------------------------------------------
-- Conventions mirror 000065_sdbi_perf_feedback_schema.sql verbatim:
--   sys.sys_<plural>; column prefix <entity>_<field>; PK <entity>_id uuid DEFAULT gen_random_uuid();
--   <entity>_tenant_id uuid NOT NULL -> sys.sys_tenancies ON DELETE RESTRICT (I5, NO RLS);
--   person FK <entity>_<role>_user_id -> sys.sys_users ON DELETE SET NULL (I14; unresolved -> NULL +
--     legacy id in *_metadata, never dropped); natural key + UQ(tenant_id, natural_key);
--   <entity>_metadata jsonb NOT NULL DEFAULT '{}'; CHECK (RD-08, never ENUM); date/timestamptz (RD-09);
--   updated_at + sys_set_updated_at trigger ONLY on mutable (programs, mentorships).
-- Idempotent: CREATE TABLE IF NOT EXISTS + guarded ADD CONSTRAINT + CREATE INDEX IF NOT EXISTS +
--   guarded CREATE TRIGGER. Applied under `psql -1 -f` (single implicit txn). Purely additive.
-- Authored: 2026-06-06 (S970).
-- ============================================================================

-- =====================================================================
-- §1 — sys.sys_mentorship_programs  (<- legacy mentorship_programs)
--      mutable catalog -> updated_at + trigger
-- =====================================================================

CREATE TABLE IF NOT EXISTS sys.sys_mentorship_programs (
  program_id                   uuid           PRIMARY KEY DEFAULT gen_random_uuid(),
  program_tenant_id            uuid           NOT NULL,
  program_natural_key          varchar(512)   NOT NULL,
  program_name                 varchar(255)   NOT NULL,
  program_description          text,
  program_type                 varchar(50)    NOT NULL DEFAULT 'GENERAL',
  program_status               varchar(20)    NOT NULL DEFAULT 'ACTIVE',
  program_duration_months      integer,
  program_max_participants     integer,
  program_focus_areas          text[],
  program_eligibility_criteria jsonb          NOT NULL DEFAULT '{}'::jsonb,
  program_start_date           date,
  program_end_date             date,
  program_metadata             jsonb          NOT NULL DEFAULT '{}'::jsonb,
  created_at                   timestamptz    NOT NULL DEFAULT now(),
  updated_at                   timestamptz    NOT NULL DEFAULT now()
);

DO $cs$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_mprog_type_check') THEN
    ALTER TABLE sys.sys_mentorship_programs ADD CONSTRAINT sys_mprog_type_check CHECK (
      program_type IN ('GENERAL','LEADERSHIP','TECHNICAL','MANAGEMENT','DEI'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_mprog_status_check') THEN
    ALTER TABLE sys.sys_mentorship_programs ADD CONSTRAINT sys_mprog_status_check CHECK (
      program_status IN ('ACTIVE','INACTIVE','ARCHIVED','DRAFT'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_mprog_updated_after') THEN
    ALTER TABLE sys.sys_mentorship_programs ADD CONSTRAINT sys_mprog_updated_after CHECK (updated_at >= created_at);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_mprog_tenant_fk') THEN
    ALTER TABLE sys.sys_mentorship_programs ADD CONSTRAINT sys_mprog_tenant_fk FOREIGN KEY (program_tenant_id) REFERENCES sys.sys_tenancies(tenant_id) ON DELETE RESTRICT;
  END IF;
END;
$cs$;

CREATE UNIQUE INDEX IF NOT EXISTS sys_mprog_natural_key_uq ON sys.sys_mentorship_programs (program_tenant_id, program_natural_key);
CREATE INDEX IF NOT EXISTS sys_mprog_tenant_idx ON sys.sys_mentorship_programs (program_tenant_id);
CREATE INDEX IF NOT EXISTS sys_mprog_status_idx ON sys.sys_mentorship_programs (program_tenant_id, program_status);

DO $trg$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'sys_mentorship_programs_set_updated_at') THEN
    CREATE TRIGGER sys_mentorship_programs_set_updated_at BEFORE UPDATE ON sys.sys_mentorship_programs
      FOR EACH ROW EXECUTE FUNCTION sys.sys_set_updated_at();
  END IF;
END;
$trg$;

-- =====================================================================
-- §2 — sys.sys_mentorships  (<- legacy mentorships)  mutable -> trigger
-- =====================================================================

CREATE TABLE IF NOT EXISTS sys.sys_mentorships (
  mentorship_id                uuid           PRIMARY KEY DEFAULT gen_random_uuid(),
  mentorship_tenant_id         uuid           NOT NULL,
  mentorship_natural_key       varchar(512)   NOT NULL,
  mentorship_program_id        uuid,
  mentorship_mentor_user_id    uuid,
  mentorship_mentee_user_id    uuid,
  mentorship_status            varchar(30)    NOT NULL DEFAULT 'ACTIVE',
  mentorship_focus_areas       text[],
  mentorship_meeting_frequency varchar(30)    NOT NULL DEFAULT 'BI_WEEKLY',
  mentorship_goals             text[],
  mentorship_match_score       numeric(5,2),
  mentorship_start_date        date,
  mentorship_end_date          date,
  mentorship_notes             text,
  mentorship_metadata          jsonb          NOT NULL DEFAULT '{}'::jsonb,
  created_at                   timestamptz    NOT NULL DEFAULT now(),
  updated_at                   timestamptz    NOT NULL DEFAULT now()
);

DO $cs$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_ment_status_check') THEN
    ALTER TABLE sys.sys_mentorships ADD CONSTRAINT sys_ment_status_check CHECK (
      mentorship_status IN ('ACTIVE','COMPLETED','ON_HOLD','CANCELLED','PENDING'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_ment_frequency_check') THEN
    ALTER TABLE sys.sys_mentorships ADD CONSTRAINT sys_ment_frequency_check CHECK (
      mentorship_meeting_frequency IN ('WEEKLY','BI_WEEKLY','MONTHLY','QUARTERLY','AD_HOC'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_ment_match_score_range') THEN
    ALTER TABLE sys.sys_mentorships ADD CONSTRAINT sys_ment_match_score_range CHECK (
      mentorship_match_score IS NULL OR (mentorship_match_score >= 0 AND mentorship_match_score <= 100));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_ment_different_persons') THEN
    ALTER TABLE sys.sys_mentorships ADD CONSTRAINT sys_ment_different_persons CHECK (
      mentorship_mentor_user_id IS NULL OR mentorship_mentee_user_id IS NULL
      OR mentorship_mentor_user_id <> mentorship_mentee_user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_ment_updated_after') THEN
    ALTER TABLE sys.sys_mentorships ADD CONSTRAINT sys_ment_updated_after CHECK (updated_at >= created_at);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_ment_tenant_fk') THEN
    ALTER TABLE sys.sys_mentorships ADD CONSTRAINT sys_ment_tenant_fk FOREIGN KEY (mentorship_tenant_id) REFERENCES sys.sys_tenancies(tenant_id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_ment_program_fk') THEN
    ALTER TABLE sys.sys_mentorships ADD CONSTRAINT sys_ment_program_fk FOREIGN KEY (mentorship_program_id) REFERENCES sys.sys_mentorship_programs(program_id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_ment_mentor_user_fk') THEN
    ALTER TABLE sys.sys_mentorships ADD CONSTRAINT sys_ment_mentor_user_fk FOREIGN KEY (mentorship_mentor_user_id) REFERENCES sys.sys_users(user_id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_ment_mentee_user_fk') THEN
    ALTER TABLE sys.sys_mentorships ADD CONSTRAINT sys_ment_mentee_user_fk FOREIGN KEY (mentorship_mentee_user_id) REFERENCES sys.sys_users(user_id) ON DELETE SET NULL;
  END IF;
END;
$cs$;

CREATE UNIQUE INDEX IF NOT EXISTS sys_ment_natural_key_uq ON sys.sys_mentorships (mentorship_tenant_id, mentorship_natural_key);
CREATE INDEX IF NOT EXISTS sys_ment_tenant_idx  ON sys.sys_mentorships (mentorship_tenant_id);
CREATE INDEX IF NOT EXISTS sys_ment_program_idx ON sys.sys_mentorships (mentorship_program_id) WHERE mentorship_program_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS sys_ment_mentor_idx  ON sys.sys_mentorships (mentorship_mentor_user_id) WHERE mentorship_mentor_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS sys_ment_mentee_idx  ON sys.sys_mentorships (mentorship_mentee_user_id) WHERE mentorship_mentee_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS sys_ment_status_idx  ON sys.sys_mentorships (mentorship_tenant_id, mentorship_status);

DO $trg$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'sys_mentorships_set_updated_at') THEN
    CREATE TRIGGER sys_mentorships_set_updated_at BEFORE UPDATE ON sys.sys_mentorships
      FOR EACH ROW EXECUTE FUNCTION sys.sys_set_updated_at();
  END IF;
END;
$trg$;

-- =====================================================================
-- §3 — sys.sys_mentorship_sessions  (<- legacy mentorship_sessions)
--      immutable event log, child of pairing (CASCADE) -> NO updated_at/trigger
-- =====================================================================

CREATE TABLE IF NOT EXISTS sys.sys_mentorship_sessions (
  session_id               uuid           PRIMARY KEY DEFAULT gen_random_uuid(),
  session_tenant_id        uuid           NOT NULL,
  session_natural_key      varchar(512)   NOT NULL,
  session_mentorship_id    uuid           NOT NULL,
  session_date             timestamptz    NOT NULL,
  session_duration_minutes integer,
  session_status           varchar(20)    NOT NULL DEFAULT 'SCHEDULED',
  session_topics           text[],
  session_notes            text,
  session_rating           integer,
  session_metadata         jsonb          NOT NULL DEFAULT '{}'::jsonb,
  created_at               timestamptz    NOT NULL DEFAULT now()
);

DO $cs$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_msess_status_check') THEN
    ALTER TABLE sys.sys_mentorship_sessions ADD CONSTRAINT sys_msess_status_check CHECK (
      session_status IN ('SCHEDULED','COMPLETED','CANCELLED','NO_SHOW','RESCHEDULED'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_msess_rating_range') THEN
    ALTER TABLE sys.sys_mentorship_sessions ADD CONSTRAINT sys_msess_rating_range CHECK (
      session_rating IS NULL OR (session_rating BETWEEN 1 AND 5));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_msess_tenant_fk') THEN
    ALTER TABLE sys.sys_mentorship_sessions ADD CONSTRAINT sys_msess_tenant_fk FOREIGN KEY (session_tenant_id) REFERENCES sys.sys_tenancies(tenant_id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_msess_mentorship_fk') THEN
    ALTER TABLE sys.sys_mentorship_sessions ADD CONSTRAINT sys_msess_mentorship_fk FOREIGN KEY (session_mentorship_id) REFERENCES sys.sys_mentorships(mentorship_id) ON DELETE CASCADE;
  END IF;
END;
$cs$;

CREATE UNIQUE INDEX IF NOT EXISTS sys_msess_natural_key_uq ON sys.sys_mentorship_sessions (session_tenant_id, session_natural_key);
CREATE INDEX IF NOT EXISTS sys_msess_tenant_idx     ON sys.sys_mentorship_sessions (session_tenant_id);
CREATE INDEX IF NOT EXISTS sys_msess_mentorship_idx ON sys.sys_mentorship_sessions (session_mentorship_id);

-- §3 is an immutable event log: no updated_at column, no set_updated_at trigger.

-- =====================================================================
-- §4 — sys.sys_mentor_match_scores  (<- legacy mentor_match_scores)
--      immutable pre-match scoring snapshot -> NO updated_at/trigger
-- =====================================================================

CREATE TABLE IF NOT EXISTS sys.sys_mentor_match_scores (
  match_id                  uuid           PRIMARY KEY DEFAULT gen_random_uuid(),
  match_tenant_id           uuid           NOT NULL,
  match_natural_key         varchar(512)   NOT NULL,
  match_mentee_user_id      uuid,
  match_mentor_user_id      uuid,
  match_skill_id            uuid,
  match_skill_name          varchar(200),
  match_mentee_level        numeric(3,2),
  match_mentor_level        numeric(3,2),
  match_score               numeric(5,4),
  match_factors             jsonb          NOT NULL DEFAULT '{}'::jsonb,
  match_is_recommended      boolean        NOT NULL DEFAULT false,
  match_recommendation_rank integer,
  match_expires_at          timestamptz,
  match_metadata            jsonb          NOT NULL DEFAULT '{}'::jsonb,
  created_at                timestamptz    NOT NULL DEFAULT now()
);

DO $cs$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_mms_score_range') THEN
    ALTER TABLE sys.sys_mentor_match_scores ADD CONSTRAINT sys_mms_score_range CHECK (
      match_score IS NULL OR (match_score >= 0 AND match_score <= 1));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_mms_mentee_level_range') THEN
    ALTER TABLE sys.sys_mentor_match_scores ADD CONSTRAINT sys_mms_mentee_level_range CHECK (
      match_mentee_level IS NULL OR (match_mentee_level >= 0 AND match_mentee_level <= 5));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_mms_mentor_level_range') THEN
    ALTER TABLE sys.sys_mentor_match_scores ADD CONSTRAINT sys_mms_mentor_level_range CHECK (
      match_mentor_level IS NULL OR (match_mentor_level >= 0 AND match_mentor_level <= 5));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_mms_different_persons') THEN
    ALTER TABLE sys.sys_mentor_match_scores ADD CONSTRAINT sys_mms_different_persons CHECK (
      match_mentee_user_id IS NULL OR match_mentor_user_id IS NULL
      OR match_mentee_user_id <> match_mentor_user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_mms_tenant_fk') THEN
    ALTER TABLE sys.sys_mentor_match_scores ADD CONSTRAINT sys_mms_tenant_fk FOREIGN KEY (match_tenant_id) REFERENCES sys.sys_tenancies(tenant_id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_mms_mentee_user_fk') THEN
    ALTER TABLE sys.sys_mentor_match_scores ADD CONSTRAINT sys_mms_mentee_user_fk FOREIGN KEY (match_mentee_user_id) REFERENCES sys.sys_users(user_id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_mms_mentor_user_fk') THEN
    ALTER TABLE sys.sys_mentor_match_scores ADD CONSTRAINT sys_mms_mentor_user_fk FOREIGN KEY (match_mentor_user_id) REFERENCES sys.sys_users(user_id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_mms_skill_fk') THEN
    ALTER TABLE sys.sys_mentor_match_scores ADD CONSTRAINT sys_mms_skill_fk FOREIGN KEY (match_skill_id) REFERENCES sys.sys_skills(skill_id) ON DELETE SET NULL;
  END IF;
END;
$cs$;

CREATE UNIQUE INDEX IF NOT EXISTS sys_mms_natural_key_uq ON sys.sys_mentor_match_scores (match_tenant_id, match_natural_key);
CREATE INDEX IF NOT EXISTS sys_mms_tenant_idx ON sys.sys_mentor_match_scores (match_tenant_id);
CREATE INDEX IF NOT EXISTS sys_mms_mentee_idx ON sys.sys_mentor_match_scores (match_mentee_user_id) WHERE match_mentee_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS sys_mms_mentor_idx ON sys.sys_mentor_match_scores (match_mentor_user_id) WHERE match_mentor_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS sys_mms_skill_idx  ON sys.sys_mentor_match_scores (match_skill_id) WHERE match_skill_id IS NOT NULL;

-- §4 is an immutable event log: no updated_at column, no set_updated_at trigger.

-- ============================================================================
-- Post-conditions (idempotent): assert the 4 base tables exist.
-- ============================================================================
DO $$
DECLARE n_tables int;
BEGIN
  SELECT count(*) INTO n_tables
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'sys' AND c.relkind = 'r'
    AND c.relname IN ('sys_mentorship_programs','sys_mentorships',
                      'sys_mentorship_sessions','sys_mentor_match_scores');
  IF n_tables <> 4 THEN
    RAISE EXCEPTION '000072: expected 4 mentorship base tables, found %', n_tables;
  END IF;
  RAISE NOTICE '000072: mentorship schema OK — 4/4 base tables present.';
END $$;
