-- =============================================================================
-- 000018_career_succession_model.sql
-- Heuresys Advanced — career + succession (10 tables) + late FKs
-- -----------------------------------------------------------------------------
-- Per TARGET_SCHEMA_DESIGN §9.
-- =============================================================================

CREATE TABLE IF NOT EXISTS sys.sys_career_paths (
  career_path_id          uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  career_path_tenant_id   uuid         REFERENCES sys.sys_tenancies(tenant_id) ON DELETE CASCADE,
  career_path_code        varchar(128) NOT NULL,
  career_path_name        varchar(255) NOT NULL,
  career_path_description text,
  career_path_kind        varchar(32)  NOT NULL DEFAULT 'VERTICAL',
  career_path_is_global   boolean      NOT NULL DEFAULT false,
  career_path_metadata    jsonb        NOT NULL DEFAULT '{}'::jsonb,
  created_at              timestamptz  NOT NULL DEFAULT now(),
  created_by              uuid         REFERENCES sys.sys_users(user_id) ON DELETE SET NULL,
  updated_at              timestamptz  NOT NULL DEFAULT now(),
  updated_by              uuid         REFERENCES sys.sys_users(user_id) ON DELETE SET NULL
);

ALTER TABLE sys.sys_career_paths
  DROP CONSTRAINT IF EXISTS sys_career_path_kind_check;
ALTER TABLE sys.sys_career_paths
  ADD CONSTRAINT sys_career_path_kind_check
  CHECK (career_path_kind IN ('VERTICAL', 'LATERAL', 'SPECIALIST', 'MANAGERIAL', 'CROSS_FUNCTIONAL'));

CREATE UNIQUE INDEX IF NOT EXISTS sys_career_paths_tenant_code_uq
  ON sys.sys_career_paths (COALESCE(career_path_tenant_id, '00000000-0000-0000-0000-000000000000'::uuid), career_path_code);

DO $trg$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'sys_career_paths_set_updated_at' AND tgrelid = 'sys.sys_career_paths'::regclass) THEN
    CREATE TRIGGER sys_career_paths_set_updated_at BEFORE UPDATE ON sys.sys_career_paths FOR EACH ROW EXECUTE FUNCTION sys.sys_set_updated_at();
  END IF;
END $trg$;

CREATE TABLE IF NOT EXISTS sys.sys_career_path_steps (
  career_path_step_id        uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  career_path_step_path_id   uuid         NOT NULL REFERENCES sys.sys_career_paths(career_path_id) ON DELETE CASCADE,
  career_path_step_ordinal   smallint     NOT NULL,
  career_path_step_origin_position_id uuid REFERENCES sys.sys_positions(position_id) ON DELETE SET NULL,
  career_path_step_target_position_id uuid REFERENCES sys.sys_positions(position_id) ON DELETE SET NULL,
  career_path_step_required_proficiency_uplift jsonb NOT NULL DEFAULT '{}'::jsonb,
  career_path_step_typical_duration_months integer,
  career_path_step_metadata  jsonb        NOT NULL DEFAULT '{}'::jsonb,
  created_at                 timestamptz  NOT NULL DEFAULT now(),
  updated_at                 timestamptz  NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS sys_career_path_steps_path_ordinal_uq
  ON sys.sys_career_path_steps (career_path_step_path_id, career_path_step_ordinal);

CREATE TABLE IF NOT EXISTS sys.sys_user_career_plans (
  user_career_plan_id          uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_career_plan_tenant_id   uuid         NOT NULL REFERENCES sys.sys_tenancies(tenant_id) ON DELETE CASCADE,
  user_career_plan_user_id     uuid         NOT NULL REFERENCES sys.sys_users(user_id) ON DELETE CASCADE,
  user_career_plan_path_id     uuid         REFERENCES sys.sys_career_paths(career_path_id) ON DELETE SET NULL,
  user_career_plan_target_position_id uuid  REFERENCES sys.sys_positions(position_id) ON DELETE SET NULL,
  user_career_plan_horizon_months integer,
  user_career_plan_status      varchar(32)  NOT NULL DEFAULT 'ACTIVE',
  user_career_plan_metadata    jsonb        NOT NULL DEFAULT '{}'::jsonb,
  created_at                   timestamptz  NOT NULL DEFAULT now(),
  created_by                   uuid         REFERENCES sys.sys_users(user_id) ON DELETE SET NULL,
  updated_at                   timestamptz  NOT NULL DEFAULT now(),
  updated_by                   uuid         REFERENCES sys.sys_users(user_id) ON DELETE SET NULL
);

ALTER TABLE sys.sys_user_career_plans
  DROP CONSTRAINT IF EXISTS sys_ucp_status_check;
ALTER TABLE sys.sys_user_career_plans
  ADD CONSTRAINT sys_ucp_status_check
  CHECK (user_career_plan_status IN ('ACTIVE', 'COMPLETED', 'PAUSED', 'CANCELLED'));

CREATE INDEX IF NOT EXISTS sys_user_career_plans_user_idx
  ON sys.sys_user_career_plans (user_career_plan_user_id, user_career_plan_status);

DO $trg$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'sys_ucp_set_updated_at' AND tgrelid = 'sys.sys_user_career_plans'::regclass) THEN
    CREATE TRIGGER sys_ucp_set_updated_at BEFORE UPDATE ON sys.sys_user_career_plans FOR EACH ROW EXECUTE FUNCTION sys.sys_set_updated_at();
  END IF;
