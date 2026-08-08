-- @migrate: once
-- #164 F4 — staging wave1 costruito sopra brownfield.column_mappings. Lo schema `brownfield` e le tabelle `audit.import_*`
-- sono ritirati dalla 000297; senza il marcatore questo file cadrebbe (o li
-- ricreerebbe) a ogni deploy. Su un database nuovo gira comunque: il registro
-- e' vuoto e nulla viene saltato.
-- =============================================================================
-- 000030_brownfield_wave1_staging.sql
-- Heuresys Advanced — Brownfield Wave 1 staging buffer tables (MVP-3 Tappa D).
-- -----------------------------------------------------------------------------
-- Creates 17 staging tables under the `staging` schema, one per Wave 1 canonical
-- target. Each staging table is a uniform jsonb-buffer holding the raw source
-- row plus validation/lineage metadata. The pattern is intentionally uniform
-- (not per-target schema mirroring) so the wave executor can iterate generically
-- using brownfield.column_mappings as transformation config.
--
-- Lifecycle:
--   1. Wave executor loads legacy rows from db/seeds/brownfield/wave1/legacy_data/
--      into the relevant staging.wave1_<target> table (1 row = 1 staging_raw_record
--      jsonb + provenance metadata).
--   2. Validation engine populates staging_validation_status + staging_validation_errors.
--   3. Approval gate (auto-approve for wave 1) flips PENDING → PASSED.
--   4. Upsert engine reads brownfield.column_mappings, applies transformations to
--      staging_raw_record, and INSERTs into sys.sys_<target> with idempotent
--      ON CONFLICT on the natural key, then writes the resulting target uuid
--      back to staging_target_record_id and creates a sys_source_lineage_records row.
--   5. audit.import_validation_results + audit.import_approval_decisions accumulate
--      per-row outcomes.
--
-- TRUNCATE policy: staging.wave1_<target> may be TRUNCATEd between runs; the
-- run id FK to brownfield.import_runs ensures isolation across waves.
--
-- Idempotent: every CREATE uses IF NOT EXISTS; every constraint is dropped and
-- re-added so re-running the migration is a no-op when the shape is current.
-- =============================================================================

CREATE SCHEMA IF NOT EXISTS staging;

DO $$
DECLARE
  target_table text;
  staging_table text;
  wave1_targets text[] := ARRAY[
    'skills',
    'skill_families',
    'skill_categories',
    'skill_taxonomy_edges',
    'skill_aliases',
    'learning_modules',
    'learning_paths',
    'learning_path_steps',
    'skill_learning_mappings',
    'user_certifications',
    'esco_occupation_mappings',
    'activity_classifications',
    'activity_classification_mappings',
    'compensation_bands',
    'process_kpi_templates',
    'blueprint_process_registry',
    'job_roles'
  ];
BEGIN
  FOREACH target_table IN ARRAY wave1_targets LOOP
    staging_table := 'wave1_' || target_table;

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
    -- Constraint name is per-table-scoped so a compact local name is safe
    -- and avoids the 63-char identifier truncation on the longer table names.
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

    -- 4. Run + status index for executor sweeps
    EXECUTE format($f$
      CREATE INDEX IF NOT EXISTS %I
        ON staging.%I (staging_import_run_id, staging_validation_status)
    $f$, staging_table || '_run_status_idx', staging_table);

    -- 5. Unique key per (run, source_table, source_record_id) — prevents
    --    duplicate ingestion of the same legacy row in a single run
    EXECUTE format($f$
      CREATE UNIQUE INDEX IF NOT EXISTS %I
        ON staging.%I (staging_import_run_id, staging_source_table, staging_source_record_id)
    $f$, staging_table || '_run_src_uq', staging_table);

    -- 6. Natural key index for forward lookups
    EXECUTE format($f$
      CREATE INDEX IF NOT EXISTS %I
        ON staging.%I (staging_source_natural_key)
        WHERE staging_source_natural_key IS NOT NULL
    $f$, staging_table || '_natkey_idx', staging_table);

    -- 7. Comment
    EXECUTE format($f$
      COMMENT ON TABLE staging.%I IS
        'Brownfield Wave 1 staging buffer for canonical target sys.sys_%I. Uniform jsonb-buffer pattern (ADR-0012 + WAVE_1_EXECUTION_RUNBOOK). TRUNCATE between runs.'
    $f$, staging_table, target_table);
  END LOOP;
END
$$;
