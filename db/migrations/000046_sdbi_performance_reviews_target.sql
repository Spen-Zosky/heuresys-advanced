-- ============================================================================
-- Migration 000046 — SDBI PerformanceReviews target schema (8 tables)
-- ----------------------------------------------------------------------------
-- ADR-0014 (SDBI) stream MVP-4 2.4 — PerformanceReviews macro-area.
-- Design pilot: target sys.* schema for the performance-review cluster derived
-- by Phase-1 introspection of heuresys_platform.public (mapping card:
-- cowork_reserved/sdbi_mapping_cards/performance_reviews_card.md).
--
-- ⚠ Source is schema-only (0 rows in heuresys_platform.public as of 2026-05-27).
--   This migration ships the TARGET SCHEMA ONLY. Phase 3-6 (temp_sdbi seed,
--   consolidation, lineage, cleanup) are DEFERRED until source data is located.
-- ----------------------------------------------------------------------------
-- Invariants: I3/I4 sys.sys_<plural>; I5 tenant isolation = FK (no RLS);
--   RD-08 categoricals = varchar(N)+CHECK (no ENUM); RD-09 date vs timestamptz.
-- Categoricals whose source value-set could NOT be derived from the empty source
--   are typed varchar(N) WITHOUT a value-CHECK and flagged TODO(CHECK) — the
--   whitelist must be added at Phase-1 on populated data (CW-B16/B21: do not
--   invent allowed values). Where the source carried a CHECK it is ported.
-- Idempotent: CREATE TABLE/INDEX IF NOT EXISTS; constraints added via guarded
--   DO blocks. Reversibility: DROP the 8 tables in reverse FK order.
-- ----------------------------------------------------------------------------
-- Authored: 2026-05-27 (MVP-4 2.4.5 — SDBI Phase 2 PerformanceReviews design pilot)
-- ============================================================================

BEGIN;

