-- =============================================================================
-- 000017_assessment_gap_model.sql
-- Heuresys Advanced — assessment + gap analysis + readiness (10 tables)
-- -----------------------------------------------------------------------------
-- Per TARGET_SCHEMA_DESIGN §8.
-- =============================================================================

CREATE TABLE IF NOT EXISTS sys.sys_assessment_methods (
  assessment_method_id          uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_method_code        varchar(64)  NOT NULL,
  assessment_method_name        varchar(128) NOT NULL,
  assessment_method_description text,
  assessment_method_metadata    jsonb        NOT NULL DEFAULT '{}'::jsonb,
  created_at                    timestamptz  NOT NULL DEFAULT now()
);

ALTER TABLE sys.sys_assessment_methods
  DROP CONSTRAINT IF EXISTS sys_assessment_method_code_check;
ALTER TABLE sys.sys_assessment_methods
  ADD CONSTRAINT sys_assessment_method_code_check
  CHECK (assessment_method_code IN ('RATING', 'NARRATIVE', 'EVIDENCE_BASED', 'PEER_360', 'MANAGER_DIRECT'));

CREATE UNIQUE INDEX IF NOT EXISTS sys_assessment_methods_code_uq
  ON sys.sys_assessment_methods (assessment_method_code);

CREATE TABLE IF NOT EXISTS sys.sys_assessments (
  assessment_id          uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_tenant_id   uuid         NOT NULL REFERENCES sys.sys_tenancies(tenant_id) ON DELETE CASCADE,
  assessment_subject_user_id uuid     NOT NULL REFERENCES sys.sys_users(user_id) ON DELETE CASCADE,
  assessment_method_id   uuid         REFERENCES sys.sys_assessment_methods(assessment_method_id) ON DELETE SET NULL,
  assessment_kind        varchar(64)  NOT NULL DEFAULT 'MANAGER',
  assessment_period_start date,
  assessment_period_end   date,
  assessment_status      varchar(32)  NOT NULL DEFAULT 'OPEN',
  assessment_metadata    jsonb        NOT NULL DEFAULT '{}'::jsonb,
  created_at             timestamptz  NOT NULL DEFAULT now(),
  created_by             uuid         REFERENCES sys.sys_users(user_id) ON DELETE SET NULL,
  updated_at             timestamptz  NOT NULL DEFAULT now(),
  updated_by             uuid         REFERENCES sys.sys_users(user_id) ON DELETE SET NULL
);

ALTER TABLE sys.sys_assessments
  DROP CONSTRAINT IF EXISTS sys_assessment_kind_check;
ALTER TABLE sys.sys_assessments
  ADD CONSTRAINT sys_assessment_kind_check
  CHECK (assessment_kind IN ('MANAGER', 'THREE_SIXTY', 'PEER', 'SELF', 'EXTERNAL'));

ALTER TABLE sys.sys_assessments
  DROP CONSTRAINT IF EXISTS sys_assessment_status_check;
ALTER TABLE sys.sys_assessments
  ADD CONSTRAINT sys_assessment_status_check
  CHECK (assessment_status IN ('OPEN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'));

CREATE INDEX IF NOT EXISTS sys_assessments_subject_idx
  ON sys.sys_assessments (assessment_subject_user_id, created_at DESC);

DO $trg$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'sys_assessments_set_updated_at' AND tgrelid = 'sys.sys_assessments'::regclass) THEN
    CREATE TRIGGER sys_assessments_set_updated_at BEFORE UPDATE ON sys.sys_assessments FOR EACH ROW EXECUTE FUNCTION sys.sys_set_updated_at();
  END IF;
END $trg$;