END $trg$;

CREATE TABLE IF NOT EXISTS sys.sys_user_target_positions (
  user_target_position_id          uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_target_position_tenant_id   uuid         NOT NULL REFERENCES sys.sys_tenancies(tenant_id) ON DELETE CASCADE,
  user_target_position_user_id     uuid         NOT NULL REFERENCES sys.sys_users(user_id) ON DELETE CASCADE,
  user_target_position_position_id uuid         NOT NULL REFERENCES sys.sys_positions(position_id) ON DELETE CASCADE,
  user_target_position_horizon     varchar(32),
  user_target_position_review_status varchar(32) NOT NULL DEFAULT 'PENDING_REVIEW',
  user_target_position_reviewer_user_id uuid    REFERENCES sys.sys_users(user_id) ON DELETE SET NULL,
  user_target_position_review_notes text,
  user_target_position_metadata    jsonb        NOT NULL DEFAULT '{}'::jsonb,
  created_at                       timestamptz  NOT NULL DEFAULT now(),
  created_by                       uuid         REFERENCES sys.sys_users(user_id) ON DELETE SET NULL,
  updated_at                       timestamptz  NOT NULL DEFAULT now(),
  updated_by                       uuid         REFERENCES sys.sys_users(user_id) ON DELETE SET NULL
);

ALTER TABLE sys.sys_user_target_positions
  DROP CONSTRAINT IF EXISTS sys_utp_review_status_check;
ALTER TABLE sys.sys_user_target_positions
  ADD CONSTRAINT sys_utp_review_status_check
  CHECK (user_target_position_review_status IN ('PENDING_REVIEW', 'APPROVED', 'REJECTED', 'WITHDRAWN'));

CREATE INDEX IF NOT EXISTS sys_utp_user_idx
  ON sys.sys_user_target_positions (user_target_position_user_id, user_target_position_review_status);

DO $trg$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'sys_utp_set_updated_at' AND tgrelid = 'sys.sys_user_target_positions'::regclass) THEN
    CREATE TRIGGER sys_utp_set_updated_at BEFORE UPDATE ON sys.sys_user_target_positions FOR EACH ROW EXECUTE FUNCTION sys.sys_set_updated_at();
  END IF;
END $trg$;

