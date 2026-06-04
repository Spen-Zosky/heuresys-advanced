-- db/seeds/brownfield/sdbi/perf_feedback/01_temp_sdbi_ddl.sql  (SDBI Phase 3 DDL)
-- D6 — SDBI Option-B slice: PerformanceReviews + Feedback360.
-- Reference: db/seeds/brownfield/sdbi/goals_pilot/01_temp_sdbi_ddl.sql + db/seeds/sdbi/_template/.
--
-- These are RAW legacy-shaped staging mirrors (NO FK to sys.*). They carry the legacy column
-- set RTL-scoped, loaded by a direct CSV COPY from the legacy VM (file-based scp; the task
-- authorizes a direct staging COPY rather than routing through legacy_mirror). Tenant + employee
-- resolution (I14 LEGACY_EMP:: crosswalk + brownfield.tenant_id_mappings) happens in Phase 5
-- (03_phase5_consolidation.sql), keeping raw FK pointers here.
--   _legacy_*_id  — raw legacy uuids (idempotency anchor = _legacy_id PK)
-- Idempotent: CREATE TABLE IF NOT EXISTS. Seed bundle wraps its own BEGIN/COMMIT (NOT applied by
-- the migrate runner, so the no-inner-txn rule does not apply to seeds).

BEGIN;

-- ---- 1. performance_reviews (raw RTL subset) ----------------------------------------------
CREATE TABLE IF NOT EXISTS temp_sdbi.pf_performance_reviews (
  _legacy_id                       uuid          NOT NULL PRIMARY KEY,
  _legacy_tenant_id                uuid          NOT NULL,
  _legacy_employee_id              uuid,
  _legacy_reviewer_id              uuid,
  _legacy_calibrated_by            uuid,
  _legacy_finalized_by             uuid,
  _legacy_review_cycle_id          uuid,
  _legacy_template_id              uuid,
  review_period_start              date          NOT NULL,
  review_period_end                date          NOT NULL,
  review_type                      varchar(64),
  review_status                    varchar(64),
  potential_rating                 varchar(64),
  overall_rating                   numeric,
  goal_achievement_rating          numeric,
  competency_rating                numeric,
  self_rating                      numeric,
  calibrated_rating                numeric,
  pre_calibration_rating           numeric,
  performance_box                  integer,
  potential_box                    integer,
  strengths                        text,
  areas_for_improvement            text,
  manager_comments                 text,
  employee_comments                text,
  self_comments                    text,
  development_plan                 text,
  career_aspirations               text,
  calibration_notes                text,
  section_ratings                  jsonb,
  competency_ratings               jsonb,
  goal_ratings                     jsonb,
  recommended_actions              jsonb,
  self_submitted_at                timestamptz,
  manager_submitted_at             timestamptz,
  calibrated_at                    timestamptz,
  finalized_at                     timestamptz,
  self_review_completed_at         timestamptz,
  shared_at                        timestamptz,
  submitted_at                     timestamptz,
  acknowledged_at                  timestamptz,
  self_assessment_status           varchar(64),
  created_at                       timestamptz,
  updated_at                       timestamptz
);

-- ---- 2. competency_review_ratings (raw; scoped via parent PR) ------------------------------
CREATE TABLE IF NOT EXISTS temp_sdbi.pf_competency_review_ratings (
  _legacy_id                       uuid          NOT NULL PRIMARY KEY,
  _legacy_tenant_id                uuid          NOT NULL,
  _legacy_performance_review_id    uuid          NOT NULL,
  _legacy_employee_id              uuid,
  _legacy_competency_id            uuid,
  ksaba_dimension                  varchar(64),
  competency_name                  varchar(255)  NOT NULL,
  self_rating                      numeric,
  self_comment                     text,
  self_evidence                    text[],
  manager_rating                   numeric,
  manager_comment                  text,
  weight                           numeric,
  created_at                       timestamptz,
  updated_at                       timestamptz
);

-- ---- 3. feedback_360 (raw event) ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS temp_sdbi.pf_feedback_360 (
  _legacy_id                       uuid          NOT NULL PRIMARY KEY,
  _legacy_tenant_id                uuid          NOT NULL,
  _legacy_target_employee_id       uuid,
  _legacy_reviewer_employee_id     uuid,
  _legacy_review_cycle_id          uuid,
  _legacy_performance_review_id    uuid,
  _legacy_questionnaire_id         uuid,
  _legacy_request_id               uuid,
  relationship_type                varchar(64),
  overall_rating                   numeric,
  strengths                        text,
  areas_for_improvement            text,
  is_anonymous                     boolean,
  status                           varchar(64),
  sentiment_score                  numeric,
  submission_time_seconds          integer,
  completed_at                     timestamptz,
  created_at                       timestamptz
);

-- ---- 4. continuous_feedback (raw event) ---------------------------------------------------
CREATE TABLE IF NOT EXISTS temp_sdbi.pf_continuous_feedback (
  _legacy_id                       uuid          NOT NULL PRIMARY KEY,
  _legacy_tenant_id                uuid          NOT NULL,
  _legacy_from_employee_id         uuid,
  _legacy_to_employee_id           uuid,
  _legacy_related_goal_id          uuid,
  _legacy_competency_id            uuid,
  _legacy_performance_review_id    uuid,
  feedback_type                    varchar(64),
  message                          text          NOT NULL,
  category                         varchar(64),
  visibility                       varchar(64),
  is_private                       boolean,
  tags                             text[],
  sentiment_score                  numeric,
  acknowledged                     boolean,
  acknowledged_at                  timestamptz,
  created_at                       timestamptz
);

CREATE INDEX IF NOT EXISTS pf_pr_tenant_idx        ON temp_sdbi.pf_performance_reviews (_legacy_tenant_id);
CREATE INDEX IF NOT EXISTS pf_crr_pr_idx           ON temp_sdbi.pf_competency_review_ratings (_legacy_performance_review_id);
CREATE INDEX IF NOT EXISTS pf_f360_tenant_idx      ON temp_sdbi.pf_feedback_360 (_legacy_tenant_id);
CREATE INDEX IF NOT EXISTS pf_cf_tenant_idx        ON temp_sdbi.pf_continuous_feedback (_legacy_tenant_id);

COMMIT;

SELECT 'pf_performance_reviews'         AS t, count(*) FROM temp_sdbi.pf_performance_reviews
UNION ALL SELECT 'pf_competency_review_ratings', count(*) FROM temp_sdbi.pf_competency_review_ratings
UNION ALL SELECT 'pf_feedback_360',              count(*) FROM temp_sdbi.pf_feedback_360
UNION ALL SELECT 'pf_continuous_feedback',       count(*) FROM temp_sdbi.pf_continuous_feedback;
