-- =============================================================================
-- 000019_compensation_intelligence_model.sql
-- Heuresys Advanced — compensation intelligence + reward gates (12 tables)
-- -----------------------------------------------------------------------------
-- Per TARGET_SCHEMA_DESIGN §10.
-- Decision support ONLY — NOT payroll execution (invariant I8).
-- Output is a handoff to external payroll systems.
-- =============================================================================

CREATE TABLE IF NOT EXISTS sys.sys_compensation_bands (
  compensation_band_id          uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  compensation_band_tenant_id   uuid         REFERENCES sys.sys_tenancies(tenant_id) ON DELETE CASCADE,
  compensation_band_code        varchar(64)  NOT NULL,
  compensation_band_name        varchar(128) NOT NULL,
  compensation_band_min_eur     numeric(18,2),
  compensation_band_mid_eur     numeric(18,2),
  compensation_band_max_eur     numeric(18,2),
  compensation_band_is_global   boolean      NOT NULL DEFAULT false,
  compensation_band_metadata    jsonb        NOT NULL DEFAULT '{}'::jsonb,
  created_at                    timestamptz  NOT NULL DEFAULT now(),
  updated_at                    timestamptz  NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS sys_compensation_bands_tenant_code_uq
  ON sys.sys_compensation_bands (COALESCE(compensation_band_tenant_id, '00000000-0000-0000-0000-000000000000'::uuid), compensation_band_code);

-- Late-binding FK from sys_position_compensation_profiles (000011) to compensation_bands
DO $fk$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_schema = 'sys'
      AND table_name = 'sys_position_compensation_profiles'
      AND constraint_name = 'sys_pcomp_band_id_fkey'
  ) THEN
    ALTER TABLE sys.sys_position_compensation_profiles
      ADD CONSTRAINT sys_pcomp_band_id_fkey
      FOREIGN KEY (compensation_band_id)
      REFERENCES sys.sys_compensation_bands(compensation_band_id) ON DELETE SET NULL;
  END IF;
END
$fk$;

