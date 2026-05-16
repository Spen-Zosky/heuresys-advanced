-- =============================================================================
-- 000002_init_sys_schema.sql
-- Heuresys Advanced — canonical + auxiliary schemas, audit table, shared trigger fn
-- -----------------------------------------------------------------------------
-- Creates the canonical `sys` schema and the three auxiliary schemas
-- (staging, brownfield, audit). Defines the migration audit table
-- `sys.sys_schema_migrations` and the shared trigger function
-- `sys.sys_set_updated_at()` reused by every table with `updated_at`.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Schemas (idempotent; redundant with create_local_database / setup_oci_vm
-- but kept here for the case where the DB was pre-created manually)
-- -----------------------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS sys;
CREATE SCHEMA IF NOT EXISTS staging;
CREATE SCHEMA IF NOT EXISTS brownfield;
CREATE SCHEMA IF NOT EXISTS audit;

-- -----------------------------------------------------------------------------
-- Shared trigger function — sys.sys_set_updated_at()
-- Used by every canonical table to keep `updated_at` fresh on UPDATE.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION sys.sys_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $func$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$func$;

-- -----------------------------------------------------------------------------
-- Migration audit table — sys.sys_schema_migrations
-- One row per migration file. Upserted by migrate.{ps1,sh}.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sys.sys_schema_migrations (
  migration_id  serial       PRIMARY KEY,
  file_name     varchar(255) NOT NULL,
  sha256        char(64)     NOT NULL,
  applied_at    timestamptz  NOT NULL DEFAULT now(),
  applied_by    varchar(128) NOT NULL DEFAULT current_user,
  duration_ms   integer
);

CREATE UNIQUE INDEX IF NOT EXISTS sys_schema_migrations_file_name_uq
  ON sys.sys_schema_migrations (file_name);

CREATE INDEX IF NOT EXISTS sys_schema_migrations_applied_at_idx
  ON sys.sys_schema_migrations (applied_at);
