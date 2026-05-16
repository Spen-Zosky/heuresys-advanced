-- =============================================================================
-- 000011_position_model.sql
-- Heuresys Advanced — sys.sys_positions + 6 PIP base requirement tables + PIP VIEW
-- -----------------------------------------------------------------------------
-- Per TARGET_SCHEMA_DESIGN §4.
-- Position is the CENTRAL HRMS object (invariant I1) — NOT employee.
-- Position OWNER ≠ Position INCUMBENT (I2): owner sits on
-- sys_positions.position_owner_user_id; incumbent in
-- sys_user_position_assignments (migration 000012).
--
-- PIP (Position Intelligence Profile) is a VIEW over base tables (ADR-0008,
-- invariant I9) — NOT a stored JSONB blob.
--
-- Some FKs (skill_id, kpi_definition_id, learning_path_id, career_path_id,
-- compensation_band_id) are declared as plain uuid here and constrained
-- later in 000013/000014/000015/000016/000018/000019 via guarded ALTER.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. sys.sys_positions — THE SPINE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sys.sys_positions (
  position_id                       uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  position_tenant_id                uuid         NOT NULL REFERENCES sys.sys_tenancies(tenant_id) ON DELETE RESTRICT,
  position_code                     varchar(128) NOT NULL,
  position_title                    varchar(255) NOT NULL,
  position_organization_unit_id     uuid         REFERENCES sys.sys_organization_units(organization_unit_id) ON DELETE SET NULL,
  position_job_role_id              uuid         REFERENCES sys.sys_job_roles(job_role_id) ON DELETE SET NULL,
  position_reports_to_position_id   uuid         REFERENCES sys.sys_positions(position_id) ON DELETE SET NULL,
  position_owner_user_id            uuid         REFERENCES sys.sys_users(user_id) ON DELETE SET NULL,
  position_esco_occupation_uri      text,
  position_criticality              varchar(32),
  position_economic_weight          numeric(8,4),
  position_is_active                boolean      NOT NULL DEFAULT true,
  position_effective_from           date         NOT NULL DEFAULT current_date,
  position_effective_to             date,
  position_metadata                 jsonb        NOT NULL DEFAULT '{}'::jsonb,
  position_ai_hints                 jsonb        NOT NULL DEFAULT '{}'::jsonb,
  created_at                        timestamptz  NOT NULL DEFAULT now(),
  created_by                        uuid         REFERENCES sys.sys_users(user_id) ON DELETE SET NULL,
  updated_at                        timestamptz  NOT NULL DEFAULT now(),
  updated_by                        uuid         REFERENCES sys.sys_users(user_id) ON DELETE SET NULL
);

ALTER TABLE sys.sys_positions
  DROP CONSTRAINT IF EXISTS sys_positions_criticality_check;
ALTER TABLE sys.sys_positions
  ADD CONSTRAINT sys_positions_criticality_check
  CHECK (position_criticality IS NULL OR position_criticality IN ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW'));

ALTER TABLE sys.sys_positions
  DROP CONSTRAINT IF EXISTS sys_positions_economic_weight_range;
ALTER TABLE sys.sys_positions
  ADD CONSTRAINT sys_positions_economic_weight_range
  CHECK (position_economic_weight IS NULL OR (position_economic_weight >= 0 AND position_economic_weight <= 1));

CREATE UNIQUE INDEX IF NOT EXISTS sys_positions_tenant_code_uq
  ON sys.sys_positions (position_tenant_id, position_code);

CREATE INDEX IF NOT EXISTS sys_positions_org_unit_idx
  ON sys.sys_positions (position_organization_unit_id);

CREATE INDEX IF NOT EXISTS sys_positions_job_role_idx
  ON sys.sys_positions (position_job_role_id);

CREATE INDEX IF NOT EXISTS sys_positions_owner_idx
  ON sys.sys_positions (position_owner_user_id)
  WHERE position_owner_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS sys_positions_reports_to_idx
  ON sys.sys_positions (position_reports_to_position_id)
  WHERE position_reports_to_position_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS sys_positions_tenant_active_idx
  ON sys.sys_positions (position_tenant_id, position_is_active);

CREATE INDEX IF NOT EXISTS sys_positions_criticality_idx
  ON sys.sys_positions (position_tenant_id, position_criticality)
  WHERE position_criticality IS NOT NULL;

DO $trg$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'sys_positions_set_updated_at' AND tgrelid = 'sys.sys_positions'::regclass) THEN
    CREATE TRIGGER sys_positions_set_updated_at BEFORE UPDATE ON sys.sys_positions FOR EACH ROW EXECUTE FUNCTION sys.sys_set_updated_at();
  END IF;
