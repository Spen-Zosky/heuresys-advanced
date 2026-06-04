-- ============================================================================
-- Migration 000065 — SDBI Option-B slice: PerformanceReviews + Feedback360
-- ----------------------------------------------------------------------------
-- ADR ref: ADR-0014 (SDBI 6-phase) · ADR-0024 / I14 (employee-centric crosswalk)
-- Companion design: docs/kb/D6_SDBI_OPTION_B_DESIGN.md (approved S960+, 4 tables + 1 VIEW)
-- ----------------------------------------------------------------------------
-- Creates 4 new sys.* base tables + 1 derived VIEW (the Option-B slice from the
-- W4 dossier §5; the two cleanest entity/event-shaped HRMS macro-areas with NO
-- prior sys.* target). Down from the mini-spec's 7 (nine-box is a VIEW, not a
-- base table; the cycle/template/questionnaire/request parent FKs are 0-filled):
--   1. sys.sys_performance_reviews                    (~161 RTL rows expected)
--   2. sys.sys_performance_review_competency_ratings  (~465, child CASCADE of #1)
--   3. sys.sys_feedback_360_responses                 (~390, immutable event log)
--   4. sys.sys_continuous_feedback                    (~474, immutable event log)
--   + sys.sys_nine_box_grid  (VIEW over #1 — no storage; relkind 'v')
-- ----------------------------------------------------------------------------
-- Conventions (verified against 000037_sys_goals_okrs_scaffold.sql + §4 of the design):
--   - Table name: sys.sys_<entity_plural>;  Column prefix: <entity_singular>_<field>
--   - PK: <entity>_id uuid DEFAULT gen_random_uuid()
--   - Tenant FK: <entity>_tenant_id uuid NOT NULL -> sys.sys_tenancies ON DELETE RESTRICT
--   - Person FK: <entity>_<role>_user_id uuid -> sys.sys_users ON DELETE SET NULL (I14;
--       unresolved legacy employee -> NULL + legacy id preserved in *_metadata, never dropped)
--   - Natural key: <entity>_natural_key varchar(512) + UQ(tenant_id, natural_key)
--   - Metadata: <entity>_metadata jsonb NOT NULL DEFAULT '{}'::jsonb
--   - CHECK constraints (RD-08, NEVER ENUM); ratings 1.00..5.00, box 1..3
--   - date for date-only (RD-09), timestamptz for lifecycle stamps
--   - updated_at + sys_set_updated_at trigger ONLY on mutable (snapshot) entities
--       (#1 review, #2 rating) — OMITTED on immutable event logs (#3 f360, #4 cf)
--   - NO RLS (I5: tenant isolation via FK + middleware; the legacy tenant_isolation
--       RLS policy is NOT ported here)
--   - Dropped on import: legacy content_embedding vector(1536) + embedding metadata
--       (our pgvector substrate is separate, 1024-d, migration 000060)
-- ----------------------------------------------------------------------------
-- Idempotent: CREATE TABLE IF NOT EXISTS + ADD CONSTRAINT (guarded via DO blocks) +
--   CREATE INDEX IF NOT EXISTS + CREATE OR REPLACE VIEW. Twice-run clean.
-- Applied by migrate.{sh,ps1} under `psql -1 -f` (single implicit txn) — NO inner
--   BEGIN/COMMIT (mirrors 000057..000063; the runner records sys_schema_migrations).
-- Purely additive: does NOT touch any existing sys.* table data.
-- Authored: 2026-06-04 (D6 / S961).
-- ============================================================================

-- =====================================================================
-- §1 — sys.sys_performance_reviews  (entity <- legacy performance_reviews)
--      mutable snapshot+lifecycle -> updated_at + trigger
-- =====================================================================

CREATE TABLE IF NOT EXISTS sys.sys_performance_reviews (
  review_id                            uuid           PRIMARY KEY DEFAULT gen_random_uuid(),
  review_tenant_id                     uuid           NOT NULL,
  review_natural_key                   varchar(512)   NOT NULL,
  review_subject_user_id               uuid,
  review_reviewer_user_id              uuid,
  review_calibrated_by_user_id         uuid,
  review_finalized_by_user_id          uuid,
  review_period_start                  date           NOT NULL,
  review_period_end                    date           NOT NULL,
  review_type                          varchar(32)    NOT NULL DEFAULT 'ANNUAL',
  review_status                        varchar(32)    NOT NULL DEFAULT 'DRAFT',
  review_potential_rating              varchar(16),
  review_overall_rating                numeric(3,2),
  review_goal_achievement_rating       numeric(3,2),
  review_competency_rating             numeric(3,2),
  review_self_rating                   numeric(3,2),
  review_calibrated_rating             numeric(3,2),
  review_pre_calibration_rating        numeric(3,1),
  review_performance_box               integer,
  review_potential_box                 integer,
  review_strengths                     text,
  review_areas_for_improvement         text,
  review_manager_comments              text,
  review_employee_comments             text,
  review_self_comments                 text,
  review_development_plan              text,
  review_career_aspirations            text,
  review_calibration_notes             text,
  review_section_ratings               jsonb          NOT NULL DEFAULT '{}'::jsonb,
  review_competency_ratings_snapshot   jsonb          NOT NULL DEFAULT '{}'::jsonb,
  review_goal_ratings_snapshot         jsonb          NOT NULL DEFAULT '{}'::jsonb,
  review_recommended_actions           jsonb          NOT NULL DEFAULT '[]'::jsonb,
  review_self_submitted_at             timestamptz,
  review_manager_submitted_at          timestamptz,
  review_calibrated_at                 timestamptz,
  review_finalized_at                  timestamptz,
  review_self_review_completed_at      timestamptz,
  review_shared_at                     timestamptz,
  review_submitted_at                  timestamptz,
  review_acknowledged_at               timestamptz,
  review_self_assessment_status        varchar(20)    NOT NULL DEFAULT 'NOT_STARTED',
  review_metadata                      jsonb          NOT NULL DEFAULT '{}'::jsonb,
  created_at                           timestamptz    NOT NULL DEFAULT now(),
  updated_at                           timestamptz    NOT NULL DEFAULT now()
);

DO $cs$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_pr_type_check') THEN
    ALTER TABLE sys.sys_performance_reviews ADD CONSTRAINT sys_pr_type_check CHECK (
      review_type IN ('ANNUAL','MID_YEAR','QUARTERLY','PROBATION','PROJECT'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_pr_status_check') THEN
    ALTER TABLE sys.sys_performance_reviews ADD CONSTRAINT sys_pr_status_check CHECK (
      review_status IN ('DRAFT','IN_PROGRESS','SUBMITTED','CALIBRATED','FINALIZED','COMPLETED','CANCELLED'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_pr_potential_rating_check') THEN
    ALTER TABLE sys.sys_performance_reviews ADD CONSTRAINT sys_pr_potential_rating_check CHECK (
      review_potential_rating IS NULL OR review_potential_rating IN ('LOW','MEDIUM','HIGH'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_pr_self_assessment_status_check') THEN
    ALTER TABLE sys.sys_performance_reviews ADD CONSTRAINT sys_pr_self_assessment_status_check CHECK (
      review_self_assessment_status IN ('NOT_STARTED','IN_PROGRESS','COMPLETED'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_pr_overall_rating_range') THEN
    ALTER TABLE sys.sys_performance_reviews ADD CONSTRAINT sys_pr_overall_rating_range CHECK (
      review_overall_rating IS NULL OR (review_overall_rating >= 1.00 AND review_overall_rating <= 5.00));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_pr_goal_achievement_range') THEN
    ALTER TABLE sys.sys_performance_reviews ADD CONSTRAINT sys_pr_goal_achievement_range CHECK (
      review_goal_achievement_rating IS NULL OR (review_goal_achievement_rating >= 1.00 AND review_goal_achievement_rating <= 5.00));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_pr_competency_range') THEN
    ALTER TABLE sys.sys_performance_reviews ADD CONSTRAINT sys_pr_competency_range CHECK (
      review_competency_rating IS NULL OR (review_competency_rating >= 1.00 AND review_competency_rating <= 5.00));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_pr_self_rating_range') THEN
    ALTER TABLE sys.sys_performance_reviews ADD CONSTRAINT sys_pr_self_rating_range CHECK (
      review_self_rating IS NULL OR (review_self_rating >= 1.00 AND review_self_rating <= 5.00));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_pr_calibrated_rating_range') THEN
    ALTER TABLE sys.sys_performance_reviews ADD CONSTRAINT sys_pr_calibrated_rating_range CHECK (
      review_calibrated_rating IS NULL OR (review_calibrated_rating >= 1.00 AND review_calibrated_rating <= 5.00));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_pr_pre_calibration_range') THEN
    ALTER TABLE sys.sys_performance_reviews ADD CONSTRAINT sys_pr_pre_calibration_range CHECK (
      review_pre_calibration_rating IS NULL OR (review_pre_calibration_rating >= 1.00 AND review_pre_calibration_rating <= 5.00));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_pr_performance_box_check') THEN
    ALTER TABLE sys.sys_performance_reviews ADD CONSTRAINT sys_pr_performance_box_check CHECK (
      review_performance_box IS NULL OR review_performance_box BETWEEN 1 AND 3);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_pr_potential_box_check') THEN
    ALTER TABLE sys.sys_performance_reviews ADD CONSTRAINT sys_pr_potential_box_check CHECK (
      review_potential_box IS NULL OR review_potential_box BETWEEN 1 AND 3);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_pr_period_ordered') THEN
    ALTER TABLE sys.sys_performance_reviews ADD CONSTRAINT sys_pr_period_ordered CHECK (
      review_period_end >= review_period_start);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_pr_updated_after') THEN
    ALTER TABLE sys.sys_performance_reviews ADD CONSTRAINT sys_pr_updated_after CHECK (updated_at >= created_at);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_pr_tenant_fk') THEN
    ALTER TABLE sys.sys_performance_reviews ADD CONSTRAINT sys_pr_tenant_fk FOREIGN KEY (review_tenant_id) REFERENCES sys.sys_tenancies(tenant_id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_pr_subject_user_fk') THEN
    ALTER TABLE sys.sys_performance_reviews ADD CONSTRAINT sys_pr_subject_user_fk FOREIGN KEY (review_subject_user_id) REFERENCES sys.sys_users(user_id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_pr_reviewer_user_fk') THEN
    ALTER TABLE sys.sys_performance_reviews ADD CONSTRAINT sys_pr_reviewer_user_fk FOREIGN KEY (review_reviewer_user_id) REFERENCES sys.sys_users(user_id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_pr_calibrated_by_user_fk') THEN
    ALTER TABLE sys.sys_performance_reviews ADD CONSTRAINT sys_pr_calibrated_by_user_fk FOREIGN KEY (review_calibrated_by_user_id) REFERENCES sys.sys_users(user_id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_pr_finalized_by_user_fk') THEN
    ALTER TABLE sys.sys_performance_reviews ADD CONSTRAINT sys_pr_finalized_by_user_fk FOREIGN KEY (review_finalized_by_user_id) REFERENCES sys.sys_users(user_id) ON DELETE SET NULL;
  END IF;
END;
$cs$;

CREATE UNIQUE INDEX IF NOT EXISTS sys_performance_reviews_natural_key_uq ON sys.sys_performance_reviews (review_tenant_id, review_natural_key);
CREATE INDEX IF NOT EXISTS sys_performance_reviews_tenant_idx        ON sys.sys_performance_reviews (review_tenant_id);
CREATE INDEX IF NOT EXISTS sys_performance_reviews_subject_idx       ON sys.sys_performance_reviews (review_subject_user_id) WHERE review_subject_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS sys_performance_reviews_reviewer_idx      ON sys.sys_performance_reviews (review_reviewer_user_id) WHERE review_reviewer_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS sys_performance_reviews_status_idx        ON sys.sys_performance_reviews (review_tenant_id, review_status);
CREATE INDEX IF NOT EXISTS sys_performance_reviews_ninebox_idx       ON sys.sys_performance_reviews (review_tenant_id, review_performance_box, review_potential_box) WHERE review_performance_box IS NOT NULL AND review_potential_box IS NOT NULL;

DO $trg$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'sys_performance_reviews_set_updated_at') THEN
    CREATE TRIGGER sys_performance_reviews_set_updated_at BEFORE UPDATE ON sys.sys_performance_reviews
      FOR EACH ROW EXECUTE FUNCTION sys.sys_set_updated_at();
  END IF;
END;
$trg$;

-- =====================================================================
-- §2 — sys.sys_performance_review_competency_ratings
--      (child <- competency_review_ratings; CASCADE on parent PR delete)
--      mutable -> updated_at + trigger
-- =====================================================================

CREATE TABLE IF NOT EXISTS sys.sys_performance_review_competency_ratings (
  rating_id                 uuid           PRIMARY KEY DEFAULT gen_random_uuid(),
  rating_tenant_id          uuid           NOT NULL,
  rating_review_id          uuid           NOT NULL,
  rating_subject_user_id    uuid,
  rating_natural_key        varchar(512)   NOT NULL,
  rating_ksaba_dimension    varchar(20),
  rating_competency_name    varchar(100)   NOT NULL,
  rating_self_rating        numeric(3,2),
  rating_manager_rating     numeric(3,2),
  rating_self_comment       text,
  rating_manager_comment    text,
  rating_self_evidence      text[],
  rating_weight             numeric(3,2)   NOT NULL DEFAULT 1.0,
  rating_metadata           jsonb          NOT NULL DEFAULT '{}'::jsonb,
  created_at                timestamptz    NOT NULL DEFAULT now(),
  updated_at                timestamptz    NOT NULL DEFAULT now()
);

DO $cs$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_prcr_ksaba_check') THEN
    ALTER TABLE sys.sys_performance_review_competency_ratings ADD CONSTRAINT sys_prcr_ksaba_check CHECK (
      rating_ksaba_dimension IS NULL OR rating_ksaba_dimension IN ('KNOWLEDGE','SKILL','BEHAVIOR','ATTITUDE'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_prcr_self_rating_range') THEN
    ALTER TABLE sys.sys_performance_review_competency_ratings ADD CONSTRAINT sys_prcr_self_rating_range CHECK (
      rating_self_rating IS NULL OR (rating_self_rating >= 1.00 AND rating_self_rating <= 5.00));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_prcr_manager_rating_range') THEN
    ALTER TABLE sys.sys_performance_review_competency_ratings ADD CONSTRAINT sys_prcr_manager_rating_range CHECK (
      rating_manager_rating IS NULL OR (rating_manager_rating >= 1.00 AND rating_manager_rating <= 5.00));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_prcr_updated_after') THEN
    ALTER TABLE sys.sys_performance_review_competency_ratings ADD CONSTRAINT sys_prcr_updated_after CHECK (updated_at >= created_at);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_prcr_tenant_fk') THEN
    ALTER TABLE sys.sys_performance_review_competency_ratings ADD CONSTRAINT sys_prcr_tenant_fk FOREIGN KEY (rating_tenant_id) REFERENCES sys.sys_tenancies(tenant_id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_prcr_review_fk') THEN
    ALTER TABLE sys.sys_performance_review_competency_ratings ADD CONSTRAINT sys_prcr_review_fk FOREIGN KEY (rating_review_id) REFERENCES sys.sys_performance_reviews(review_id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_prcr_subject_user_fk') THEN
    ALTER TABLE sys.sys_performance_review_competency_ratings ADD CONSTRAINT sys_prcr_subject_user_fk FOREIGN KEY (rating_subject_user_id) REFERENCES sys.sys_users(user_id) ON DELETE SET NULL;
  END IF;
END;
$cs$;

CREATE UNIQUE INDEX IF NOT EXISTS sys_prcr_natural_key_uq ON sys.sys_performance_review_competency_ratings (rating_tenant_id, rating_natural_key);
CREATE UNIQUE INDEX IF NOT EXISTS sys_prcr_review_competency_uq ON sys.sys_performance_review_competency_ratings (rating_review_id, rating_competency_name);
CREATE INDEX IF NOT EXISTS sys_prcr_tenant_idx  ON sys.sys_performance_review_competency_ratings (rating_tenant_id);
CREATE INDEX IF NOT EXISTS sys_prcr_review_idx  ON sys.sys_performance_review_competency_ratings (rating_review_id);
CREATE INDEX IF NOT EXISTS sys_prcr_subject_idx ON sys.sys_performance_review_competency_ratings (rating_subject_user_id) WHERE rating_subject_user_id IS NOT NULL;

DO $trg$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'sys_prcr_set_updated_at') THEN
    CREATE TRIGGER sys_prcr_set_updated_at BEFORE UPDATE ON sys.sys_performance_review_competency_ratings
      FOR EACH ROW EXECUTE FUNCTION sys.sys_set_updated_at();
  END IF;
END;
$trg$;

-- =====================================================================
-- §3 — sys.sys_feedback_360_responses  (event <- feedback_360)
--      immutable event log -> NO updated_at, NO trigger
-- =====================================================================

CREATE TABLE IF NOT EXISTS sys.sys_feedback_360_responses (
  response_id                       uuid           PRIMARY KEY DEFAULT gen_random_uuid(),
  response_tenant_id                uuid           NOT NULL,
  response_natural_key              varchar(512)   NOT NULL,
  response_target_user_id           uuid,
  response_reviewer_user_id         uuid,
  response_review_id                uuid,
  response_relationship_type        varchar(32),
  response_overall_rating           numeric(3,2),
  response_strengths                text,
  response_areas_for_improvement    text,
  response_is_anonymous             boolean        NOT NULL DEFAULT true,
  response_status                   varchar(32)    NOT NULL DEFAULT 'PENDING',
  response_sentiment_score          numeric(3,2),
  response_submission_time_seconds  integer,
  response_completed_at             timestamptz,
  response_metadata                 jsonb          NOT NULL DEFAULT '{}'::jsonb,
  created_at                        timestamptz    NOT NULL DEFAULT now()
);

DO $cs$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_f360_relationship_check') THEN
    ALTER TABLE sys.sys_feedback_360_responses ADD CONSTRAINT sys_f360_relationship_check CHECK (
      response_relationship_type IS NULL OR response_relationship_type IN ('SELF','PEER','MANAGER','DIRECT_REPORT','SKIP_LEVEL','EXTERNAL'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_f360_status_check') THEN
    ALTER TABLE sys.sys_feedback_360_responses ADD CONSTRAINT sys_f360_status_check CHECK (
      response_status IN ('PENDING','IN_PROGRESS','COMPLETED','DECLINED','EXPIRED'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_f360_overall_rating_range') THEN
    ALTER TABLE sys.sys_feedback_360_responses ADD CONSTRAINT sys_f360_overall_rating_range CHECK (
      response_overall_rating IS NULL OR (response_overall_rating >= 1.00 AND response_overall_rating <= 5.00));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_f360_tenant_fk') THEN
    ALTER TABLE sys.sys_feedback_360_responses ADD CONSTRAINT sys_f360_tenant_fk FOREIGN KEY (response_tenant_id) REFERENCES sys.sys_tenancies(tenant_id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_f360_target_user_fk') THEN
    ALTER TABLE sys.sys_feedback_360_responses ADD CONSTRAINT sys_f360_target_user_fk FOREIGN KEY (response_target_user_id) REFERENCES sys.sys_users(user_id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_f360_reviewer_user_fk') THEN
    ALTER TABLE sys.sys_feedback_360_responses ADD CONSTRAINT sys_f360_reviewer_user_fk FOREIGN KEY (response_reviewer_user_id) REFERENCES sys.sys_users(user_id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_f360_review_fk') THEN
    ALTER TABLE sys.sys_feedback_360_responses ADD CONSTRAINT sys_f360_review_fk FOREIGN KEY (response_review_id) REFERENCES sys.sys_performance_reviews(review_id) ON DELETE SET NULL;
  END IF;
END;
$cs$;

CREATE UNIQUE INDEX IF NOT EXISTS sys_f360_natural_key_uq ON sys.sys_feedback_360_responses (response_tenant_id, response_natural_key);
CREATE INDEX IF NOT EXISTS sys_f360_tenant_idx   ON sys.sys_feedback_360_responses (response_tenant_id);
CREATE INDEX IF NOT EXISTS sys_f360_target_idx   ON sys.sys_feedback_360_responses (response_target_user_id) WHERE response_target_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS sys_f360_reviewer_idx ON sys.sys_feedback_360_responses (response_reviewer_user_id) WHERE response_reviewer_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS sys_f360_review_idx   ON sys.sys_feedback_360_responses (response_review_id) WHERE response_review_id IS NOT NULL;

-- §3 is an immutable event log: no updated_at column, no set_updated_at trigger.

-- =====================================================================
-- §4 — sys.sys_continuous_feedback  (event <- continuous_feedback)
--      immutable event log -> NO updated_at, NO trigger
-- =====================================================================

CREATE TABLE IF NOT EXISTS sys.sys_continuous_feedback (
  feedback_id                 uuid           PRIMARY KEY DEFAULT gen_random_uuid(),
  feedback_tenant_id          uuid           NOT NULL,
  feedback_natural_key        varchar(512)   NOT NULL,
  feedback_from_user_id       uuid,
  feedback_to_user_id         uuid,
  feedback_related_goal_id    uuid,
  feedback_type               varchar(30)    NOT NULL DEFAULT 'PRAISE',
  feedback_message            text           NOT NULL,
  feedback_category           varchar(50),
  feedback_visibility         varchar(20)    NOT NULL DEFAULT 'PRIVATE',
  feedback_is_private         boolean        NOT NULL DEFAULT false,
  feedback_tags               text[],
  feedback_sentiment_score    numeric(3,2),
  feedback_acknowledged       boolean        NOT NULL DEFAULT false,
  feedback_acknowledged_at    timestamptz,
  feedback_metadata           jsonb          NOT NULL DEFAULT '{}'::jsonb,
  created_at                  timestamptz    NOT NULL DEFAULT now()
);

DO $cs$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_cf_type_check') THEN
    ALTER TABLE sys.sys_continuous_feedback ADD CONSTRAINT sys_cf_type_check CHECK (
      feedback_type IN ('PRAISE','CONSTRUCTIVE','SUGGESTION','COACHING','RECOGNITION'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_cf_visibility_check') THEN
    ALTER TABLE sys.sys_continuous_feedback ADD CONSTRAINT sys_cf_visibility_check CHECK (
      feedback_visibility IN ('PRIVATE','MANAGER','TEAM','PUBLIC'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_cf_tenant_fk') THEN
    ALTER TABLE sys.sys_continuous_feedback ADD CONSTRAINT sys_cf_tenant_fk FOREIGN KEY (feedback_tenant_id) REFERENCES sys.sys_tenancies(tenant_id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_cf_from_user_fk') THEN
    ALTER TABLE sys.sys_continuous_feedback ADD CONSTRAINT sys_cf_from_user_fk FOREIGN KEY (feedback_from_user_id) REFERENCES sys.sys_users(user_id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_cf_to_user_fk') THEN
    ALTER TABLE sys.sys_continuous_feedback ADD CONSTRAINT sys_cf_to_user_fk FOREIGN KEY (feedback_to_user_id) REFERENCES sys.sys_users(user_id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_cf_related_goal_fk') THEN
    ALTER TABLE sys.sys_continuous_feedback ADD CONSTRAINT sys_cf_related_goal_fk FOREIGN KEY (feedback_related_goal_id) REFERENCES sys.sys_goals(goal_id) ON DELETE SET NULL;
  END IF;
END;
$cs$;

CREATE UNIQUE INDEX IF NOT EXISTS sys_cf_natural_key_uq ON sys.sys_continuous_feedback (feedback_tenant_id, feedback_natural_key);
CREATE INDEX IF NOT EXISTS sys_cf_tenant_idx       ON sys.sys_continuous_feedback (feedback_tenant_id);
CREATE INDEX IF NOT EXISTS sys_cf_from_idx         ON sys.sys_continuous_feedback (feedback_from_user_id) WHERE feedback_from_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS sys_cf_to_idx           ON sys.sys_continuous_feedback (feedback_to_user_id) WHERE feedback_to_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS sys_cf_related_goal_idx ON sys.sys_continuous_feedback (feedback_related_goal_id) WHERE feedback_related_goal_id IS NOT NULL;

-- §4 is an immutable event log: no updated_at column, no set_updated_at trigger.

-- =====================================================================
-- §5 — sys.sys_nine_box_grid  (VIEW over sys_performance_reviews)
--      I9 doctrine: a 9-box projection is a VIEW, never a stored blob.
--      Department/org_unit leg deferred for v1 (D6-S5); add later via assignments.
-- =====================================================================

CREATE OR REPLACE VIEW sys.sys_nine_box_grid AS
SELECT
  pr.review_tenant_id                                   AS tenant_id,
  pr.review_subject_user_id                             AS user_id,
  u.user_display_name                                   AS employee_name,
  pr.review_overall_rating                              AS overall_rating,
  pr.review_potential_rating                            AS potential_rating,
  pr.review_performance_box                             AS performance_box,
  pr.review_potential_box                               AS potential_box,
  CASE
    WHEN pr.review_performance_box = 3 AND pr.review_potential_box = 3 THEN 'Star'
    WHEN pr.review_performance_box = 3 AND pr.review_potential_box = 2 THEN 'High Performer'
    WHEN pr.review_performance_box = 3 AND pr.review_potential_box = 1 THEN 'Workhorse'
    WHEN pr.review_performance_box = 2 AND pr.review_potential_box = 3 THEN 'High Potential'
    WHEN pr.review_performance_box = 2 AND pr.review_potential_box = 2 THEN 'Core Player'
    WHEN pr.review_performance_box = 2 AND pr.review_potential_box = 1 THEN 'Solid Performer'
    WHEN pr.review_performance_box = 1 AND pr.review_potential_box = 3 THEN 'Enigma'
    WHEN pr.review_performance_box = 1 AND pr.review_potential_box = 2 THEN 'Inconsistent Player'
    WHEN pr.review_performance_box = 1 AND pr.review_potential_box = 1 THEN 'Risk'
    ELSE 'Not Rated'
  END                                                   AS nine_box_category,
  pr.review_metadata->>'legacy_review_cycle_id'         AS review_cycle_id
FROM sys.sys_performance_reviews pr
LEFT JOIN sys.sys_users u ON pr.review_subject_user_id = u.user_id
WHERE pr.review_status = 'COMPLETED'
  AND pr.review_performance_box IS NOT NULL
  AND pr.review_potential_box IS NOT NULL;

COMMENT ON VIEW sys.sys_nine_box_grid IS
  'Derived 9-box placement projection over sys_performance_reviews (I9: projection is a VIEW, '
  'never a stored blob). Mirrors the legacy nine_box_grid VIEW CASE labels. Only COMPLETED '
  'reviews with both box coordinates set appear. Department leg deferred (D6-S5). ADR-0014 / D6.';

-- ============================================================================
-- Post-conditions (cheap, idempotent on re-run): assert the 4 base tables + VIEW exist.
-- ============================================================================
DO $$
DECLARE n_tables int; n_view int;
BEGIN
  SELECT count(*) INTO n_tables
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'sys' AND c.relkind = 'r'
    AND c.relname IN ('sys_performance_reviews','sys_performance_review_competency_ratings',
                      'sys_feedback_360_responses','sys_continuous_feedback');
  IF n_tables <> 4 THEN
    RAISE EXCEPTION '000065: expected 4 SDBI base tables, found %', n_tables;
  END IF;
  SELECT count(*) INTO n_view
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'sys' AND c.relkind = 'v' AND c.relname = 'sys_nine_box_grid';
  IF n_view <> 1 THEN
    RAISE EXCEPTION '000065: expected sys_nine_box_grid VIEW, found %', n_view;
  END IF;
  RAISE NOTICE '000065: SDBI Option-B schema OK — 4/4 base tables + sys_nine_box_grid VIEW present.';
END $$;
