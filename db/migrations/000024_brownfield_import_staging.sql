-- =============================================================================
-- 000024_brownfield_import_staging.sql
-- Heuresys Advanced — brownfield staging schema tables (operational)
-- -----------------------------------------------------------------------------
-- Per TARGET_SCHEMA_DESIGN §13.
-- These tables live in the `brownfield` and `audit` auxiliary schemas —
-- NEVER in sys (canonical). Used by brownfield wave runs post-MVP to
-- import legacy heuresys_platform data.
-- =============================================================================

CREATE TABLE IF NOT EXISTS brownfield.source_exports (
  source_export_id          uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  source_export_name        varchar(255) NOT NULL,
  source_export_file_hash   char(64),
  source_export_retrieved_at timestamptz NOT NULL DEFAULT now(),
  source_export_size_bytes  bigint,
  source_export_status      varchar(32)  NOT NULL DEFAULT 'AVAILABLE',
  source_export_metadata    jsonb        NOT NULL DEFAULT '{}'::jsonb,
  created_at                timestamptz  NOT NULL DEFAULT now()
);

ALTER TABLE brownfield.source_exports
  DROP CONSTRAINT IF EXISTS brownfield_source_export_status_check;
ALTER TABLE brownfield.source_exports
  ADD CONSTRAINT brownfield_source_export_status_check
  CHECK (source_export_status IN ('AVAILABLE', 'INGESTED', 'ARCHIVED', 'CORRUPTED'));

CREATE UNIQUE INDEX IF NOT EXISTS brownfield_source_exports_name_uq
  ON brownfield.source_exports (source_export_name);

CREATE TABLE IF NOT EXISTS brownfield.source_tables (
  source_table_id          uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  source_table_export_id   uuid         NOT NULL REFERENCES brownfield.source_exports(source_export_id) ON DELETE CASCADE,
  source_table_schema      varchar(64),
  source_table_name        varchar(255) NOT NULL,
  source_table_rls_enabled boolean      NOT NULL DEFAULT false,
  source_table_row_estimate bigint,
  source_table_domain      varchar(64),
  source_table_classification varchar(32),
  source_table_metadata    jsonb        NOT NULL DEFAULT '{}'::jsonb,
  created_at               timestamptz  NOT NULL DEFAULT now()
);

ALTER TABLE brownfield.source_tables
  DROP CONSTRAINT IF EXISTS brownfield_source_table_classification_check;
ALTER TABLE brownfield.source_tables
  ADD CONSTRAINT brownfield_source_table_classification_check
  CHECK (source_table_classification IS NULL OR source_table_classification IN
    ('IMPORT', 'TRANSFORM', 'REFERENCE_ONLY', 'EXCLUDE'));

CREATE UNIQUE INDEX IF NOT EXISTS brownfield_source_tables_export_schema_name_uq
  ON brownfield.source_tables (source_table_export_id, COALESCE(source_table_schema, ''), source_table_name);

CREATE INDEX IF NOT EXISTS brownfield_source_tables_domain_idx
  ON brownfield.source_tables (source_table_domain);

CREATE TABLE IF NOT EXISTS brownfield.source_columns (
  source_column_id          uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  source_column_table_id    uuid         NOT NULL REFERENCES brownfield.source_tables(source_table_id) ON DELETE CASCADE,
  source_column_name        varchar(255) NOT NULL,
  source_column_data_type   varchar(128) NOT NULL,
  source_column_is_nullable boolean      NOT NULL DEFAULT true,
  source_column_comment     text,
  source_column_pii_flag    boolean      NOT NULL DEFAULT false,
  source_column_metadata    jsonb        NOT NULL DEFAULT '{}'::jsonb,
  created_at                timestamptz  NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS brownfield_source_columns_table_name_uq
  ON brownfield.source_columns (source_column_table_id, source_column_name);

CREATE TABLE IF NOT EXISTS brownfield.import_runs (
  import_run_id            uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  import_run_export_id     uuid         REFERENCES brownfield.source_exports(source_export_id) ON DELETE SET NULL,
  import_run_wave          smallint,
  import_run_classification_scope varchar(32),
  import_run_started_at    timestamptz  NOT NULL DEFAULT now(),
  import_run_finished_at   timestamptz,
  import_run_status        varchar(32)  NOT NULL DEFAULT 'RUNNING',
  import_run_initiated_by  uuid         REFERENCES sys.sys_users(user_id) ON DELETE SET NULL,
  import_run_metadata      jsonb        NOT NULL DEFAULT '{}'::jsonb,
  created_at               timestamptz  NOT NULL DEFAULT now()
);

ALTER TABLE brownfield.import_runs
  DROP CONSTRAINT IF EXISTS brownfield_import_run_status_check;
ALTER TABLE brownfield.import_runs
  ADD CONSTRAINT brownfield_import_run_status_check
  CHECK (import_run_status IN ('RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED', 'AWAITING_APPROVAL'));

ALTER TABLE brownfield.import_runs
  DROP CONSTRAINT IF EXISTS brownfield_import_run_wave_check;
ALTER TABLE brownfield.import_runs
  ADD CONSTRAINT brownfield_import_run_wave_check
  CHECK (import_run_wave IS NULL OR import_run_wave BETWEEN 1 AND 4);

CREATE INDEX IF NOT EXISTS brownfield_import_runs_status_started_idx
  ON brownfield.import_runs (import_run_status, import_run_started_at DESC);

-- -----------------------------------------------------------------------------
-- audit.import_run_logs — operational logs (errors, warnings, counts)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit.import_run_logs (
  import_run_log_id        uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  import_run_log_run_id    uuid         NOT NULL REFERENCES brownfield.import_runs(import_run_id) ON DELETE CASCADE,
  import_run_log_level     varchar(16)  NOT NULL,
  import_run_log_message   text         NOT NULL,
  import_run_log_payload   jsonb        NOT NULL DEFAULT '{}'::jsonb,
  created_at               timestamptz  NOT NULL DEFAULT now()
);

ALTER TABLE audit.import_run_logs
  DROP CONSTRAINT IF EXISTS audit_import_run_log_level_check;
ALTER TABLE audit.import_run_logs
  ADD CONSTRAINT audit_import_run_log_level_check
  CHECK (import_run_log_level IN ('DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL'));

CREATE INDEX IF NOT EXISTS audit_import_run_logs_run_level_idx
  ON audit.import_run_logs (import_run_log_run_id, import_run_log_level, created_at DESC);