END $trg$;

-- -----------------------------------------------------------------------------
-- 2. sys.sys_position_skill_requirements (PIP base; FK to skill in 000013)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sys.sys_position_skill_requirements (
  position_skill_requirement_id        uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  position_id                          uuid         NOT NULL REFERENCES sys.sys_positions(position_id) ON DELETE CASCADE,
  position_skill_requirement_tenant_id uuid         NOT NULL REFERENCES sys.sys_tenancies(tenant_id) ON DELETE RESTRICT,
  skill_id                             uuid         NOT NULL,
  required_proficiency                 varchar(32)  NOT NULL,
  weight                               numeric(4,3) NOT NULL DEFAULT 1.000,
  criticality                          varchar(32)  NOT NULL DEFAULT 'MEDIUM',
  position_skill_requirement_metadata  jsonb        NOT NULL DEFAULT '{}'::jsonb,
  created_at                           timestamptz  NOT NULL DEFAULT now(),
  created_by                           uuid         REFERENCES sys.sys_users(user_id) ON DELETE SET NULL,
  updated_at                           timestamptz  NOT NULL DEFAULT now(),
  updated_by                           uuid         REFERENCES sys.sys_users(user_id) ON DELETE SET NULL
);

ALTER TABLE sys.sys_position_skill_requirements
  DROP CONSTRAINT IF EXISTS sys_psr_required_proficiency_check;
ALTER TABLE sys.sys_position_skill_requirements
  ADD CONSTRAINT sys_psr_required_proficiency_check
  CHECK (required_proficiency IN ('NOVICE', 'BASIC', 'COMPETENT', 'PROFICIENT', 'EXPERT', 'MASTER'));

ALTER TABLE sys.sys_position_skill_requirements
  DROP CONSTRAINT IF EXISTS sys_psr_criticality_check;
ALTER TABLE sys.sys_position_skill_requirements
  ADD CONSTRAINT sys_psr_criticality_check
  CHECK (criticality IN ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW'));

CREATE UNIQUE INDEX IF NOT EXISTS sys_psr_position_skill_uq
  ON sys.sys_position_skill_requirements (position_id, skill_id);

CREATE INDEX IF NOT EXISTS sys_psr_skill_idx
  ON sys.sys_position_skill_requirements (skill_id);

DO $trg$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'sys_psr_set_updated_at' AND tgrelid = 'sys.sys_position_skill_requirements'::regclass) THEN
    CREATE TRIGGER sys_psr_set_updated_at BEFORE UPDATE ON sys.sys_position_skill_requirements FOR EACH ROW EXECUTE FUNCTION sys.sys_set_updated_at();
  END IF;
END $trg$;

