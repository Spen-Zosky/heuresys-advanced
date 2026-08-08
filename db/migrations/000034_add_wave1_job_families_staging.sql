-- @migrate: once
-- #164 F4 — crea una tabella con chiave esterna verso brownfield.import_runs. Lo schema `brownfield` e le tabelle `audit.import_*`
-- sono ritirati dalla 000297; senza il marcatore questo file cadrebbe (o li
-- ricreerebbe) a ogni deploy. Su un database nuovo gira comunque: il registro
-- e' vuoto e nulla viene saltato.
-- =============================================================================
-- 000034_add_wave1_job_families_staging.sql
-- Heuresys Advanced — Batch X1 Class B fix: bootstrap sys_job_families cascade root.
-- -----------------------------------------------------------------------------
-- Adds the 18th wave1 staging table: staging.wave1_job_families, mirroring the
-- pattern of migration 000030 (uniform jsonb-buffer with run_id FK + validation
-- status + lineage metadata).
--
-- Context: sys_job_families was a true source-gap (Class D root cause) blocking
-- the cascade for sys_job_roles, sys_esco_occupation_mappings, and
-- sys_position_skill_requirements. Diagnostic:
-- cowork_reserved/batch_c1/class_b_diagnostics/sys_job_families.md
--
-- Idempotent: every CREATE uses IF NOT EXISTS; constraints are dropped + re-added.
-- =============================================================================

DO $$
DECLARE
  staging_table text := 'wave1_job_families';
  target_table  text := 'job_families';
BEGIN
  -- 1. Table
  EXECUTE format($f$
    CREATE TABLE IF NOT EXISTS staging.%I (
      staging_row_id              uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
      staging_import_run_id       uuid         NOT NULL REFERENCES brownfield.import_runs(import_run_id) ON DELETE CASCADE,
      staging_source_table        varchar(255) NOT NULL,
      staging_source_record_id    varchar(255) NOT NULL,
      staging_source_natural_key  varchar(512),
      staging_source_content_hash char(64),
      staging_raw_record          jsonb        NOT NULL,
      staging_validation_status   varchar(32)  NOT NULL DEFAULT 'PENDING',
      staging_validation_errors   jsonb        NOT NULL DEFAULT '[]'::jsonb,
      staging_mapping_confidence  numeric(4,3) NOT NULL DEFAULT 1.000,
      staging_target_record_id    uuid,
      staging_upserted_at         timestamptz,
      created_at                  timestamptz  NOT NULL DEFAULT now()
    )
  $f$, staging_table);

  -- 2. Validation status CHECK
  EXECUTE format($f$
    ALTER TABLE staging.%I DROP CONSTRAINT IF EXISTS chk_validation_status
  $f$, staging_table);
  EXECUTE format($f$
    ALTER TABLE staging.%I
      ADD CONSTRAINT chk_validation_status
      CHECK (staging_validation_status IN ('PENDING','PASSED','FAILED','SKIPPED'))
  $f$, staging_table);

  -- 3. Confidence range CHECK
  EXECUTE format($f$
    ALTER TABLE staging.%I DROP CONSTRAINT IF EXISTS chk_mapping_confidence
  $f$, staging_table);
  EXECUTE format($f$
    ALTER TABLE staging.%I
      ADD CONSTRAINT chk_mapping_confidence
      CHECK (staging_mapping_confidence >= 0.000 AND staging_mapping_confidence <= 1.000)
  $f$, staging_table);

  -- 4. Run + status index
  EXECUTE format($f$
    CREATE INDEX IF NOT EXISTS %I
      ON staging.%I (staging_import_run_id, staging_validation_status)
  $f$, staging_table || '_run_status_idx', staging_table);

  -- 5. Unique key per (run, source_table, source_record_id)
  EXECUTE format($f$
    CREATE UNIQUE INDEX IF NOT EXISTS %I
      ON staging.%I (staging_import_run_id, staging_source_table, staging_source_record_id)
  $f$, staging_table || '_run_src_uq', staging_table);

  -- 6. Natural key index
  EXECUTE format($f$
    CREATE INDEX IF NOT EXISTS %I
      ON staging.%I (staging_source_natural_key)
      WHERE staging_source_natural_key IS NOT NULL
  $f$, staging_table || '_natkey_idx', staging_table);

  -- 7. Comment
  EXECUTE format($f$
    COMMENT ON TABLE staging.%I IS
      'Brownfield Wave 1 staging buffer for canonical target sys.sys_%I. Bootstrapped in batch X1 (was a source-gap blocking sys_job_families cascade root). TRUNCATE between runs.'
  $f$, staging_table, target_table);
END
$$;
