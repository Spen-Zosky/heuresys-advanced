-- @migrate: once
-- #164 F4 — crea audit.import_validation_rule_codes. Lo schema `brownfield` e le tabelle `audit.import_*`
-- sono ritirati dalla 000297; senza il marcatore questo file cadrebbe (o li
-- ricreerebbe) a ogni deploy. Su un database nuovo gira comunque: il registro
-- e' vuoto e nulla viene saltato.
-- 000063_sdbi_infra.sql
-- SDBI Phase-1 infrastructure (the prerequisite PROMPT 027 §4 / dossier §5 W4 Option-C never closed).
-- Two DB-side items (the docs/template items 3+4 ship as files, not in this migration):
--   ITEM 1 — SDBI audit rule_codes: registered as a queryable canonical dictionary in the audit
--            schema (audit.import_validation_rule_codes), seeded with the SDBI family from
--            ADR-0014 §3.5 (+ the pre-existing brownfield codes for completeness). The audit
--            rule_code column itself is a free varchar(128) with NO CHECK enum (verified live),
--            so "adding rule_codes" = making the canonical set queryable + documented, mirroring
--            how 000058 gave reconciliation a queryable registry. The TS constants are added in
--            parallel in apps/api/src/modules/brownfield-wave-executor/audit-rule-codes.ts
--            (PROMPT 027 §4.3 "shipped in audit-rule-codes.ts").
--   ITEM 2 — the 4 SDBI lineage columns on sys.sys_source_lineage_records, exactly per
--            ADR-0014 §3.4 (mapping_card_id, confidence, ai_model_id, human_approver). These
--            promote the SDBI provenance that the goals pilot currently buries inside the
--            source_lineage_metadata jsonb (5939 rows) to first-class, queryable columns.
--
-- RD-08: categorical fields = varchar(N) + CHECK, never ENUM.
-- Idempotent by construction: CREATE TABLE IF NOT EXISTS, ALTER ... ADD COLUMN IF NOT EXISTS,
--   DROP CONSTRAINT IF EXISTS + ADD CONSTRAINT, INSERT ... ON CONFLICT DO NOTHING. Twice-run clean.
-- Applied by migrate.{sh,ps1} under `psql -1 -f` (single implicit txn) — NO inner BEGIN/COMMIT,
--   and the runner records sys.sys_schema_migrations itself (mirrors 000057..000062).
-- Pure metadata + 1 new audit-schema dictionary table: does NOT touch any business (sys.sys_<plural>)
--   table data and does NOT touch the 5939 existing SDBI lineage rows.

-- =============================================================================
-- ITEM 1 — SDBI audit rule_code dictionary (queryable canonical set)
-- =============================================================================

CREATE TABLE IF NOT EXISTS audit.import_validation_rule_codes (
  import_validation_rule_code_id   uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  import_validation_rule_code      varchar(128) NOT NULL,
  import_validation_rule_family    varchar(32)  NOT NULL,
  import_validation_rule_status    varchar(32)  NOT NULL,
  import_validation_rule_semantics text         NOT NULL,
  import_validation_rule_adr_ref   varchar(64),
  created_at                       timestamptz  NOT NULL DEFAULT now(),
  updated_at                       timestamptz  NOT NULL DEFAULT now(),
  CONSTRAINT import_validation_rule_codes_code_uq UNIQUE (import_validation_rule_code)
);

-- family: which workflow emits the code. RD-08 varchar + CHECK, never ENUM.
ALTER TABLE audit.import_validation_rule_codes
  DROP CONSTRAINT IF EXISTS import_validation_rule_codes_family_check;
ALTER TABLE audit.import_validation_rule_codes
  ADD CONSTRAINT import_validation_rule_codes_family_check
  CHECK (import_validation_rule_family IN ('BROWNFIELD','SDBI'));

-- status: the terminal status the code maps to (mirrors the values allowed on
-- audit.import_validation_results.import_validation_result_status).
ALTER TABLE audit.import_validation_rule_codes
  DROP CONSTRAINT IF EXISTS import_validation_rule_codes_status_check;
ALTER TABLE audit.import_validation_rule_codes
  ADD CONSTRAINT import_validation_rule_codes_status_check
  CHECK (import_validation_rule_status IN ('PASSED','FAILED','WARNING','SKIPPED'));