CREATE TABLE IF NOT EXISTS sys.sys_position_economic_weight (
  position_economic_weight_id        uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  position_economic_weight_position_id uuid       NOT NULL REFERENCES sys.sys_positions(position_id) ON DELETE CASCADE,
  position_economic_weight_tenant_id uuid         NOT NULL REFERENCES sys.sys_tenancies(tenant_id) ON DELETE CASCADE,
  position_economic_weight_value     numeric(8,4) NOT NULL,
  position_economic_weight_period_start date,
  position_economic_weight_period_end   date,
  position_economic_weight_metadata  jsonb        NOT NULL DEFAULT '{}'::jsonb,
  created_at                         timestamptz  NOT NULL DEFAULT now(),
  updated_at                         timestamptz  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sys_pew_position_idx
  ON sys.sys_position_economic_weight (position_economic_weight_position_id);

CREATE TABLE IF NOT EXISTS sys.sys_objective_reward_rules (
  objective_reward_rule_id        uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  objective_reward_rule_tenant_id uuid         NOT NULL REFERENCES sys.sys_tenancies(tenant_id) ON DELETE CASCADE,
  objective_reward_rule_code      varchar(128) NOT NULL,
  objective_reward_rule_name      varchar(255) NOT NULL,
  objective_reward_rule_payload   jsonb        NOT NULL DEFAULT '{}'::jsonb,
  created_at                      timestamptz  NOT NULL DEFAULT now(),
  updated_at                      timestamptz  NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS sys_objective_reward_rules_tenant_code_uq
  ON sys.sys_objective_reward_rules (objective_reward_rule_tenant_id, objective_reward_rule_code);

CREATE TABLE IF NOT EXISTS sys.sys_payout_curves (
  payout_curve_id        uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  payout_curve_tenant_id uuid         REFERENCES sys.sys_tenancies(tenant_id) ON DELETE CASCADE,
  payout_curve_code      varchar(64)  NOT NULL,
  payout_curve_name      varchar(128) NOT NULL,
  payout_curve_kind      varchar(32)  NOT NULL DEFAULT 'LINEAR',
  payout_curve_payload   jsonb        NOT NULL DEFAULT '{}'::jsonb,
  payout_curve_is_global boolean      NOT NULL DEFAULT false,
  created_at             timestamptz  NOT NULL DEFAULT now(),
  updated_at             timestamptz  NOT NULL DEFAULT now()
);

ALTER TABLE sys.sys_payout_curves
  DROP CONSTRAINT IF EXISTS sys_payout_curve_kind_check;
ALTER TABLE sys.sys_payout_curves
  ADD CONSTRAINT sys_payout_curve_kind_check
  CHECK (payout_curve_kind IN ('LINEAR', 'CAPPED', 'STEPPED', 'SIGMOID'));

CREATE UNIQUE INDEX IF NOT EXISTS sys_payout_curves_tenant_code_uq
  ON sys.sys_payout_curves (COALESCE(payout_curve_tenant_id, '00000000-0000-0000-0000-000000000000'::uuid), payout_curve_code);

CREATE TABLE IF NOT EXISTS sys.sys_bonus_pools (
  bonus_pool_id            uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  bonus_pool_tenant_id     uuid         NOT NULL REFERENCES sys.sys_tenancies(tenant_id) ON DELETE CASCADE,
  bonus_pool_scope         varchar(32)  NOT NULL DEFAULT 'TENANT',
  bonus_pool_organization_unit_id uuid  REFERENCES sys.sys_organization_units(organization_unit_id) ON DELETE SET NULL,
  bonus_pool_period_start  date         NOT NULL,
  bonus_pool_period_end    date         NOT NULL,
  bonus_pool_total_eur     numeric(18,2),
  bonus_pool_payload       jsonb        NOT NULL DEFAULT '{}'::jsonb,
  created_at               timestamptz  NOT NULL DEFAULT now(),
  updated_at               timestamptz  NOT NULL DEFAULT now()
);

ALTER TABLE sys.sys_bonus_pools
  DROP CONSTRAINT IF EXISTS sys_bonus_pool_scope_check;
ALTER TABLE sys.sys_bonus_pools
  ADD CONSTRAINT sys_bonus_pool_scope_check
  CHECK (bonus_pool_scope IN ('TENANT', 'ORG_UNIT', 'POSITION_FAMILY'));

CREATE INDEX IF NOT EXISTS sys_bonus_pools_tenant_period_idx
  ON sys.sys_bonus_pools (bonus_pool_tenant_id, bonus_pool_period_end DESC);

CREATE TABLE IF NOT EXISTS sys.sys_variable_pay_calculations (
  variable_pay_calculation_id        uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  variable_pay_calculation_tenant_id uuid         NOT NULL REFERENCES sys.sys_tenancies(tenant_id) ON DELETE CASCADE,
  variable_pay_calculation_user_id   uuid         NOT NULL REFERENCES sys.sys_users(user_id) ON DELETE CASCADE,
  variable_pay_calculation_position_id uuid       REFERENCES sys.sys_positions(position_id) ON DELETE SET NULL,
  variable_pay_calculation_period_start date      NOT NULL,
  variable_pay_calculation_period_end   date      NOT NULL,
  variable_pay_calculation_signal_score numeric(8,4),
  variable_pay_calculation_amount_eur numeric(18,2),
  variable_pay_calculation_payload   jsonb        NOT NULL DEFAULT '{}'::jsonb,
  variable_pay_calculation_computed_at timestamptz NOT NULL DEFAULT now(),
  created_at                         timestamptz  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sys_vpc_user_period_idx
  ON sys.sys_variable_pay_calculations (variable_pay_calculation_user_id, variable_pay_calculation_period_end DESC);

CREATE TABLE IF NOT EXISTS sys.sys_reward_gate_catalog (
  reward_gate_catalog_id          uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  reward_gate_catalog_blueprint_variant_id uuid NOT NULL REFERENCES sys.sys_blueprint_variants(blueprint_variant_id) ON DELETE CASCADE,
  reward_gate_catalog_code        varchar(64)  NOT NULL,
  reward_gate_catalog_name        varchar(128) NOT NULL,
  reward_gate_catalog_description text,
  reward_gate_catalog_is_blocking boolean      NOT NULL DEFAULT true,
  reward_gate_catalog_metadata    jsonb        NOT NULL DEFAULT '{}'::jsonb,
  created_at                      timestamptz  NOT NULL DEFAULT now(),
  updated_at                      timestamptz  NOT NULL DEFAULT now()
);

-- Idempotent ALTER for upgrades from prior versions that had nullable variant_id:
--   if the column was created nullable and the table is empty, we can SET NOT NULL.
DO $alter$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'sys' AND table_name = 'sys_reward_gate_catalog'
      AND column_name = 'reward_gate_catalog_blueprint_variant_id'
      AND is_nullable = 'YES'
  ) THEN
    ALTER TABLE sys.sys_reward_gate_catalog
      ALTER COLUMN reward_gate_catalog_blueprint_variant_id SET NOT NULL;
  END IF;
END
$alter$;

-- Drop the previous COALESCE-based unique index (if it exists from an earlier
-- apply with nullable variant_id) and recreate a plain unique index so that
-- ON CONFLICT (variant_id, code) in 000021 matches correctly.
DROP INDEX IF EXISTS sys.sys_reward_gate_catalog_variant_code_uq;
CREATE UNIQUE INDEX IF NOT EXISTS sys_reward_gate_catalog_variant_code_uq
  ON sys.sys_reward_gate_catalog (reward_gate_catalog_blueprint_variant_id, reward_gate_catalog_code);

CREATE TABLE IF NOT EXISTS sys.sys_reward_gates (
  reward_gate_id          uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  reward_gate_tenant_id   uuid         NOT NULL REFERENCES sys.sys_tenancies(tenant_id) ON DELETE CASCADE,
  reward_gate_user_id     uuid         REFERENCES sys.sys_users(user_id) ON DELETE CASCADE,
  reward_gate_position_id uuid         REFERENCES sys.sys_positions(position_id) ON DELETE CASCADE,
  reward_gate_catalog_id  uuid         NOT NULL REFERENCES sys.sys_reward_gate_catalog(reward_gate_catalog_id) ON DELETE RESTRICT,
  reward_gate_period_start date        NOT NULL,
  reward_gate_period_end   date        NOT NULL,
  reward_gate_payload     jsonb        NOT NULL DEFAULT '{}'::jsonb,
  created_at              timestamptz  NOT NULL DEFAULT now(),
  updated_at              timestamptz  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sys_reward_gates_user_period_idx
  ON sys.sys_reward_gates (reward_gate_user_id, reward_gate_period_end DESC);

CREATE TABLE IF NOT EXISTS sys.sys_reward_gate_results (
  reward_gate_result_id          uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  reward_gate_result_gate_id     uuid         NOT NULL REFERENCES sys.sys_reward_gates(reward_gate_id) ON DELETE CASCADE,
  reward_gate_result_tenant_id   uuid         NOT NULL REFERENCES sys.sys_tenancies(tenant_id) ON DELETE CASCADE,
  reward_gate_result_status      varchar(32)  NOT NULL,
  reward_gate_result_score       numeric(8,4),
  reward_gate_result_evaluator_user_id uuid   REFERENCES sys.sys_users(user_id) ON DELETE SET NULL,
  reward_gate_result_override_reason text,
  reward_gate_result_payload     jsonb        NOT NULL DEFAULT '{}'::jsonb,
  reward_gate_result_recorded_at timestamptz  NOT NULL DEFAULT now(),
  created_at                     timestamptz  NOT NULL DEFAULT now()
);

ALTER TABLE sys.sys_reward_gate_results
  DROP CONSTRAINT IF EXISTS sys_reward_gate_result_status_check;
ALTER TABLE sys.sys_reward_gate_results
  ADD CONSTRAINT sys_reward_gate_result_status_check
  CHECK (reward_gate_result_status IN ('PASSED', 'WARNING', 'BLOCKED', 'ESCALATED', 'OVERRIDDEN_WITH_REASON'));

CREATE INDEX IF NOT EXISTS sys_reward_gate_results_gate_idx
  ON sys.sys_reward_gate_results (reward_gate_result_gate_id, reward_gate_result_recorded_at DESC);

CREATE TABLE IF NOT EXISTS sys.sys_compensation_recommendations (
  compensation_recommendation_id          uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  compensation_recommendation_tenant_id   uuid         NOT NULL REFERENCES sys.sys_tenancies(tenant_id) ON DELETE CASCADE,
  compensation_recommendation_user_id     uuid         NOT NULL REFERENCES sys.sys_users(user_id) ON DELETE CASCADE,
  compensation_recommendation_position_id uuid         REFERENCES sys.sys_positions(position_id) ON DELETE SET NULL,
  compensation_recommendation_period_start date         NOT NULL,
  compensation_recommendation_period_end   date         NOT NULL,
  compensation_recommendation_signal       varchar(32)  NOT NULL DEFAULT 'PROPOSED',
  compensation_recommendation_amount_eur   numeric(18,2),
  compensation_recommendation_narrative   text,
  compensation_recommendation_payload     jsonb        NOT NULL DEFAULT '{}'::jsonb,
  compensation_recommendation_computed_at timestamptz  NOT NULL DEFAULT now(),
  created_at                              timestamptz  NOT NULL DEFAULT now()
);

ALTER TABLE sys.sys_compensation_recommendations
  DROP CONSTRAINT IF EXISTS sys_compensation_recommendation_signal_check;
ALTER TABLE sys.sys_compensation_recommendations
  ADD CONSTRAINT sys_compensation_recommendation_signal_check
  CHECK (compensation_recommendation_signal IN ('PROPOSED', 'APPROVED', 'SUPPRESSED_BY_GATE', 'ADJUSTED', 'REJECTED'));

CREATE INDEX IF NOT EXISTS sys_compensation_recommendations_user_idx
  ON sys.sys_compensation_recommendations (compensation_recommendation_user_id, compensation_recommendation_period_end DESC);

CREATE TABLE IF NOT EXISTS sys.sys_payroll_handoff_records (
  payroll_handoff_record_id        uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_handoff_record_tenant_id uuid         NOT NULL REFERENCES sys.sys_tenancies(tenant_id) ON DELETE CASCADE,
  payroll_handoff_record_period_start date      NOT NULL,
  payroll_handoff_record_period_end   date      NOT NULL,
  payroll_handoff_record_recipient_system varchar(128) NOT NULL,
  payroll_handoff_record_payload   jsonb        NOT NULL DEFAULT '{}'::jsonb,
  payroll_handoff_record_handed_off_at timestamptz NOT NULL DEFAULT now(),
  payroll_handoff_record_status    varchar(32)  NOT NULL DEFAULT 'SENT',
  created_at                       timestamptz  NOT NULL DEFAULT now()
);

ALTER TABLE sys.sys_payroll_handoff_records
  DROP CONSTRAINT IF EXISTS sys_payroll_handoff_status_check;
ALTER TABLE sys.sys_payroll_handoff_records
  ADD CONSTRAINT sys_payroll_handoff_status_check
  CHECK (payroll_handoff_record_status IN ('PENDING', 'SENT', 'ACKNOWLEDGED', 'REJECTED'));

CREATE INDEX IF NOT EXISTS sys_payroll_handoff_tenant_period_idx
  ON sys.sys_payroll_handoff_records (payroll_handoff_record_tenant_id, payroll_handoff_record_period_end DESC);
