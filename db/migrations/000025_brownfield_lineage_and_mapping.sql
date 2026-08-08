-- @migrate: once
-- #164 F4 — questo file CREA oggetti dello schema `brownfield`, ritirato dalla
-- 000297. Senza il marcatore la catena lo ricreerebbe a ogni deploy e il ritiro
-- oscillerebbe (ADR-0035). Su un database nuovo gira comunque: il registro e' vuoto.
-- =============================================================================
-- 000025_brownfield_lineage_and_mapping.sql
-- Heuresys Advanced — brownfield mappings + canonical lineage
-- -----------------------------------------------------------------------------
-- Per TARGET_SCHEMA_DESIGN §13.
-- - brownfield.table_mappings + column_mappings: approved source→target
--   mappings before canonical upsert.
-- - sys.sys_source_lineage_records: CANONICAL lineage row, one per brownfield-
--   sourced canonical record. Polymorphic target via (target_table_name,
--   target_record_id). Per invariant I12 every brownfield import must
--   leave a lineage trail.
-- =============================================================================

CREATE TABLE IF NOT EXISTS brownfield.table_mappings (
  table_mapping_id          uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  table_mapping_run_id      uuid         REFERENCES brownfield.import_runs(import_run_id) ON DELETE SET NULL,
  table_mapping_source_table_id uuid     NOT NULL REFERENCES brownfield.source_tables(source_table_id) ON DELETE CASCADE,
  table_mapping_target_schema varchar(64) NOT NULL,
  table_mapping_target_table  varchar(255) NOT NULL,
  table_mapping_classification varchar(32) NOT NULL,
  table_mapping_approval_status varchar(32) NOT NULL DEFAULT 'PROPOSED',
  table_mapping_approved_by   uuid       REFERENCES sys.sys_users(user_id) ON DELETE SET NULL,
  table_mapping_approved_at   timestamptz,
  table_mapping_rationale     text,
  table_mapping_metadata      jsonb      NOT NULL DEFAULT '{}'::jsonb,
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE brownfield.table_mappings
  DROP CONSTRAINT IF EXISTS brownfield_table_mapping_classification_check;
ALTER TABLE brownfield.table_mappings
  ADD CONSTRAINT brownfield_table_mapping_classification_check
  CHECK (table_mapping_classification IN ('IMPORT', 'TRANSFORM', 'REFERENCE_ONLY', 'EXCLUDE'));

ALTER TABLE brownfield.table_mappings
  DROP CONSTRAINT IF EXISTS brownfield_table_mapping_approval_status_check;
ALTER TABLE brownfield.table_mappings
  ADD CONSTRAINT brownfield_table_mapping_approval_status_check
  CHECK (table_mapping_approval_status IN ('PROPOSED', 'APPROVED', 'REJECTED', 'NEEDS_CHANGES'));

CREATE UNIQUE INDEX IF NOT EXISTS brownfield_table_mappings_source_target_uq
  ON brownfield.table_mappings (table_mapping_source_table_id, table_mapping_target_schema, table_mapping_target_table);

CREATE INDEX IF NOT EXISTS brownfield_table_mappings_run_idx
  ON brownfield.table_mappings (table_mapping_run_id)
  WHERE table_mapping_run_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS brownfield.column_mappings (
  column_mapping_id           uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  column_mapping_table_mapping_id uuid    NOT NULL REFERENCES brownfield.table_mappings(table_mapping_id) ON DELETE CASCADE,
  column_mapping_source_column_id uuid    NOT NULL REFERENCES brownfield.source_columns(source_column_id) ON DELETE CASCADE,
  column_mapping_target_column varchar(255) NOT NULL,
  column_mapping_transform     varchar(64),
  column_mapping_transform_payload jsonb  NOT NULL DEFAULT '{}'::jsonb,
  column_mapping_pii_disposition varchar(32) NOT NULL DEFAULT 'NONE',
  column_mapping_metadata     jsonb       NOT NULL DEFAULT '{}'::jsonb,
  created_at                  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE brownfield.column_mappings
  DROP CONSTRAINT IF EXISTS brownfield_column_mapping_pii_disposition_check;
ALTER TABLE brownfield.column_mappings
  ADD CONSTRAINT brownfield_column_mapping_pii_disposition_check
  CHECK (column_mapping_pii_disposition IN ('NONE', 'PSEUDONYMIZE', 'MASK', 'DROP', 'TAG_SYNTHETIC'));

CREATE UNIQUE INDEX IF NOT EXISTS brownfield_column_mappings_pair_uq
  ON brownfield.column_mappings (column_mapping_table_mapping_id, column_mapping_source_column_id);

-- -----------------------------------------------------------------------------
-- sys.sys_source_lineage_records — CANONICAL lineage (only sys table in this migration)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sys.sys_source_lineage_records (
  source_lineage_record_id        uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  source_lineage_tenant_id        uuid         NOT NULL REFERENCES sys.sys_tenancies(tenant_id) ON DELETE CASCADE,
  source_lineage_source_system    varchar(64)  NOT NULL DEFAULT 'OLDDB',
  source_lineage_source_table     varchar(255) NOT NULL,
  source_lineage_source_record_id varchar(255) NOT NULL,
  source_lineage_source_natural_key varchar(512),
  source_lineage_source_content_hash char(64),
  source_lineage_import_run_id    uuid         REFERENCES brownfield.import_runs(import_run_id) ON DELETE SET NULL,
  source_lineage_table_mapping_id uuid         REFERENCES brownfield.table_mappings(table_mapping_id) ON DELETE SET NULL,
  source_lineage_target_table_name varchar(255) NOT NULL,
  source_lineage_target_record_id uuid         NOT NULL,
  source_lineage_mapping_confidence numeric(4,3) NOT NULL DEFAULT 1.000,
  source_lineage_validation_status varchar(32) NOT NULL DEFAULT 'VALID',
  source_lineage_metadata         jsonb        NOT NULL DEFAULT '{}'::jsonb,
  created_at                      timestamptz  NOT NULL DEFAULT now()
);

ALTER TABLE sys.sys_source_lineage_records
  DROP CONSTRAINT IF EXISTS sys_source_lineage_validation_status_check;
ALTER TABLE sys.sys_source_lineage_records
  ADD CONSTRAINT sys_source_lineage_validation_status_check
  CHECK (source_lineage_validation_status IN ('VALID', 'STALE', 'CONFLICTED', 'REJECTED'));

CREATE UNIQUE INDEX IF NOT EXISTS sys_source_lineage_records_source_uq
  ON sys.sys_source_lineage_records (source_lineage_source_system, source_lineage_source_table, source_lineage_source_record_id, source_lineage_target_table_name);

CREATE INDEX IF NOT EXISTS sys_source_lineage_records_target_idx
  ON sys.sys_source_lineage_records (source_lineage_target_table_name, source_lineage_target_record_id);

CREATE INDEX IF NOT EXISTS sys_source_lineage_records_natural_key_idx
  ON sys.sys_source_lineage_records (source_lineage_source_natural_key)
  WHERE source_lineage_source_natural_key IS NOT NULL;