-- guarded updated_at trigger (mirrors 000058 / 000053)
DO $trg$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger
                 WHERE tgname='import_validation_rule_codes_set_updated_at'
                   AND tgrelid='audit.import_validation_rule_codes'::regclass) THEN
    CREATE TRIGGER import_validation_rule_codes_set_updated_at BEFORE UPDATE
      ON audit.import_validation_rule_codes
      FOR EACH ROW EXECUTE FUNCTION sys.sys_set_updated_at();
  END IF;
END $trg$;

-- Seed the canonical rule_code set. Brownfield codes mirror audit-rule-codes.ts (back-filled for
-- a complete dictionary); SDBI codes are the ADR-0014 §3.5 family that PROMPT 027 §4 never landed.
INSERT INTO audit.import_validation_rule_codes
  (import_validation_rule_code, import_validation_rule_family,
   import_validation_rule_status, import_validation_rule_semantics, import_validation_rule_adr_ref)
VALUES
  -- ---- Brownfield family (pre-existing, mirrors AUDIT_RULE_CODES in audit-rule-codes.ts) ----
  ('WAVE1_ALL_RULES', 'BROWNFIELD', 'PASSED',
   'Generic Wave-1 pass marker (pre-existing).', NULL),
  ('LEGACY_NULL_LINEAGE_DOCUMENTED_V1', 'BROWNFIELD', 'WARNING',
   'NULL lineage hygiene anchor (pre-existing).', NULL),
  ('HANDLED_VIA_LINEAGE_WRITE_V1', 'BROWNFIELD', 'SKIPPED',
   'LINEAGE_SOURCE_NK marker — row handled via lineage write (pre-existing).', NULL),
  ('WHERE_SKIP_FILTER_EXCLUDED_V1', 'BROWNFIELD', 'SKIPPED',
   'CW-B17 fix: staging row excluded by WHERE skip filter, documented with exclusion_reason.', 'ADR-0014 §3.5'),
  ('SILENT_UPSERT_ZERO_ROWS_V1', 'BROWNFIELD', 'WARNING',
   'CW-B60-A fix: per (run, table_mapping) the main INSERT returned rowCount=0 while not classified skipped.', NULL),
  -- ---- SDBI family (ADR-0014 §3.5 — the infra item this migration closes) ----
  ('SDBI_CONFIDENCE_HIGH_AUTO_APPROVED', 'SDBI', 'PASSED',
   'Mapping_card auto-approved (AI confidence >= 0.85).', 'ADR-0014 §3.3/§3.5'),
  ('SDBI_CONFIDENCE_MEDIUM_NEEDS_REVIEW', 'SDBI', 'WARNING',
   'Mapping_card requires human review (0.60 <= confidence < 0.85).', 'ADR-0014 §3.3/§3.5'),
  ('SDBI_CONFIDENCE_LOW_HALT_ASKED', 'SDBI', 'WARNING',
   'Workflow halted for AI clarification request (confidence < 0.60).', 'ADR-0014 §3.3/§3.5'),
  ('SDBI_HUMAN_APPROVED', 'SDBI', 'PASSED',
   'Human approved the mapping_card.', 'ADR-0014 §3.5'),
  ('SDBI_HUMAN_REJECTED', 'SDBI', 'FAILED',
   'Human rejected the mapping_card.', 'ADR-0014 §3.5'),
  ('SDBI_HUMAN_CORRECTED', 'SDBI', 'PASSED',
   'Human corrected and re-approved the mapping_card.', 'ADR-0014 §3.5'),
  ('SDBI_CONSOLIDATION_COMPLETE_V1', 'SDBI', 'PASSED',
   'Phase 5 consolidation completed successfully (temp_sdbi -> sys.*).', 'ADR-0014 §3.5/§3.1'),
  ('SDBI_TEMP_CLEANUP_V1', 'SDBI', 'PASSED',
   'Phase 6 temp_sdbi cleanup done (DROP TABLE temp_sdbi.*).', 'ADR-0014 §3.5/§3.1')
ON CONFLICT (import_validation_rule_code) DO NOTHING;

COMMENT ON TABLE audit.import_validation_rule_codes IS
  'Canonical dictionary of import_validation_results.rule_code values (the rule_code column is a free
   varchar(128) with no CHECK enum). Brownfield codes mirror audit-rule-codes.ts; SDBI codes are the
   ADR-0014 §3.5 family. Seeded idempotently by migration 000063. See docs/sdbi/RUNBOOK.md.';