-- -----------------------------------------------------------------------------
-- 3. sys.sys_position_kpi_requirements (PIP base; FK to kpi in 000015)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sys.sys_position_kpi_requirements (
  position_kpi_requirement_id        uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  position_id                        uuid         NOT NULL REFERENCES sys.sys_positions(position_id) ON DELETE CASCADE,
  position_kpi_requirement_tenant_id uuid         NOT NULL REFERENCES sys.sys_tenancies(tenant_id) ON DELETE RESTRICT,
  kpi_definition_id                  uuid         NOT NULL,
  target_template                    jsonb        NOT NULL DEFAULT '{}'::jsonb,
  weight                             numeric(4,3) NOT NULL DEFAULT 1.000,
  position_kpi_requirement_metadata  jsonb        NOT NULL DEFAULT '{}'::jsonb,
  created_at                         timestamptz  NOT NULL DEFAULT now(),
  created_by                         uuid         REFERENCES sys.sys_users(user_id) ON DELETE SET NULL,
  updated_at                         timestamptz  NOT NULL DEFAULT now(),
  updated_by                         uuid         REFERENCES sys.sys_users(user_id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS sys_pkr_position_kpi_uq
  ON sys.sys_position_kpi_requirements (position_id, kpi_definition_id);

CREATE INDEX IF NOT EXISTS sys_pkr_kpi_idx
  ON sys.sys_position_kpi_requirements (kpi_definition_id);

DO $trg$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'sys_pkr_set_updated_at' AND tgrelid = 'sys.sys_position_kpi_requirements'::regclass) THEN
    CREATE TRIGGER sys_pkr_set_updated_at BEFORE UPDATE ON sys.sys_position_kpi_requirements FOR EACH ROW EXECUTE FUNCTION sys.sys_set_updated_at();
  END IF;
END $trg$;

-- -----------------------------------------------------------------------------
-- 4. sys.sys_position_learning_requirements (PIP base; FK to learning_path in 000016)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sys.sys_position_learning_requirements (
  position_learning_requirement_id        uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  position_id                             uuid         NOT NULL REFERENCES sys.sys_positions(position_id) ON DELETE CASCADE,
  position_learning_requirement_tenant_id uuid         NOT NULL REFERENCES sys.sys_tenancies(tenant_id) ON DELETE RESTRICT,
  learning_path_id                        uuid         NOT NULL,
  is_mandatory                            boolean      NOT NULL DEFAULT true,
  deadline_rule                           jsonb        NOT NULL DEFAULT '{}'::jsonb,
  position_learning_requirement_metadata  jsonb        NOT NULL DEFAULT '{}'::jsonb,
  created_at                              timestamptz  NOT NULL DEFAULT now(),
  created_by                              uuid         REFERENCES sys.sys_users(user_id) ON DELETE SET NULL,
  updated_at                              timestamptz  NOT NULL DEFAULT now(),
  updated_by                              uuid         REFERENCES sys.sys_users(user_id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS sys_plr_position_path_uq
  ON sys.sys_position_learning_requirements (position_id, learning_path_id);

CREATE INDEX IF NOT EXISTS sys_plr_learning_path_idx
  ON sys.sys_position_learning_requirements (learning_path_id);

DO $trg$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'sys_plr_set_updated_at' AND tgrelid = 'sys.sys_position_learning_requirements'::regclass) THEN
    CREATE TRIGGER sys_plr_set_updated_at BEFORE UPDATE ON sys.sys_position_learning_requirements FOR EACH ROW EXECUTE FUNCTION sys.sys_set_updated_at();
  END IF;
END $trg$;

-- -----------------------------------------------------------------------------
-- 5. sys.sys_position_career_paths (PIP base; FK to career_path in 000018)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sys.sys_position_career_paths (
  position_career_path_id        uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  position_id                    uuid         NOT NULL REFERENCES sys.sys_positions(position_id) ON DELETE CASCADE,
  position_career_path_tenant_id uuid         NOT NULL REFERENCES sys.sys_tenancies(tenant_id) ON DELETE RESTRICT,
  career_path_id                 uuid         NOT NULL,
  position_career_path_metadata  jsonb        NOT NULL DEFAULT '{}'::jsonb,
  created_at                     timestamptz  NOT NULL DEFAULT now(),
  created_by                     uuid         REFERENCES sys.sys_users(user_id) ON DELETE SET NULL,
  updated_at                     timestamptz  NOT NULL DEFAULT now(),
  updated_by                     uuid         REFERENCES sys.sys_users(user_id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS sys_pcp_position_path_uq
  ON sys.sys_position_career_paths (position_id, career_path_id);

CREATE INDEX IF NOT EXISTS sys_pcp_career_path_idx
  ON sys.sys_position_career_paths (career_path_id);

-- -----------------------------------------------------------------------------
-- 6. sys.sys_position_compensation_profiles (PIP base; FK to band in 000019)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sys.sys_position_compensation_profiles (
  position_compensation_profile_id        uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  position_id                             uuid         NOT NULL REFERENCES sys.sys_positions(position_id) ON DELETE CASCADE,
  position_compensation_profile_tenant_id uuid         NOT NULL REFERENCES sys.sys_tenancies(tenant_id) ON DELETE RESTRICT,
  compensation_band_id                    uuid,
  economic_weight                         numeric(8,4),
  reward_gates_applied                    jsonb        NOT NULL DEFAULT '[]'::jsonb,
  position_compensation_profile_metadata  jsonb        NOT NULL DEFAULT '{}'::jsonb,
  created_at                              timestamptz  NOT NULL DEFAULT now(),
  created_by                              uuid         REFERENCES sys.sys_users(user_id) ON DELETE SET NULL,
  updated_at                              timestamptz  NOT NULL DEFAULT now(),
  updated_by                              uuid         REFERENCES sys.sys_users(user_id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS sys_pcomp_position_uq
  ON sys.sys_position_compensation_profiles (position_id);

DO $trg$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'sys_pcomp_set_updated_at' AND tgrelid = 'sys.sys_position_compensation_profiles'::regclass) THEN
    CREATE TRIGGER sys_pcomp_set_updated_at BEFORE UPDATE ON sys.sys_position_compensation_profiles FOR EACH ROW EXECUTE FUNCTION sys.sys_set_updated_at();
  END IF;
END $trg$;

-- -----------------------------------------------------------------------------
-- 7. sys.sys_position_succession_relevance (PIP base)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sys.sys_position_succession_relevance (
  position_succession_relevance_id        uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  position_id                             uuid         NOT NULL REFERENCES sys.sys_positions(position_id) ON DELETE CASCADE,
  position_succession_relevance_tenant_id uuid         NOT NULL REFERENCES sys.sys_tenancies(tenant_id) ON DELETE RESTRICT,
  is_critical                             boolean      NOT NULL DEFAULT false,
  readiness_horizon                       varchar(32),
  position_succession_relevance_metadata  jsonb        NOT NULL DEFAULT '{}'::jsonb,
  created_at                              timestamptz  NOT NULL DEFAULT now(),
  created_by                              uuid         REFERENCES sys.sys_users(user_id) ON DELETE SET NULL,
  updated_at                              timestamptz  NOT NULL DEFAULT now(),
  updated_by                              uuid         REFERENCES sys.sys_users(user_id) ON DELETE SET NULL
);

ALTER TABLE sys.sys_position_succession_relevance
  DROP CONSTRAINT IF EXISTS sys_psr_readiness_horizon_check;
ALTER TABLE sys.sys_position_succession_relevance
  ADD CONSTRAINT sys_psr_readiness_horizon_check
  CHECK (readiness_horizon IS NULL OR readiness_horizon IN ('READY_NOW', 'READY_6_MONTHS', 'READY_1_YEAR', 'READY_2_YEARS', 'NOT_READY'));

CREATE UNIQUE INDEX IF NOT EXISTS sys_psucc_position_uq
  ON sys.sys_position_succession_relevance (position_id);

DO $trg$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'sys_psucc_set_updated_at' AND tgrelid = 'sys.sys_position_succession_relevance'::regclass) THEN
    CREATE TRIGGER sys_psucc_set_updated_at BEFORE UPDATE ON sys.sys_position_succession_relevance FOR EACH ROW EXECUTE FUNCTION sys.sys_set_updated_at();
  END IF;
END $trg$;

-- -----------------------------------------------------------------------------
-- 8. sys.sys_position_intelligence_profiles_v — PIP VIEW (per ADR-0008)
-- -----------------------------------------------------------------------------
-- Aggregates the 6 base requirement tables as JSONB array projections.
-- This is a plain VIEW (re-queried each access). If profiling shows hot
-- paths, can be promoted to MATERIALIZED VIEW in a follow-up migration.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW sys.sys_position_intelligence_profiles_v AS
SELECT
  p.position_id,
  p.position_tenant_id,
  p.position_code,
  p.position_title,
  p.position_organization_unit_id,
  p.position_job_role_id,
  p.position_owner_user_id,
  p.position_reports_to_position_id,
  p.position_esco_occupation_uri,
  p.position_criticality,
  p.position_economic_weight,
  p.position_is_active,
  p.position_effective_from,
  p.position_effective_to,
  (SELECT jsonb_agg(jsonb_build_object(
            'skill_id', psr.skill_id,
            'required_proficiency', psr.required_proficiency,
            'weight', psr.weight,
            'criticality', psr.criticality))
   FROM sys.sys_position_skill_requirements psr
   WHERE psr.position_id = p.position_id) AS required_skills,
  (SELECT jsonb_agg(jsonb_build_object(
            'kpi_definition_id', pkr.kpi_definition_id,
            'target_template', pkr.target_template,
            'weight', pkr.weight))
   FROM sys.sys_position_kpi_requirements pkr
   WHERE pkr.position_id = p.position_id) AS required_kpis,
  (SELECT jsonb_agg(jsonb_build_object(
            'learning_path_id', plr.learning_path_id,
            'mandatory', plr.is_mandatory,
            'deadline_rule', plr.deadline_rule))
   FROM sys.sys_position_learning_requirements plr
   WHERE plr.position_id = p.position_id) AS required_learning_paths,
  (SELECT jsonb_agg(jsonb_build_object('career_path_id', pcp.career_path_id))
   FROM sys.sys_position_career_paths pcp
   WHERE pcp.position_id = p.position_id) AS career_paths,
  (SELECT row_to_json(pcp2)
   FROM (SELECT compensation_band_id, economic_weight, reward_gates_applied
         FROM sys.sys_position_compensation_profiles
         WHERE position_id = p.position_id LIMIT 1) pcp2) AS compensation_profile,
  (SELECT row_to_json(psrr)
   FROM (SELECT is_critical, readiness_horizon
         FROM sys.sys_position_succession_relevance
         WHERE position_id = p.position_id LIMIT 1) psrr) AS succession_relevance,
  p.position_ai_hints,
  p.updated_at
FROM sys.sys_positions p;
