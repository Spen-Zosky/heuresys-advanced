-- =============================================================================
-- 000007_enterprise_typing.sql
-- Heuresys Advanced — enterprise typing model (5 tables)
-- -----------------------------------------------------------------------------
-- Per TARGET_SCHEMA_DESIGN §2.1.
-- Tables: activity_classifications (ATECO 2025 + NACE Rev. 2.1 catalog),
-- activity_classification_mappings (ATECO ↔ NACE cross-mappings),
-- enterprise_typing_profiles (per-tenant typing result),
-- enterprise_size_bands (XS..XL band thresholds),
-- operating_model_catalog (RETAIL/WHOLESALE/MIXED/...).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. sys.sys_activity_classifications — ATECO 2025 + NACE Rev. 2.1 catalog
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sys.sys_activity_classifications (
  activity_classification_id          uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_classification_scheme      varchar(32)  NOT NULL,
  activity_classification_code        varchar(32)  NOT NULL,
  activity_classification_parent_code varchar(32),
  activity_classification_name        varchar(255) NOT NULL,
  activity_classification_description text,
  activity_classification_level       smallint,
  activity_classification_metadata    jsonb        NOT NULL DEFAULT '{}'::jsonb,
  created_at                          timestamptz  NOT NULL DEFAULT now(),
  updated_at                          timestamptz  NOT NULL DEFAULT now()
);

-- Bootstrap baseline whitelist, GUARDED so a full re-run does NOT clobber the
-- relaxed constraint set by migration 000032 (ATECO/NACE base versions loaded at
-- runtime by the brownfield wave). On a fresh DB the constraint is absent and the
-- table is empty here, so the strict 4-value baseline applies; 000032 later relaxes it.
-- Without this guard, an unconditional DROP+ADD re-asserted the strict CHECK on a
-- re-run once ATECO/NACE rows existed and aborted the chain with "violated by some row".
DO $scheme_check$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname  = 'sys_activity_classifications_scheme_check'
      AND conrelid = 'sys.sys_activity_classifications'::regclass
  ) THEN
    ALTER TABLE sys.sys_activity_classifications
      ADD CONSTRAINT sys_activity_classifications_scheme_check
      CHECK (activity_classification_scheme IN ('ATECO_2025', 'NACE_REV_2_1', 'ATECO_2007', 'NACE_REV_2'));
  END IF;
END $scheme_check$;

CREATE UNIQUE INDEX IF NOT EXISTS sys_activity_classifications_scheme_code_uq
  ON sys.sys_activity_classifications (activity_classification_scheme, activity_classification_code);

CREATE INDEX IF NOT EXISTS sys_activity_classifications_parent_idx
  ON sys.sys_activity_classifications (activity_classification_scheme, activity_classification_parent_code)
  WHERE activity_classification_parent_code IS NOT NULL;

DO $trg$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'sys_activity_classifications_set_updated_at' AND tgrelid = 'sys.sys_activity_classifications'::regclass) THEN
    CREATE TRIGGER sys_activity_classifications_set_updated_at BEFORE UPDATE ON sys.sys_activity_classifications FOR EACH ROW EXECUTE FUNCTION sys.sys_set_updated_at();
  END IF;
END $trg$;

-- -----------------------------------------------------------------------------
-- 2. sys.sys_activity_classification_mappings — cross-scheme mappings
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sys.sys_activity_classification_mappings (
  activity_class_mapping_id           uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_class_mapping_source_id    uuid         NOT NULL REFERENCES sys.sys_activity_classifications(activity_classification_id) ON DELETE CASCADE,
  activity_class_mapping_target_id    uuid         NOT NULL REFERENCES sys.sys_activity_classifications(activity_classification_id) ON DELETE CASCADE,
  activity_class_mapping_kind         varchar(32)  NOT NULL DEFAULT 'EXACT',
  activity_class_mapping_confidence   numeric(4,3) NOT NULL DEFAULT 1.000,
  activity_class_mapping_metadata     jsonb        NOT NULL DEFAULT '{}'::jsonb,
  created_at                          timestamptz  NOT NULL DEFAULT now(),
  updated_at                          timestamptz  NOT NULL DEFAULT now()
);

ALTER TABLE sys.sys_activity_classification_mappings
  DROP CONSTRAINT IF EXISTS sys_activity_class_mapping_kind_check;
ALTER TABLE sys.sys_activity_classification_mappings
  ADD CONSTRAINT sys_activity_class_mapping_kind_check
  CHECK (activity_class_mapping_kind IN ('EXACT', 'NARROWER', 'BROADER', 'RELATED', 'APPROXIMATE'));

CREATE UNIQUE INDEX IF NOT EXISTS sys_activity_class_mapping_pair_uq
  ON sys.sys_activity_classification_mappings (activity_class_mapping_source_id, activity_class_mapping_target_id);

