-- =============================================================================
-- 000015_kpi_model.sql
-- Heuresys Advanced — KPI cascading (10 tables) + late FK to user_kpi_evidence
-- -----------------------------------------------------------------------------
-- Per TARGET_SCHEMA_DESIGN §6.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. sys.sys_kpi_definitions — KPI master catalog
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sys.sys_kpi_definitions (
  kpi_definition_id          uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  kpi_definition_tenant_id   uuid         REFERENCES sys.sys_tenancies(tenant_id) ON DELETE CASCADE,
  kpi_definition_code        varchar(128) NOT NULL,
  kpi_definition_name        varchar(255) NOT NULL,
  kpi_definition_description text,
  kpi_definition_formula     text,
  kpi_definition_unit        varchar(64),
  kpi_definition_polarity    varchar(32)  NOT NULL DEFAULT 'HIGHER_IS_BETTER',
  kpi_definition_is_global   boolean      NOT NULL DEFAULT false,
  kpi_definition_metadata    jsonb        NOT NULL DEFAULT '{}'::jsonb,
  created_at                 timestamptz  NOT NULL DEFAULT now(),
  created_by                 uuid         REFERENCES sys.sys_users(user_id) ON DELETE SET NULL,
  updated_at                 timestamptz  NOT NULL DEFAULT now(),
  updated_by                 uuid         REFERENCES sys.sys_users(user_id) ON DELETE SET NULL
);

ALTER TABLE sys.sys_kpi_definitions
  DROP CONSTRAINT IF EXISTS sys_kpi_definitions_polarity_check;
ALTER TABLE sys.sys_kpi_definitions
  ADD CONSTRAINT sys_kpi_definitions_polarity_check
  CHECK (kpi_definition_polarity IN ('HIGHER_IS_BETTER', 'LOWER_IS_BETTER', 'TARGET_RANGE'));

CREATE UNIQUE INDEX IF NOT EXISTS sys_kpi_definitions_tenant_code_uq
  ON sys.sys_kpi_definitions (COALESCE(kpi_definition_tenant_id, '00000000-0000-0000-0000-000000000000'::uuid), kpi_definition_code);

DO $trg$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'sys_kpi_definitions_set_updated_at' AND tgrelid = 'sys.sys_kpi_definitions'::regclass) THEN
    CREATE TRIGGER sys_kpi_definitions_set_updated_at BEFORE UPDATE ON sys.sys_kpi_definitions FOR EACH ROW EXECUTE FUNCTION sys.sys_set_updated_at();
  END IF;
END $trg$;

-- -----------------------------------------------------------------------------
-- 2. sys.sys_kpi_metric_definitions — underlying metrics composing a KPI
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sys.sys_kpi_metric_definitions (
  kpi_metric_definition_id            uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  kpi_metric_definition_kpi_id        uuid         NOT NULL REFERENCES sys.sys_kpi_definitions(kpi_definition_id) ON DELETE CASCADE,
  kpi_metric_definition_code          varchar(128) NOT NULL,
  kpi_metric_definition_name          varchar(255) NOT NULL,
  kpi_metric_definition_unit          varchar(64),
  kpi_metric_definition_aggregation   varchar(32)  NOT NULL DEFAULT 'SUM',
  kpi_metric_definition_metadata      jsonb        NOT NULL DEFAULT '{}'::jsonb,
  created_at                          timestamptz  NOT NULL DEFAULT now(),
  updated_at                          timestamptz  NOT NULL DEFAULT now()
);

ALTER TABLE sys.sys_kpi_metric_definitions
  DROP CONSTRAINT IF EXISTS sys_kpi_metric_aggregation_check;
ALTER TABLE sys.sys_kpi_metric_definitions
  ADD CONSTRAINT sys_kpi_metric_aggregation_check
  CHECK (kpi_metric_definition_aggregation IN ('SUM', 'AVG', 'MIN', 'MAX', 'COUNT', 'RATIO', 'CUSTOM'));

CREATE UNIQUE INDEX IF NOT EXISTS sys_kpi_metric_definitions_kpi_code_uq
  ON sys.sys_kpi_metric_definitions (kpi_metric_definition_kpi_id, kpi_metric_definition_code);

