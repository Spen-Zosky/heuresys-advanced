-- @migrate: once
-- #164 F4 — altera audit.import_validation_results. Lo schema `brownfield` e le tabelle `audit.import_*`
-- sono ritirati dalla 000297; senza il marcatore questo file cadrebbe (o li
-- ricreerebbe) a ogni deploy. Su un database nuovo gira comunque: il registro
-- e' vuoto e nulla viene saltato.
-- =============================================================================
-- 000039_audit_source_table_id_nullable.sql
-- CW-B27 mitigation — Cross-Workflow Schema Coupling fix
--
-- Issue: audit.import_validation_results.source_table_id is NOT NULL FK to
--        brownfield.source_tables. This couples brownfield+SDBI workflows: SDBI
--        cannot emit audit rows without registering placeholder source_tables.
--
-- Decision: relax source_table_id to NULL allowed. Audit semantically valid even
--           without a brownfield source_table_id (SDBI workflow uses
--           mapping_card_id stored in payload metadata instead).
--
-- Idempotent: ALTER COLUMN DROP NOT NULL safe to re-run.
-- =============================================================================

BEGIN;

ALTER TABLE audit.import_validation_results
  ALTER COLUMN import_validation_result_source_table_id DROP NOT NULL;

COMMENT ON COLUMN audit.import_validation_results.import_validation_result_source_table_id IS
  'Optional FK to brownfield.source_tables. NULL allowed for SDBI workflow audit rows
   that bypass brownfield registry (use mapping_card_id in payload instead).
   Brownfield workflow continues to populate this for traceability.
   See ADR-0014 §3.5 + CW-B27 mitigation.';

-- Index audit_import_validation_results_source_table_idx remains valid (partial query OK with NULL exclusion)

-- Record migration
INSERT INTO sys.sys_schema_migrations (file_name, sha256, applied_by, duration_ms)
VALUES (
  '000039_audit_source_table_id_nullable.sql',
  REPEAT('0', 64), -- CLI computes actual sha256
  CURRENT_USER,
  0
)
ON CONFLICT (file_name) DO NOTHING;

COMMIT;