-- ===========================================================================
-- 1. sys.sys_performance_review_templates  (src public.performance_review_templates)
-- ===========================================================================
CREATE TABLE IF NOT EXISTS sys.sys_performance_review_templates (
  template_id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_tenant_id                uuid NOT NULL REFERENCES sys.sys_tenancies (tenant_id),
  template_natural_key              text NOT NULL,
  template_name                     varchar(255) NOT NULL,
  template_description              text,
  template_type                     varchar(50),   -- TODO(CHECK): whitelist from data
  template_rating_scale_type        varchar(20),   -- TODO(CHECK): whitelist from data
  template_rating_scale_config      jsonb,
  template_sections                 jsonb NOT NULL DEFAULT '[]'::jsonb,
  template_competencies             jsonb,
  template_include_goals            boolean,
  template_include_development_plan boolean,
  template_is_default               boolean NOT NULL DEFAULT false,
  template_is_active                boolean NOT NULL DEFAULT true,
  template_deleted_at                timestamptz,
  template_metadata                 jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at                        timestamptz NOT NULL DEFAULT now(),
  updated_at                        timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS sys_performance_review_templates_nk_uq
  ON sys.sys_performance_review_templates (template_tenant_id, template_natural_key);

-- ===========================================================================
-- 2. sys.sys_review_cycles  (src public.review_cycles)
-- ===========================================================================
CREATE TABLE IF NOT EXISTS sys.sys_review_cycles (
  cycle_id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_tenant_id                   uuid NOT NULL REFERENCES sys.sys_tenancies (tenant_id),
  cycle_natural_key                 text NOT NULL,
  cycle_name                        varchar(255) NOT NULL,
  cycle_description                 text,
  cycle_type                        varchar(50),   -- TODO(CHECK): whitelist from data
  cycle_status                      varchar(50),   -- TODO(CHECK): whitelist from data
  cycle_start_date                  date NOT NULL,
  cycle_end_date                    date NOT NULL,
  cycle_self_review_deadline        date,
  cycle_manager_review_deadline     date,
  cycle_calibration_deadline        date,
  cycle_feedback_deadline           date,
  cycle_acknowledgment_deadline     date,
  cycle_finalization_deadline       date,
  cycle_feedback_360_deadline       date,
  cycle_include_self_review         boolean,
  cycle_include_peer_review         boolean,
  cycle_include_upward_review       boolean,
  cycle_include_360_feedback        boolean,
  cycle_require_goal_assessment     boolean,
  cycle_require_competency_rating   boolean,
  cycle_feedback_360_anonymous      boolean,
  cycle_feedback_360_min_responses  integer,
  cycle_review_template_id          uuid REFERENCES sys.sys_performance_review_templates (template_id),
  cycle_competency_framework_id     uuid,          -- no sys.* competency target yet → ref kept in metadata
  cycle_rating_scale_id             uuid,          -- no sys.* rating_scale target yet
  cycle_rating_scale_type           varchar(20),
  cycle_rating_scale_config         jsonb,
  cycle_eligible_employees_filter   jsonb,
  cycle_launched_at                 timestamptz,
  cycle_completed_at                timestamptz,
  cycle_metadata                    jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at                        timestamptz NOT NULL DEFAULT now(),
  updated_at                        timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS sys_review_cycles_nk_uq
  ON sys.sys_review_cycles (cycle_tenant_id, cycle_natural_key);
CREATE INDEX IF NOT EXISTS sys_review_cycles_template_idx
  ON sys.sys_review_cycles (cycle_review_template_id) WHERE cycle_review_template_id IS NOT NULL;

-- ===========================================================================
-- 3. sys.sys_review_cycle_phases  (src public.review_cycle_phases)
-- ===========================================================================
CREATE TABLE IF NOT EXISTS sys.sys_review_cycle_phases (
  phase_id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phase_tenant_id           uuid NOT NULL REFERENCES sys.sys_tenancies (tenant_id),
  phase_cycle_id            uuid NOT NULL REFERENCES sys.sys_review_cycles (cycle_id) ON DELETE CASCADE,
  phase_natural_key         text NOT NULL,
  phase_name                varchar(50) NOT NULL,
  phase_order               integer NOT NULL,
  phase_start_date          date NOT NULL,
  phase_end_date            date NOT NULL,
  phase_status              varchar(20),   -- TODO(CHECK): whitelist from data
  phase_instructions        text,
  phase_reminder_days_before  integer,
  phase_escalation_days_after integer,
  phase_is_required         boolean NOT NULL DEFAULT true,
  phase_metadata            jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS sys_review_cycle_phases_nk_uq
  ON sys.sys_review_cycle_phases (phase_tenant_id, phase_natural_key);
CREATE INDEX IF NOT EXISTS sys_review_cycle_phases_cycle_idx
  ON sys.sys_review_cycle_phases (phase_cycle_id);

-- ===========================================================================
-- 4. sys.sys_review_cycle_participants  (src public.review_cycle_participants)
-- ===========================================================================
CREATE TABLE IF NOT EXISTS sys.sys_review_cycle_participants (
  participant_id                         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_tenant_id                  uuid NOT NULL REFERENCES sys.sys_tenancies (tenant_id),
  participant_cycle_id                   uuid NOT NULL REFERENCES sys.sys_review_cycles (cycle_id) ON DELETE CASCADE,
  participant_natural_key                text NOT NULL,
  participant_employee_user_id           uuid REFERENCES sys.sys_users (user_id),
  participant_manager_user_id            uuid REFERENCES sys.sys_users (user_id),
  participant_status                     varchar(30),  -- CHECK ported below (source whitelist)
  participant_self_review_completed      boolean,
  participant_self_review_completed_at   timestamptz,
  participant_manager_review_completed   boolean,
  participant_manager_review_completed_at timestamptz,
  participant_calibrated                 boolean,
  participant_calibrated_at              timestamptz,
  participant_acknowledged               boolean,
  participant_acknowledged_at            timestamptz,
  participant_excluded_reason            text,
  participant_metadata                   jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at                             timestamptz NOT NULL DEFAULT now(),
  updated_at                             timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS sys_review_cycle_participants_nk_uq
  ON sys.sys_review_cycle_participants (participant_tenant_id, participant_natural_key);
CREATE INDEX IF NOT EXISTS sys_review_cycle_participants_cycle_idx
  ON sys.sys_review_cycle_participants (participant_cycle_id);
-- Ported CHECK (source value-set, UPPERCASE-normalized per repo convention)
DO $pp_status$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='sys_review_cycle_participants_status_check'
                 AND conrelid='sys.sys_review_cycle_participants'::regclass) THEN
    ALTER TABLE sys.sys_review_cycle_participants
      ADD CONSTRAINT sys_review_cycle_participants_status_check
      CHECK (participant_status IS NULL OR participant_status IN
        ('PENDING','SELF_REVIEW','MANAGER_REVIEW','IN_CALIBRATION','FEEDBACK','ACKNOWLEDGED','COMPLETED','EXCLUDED'));
  END IF;
END $pp_status$;

-- ===========================================================================
-- 5. sys.sys_performance_reviews  (src public.performance_reviews — 52 cols;
--    content_embedding + embedding_* SKIPPED, provenance kept in metadata)
-- ===========================================================================
CREATE TABLE IF NOT EXISTS sys.sys_performance_reviews (
  review_id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_tenant_id                uuid NOT NULL REFERENCES sys.sys_tenancies (tenant_id),
  review_natural_key              text NOT NULL,
  review_cycle_id                 uuid REFERENCES sys.sys_review_cycles (cycle_id),
  review_template_id              uuid REFERENCES sys.sys_performance_review_templates (template_id),
  review_employee_user_id         uuid REFERENCES sys.sys_users (user_id),
  review_reviewer_user_id         uuid REFERENCES sys.sys_users (user_id),
  review_period_start             date NOT NULL,
  review_period_end               date NOT NULL,
  review_type                     varchar(50),  -- TODO(CHECK): whitelist from data
  review_status                   varchar(50),  -- TODO(CHECK): whitelist from data
  review_overall_rating           numeric(4,2),
  review_goal_achievement_rating  numeric(4,2),
  review_competency_rating        numeric(4,2),
  review_potential_rating         varchar(20),
  review_performance_box          smallint,
  review_potential_box            smallint,
  review_pre_calibration_rating   numeric(4,2),
  review_calibrated_rating        numeric(4,2),
  review_calibrated_by_user_id    uuid REFERENCES sys.sys_users (user_id),
  review_self_rating              numeric(4,2),
  review_strengths                text,
  review_areas_for_improvement    text,
  review_manager_comments         text,
  review_employee_comments        text,
  review_self_comments            text,
  review_development_plan         text,
  review_career_aspirations       text,
  review_calibration_notes        text,
  review_competency_ratings       jsonb,
  review_goal_ratings             jsonb,
  review_section_ratings          jsonb,
  review_recommended_actions      jsonb,
  review_goals_auto_populated     boolean,
  review_goals_count              integer,
  review_competencies_count       integer,
  review_self_assessment_status   varchar(20),
  review_self_assessment_started_at timestamptz,
  review_self_submitted_at        timestamptz,
  review_manager_submitted_at     timestamptz,
  review_submitted_at             timestamptz,
  review_acknowledged_at          timestamptz,
  review_self_review_completed_at timestamptz,
  review_calibrated_at            timestamptz,
  review_shared_at                timestamptz,
  review_finalized_at             timestamptz,
  review_finalized_by_user_id     uuid REFERENCES sys.sys_users (user_id),
  review_metadata                 jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at                      timestamptz NOT NULL DEFAULT now(),
  updated_at                      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sys_performance_reviews_overall_rating_check
    CHECK (review_overall_rating IS NULL OR (review_overall_rating >= 1 AND review_overall_rating <= 5)),
  CONSTRAINT sys_performance_reviews_performance_box_check
    CHECK (review_performance_box IS NULL OR (review_performance_box >= 1 AND review_performance_box <= 3)),
  CONSTRAINT sys_performance_reviews_potential_box_check
    CHECK (review_potential_box IS NULL OR (review_potential_box >= 1 AND review_potential_box <= 3))
);
CREATE UNIQUE INDEX IF NOT EXISTS sys_performance_reviews_nk_uq
  ON sys.sys_performance_reviews (review_tenant_id, review_natural_key);
CREATE INDEX IF NOT EXISTS sys_performance_reviews_cycle_idx
  ON sys.sys_performance_reviews (review_cycle_id) WHERE review_cycle_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS sys_performance_reviews_employee_idx
  ON sys.sys_performance_reviews (review_employee_user_id) WHERE review_employee_user_id IS NOT NULL;

-- ===========================================================================
-- 6. sys.sys_self_reviews  (src public.self_reviews)
-- ===========================================================================
CREATE TABLE IF NOT EXISTS sys.sys_self_reviews (
  self_review_id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  self_review_tenant_id             uuid NOT NULL REFERENCES sys.sys_tenancies (tenant_id),
  self_review_natural_key           text NOT NULL,
  self_review_performance_review_id uuid NOT NULL REFERENCES sys.sys_performance_reviews (review_id) ON DELETE CASCADE,
  self_review_employee_user_id      uuid REFERENCES sys.sys_users (user_id),
  self_review_overall_rating        numeric(4,2),
  self_review_goal_rating           numeric(4,2),
  self_review_competency_rating     numeric(4,2),
  self_review_achievements          text,
  self_review_challenges            text,
  self_review_learnings             text,
  self_review_goals_for_next_period text,
  self_review_feedback_for_manager  text,
  self_review_competency_self_ratings jsonb,
  self_review_goal_self_assessments jsonb,
  self_review_goal_ratings          jsonb,
  self_review_ksaba_ratings         jsonb,
  self_review_status                varchar(20),  -- CHECK ported below (source whitelist)
  self_review_evidence_count        integer,
  self_review_submitted_at          timestamptz,
  self_review_last_saved_at         timestamptz,
  self_review_metadata              jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at                        timestamptz NOT NULL DEFAULT now(),
  updated_at                        timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS sys_self_reviews_nk_uq
  ON sys.sys_self_reviews (self_review_tenant_id, self_review_natural_key);
CREATE INDEX IF NOT EXISTS sys_self_reviews_review_idx
  ON sys.sys_self_reviews (self_review_performance_review_id);
DO $sr_status$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='sys_self_reviews_status_check'
                 AND conrelid='sys.sys_self_reviews'::regclass) THEN
    ALTER TABLE sys.sys_self_reviews
      ADD CONSTRAINT sys_self_reviews_status_check
      CHECK (self_review_status IS NULL OR self_review_status IN ('DRAFT','SUBMITTED'));
  END IF;
END $sr_status$;

-- ===========================================================================
-- 7. sys.sys_goal_review_ratings  (src public.goal_review_ratings)
-- ===========================================================================
CREATE TABLE IF NOT EXISTS sys.sys_goal_review_ratings (
  goal_rating_id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_rating_tenant_id             uuid NOT NULL REFERENCES sys.sys_tenancies (tenant_id),
  goal_rating_natural_key           text NOT NULL,
  goal_rating_performance_review_id uuid NOT NULL REFERENCES sys.sys_performance_reviews (review_id) ON DELETE CASCADE,
  goal_rating_goal_id               uuid REFERENCES sys.sys_goals (goal_id),
  goal_rating_employee_user_id      uuid REFERENCES sys.sys_users (user_id),
  goal_rating_self_rating           numeric(4,2),
  goal_rating_self_comment          text,
  goal_rating_achievement_description text,
  goal_rating_manager_rating        numeric(4,2),
  goal_rating_manager_comment       text,
  goal_rating_weight                numeric(5,2),
  goal_rating_metadata              jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at                        timestamptz NOT NULL DEFAULT now(),
  updated_at                        timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS sys_goal_review_ratings_nk_uq
  ON sys.sys_goal_review_ratings (goal_rating_tenant_id, goal_rating_natural_key);
CREATE INDEX IF NOT EXISTS sys_goal_review_ratings_review_idx
  ON sys.sys_goal_review_ratings (goal_rating_performance_review_id);

-- ===========================================================================
-- 8. sys.sys_competency_review_ratings  (src public.competency_review_ratings)
--    competency_id has no sys.* target yet → kept nullable + ref in metadata.
-- ===========================================================================
CREATE TABLE IF NOT EXISTS sys.sys_competency_review_ratings (
  competency_rating_id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competency_rating_tenant_id             uuid NOT NULL REFERENCES sys.sys_tenancies (tenant_id),
  competency_rating_natural_key           text NOT NULL,
  competency_rating_performance_review_id uuid NOT NULL REFERENCES sys.sys_performance_reviews (review_id) ON DELETE CASCADE,
  competency_rating_employee_user_id      uuid REFERENCES sys.sys_users (user_id),
  competency_rating_legacy_competency_id  uuid,          -- no sys.* competency target
  competency_rating_ksaba_dimension       varchar(20),
  competency_rating_competency_name       varchar(100) NOT NULL,
  competency_rating_self_rating           numeric(4,2),
  competency_rating_self_comment          text,
  competency_rating_self_evidence         jsonb,         -- src text[] → jsonb array
  competency_rating_manager_rating        numeric(4,2),
  competency_rating_manager_comment       text,
  competency_rating_weight                numeric(5,2),
  competency_rating_metadata              jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at                              timestamptz NOT NULL DEFAULT now(),
  updated_at                             timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS sys_competency_review_ratings_nk_uq
  ON sys.sys_competency_review_ratings (competency_rating_tenant_id, competency_rating_natural_key);
CREATE INDEX IF NOT EXISTS sys_competency_review_ratings_review_idx
  ON sys.sys_competency_review_ratings (competency_rating_performance_review_id);

COMMIT;
