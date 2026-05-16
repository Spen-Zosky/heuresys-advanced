-- =============================================================================
-- 000010_job_role_model.sql
-- Heuresys Advanced — job role catalog (3 tables)
-- -----------------------------------------------------------------------------
-- Per TARGET_SCHEMA_DESIGN §3.2.
-- =============================================================================

CREATE TABLE IF NOT EXISTS sys.sys_job_families (
  job_family_id          uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  job_family_code        varchar(64)  NOT NULL,
  job_family_name        varchar(128) NOT NULL,
  job_family_description text,
  job_family_metadata    jsonb        NOT NULL DEFAULT '{}'::jsonb,
  created_at             timestamptz  NOT NULL DEFAULT now(),
  updated_at             timestamptz  NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS sys_job_families_code_uq
  ON sys.sys_job_families (job_family_code);

CREATE TABLE IF NOT EXISTS sys.sys_job_roles (
  job_role_id              uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  job_role_family_id       uuid         NOT NULL REFERENCES sys.sys_job_families(job_family_id) ON DELETE RESTRICT,
  job_role_code            varchar(128) NOT NULL,
  job_role_name            varchar(255) NOT NULL,
  job_role_description     text,
  job_role_seniority_level varchar(32),
  job_role_metadata        jsonb        NOT NULL DEFAULT '{}'::jsonb,
  created_at               timestamptz  NOT NULL DEFAULT now(),
  created_by               uuid         REFERENCES sys.sys_users(user_id) ON DELETE SET NULL,
  updated_at               timestamptz  NOT NULL DEFAULT now(),
  updated_by               uuid         REFERENCES sys.sys_users(user_id) ON DELETE SET NULL
);

ALTER TABLE sys.sys_job_roles
  DROP CONSTRAINT IF EXISTS sys_job_roles_seniority_level_check;
ALTER TABLE sys.sys_job_roles
  ADD CONSTRAINT sys_job_roles_seniority_level_check
  CHECK (job_role_seniority_level IS NULL OR job_role_seniority_level IN
    ('ENTRY', 'JUNIOR', 'MID', 'SENIOR', 'LEAD', 'EXECUTIVE'));

CREATE UNIQUE INDEX IF NOT EXISTS sys_job_roles_code_uq
  ON sys.sys_job_roles (job_role_code);

CREATE INDEX IF NOT EXISTS sys_job_roles_family_idx
  ON sys.sys_job_roles (job_role_family_id);

DO $trg$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'sys_job_roles_set_updated_at' AND tgrelid = 'sys.sys_job_roles'::regclass) THEN
    CREATE TRIGGER sys_job_roles_set_updated_at BEFORE UPDATE ON sys.sys_job_roles FOR EACH ROW EXECUTE FUNCTION sys.sys_set_updated_at();
  END IF;
END $trg$;

CREATE TABLE IF NOT EXISTS sys.sys_esco_occupation_mappings (
  esco_occupation_mapping_id          uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  esco_occupation_mapping_job_role_id uuid         NOT NULL REFERENCES sys.sys_job_roles(job_role_id) ON DELETE CASCADE,
  esco_occupation_mapping_esco_uri    text         NOT NULL,
  esco_occupation_mapping_esco_label  varchar(255),
  esco_occupation_mapping_isco_code   varchar(16),
  esco_occupation_mapping_confidence  numeric(4,3) NOT NULL DEFAULT 1.000,
  esco_occupation_mapping_metadata    jsonb        NOT NULL DEFAULT '{}'::jsonb,
  created_at                          timestamptz  NOT NULL DEFAULT now(),
  updated_at                          timestamptz  NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS sys_esco_occupation_mappings_pair_uq
  ON sys.sys_esco_occupation_mappings (esco_occupation_mapping_job_role_id, esco_occupation_mapping_esco_uri);

CREATE INDEX IF NOT EXISTS sys_esco_occupation_mappings_esco_uri_idx
  ON sys.sys_esco_occupation_mappings (esco_occupation_mapping_esco_uri);

CREATE INDEX IF NOT EXISTS sys_esco_occupation_mappings_isco_idx
  ON sys.sys_esco_occupation_mappings (esco_occupation_mapping_isco_code)
  WHERE esco_occupation_mapping_isco_code IS NOT NULL;
