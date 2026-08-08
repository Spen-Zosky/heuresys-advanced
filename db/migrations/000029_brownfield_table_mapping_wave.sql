-- @migrate: once
-- #164 F4 — questo file CREA oggetti dello schema `brownfield`, ritirato dalla
-- 000297. Senza il marcatore la catena lo ricreerebbe a ogni deploy e il ritiro
-- oscillerebbe (ADR-0035). Su un database nuovo gira comunque: il registro e' vuoto.
-- =============================================================================
-- 000029_brownfield_table_mapping_wave.sql
-- Heuresys Advanced — Brownfield: wave assignment on table_mappings (ADR-0012).
-- -----------------------------------------------------------------------------
-- Per ADR-0012 (docs/architecture/adr/0012_brownfield_table_mapping_wave_column.md):
-- store the brownfield wave (1..4) as a dedicated smallint column on
-- brownfield.table_mappings, symmetric with brownfield.import_runs.import_run_wave
-- (migration 000024). The wave attribute is needed by:
--   - db/scripts/brownfield-wave-1-preflight.{sh,ps1}
--   - docs/brownfield/WAVE_1_EXECUTION_RUNBOOK.md acceptance SQL
--   - the Wave 1 executor module (future session, MVP-3 Tappa D continuation)
--
-- Idempotent: ADD COLUMN IF NOT EXISTS / DROP CONSTRAINT IF EXISTS / CREATE
-- INDEX IF NOT EXISTS. The backfill UPDATE is bounded by `WHERE wave IS NULL`
-- so re-running never overrides a previously assigned wave.
--
-- Backfill behavior:
--   - On a freshly bootstrapped DB where brownfield.table_mappings is empty,
--     the UPDATE is a no-op (0 rows touched). Mapping population is a separate
--     prerequisite of the Wave 1 executor session.
--   - On a DB that has the 93 Wave 1 mappings loaded, this assigns wave=1 to
--     every APPROVED + IMPORT/TRANSFORM mapping whose source table belongs to
--     the 7 Wave 1 source domains (ESKAP, SKILGRO, INDOOR, ITLAB, PROGOV,
--     OPOURSKA, H2R — per BROWNFIELD_IMPORT_PLAN.md §3.1). The domain
--     classification lives on `brownfield.source_tables.source_table_domain`
--     (varchar(64)); `source_table_schema` holds the legacy PG schema name
--     (always 'public' for heuresys_platform) — they are NOT the same column.
-- =============================================================================

-- 1. Column
ALTER TABLE brownfield.table_mappings
  ADD COLUMN IF NOT EXISTS table_mapping_wave smallint;

COMMENT ON COLUMN brownfield.table_mappings.table_mapping_wave IS
  'Brownfield import wave (1..4) per ADR-0012. NULL = unassigned. Symmetric with brownfield.import_runs.import_run_wave.';

-- 2. CHECK constraint (matches import_runs shape: NULL allowed, 1..4 otherwise)
ALTER TABLE brownfield.table_mappings
  DROP CONSTRAINT IF EXISTS brownfield_table_mapping_wave_check;
ALTER TABLE brownfield.table_mappings
  ADD CONSTRAINT brownfield_table_mapping_wave_check
  CHECK (table_mapping_wave IS NULL OR table_mapping_wave BETWEEN 1 AND 4);

-- 3. Secondary index for wave-scoped scans (partial — only assigned mappings)
CREATE INDEX IF NOT EXISTS brownfield_table_mappings_wave_idx
  ON brownfield.table_mappings (table_mapping_wave)
  WHERE table_mapping_wave IS NOT NULL;

-- 4. Wave 1 backfill (no-op when brownfield.table_mappings is empty)
--    Filter on source_table_domain (lexicon classification, varchar(64))
--    NOT on source_table_schema (legacy PG schema, always 'public').
--    Source domain list per docs/brownfield/BROWNFIELD_IMPORT_PLAN.md §3.1.
--    Only touches rows where wave IS NULL → idempotent across reruns.
UPDATE brownfield.table_mappings tm
   SET table_mapping_wave = 1
  FROM brownfield.source_tables st
 WHERE tm.table_mapping_source_table_id = st.source_table_id
   AND tm.table_mapping_wave IS NULL
   AND tm.table_mapping_approval_status = 'APPROVED'
   AND tm.table_mapping_classification IN ('IMPORT', 'TRANSFORM')
   AND st.source_table_domain IN (
     'ESKAP',
     'SKILGRO',
     'INDOOR',
     'ITLAB',
     'PROGOV',
     'OPOURSKA',
     'H2R'
   );