-- -----------------------------------------------------------------------------
-- 3. sys.sys_process_kpi_templates — process-level KPI templates
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sys.sys_process_kpi_templates (
  process_kpi_template_id              uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  process_kpi_template_process_id      uuid         NOT NULL REFERENCES sys.sys_blueprint_process_registry(blueprint_process_id) ON DELETE CASCADE,
  process_kpi_template_kpi_id          uuid         NOT NULL REFERENCES sys.sys_kpi_definitions(kpi_definition_id) ON DELETE CASCADE,
  process_kpi_template_default_weight  numeric(4,3) NOT NULL DEFAULT 1.000,
  process_kpi_template_default_target  jsonb        NOT NULL DEFAULT '{}'::jsonb,
  process_kpi_template_metadata        jsonb        NOT NULL DEFAULT '{}'::jsonb,
  created_at                           timestamptz  NOT NULL DEFAULT now(),
  updated_at                           timestamptz  NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS sys_process_kpi_templates_process_kpi_uq
  ON sys.sys_process_kpi_templates (process_kpi_template_process_id, process_kpi_template_kpi_id);

-- -----------------------------------------------------------------------------
-- 4. sys.sys_organization_unit_kpi_templates — cascaded to org units
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sys.sys_organization_unit_kpi_templates (
  organization_unit_kpi_template_id              uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_unit_kpi_template_unit_id         uuid         NOT NULL REFERENCES sys.sys_organization_units(organization_unit_id) ON DELETE CASCADE,
  organization_unit_kpi_template_kpi_id          uuid         NOT NULL REFERENCES sys.sys_kpi_definitions(kpi_definition_id) ON DELETE CASCADE,
  organization_unit_kpi_template_tenant_id       uuid         NOT NULL REFERENCES sys.sys_tenancies(tenant_id) ON DELETE CASCADE,
  organization_unit_kpi_template_weight          numeric(4,3) NOT NULL DEFAULT 1.000,
  organization_unit_kpi_template_target          jsonb        NOT NULL DEFAULT '{}'::jsonb,
  organization_unit_kpi_template_metadata        jsonb        NOT NULL DEFAULT '{}'::jsonb,
  created_at                                     timestamptz  NOT NULL DEFAULT now(),
  updated_at                                     timestamptz  NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS sys_org_unit_kpi_templates_unit_kpi_uq
  ON sys.sys_organization_unit_kpi_templates (organization_unit_kpi_template_unit_id, organization_unit_kpi_template_kpi_id);

-- -----------------------------------------------------------------------------
-- 5. sys.sys_kpi_targets — concrete per-position/user/period targets
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sys.sys_kpi_targets (
  kpi_target_id            uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  kpi_target_tenant_id     uuid         NOT NULL REFERENCES sys.sys_tenancies(tenant_id) ON DELETE CASCADE,
  kpi_target_kpi_id        uuid         NOT NULL REFERENCES sys.sys_kpi_definitions(kpi_definition_id) ON DELETE CASCADE,
  kpi_target_position_id   uuid         REFERENCES sys.sys_positions(position_id) ON DELETE CASCADE,
  kpi_target_user_id       uuid         REFERENCES sys.sys_users(user_id) ON DELETE CASCADE,
  kpi_target_period_start  date         NOT NULL,
  kpi_target_period_end    date         NOT NULL,
  kpi_target_target_value  numeric(18,4) NOT NULL,
  kpi_target_minimum_value numeric(18,4),
  kpi_target_stretch_value numeric(18,4),
  kpi_target_unit          varchar(64),
  kpi_target_metadata      jsonb        NOT NULL DEFAULT '{}'::jsonb,
  created_at               timestamptz  NOT NULL DEFAULT now(),
  created_by               uuid         REFERENCES sys.sys_users(user_id) ON DELETE SET NULL,
  updated_at               timestamptz  NOT NULL DEFAULT now(),
  updated_by               uuid         REFERENCES sys.sys_users(user_id) ON DELETE SET NULL
);

ALTER TABLE sys.sys_kpi_targets
  DROP CONSTRAINT IF EXISTS sys_kpi_targets_scope_check;
ALTER TABLE sys.sys_kpi_targets
  ADD CONSTRAINT sys_kpi_targets_scope_check
  CHECK (kpi_target_position_id IS NOT NULL OR kpi_target_user_id IS NOT NULL);

CREATE INDEX IF NOT EXISTS sys_kpi_targets_kpi_period_idx
  ON sys.sys_kpi_targets (kpi_target_kpi_id, kpi_target_period_end DESC);

CREATE INDEX IF NOT EXISTS sys_kpi_targets_user_idx
  ON sys.sys_kpi_targets (kpi_target_user_id)
  WHERE kpi_target_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS sys_kpi_targets_position_idx
  ON sys.sys_kpi_targets (kpi_target_position_id)
  WHERE kpi_target_position_id IS NOT NULL;

DO $trg$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'sys_kpi_targets_set_updated_at' AND tgrelid = 'sys.sys_kpi_targets'::regclass) THEN
    CREATE TRIGGER sys_kpi_targets_set_updated_at BEFORE UPDATE ON sys.sys_kpi_targets FOR EACH ROW EXECUTE FUNCTION sys.sys_set_updated_at();
  END IF;
END $trg$;

-- -----------------------------------------------------------------------------
-- 6. sys.sys_kpi_measurements — actual measurements over time
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sys.sys_kpi_measurements (
  kpi_measurement_id        uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  kpi_measurement_tenant_id uuid         NOT NULL REFERENCES sys.sys_tenancies(tenant_id) ON DELETE CASCADE,
  kpi_measurement_kpi_id    uuid         NOT NULL REFERENCES sys.sys_kpi_definitions(kpi_definition_id) ON DELETE CASCADE,
  kpi_measurement_user_id   uuid         REFERENCES sys.sys_users(user_id) ON DELETE CASCADE,
  kpi_measurement_position_id uuid       REFERENCES sys.sys_positions(position_id) ON DELETE CASCADE,
  kpi_measurement_period_start date     NOT NULL,
  kpi_measurement_period_end   date     NOT NULL,
  kpi_measurement_value     numeric(18,4) NOT NULL,
  kpi_measurement_unit      varchar(64),
  kpi_measurement_source    varchar(64),
  kpi_measurement_recorded_at timestamptz NOT NULL DEFAULT now(),
  kpi_measurement_metadata  jsonb        NOT NULL DEFAULT '{}'::jsonb,
  created_at                timestamptz  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sys_kpi_measurements_kpi_user_period_idx
  ON sys.sys_kpi_measurements (kpi_measurement_kpi_id, kpi_measurement_user_id, kpi_measurement_period_end DESC);

CREATE INDEX IF NOT EXISTS sys_kpi_measurements_kpi_position_period_idx
  ON sys.sys_kpi_measurements (kpi_measurement_kpi_id, kpi_measurement_position_id, kpi_measurement_period_end DESC);

-- -----------------------------------------------------------------------------
-- 7. sys.sys_kpi_assessment_methods — assessment method catalog
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sys.sys_kpi_assessment_methods (
  kpi_assessment_method_id          uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  kpi_assessment_method_code        varchar(64)  NOT NULL,
  kpi_assessment_method_name        varchar(128) NOT NULL,
  kpi_assessment_method_description text,
  kpi_assessment_method_metadata    jsonb        NOT NULL DEFAULT '{}'::jsonb,
  created_at                        timestamptz  NOT NULL DEFAULT now()
);

ALTER TABLE sys.sys_kpi_assessment_methods
  DROP CONSTRAINT IF EXISTS sys_kpi_assessment_method_code_check;
ALTER TABLE sys.sys_kpi_assessment_methods
  ADD CONSTRAINT sys_kpi_assessment_method_code_check
  CHECK (kpi_assessment_method_code IN ('DELTA_VS_TARGET', 'PERCENTILE', 'BANDED', 'LINEAR_SCORE', 'STEPPED'));

CREATE UNIQUE INDEX IF NOT EXISTS sys_kpi_assessment_methods_code_uq
  ON sys.sys_kpi_assessment_methods (kpi_assessment_method_code);

-- -----------------------------------------------------------------------------
-- 8. sys.sys_kpi_weighting_rules — weighting rules catalog
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sys.sys_kpi_weighting_rules (
  kpi_weighting_rule_id          uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  kpi_weighting_rule_code        varchar(64)  NOT NULL,
  kpi_weighting_rule_name        varchar(128) NOT NULL,
  kpi_weighting_rule_kind        varchar(32)  NOT NULL DEFAULT 'LINEAR',
  kpi_weighting_rule_payload     jsonb        NOT NULL DEFAULT '{}'::jsonb,
  kpi_weighting_rule_description text,
  created_at                     timestamptz  NOT NULL DEFAULT now()
);

ALTER TABLE sys.sys_kpi_weighting_rules
  DROP CONSTRAINT IF EXISTS sys_kpi_weighting_rule_kind_check;
ALTER TABLE sys.sys_kpi_weighting_rules
  ADD CONSTRAINT sys_kpi_weighting_rule_kind_check
  CHECK (kpi_weighting_rule_kind IN ('LINEAR', 'CAPPED', 'STEP'));

CREATE UNIQUE INDEX IF NOT EXISTS sys_kpi_weighting_rules_code_uq
  ON sys.sys_kpi_weighting_rules (kpi_weighting_rule_code);

-- -----------------------------------------------------------------------------
-- 9. sys.sys_kpi_assessment_results — computed KPI assessment results
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sys.sys_kpi_assessment_results (
  kpi_assessment_result_id          uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  kpi_assessment_result_tenant_id   uuid         NOT NULL REFERENCES sys.sys_tenancies(tenant_id) ON DELETE CASCADE,
  kpi_assessment_result_kpi_id      uuid         NOT NULL REFERENCES sys.sys_kpi_definitions(kpi_definition_id) ON DELETE CASCADE,
  kpi_assessment_result_user_id     uuid         REFERENCES sys.sys_users(user_id) ON DELETE CASCADE,
  kpi_assessment_result_position_id uuid         REFERENCES sys.sys_positions(position_id) ON DELETE CASCADE,
  kpi_assessment_result_period_start date         NOT NULL,
  kpi_assessment_result_period_end   date         NOT NULL,
  kpi_assessment_result_method_id   uuid         REFERENCES sys.sys_kpi_assessment_methods(kpi_assessment_method_id) ON DELETE SET NULL,
  kpi_assessment_result_score       numeric(8,4),
  kpi_assessment_result_payload     jsonb        NOT NULL DEFAULT '{}'::jsonb,
  kpi_assessment_result_computed_at timestamptz  NOT NULL DEFAULT now(),
  created_at                        timestamptz  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sys_kpi_assessment_results_kpi_user_idx
  ON sys.sys_kpi_assessment_results (kpi_assessment_result_kpi_id, kpi_assessment_result_user_id, kpi_assessment_result_period_end DESC);

-- -----------------------------------------------------------------------------
-- 10. Late-binding FKs from earlier migrations to sys_kpi_definitions
-- -----------------------------------------------------------------------------
-- sys_user_kpi_evidence.kpi_id (created in 000006)
DO $fk$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_schema = 'sys'
      AND table_name = 'sys_user_kpi_evidence'
      AND constraint_name = 'sys_user_kpi_evidence_kpi_id_fkey'
  ) THEN
    ALTER TABLE sys.sys_user_kpi_evidence
      ADD CONSTRAINT sys_user_kpi_evidence_kpi_id_fkey
      FOREIGN KEY (user_kpi_evidence_kpi_id)
      REFERENCES sys.sys_kpi_definitions(kpi_definition_id) ON DELETE RESTRICT;
  END IF;
END
$fk$;

-- sys_position_kpi_requirements.kpi_definition_id (created in 000011)
DO $fk$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_schema = 'sys'
      AND table_name = 'sys_position_kpi_requirements'
      AND constraint_name = 'sys_position_kpi_requirements_kpi_id_fkey'
  ) THEN
    ALTER TABLE sys.sys_position_kpi_requirements
      ADD CONSTRAINT sys_position_kpi_requirements_kpi_id_fkey
      FOREIGN KEY (kpi_definition_id)
      REFERENCES sys.sys_kpi_definitions(kpi_definition_id) ON DELETE RESTRICT;
  END IF;
END
$fk$;