-- =============================================================================
-- ITEM 2 — 4 SDBI lineage columns on sys.sys_source_lineage_records (ADR-0014 §3.4)
-- =============================================================================
-- Brownfield-path lineage rows leave these NULL (preserved invariant). SDBI-path rows populate
-- them. Backfills nothing: the 5939 existing SDBI pilot rows keep their jsonb provenance; a future
-- SDBI consolidation may dual-write the columns (out of scope for this infra migration).

ALTER TABLE sys.sys_source_lineage_records
  ADD COLUMN IF NOT EXISTS source_lineage_sdbi_mapping_card_id varchar(128);
ALTER TABLE sys.sys_source_lineage_records
  ADD COLUMN IF NOT EXISTS source_lineage_sdbi_confidence       numeric(4,3);
ALTER TABLE sys.sys_source_lineage_records
  ADD COLUMN IF NOT EXISTS source_lineage_sdbi_ai_model_id      varchar(128);
ALTER TABLE sys.sys_source_lineage_records
  ADD COLUMN IF NOT EXISTS source_lineage_sdbi_human_approver   varchar(255);

-- Bound the SDBI confidence to [0,1] (matches the AI self-reported scale in ADR-0014 §3.3).
-- NULL passes (brownfield rows + pre-existing SDBI rows that never set it).
ALTER TABLE sys.sys_source_lineage_records
  DROP CONSTRAINT IF EXISTS sys_source_lineage_sdbi_confidence_check;
ALTER TABLE sys.sys_source_lineage_records
  ADD CONSTRAINT sys_source_lineage_sdbi_confidence_check
  CHECK (source_lineage_sdbi_confidence IS NULL
         OR (source_lineage_sdbi_confidence >= 0 AND source_lineage_sdbi_confidence <= 1));

COMMENT ON COLUMN sys.sys_source_lineage_records.source_lineage_sdbi_mapping_card_id IS
  'SDBI-path only: the mapping_card id that authored this row (NULL on brownfield-path rows). ADR-0014 §3.4.';
COMMENT ON COLUMN sys.sys_source_lineage_records.source_lineage_sdbi_confidence IS
  'SDBI-path only: AI self-reported mapping confidence [0,1] (NULL on brownfield-path rows). ADR-0014 §3.3/§3.4.';
COMMENT ON COLUMN sys.sys_source_lineage_records.source_lineage_sdbi_ai_model_id IS
  'SDBI-path only: the AI model id that produced the mapping (NULL on brownfield-path rows). ADR-0014 §3.4.';
COMMENT ON COLUMN sys.sys_source_lineage_records.source_lineage_sdbi_human_approver IS
  'SDBI-path only: the human approver email/handle (NULL on brownfield-path rows). ADR-0014 §3.4.';

-- =============================================================================
-- Post-conditions (assert the migration achieved its goal; cheap, idempotent on re-run)
-- =============================================================================
DO $$
DECLARE
  n_sdbi_codes int;
  n_sdbi_cols  int;
BEGIN
  SELECT count(*) INTO n_sdbi_codes
  FROM audit.import_validation_rule_codes
  WHERE import_validation_rule_family = 'SDBI';
  IF n_sdbi_codes < 8 THEN
    RAISE EXCEPTION '000063: expected >= 8 SDBI rule_codes registered, found %', n_sdbi_codes;
  END IF;

  SELECT count(*) INTO n_sdbi_cols
  FROM information_schema.columns
  WHERE table_schema = 'sys' AND table_name = 'sys_source_lineage_records'
    AND column_name IN (
      'source_lineage_sdbi_mapping_card_id',
      'source_lineage_sdbi_confidence',
      'source_lineage_sdbi_ai_model_id',
      'source_lineage_sdbi_human_approver');
  IF n_sdbi_cols <> 4 THEN
    RAISE EXCEPTION '000063: expected 4 SDBI lineage columns, found %', n_sdbi_cols;
  END IF;

  RAISE NOTICE '000063: SDBI infra OK — % SDBI rule_codes in dictionary, 4/4 SDBI lineage columns present.',
    n_sdbi_codes;
END $$;