-- -----------------------------------------------------------------------------
-- 3. sys.sys_enterprise_size_bands — XS..XL thresholds
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sys.sys_enterprise_size_bands (
  enterprise_size_band_id              uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  enterprise_size_band_code            varchar(32)  NOT NULL,
  enterprise_size_band_name            varchar(128) NOT NULL,
  enterprise_size_band_min_employees   integer,
  enterprise_size_band_max_employees   integer,
  enterprise_size_band_min_revenue_eur numeric(18,2),
  enterprise_size_band_max_revenue_eur numeric(18,2),
  enterprise_size_band_description     text,
  enterprise_size_band_metadata        jsonb        NOT NULL DEFAULT '{}'::jsonb,
  created_at                           timestamptz  NOT NULL DEFAULT now(),
  updated_at                           timestamptz  NOT NULL DEFAULT now()
);

ALTER TABLE sys.sys_enterprise_size_bands
  DROP CONSTRAINT IF EXISTS sys_enterprise_size_band_code_check;
ALTER TABLE sys.sys_enterprise_size_bands
  ADD CONSTRAINT sys_enterprise_size_band_code_check
  CHECK (enterprise_size_band_code IN ('XS', 'S', 'M', 'L', 'XL'));

CREATE UNIQUE INDEX IF NOT EXISTS sys_enterprise_size_bands_code_uq
  ON sys.sys_enterprise_size_bands (enterprise_size_band_code);

-- -----------------------------------------------------------------------------
-- 4. sys.sys_operating_model_catalog — RETAIL/WHOLESALE/MIXED/...
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sys.sys_operating_model_catalog (
  operating_model_id          uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  operating_model_code        varchar(64)  NOT NULL,
  operating_model_name        varchar(128) NOT NULL,
  operating_model_description text,
  operating_model_metadata    jsonb        NOT NULL DEFAULT '{}'::jsonb,
  created_at                  timestamptz  NOT NULL DEFAULT now(),
  updated_at                  timestamptz  NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS sys_operating_model_code_uq
  ON sys.sys_operating_model_catalog (operating_model_code);

-- -----------------------------------------------------------------------------
-- 5. sys.sys_enterprise_typing_profiles — per-tenant typing result
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sys.sys_enterprise_typing_profiles (
  enterprise_typing_profile_id          uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  enterprise_typing_tenant_id           uuid         NOT NULL REFERENCES sys.sys_tenancies(tenant_id) ON DELETE CASCADE,
  enterprise_typing_industry_class_id   uuid         REFERENCES sys.sys_activity_classifications(activity_classification_id) ON DELETE SET NULL,
  enterprise_typing_size_band_id        uuid         REFERENCES sys.sys_enterprise_size_bands(enterprise_size_band_id) ON DELETE SET NULL,
  enterprise_typing_operating_model_id  uuid         REFERENCES sys.sys_operating_model_catalog(operating_model_id) ON DELETE SET NULL,
  enterprise_typing_regulatory_intensity varchar(32) NOT NULL DEFAULT 'MEDIUM',
  enterprise_typing_employee_count      integer,
  enterprise_typing_revenue_eur         numeric(18,2),
  enterprise_typing_country_code        char(2),
  enterprise_typing_assessed_at         timestamptz  NOT NULL DEFAULT now(),
  enterprise_typing_metadata            jsonb        NOT NULL DEFAULT '{}'::jsonb,
  created_at                            timestamptz  NOT NULL DEFAULT now(),
  created_by                            uuid         REFERENCES sys.sys_users(user_id) ON DELETE SET NULL,
  updated_at                            timestamptz  NOT NULL DEFAULT now(),
  updated_by                            uuid         REFERENCES sys.sys_users(user_id) ON DELETE SET NULL
);

ALTER TABLE sys.sys_enterprise_typing_profiles
  DROP CONSTRAINT IF EXISTS sys_enterprise_typing_regulatory_intensity_check;
ALTER TABLE sys.sys_enterprise_typing_profiles
  ADD CONSTRAINT sys_enterprise_typing_regulatory_intensity_check
  CHECK (enterprise_typing_regulatory_intensity IN ('LOW', 'MEDIUM', 'HIGH', 'EXTREME'));

CREATE UNIQUE INDEX IF NOT EXISTS sys_enterprise_typing_tenant_uq
  ON sys.sys_enterprise_typing_profiles (enterprise_typing_tenant_id);

DO $trg$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'sys_enterprise_typing_set_updated_at' AND tgrelid = 'sys.sys_enterprise_typing_profiles'::regclass) THEN
    CREATE TRIGGER sys_enterprise_typing_set_updated_at BEFORE UPDATE ON sys.sys_enterprise_typing_profiles FOR EACH ROW EXECUTE FUNCTION sys.sys_set_updated_at();
  END IF;
END $trg$;