CREATE TABLE IF NOT EXISTS sys.sys_critical_positions (
  critical_position_id        uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  critical_position_tenant_id uuid         NOT NULL REFERENCES sys.sys_tenancies(tenant_id) ON DELETE CASCADE,
  critical_position_position_id uuid       NOT NULL REFERENCES sys.sys_positions(position_id) ON DELETE CASCADE,
  critical_position_rationale text,
  critical_position_business_impact_score numeric(5,2),
  critical_position_flagged_at timestamptz NOT NULL DEFAULT now(),
  critical_position_metadata  jsonb        NOT NULL DEFAULT '{}'::jsonb,
  created_at                  timestamptz  NOT NULL DEFAULT now(),
  created_by                  uuid         REFERENCES sys.sys_users(user_id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS sys_critical_positions_position_uq
  ON sys.sys_critical_positions (critical_position_position_id);

CREATE TABLE IF NOT EXISTS sys.sys_succession_pools (
  succession_pool_id          uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  succession_pool_tenant_id   uuid         NOT NULL REFERENCES sys.sys_tenancies(tenant_id) ON DELETE CASCADE,
  succession_pool_position_id uuid         NOT NULL REFERENCES sys.sys_positions(position_id) ON DELETE CASCADE,
  succession_pool_code        varchar(128) NOT NULL,
  succession_pool_name        varchar(255) NOT NULL,
  succession_pool_description text,
  succession_pool_status      varchar(32)  NOT NULL DEFAULT 'ACTIVE',
  succession_pool_metadata    jsonb        NOT NULL DEFAULT '{}'::jsonb,
  created_at                  timestamptz  NOT NULL DEFAULT now(),
  created_by                  uuid         REFERENCES sys.sys_users(user_id) ON DELETE SET NULL,
  updated_at                  timestamptz  NOT NULL DEFAULT now(),
  updated_by                  uuid         REFERENCES sys.sys_users(user_id) ON DELETE SET NULL
);

ALTER TABLE sys.sys_succession_pools
  DROP CONSTRAINT IF EXISTS sys_succession_pool_status_check;
ALTER TABLE sys.sys_succession_pools
  ADD CONSTRAINT sys_succession_pool_status_check
  CHECK (succession_pool_status IN ('ACTIVE', 'ARCHIVED', 'PROPOSED'));

CREATE UNIQUE INDEX IF NOT EXISTS sys_succession_pools_tenant_code_uq
  ON sys.sys_succession_pools (succession_pool_tenant_id, succession_pool_code);

CREATE TABLE IF NOT EXISTS sys.sys_successor_candidates (
  successor_candidate_id          uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  successor_candidate_pool_id     uuid         NOT NULL REFERENCES sys.sys_succession_pools(succession_pool_id) ON DELETE CASCADE,
  successor_candidate_tenant_id   uuid         NOT NULL REFERENCES sys.sys_tenancies(tenant_id) ON DELETE CASCADE,
  successor_candidate_user_id     uuid         NOT NULL REFERENCES sys.sys_users(user_id) ON DELETE CASCADE,
  successor_candidate_status      varchar(32)  NOT NULL DEFAULT 'CANDIDATE',
  successor_candidate_readiness_level varchar(32),
  successor_candidate_metadata    jsonb        NOT NULL DEFAULT '{}'::jsonb,
  created_at                      timestamptz  NOT NULL DEFAULT now(),
  updated_at                      timestamptz  NOT NULL DEFAULT now()
);

ALTER TABLE sys.sys_successor_candidates
  DROP CONSTRAINT IF EXISTS sys_successor_candidate_status_check;
ALTER TABLE sys.sys_successor_candidates
  ADD CONSTRAINT sys_successor_candidate_status_check
  CHECK (successor_candidate_status IN ('CANDIDATE', 'CONFIRMED', 'WITHDRAWN', 'NOT_READY'));

ALTER TABLE sys.sys_successor_candidates
  DROP CONSTRAINT IF EXISTS sys_successor_candidate_readiness_check;
ALTER TABLE sys.sys_successor_candidates
  ADD CONSTRAINT sys_successor_candidate_readiness_check
  CHECK (successor_candidate_readiness_level IS NULL OR successor_candidate_readiness_level IN
    ('READY_NOW', 'READY_6_MONTHS', 'READY_1_YEAR', 'READY_2_YEARS', 'NOT_READY'));

CREATE UNIQUE INDEX IF NOT EXISTS sys_successor_candidates_pool_user_uq
  ON sys.sys_successor_candidates (successor_candidate_pool_id, successor_candidate_user_id);

CREATE TABLE IF NOT EXISTS sys.sys_successor_readiness (
  successor_readiness_id        uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  successor_readiness_candidate_id uuid      NOT NULL REFERENCES sys.sys_successor_candidates(successor_candidate_id) ON DELETE CASCADE,
  successor_readiness_tenant_id uuid         NOT NULL REFERENCES sys.sys_tenancies(tenant_id) ON DELETE CASCADE,
  successor_readiness_score     numeric(5,2),
  successor_readiness_horizon   varchar(32),
  successor_readiness_payload   jsonb        NOT NULL DEFAULT '{}'::jsonb,
  successor_readiness_assessed_at timestamptz NOT NULL DEFAULT now(),
  created_at                    timestamptz  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sys_successor_readiness_candidate_idx
  ON sys.sys_successor_readiness (successor_readiness_candidate_id, successor_readiness_assessed_at DESC);

CREATE TABLE IF NOT EXISTS sys.sys_critical_role_coverage_status (
  critical_role_coverage_status_id          uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  critical_role_coverage_status_tenant_id   uuid         NOT NULL REFERENCES sys.sys_tenancies(tenant_id) ON DELETE CASCADE,
  critical_role_coverage_status_position_id uuid         NOT NULL REFERENCES sys.sys_positions(position_id) ON DELETE CASCADE,
  critical_role_coverage_ready_now_count    integer      NOT NULL DEFAULT 0,
  critical_role_coverage_ready_6mo_count    integer      NOT NULL DEFAULT 0,
  critical_role_coverage_ready_1y_count     integer      NOT NULL DEFAULT 0,
  critical_role_coverage_overall_score      numeric(5,2),
  critical_role_coverage_computed_at        timestamptz  NOT NULL DEFAULT now(),
  critical_role_coverage_payload            jsonb        NOT NULL DEFAULT '{}'::jsonb,
  created_at                                timestamptz  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sys_critical_role_coverage_position_idx
  ON sys.sys_critical_role_coverage_status (critical_role_coverage_status_position_id, critical_role_coverage_computed_at DESC);

-- Late-binding FK from sys_position_career_paths.career_path_id (000011)
DO $fk$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_schema = 'sys'
      AND table_name = 'sys_position_career_paths'
      AND constraint_name = 'sys_position_career_paths_career_path_id_fkey'
  ) THEN
    ALTER TABLE sys.sys_position_career_paths
      ADD CONSTRAINT sys_position_career_paths_career_path_id_fkey
      FOREIGN KEY (career_path_id)
      REFERENCES sys.sys_career_paths(career_path_id) ON DELETE RESTRICT;
  END IF;
END
$fk$;
