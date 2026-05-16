-- =============================================================================
-- 000008_blueprint_catalog.sql
-- Heuresys Advanced — blueprint catalog (5 tables)
-- -----------------------------------------------------------------------------
-- Per TARGET_SCHEMA_DESIGN §2.2.
-- Industry blueprint families (FIN_BANKING, RETAIL_FOOD, MANUFACTURING, …),
-- variants per family, process registry, per-tenant activation, overrides.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. sys.sys_blueprint_families
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sys.sys_blueprint_families (
  blueprint_family_id          uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_family_code        varchar(64)  NOT NULL,
  blueprint_family_name        varchar(128) NOT NULL,
  blueprint_family_description text,
  blueprint_family_metadata    jsonb        NOT NULL DEFAULT '{}'::jsonb,
  created_at                   timestamptz  NOT NULL DEFAULT now(),
  updated_at                   timestamptz  NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS sys_blueprint_families_code_uq
  ON sys.sys_blueprint_families (blueprint_family_code);

-- -----------------------------------------------------------------------------
-- 2. sys.sys_blueprint_variants
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sys.sys_blueprint_variants (
  blueprint_variant_id           uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_variant_family_id    uuid         NOT NULL REFERENCES sys.sys_blueprint_families(blueprint_family_id) ON DELETE CASCADE,
  blueprint_variant_code         varchar(128) NOT NULL,
  blueprint_variant_name         varchar(255) NOT NULL,
  blueprint_variant_description  text,
  blueprint_variant_size_band_id uuid         REFERENCES sys.sys_enterprise_size_bands(enterprise_size_band_id) ON DELETE SET NULL,
  blueprint_variant_metadata     jsonb        NOT NULL DEFAULT '{}'::jsonb,
  created_at                     timestamptz  NOT NULL DEFAULT now(),
  updated_at                     timestamptz  NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS sys_blueprint_variants_code_uq
  ON sys.sys_blueprint_variants (blueprint_variant_code);

CREATE INDEX IF NOT EXISTS sys_blueprint_variants_family_idx
  ON sys.sys_blueprint_variants (blueprint_variant_family_id);

-- -----------------------------------------------------------------------------
-- 3. sys.sys_blueprint_process_registry
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sys.sys_blueprint_process_registry (
  blueprint_process_id           uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_process_variant_id   uuid         NOT NULL REFERENCES sys.sys_blueprint_variants(blueprint_variant_id) ON DELETE CASCADE,
  blueprint_process_code         varchar(64)  NOT NULL,
  blueprint_process_name         varchar(255) NOT NULL,
  blueprint_process_ordinal      smallint     NOT NULL,
  blueprint_process_description  text,
  blueprint_process_is_optional  boolean      NOT NULL DEFAULT false,
  blueprint_process_metadata     jsonb        NOT NULL DEFAULT '{}'::jsonb,
  created_at                     timestamptz  NOT NULL DEFAULT now(),
  updated_at                     timestamptz  NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS sys_blueprint_process_registry_variant_code_uq
  ON sys.sys_blueprint_process_registry (blueprint_process_variant_id, blueprint_process_code);

CREATE INDEX IF NOT EXISTS sys_blueprint_process_registry_variant_idx
  ON sys.sys_blueprint_process_registry (blueprint_process_variant_id, blueprint_process_ordinal);

-- -----------------------------------------------------------------------------
-- 4. sys.sys_blueprint_activations
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sys.sys_blueprint_activations (
  blueprint_activation_id          uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_activation_tenant_id   uuid         NOT NULL REFERENCES sys.sys_tenancies(tenant_id) ON DELETE CASCADE,
  blueprint_activation_variant_id  uuid         NOT NULL REFERENCES sys.sys_blueprint_variants(blueprint_variant_id) ON DELETE RESTRICT,
  blueprint_activation_status      varchar(32)  NOT NULL DEFAULT 'ACTIVE',
  blueprint_activation_effective_from date      NOT NULL DEFAULT current_date,
  blueprint_activation_effective_to   date,
  blueprint_activation_metadata    jsonb        NOT NULL DEFAULT '{}'::jsonb,
  created_at                       timestamptz  NOT NULL DEFAULT now(),
  created_by                       uuid         REFERENCES sys.sys_users(user_id) ON DELETE SET NULL,
  updated_at                       timestamptz  NOT NULL DEFAULT now(),
  updated_by                       uuid         REFERENCES sys.sys_users(user_id) ON DELETE SET NULL
);

ALTER TABLE sys.sys_blueprint_activations
  DROP CONSTRAINT IF EXISTS sys_blueprint_activation_status_check;
ALTER TABLE sys.sys_blueprint_activations
  ADD CONSTRAINT sys_blueprint_activation_status_check
  CHECK (blueprint_activation_status IN ('PROPOSED', 'ACTIVE', 'SUSPENDED', 'RETIRED'));

CREATE UNIQUE INDEX IF NOT EXISTS sys_blueprint_activations_one_active_per_tenant
  ON sys.sys_blueprint_activations (blueprint_activation_tenant_id)
  WHERE blueprint_activation_status = 'ACTIVE';

CREATE INDEX IF NOT EXISTS sys_blueprint_activations_variant_idx
  ON sys.sys_blueprint_activations (blueprint_activation_variant_id);

DO $trg$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'sys_blueprint_activations_set_updated_at' AND tgrelid = 'sys.sys_blueprint_activations'::regclass) THEN
    CREATE TRIGGER sys_blueprint_activations_set_updated_at BEFORE UPDATE ON sys.sys_blueprint_activations FOR EACH ROW EXECUTE FUNCTION sys.sys_set_updated_at();
  END IF;
END $trg$;

-- -----------------------------------------------------------------------------
-- 5. sys.sys_blueprint_overrides
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sys.sys_blueprint_overrides (
  blueprint_override_id              uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  blueprint_override_activation_id   uuid         NOT NULL REFERENCES sys.sys_blueprint_activations(blueprint_activation_id) ON DELETE CASCADE,
  blueprint_override_process_id      uuid         NOT NULL REFERENCES sys.sys_blueprint_process_registry(blueprint_process_id) ON DELETE CASCADE,
  blueprint_override_inclusion       varchar(32)  NOT NULL DEFAULT 'IN',
  blueprint_override_rationale       text,
  blueprint_override_metadata        jsonb        NOT NULL DEFAULT '{}'::jsonb,
  created_at                         timestamptz  NOT NULL DEFAULT now(),
  created_by                         uuid         REFERENCES sys.sys_users(user_id) ON DELETE SET NULL,
  updated_at                         timestamptz  NOT NULL DEFAULT now(),
  updated_by                         uuid         REFERENCES sys.sys_users(user_id) ON DELETE SET NULL
);

ALTER TABLE sys.sys_blueprint_overrides
  DROP CONSTRAINT IF EXISTS sys_blueprint_override_inclusion_check;
ALTER TABLE sys.sys_blueprint_overrides
  ADD CONSTRAINT sys_blueprint_override_inclusion_check
  CHECK (blueprint_override_inclusion IN ('IN', 'PARTIAL', 'OUT'));

CREATE UNIQUE INDEX IF NOT EXISTS sys_blueprint_overrides_activation_process_uq
  ON sys.sys_blueprint_overrides (blueprint_override_activation_id, blueprint_override_process_id);

DO $trg$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'sys_blueprint_overrides_set_updated_at' AND tgrelid = 'sys.sys_blueprint_overrides'::regclass) THEN
    CREATE TRIGGER sys_blueprint_overrides_set_updated_at BEFORE UPDATE ON sys.sys_blueprint_overrides FOR EACH ROW EXECUTE FUNCTION sys.sys_set_updated_at();
  END IF;
END $trg$;