CREATE TABLE IF NOT EXISTS sys.sys_assessment_results (
  assessment_result_id          uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_result_assessment_id uuid       NOT NULL REFERENCES sys.sys_assessments(assessment_id) ON DELETE CASCADE,
  assessment_result_tenant_id   uuid         NOT NULL REFERENCES sys.sys_tenancies(tenant_id) ON DELETE CASCADE,
  assessment_result_dimension   varchar(128) NOT NULL,
  assessment_result_score       numeric(5,2),
  assessment_result_narrative   text,
  assessment_result_assessor_user_id uuid    REFERENCES sys.sys_users(user_id) ON DELETE SET NULL,
  assessment_result_recorded_at timestamptz  NOT NULL DEFAULT now(),
  assessment_result_metadata    jsonb        NOT NULL DEFAULT '{}'::jsonb,
  created_at                    timestamptz  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sys_assessment_results_assessment_idx
  ON sys.sys_assessment_results (assessment_result_assessment_id);

CREATE TABLE IF NOT EXISTS sys.sys_behavioral_assessments (
  behavioral_assessment_id        uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  behavioral_assessment_tenant_id uuid         NOT NULL REFERENCES sys.sys_tenancies(tenant_id) ON DELETE CASCADE,
  behavioral_assessment_user_id   uuid         NOT NULL REFERENCES sys.sys_users(user_id) ON DELETE CASCADE,
  behavioral_assessment_competency varchar(255) NOT NULL,
  behavioral_assessment_score     numeric(5,2),
  behavioral_assessment_evidence_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  behavioral_assessment_recorded_at timestamptz NOT NULL DEFAULT now(),
  created_at                      timestamptz  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sys_behavioral_assessments_user_idx
  ON sys.sys_behavioral_assessments (behavioral_assessment_user_id, behavioral_assessment_recorded_at DESC);

CREATE TABLE IF NOT EXISTS sys.sys_employee_position_fit_scores (
  employee_position_fit_score_id        uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_position_fit_score_tenant_id uuid         NOT NULL REFERENCES sys.sys_tenancies(tenant_id) ON DELETE CASCADE,
  employee_position_fit_score_user_id   uuid         NOT NULL REFERENCES sys.sys_users(user_id) ON DELETE CASCADE,
  employee_position_fit_score_position_id uuid       NOT NULL REFERENCES sys.sys_positions(position_id) ON DELETE CASCADE,
  employee_position_fit_score_dimension varchar(64)  NOT NULL,
  employee_position_fit_score_score     numeric(5,2) NOT NULL,
  employee_position_fit_score_computed_at timestamptz NOT NULL DEFAULT now(),
  employee_position_fit_score_payload   jsonb        NOT NULL DEFAULT '{}'::jsonb,
  created_at                            timestamptz  NOT NULL DEFAULT now()
);

ALTER TABLE sys.sys_employee_position_fit_scores
  DROP CONSTRAINT IF EXISTS sys_epfs_dimension_check;
ALTER TABLE sys.sys_employee_position_fit_scores
  ADD CONSTRAINT sys_epfs_dimension_check
  CHECK (employee_position_fit_score_dimension IN ('SKILL', 'KPI', 'LEARNING', 'CERTIFICATION', 'BEHAVIORAL', 'OVERALL'));

CREATE INDEX IF NOT EXISTS sys_epfs_user_position_dimension_idx
  ON sys.sys_employee_position_fit_scores (employee_position_fit_score_user_id, employee_position_fit_score_position_id, employee_position_fit_score_dimension, employee_position_fit_score_computed_at DESC);

CREATE TABLE IF NOT EXISTS sys.sys_gap_analysis_results (
  gap_analysis_result_id        uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  gap_analysis_result_tenant_id uuid         NOT NULL REFERENCES sys.sys_tenancies(tenant_id) ON DELETE CASCADE,
  gap_analysis_result_user_id   uuid         NOT NULL REFERENCES sys.sys_users(user_id) ON DELETE CASCADE,
  gap_analysis_result_position_id uuid       REFERENCES sys.sys_positions(position_id) ON DELETE CASCADE,
  gap_analysis_result_kind      varchar(64)  NOT NULL,
  gap_analysis_result_payload   jsonb        NOT NULL DEFAULT '{}'::jsonb,
  gap_analysis_result_overall_score numeric(5,2),
  gap_analysis_result_computed_at timestamptz NOT NULL DEFAULT now(),
  created_at                    timestamptz  NOT NULL DEFAULT now()
);

ALTER TABLE sys.sys_gap_analysis_results
  DROP CONSTRAINT IF EXISTS sys_gap_analysis_kind_check;
ALTER TABLE sys.sys_gap_analysis_results
  ADD CONSTRAINT sys_gap_analysis_kind_check
  CHECK (gap_analysis_result_kind IN ('SKILL', 'KPI', 'LEARNING', 'CERTIFICATION', 'BEHAVIORAL', 'COMPOSITE'));

CREATE INDEX IF NOT EXISTS sys_gap_analysis_results_user_position_idx
  ON sys.sys_gap_analysis_results (gap_analysis_result_user_id, gap_analysis_result_position_id, gap_analysis_result_computed_at DESC);

CREATE TABLE IF NOT EXISTS sys.sys_gap_closure_plans (
  gap_closure_plan_id          uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  gap_closure_plan_tenant_id   uuid         NOT NULL REFERENCES sys.sys_tenancies(tenant_id) ON DELETE CASCADE,
  gap_closure_plan_user_id     uuid         NOT NULL REFERENCES sys.sys_users(user_id) ON DELETE CASCADE,
  gap_closure_plan_position_id uuid         REFERENCES sys.sys_positions(position_id) ON DELETE SET NULL,
  gap_closure_plan_milestones  jsonb        NOT NULL DEFAULT '[]'::jsonb,
  gap_closure_plan_status      varchar(32)  NOT NULL DEFAULT 'PROPOSED',
  gap_closure_plan_owner_user_id uuid       REFERENCES sys.sys_users(user_id) ON DELETE SET NULL,
  gap_closure_plan_target_completion_date date,
  gap_closure_plan_metadata    jsonb        NOT NULL DEFAULT '{}'::jsonb,
  created_at                   timestamptz  NOT NULL DEFAULT now(),
  created_by                   uuid         REFERENCES sys.sys_users(user_id) ON DELETE SET NULL,
  updated_at                   timestamptz  NOT NULL DEFAULT now(),
  updated_by                   uuid         REFERENCES sys.sys_users(user_id) ON DELETE SET NULL
);

ALTER TABLE sys.sys_gap_closure_plans
  DROP CONSTRAINT IF EXISTS sys_gap_closure_plan_status_check;
ALTER TABLE sys.sys_gap_closure_plans
  ADD CONSTRAINT sys_gap_closure_plan_status_check
  CHECK (gap_closure_plan_status IN ('PROPOSED', 'ACTIVE', 'COMPLETED', 'CANCELLED', 'ON_HOLD'));

CREATE INDEX IF NOT EXISTS sys_gap_closure_plans_user_idx
  ON sys.sys_gap_closure_plans (gap_closure_plan_user_id, gap_closure_plan_status);

DO $trg$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'sys_gap_closure_plans_set_updated_at' AND tgrelid = 'sys.sys_gap_closure_plans'::regclass) THEN
    CREATE TRIGGER sys_gap_closure_plans_set_updated_at BEFORE UPDATE ON sys.sys_gap_closure_plans FOR EACH ROW EXECUTE FUNCTION sys.sys_set_updated_at();
  END IF;
END $trg$;

CREATE TABLE IF NOT EXISTS sys.sys_readiness_scores (
  readiness_score_id        uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  readiness_score_tenant_id uuid         NOT NULL REFERENCES sys.sys_tenancies(tenant_id) ON DELETE CASCADE,
  readiness_score_user_id   uuid         NOT NULL REFERENCES sys.sys_users(user_id) ON DELETE CASCADE,
  readiness_score_position_id uuid       NOT NULL REFERENCES sys.sys_positions(position_id) ON DELETE CASCADE,
  readiness_score_horizon   varchar(32)  NOT NULL,
  readiness_score_value     numeric(5,2),
  readiness_score_payload   jsonb        NOT NULL DEFAULT '{}'::jsonb,
  readiness_score_computed_at timestamptz NOT NULL DEFAULT now(),
  created_at                timestamptz  NOT NULL DEFAULT now()
);

ALTER TABLE sys.sys_readiness_scores
  DROP CONSTRAINT IF EXISTS sys_readiness_score_horizon_check;
ALTER TABLE sys.sys_readiness_scores
  ADD CONSTRAINT sys_readiness_score_horizon_check
  CHECK (readiness_score_horizon IN ('READY_NOW', 'READY_6_MONTHS', 'READY_1_YEAR', 'READY_2_YEARS', 'NOT_READY'));

CREATE INDEX IF NOT EXISTS sys_readiness_scores_user_position_idx
  ON sys.sys_readiness_scores (readiness_score_user_id, readiness_score_position_id, readiness_score_computed_at DESC);

CREATE TABLE IF NOT EXISTS sys.sys_talent_scores (
  talent_score_id        uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  talent_score_tenant_id uuid         NOT NULL REFERENCES sys.sys_tenancies(tenant_id) ON DELETE CASCADE,
  talent_score_user_id   uuid         NOT NULL REFERENCES sys.sys_users(user_id) ON DELETE CASCADE,
  talent_score_potential numeric(5,2),
  talent_score_performance numeric(5,2),
  talent_score_band      varchar(32),
  talent_score_payload   jsonb        NOT NULL DEFAULT '{}'::jsonb,
  talent_score_computed_at timestamptz NOT NULL DEFAULT now(),
  created_at             timestamptz  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sys_talent_scores_user_idx
  ON sys.sys_talent_scores (talent_score_user_id, talent_score_computed_at DESC);

CREATE TABLE IF NOT EXISTS sys.sys_succession_scores (
  succession_score_id        uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  succession_score_tenant_id uuid         NOT NULL REFERENCES sys.sys_tenancies(tenant_id) ON DELETE CASCADE,
  succession_score_user_id   uuid         NOT NULL REFERENCES sys.sys_users(user_id) ON DELETE CASCADE,
  succession_score_position_id uuid       NOT NULL REFERENCES sys.sys_positions(position_id) ON DELETE CASCADE,
  succession_score_value     numeric(5,2),
  succession_score_horizon   varchar(32),
  succession_score_payload   jsonb        NOT NULL DEFAULT '{}'::jsonb,
  succession_score_computed_at timestamptz NOT NULL DEFAULT now(),
  created_at                 timestamptz  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sys_succession_scores_position_idx
  ON sys.sys_succession_scores (succession_score_position_id, succession_score_value DESC);

-- Late-binding FK from sys_user_assessment_evidence.assessment_id (000006)
DO $fk$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_schema = 'sys'
      AND table_name = 'sys_user_assessment_evidence'
      AND constraint_name = 'sys_user_assessment_evidence_assessment_id_fkey'
  ) THEN
    ALTER TABLE sys.sys_user_assessment_evidence
      ADD CONSTRAINT sys_user_assessment_evidence_assessment_id_fkey
      FOREIGN KEY (user_assessment_evidence_assessment_id)
      REFERENCES sys.sys_assessments(assessment_id) ON DELETE RESTRICT;
  END IF;
END
$fk$;
