-- db/seeds/sdbi/_template/03_phase5_consolidation.sql  (SDBI template — Phase 5 consolidation)
-- Copy to db/seeds/brownfield/sdbi/<AREA>/03_phase5_consolidation.sql and replace <…> placeholders.
-- Reference implementation: db/seeds/brownfield/sdbi/goals_pilot/03_phase5_consolidation.sql
--
-- Consolidate temp_sdbi.<ENTITY> -> sys.<TARGET_TABLE> + lineage + audit.
-- Lineage MUST populate the 4 SDBI columns added by migration 000063 (ADR-0014 §3.4):
--   source_lineage_sdbi_mapping_card_id, source_lineage_sdbi_confidence,
--   source_lineage_sdbi_ai_model_id, source_lineage_sdbi_human_approver
-- (the goals pilot stored these in jsonb metadata — new runs use the first-class columns).
-- Audit uses the SDBI rule_codes from migration 000063 / audit-rule-codes.ts.
-- Idempotent: ON CONFLICT … DO UPDATE|DO NOTHING. Run via psql … -v ON_ERROR_STOP=1 -f.

BEGIN;

-- ===== Step 1: sys.<TARGET_TABLE> (resolve raw _legacy_source_*_id pointers) =====
INSERT INTO sys.<TARGET_TABLE> (
  <ENTITY>_id, <ENTITY>_tenant_id, <ENTITY>_natural_key,
  -- <ENTITY>_<field>, …
  <ENTITY>_metadata, created_at, updated_at
)
SELECT
  t.<ENTITY>_id, t.<ENTITY>_tenant_id, t.<ENTITY>_natural_key,
  -- resolve FK pointers, e.g.:
  --   (SELECT <parent>_id FROM temp_sdbi.<parent> p WHERE p._legacy_source_id = t._legacy_source_<fk>_id),
  -- <ENTITY>_<field>, …
  t.<ENTITY>_metadata, t.created_at, t.updated_at
FROM temp_sdbi.<ENTITY> t
ON CONFLICT (<ENTITY>_tenant_id, <ENTITY>_natural_key) DO UPDATE SET
  <ENTITY>_metadata = sys.<TARGET_TABLE>.<ENTITY>_metadata || EXCLUDED.<ENTITY>_metadata,
  updated_at = now();

-- ===== Step 2: lineage (one bulk INSERT per target table; 4 SDBI columns populated) =====
INSERT INTO sys.sys_source_lineage_records (
  source_lineage_tenant_id, source_lineage_source_system, source_lineage_source_table,
  source_lineage_source_record_id, source_lineage_source_natural_key,
  source_lineage_import_run_id, source_lineage_target_table_name, source_lineage_target_record_id,
  source_lineage_mapping_confidence, source_lineage_validation_status, source_lineage_metadata,
  source_lineage_sdbi_mapping_card_id, source_lineage_sdbi_confidence,
  source_lineage_sdbi_ai_model_id, source_lineage_sdbi_human_approver
)
SELECT
  t.<ENTITY>_tenant_id, '<SOURCE_SYSTEM>', '<SOURCE_TABLE>',
  t._legacy_source_id::text,
  'OLDDB::<SOURCE_TABLE>::' || t._legacy_source_id::text,
  t._import_run_id, '<TARGET_TABLE>', t.<ENTITY>_id,
  <CONFIDENCE>, 'VALID',
  jsonb_build_object('sdbi_mapping_card_id', '<MAPPING_CARD_ID>'),
  '<MAPPING_CARD_ID>', <CONFIDENCE>, '<AI_MODEL_ID>', '<APPROVER>'
FROM temp_sdbi.<ENTITY> t
ON CONFLICT (source_lineage_source_system, source_lineage_source_table,
             source_lineage_source_record_id, source_lineage_target_table_name) DO NOTHING;

-- ===== Step 3: audit marker (SDBI rule_codes; source_table_id NULL OK — mig 000039) =====
-- CW-B17: emit a row per processed row (PASSED) or per skip (SKIPPED + reason). Here one
-- consolidation-complete marker per target table; expand to per-row if you skip-filter.
INSERT INTO audit.import_validation_results (
  import_validation_result_run_id, import_validation_result_source_table_id,
  import_validation_result_rule_code, import_validation_result_status,
  import_validation_result_message, import_validation_result_payload
)
SELECT
  (SELECT max(_import_run_id) FROM temp_sdbi.<ENTITY>),
  NULL,
  'SDBI_CONSOLIDATION_COMPLETE_V1', 'PASSED',
  'SDBI Phase 5 consolidation complete for <TARGET_TABLE>.',
  jsonb_build_object(
    'sdbi_mapping_card_id', '<MAPPING_CARD_ID>',
    'sdbi_ai_model_id', '<AI_MODEL_ID>',
    'target_table', '<TARGET_TABLE>',
    'source_table', '<SOURCE_TABLE>',
    'rows', (SELECT count(*) FROM temp_sdbi.<ENTITY>)
  );

COMMIT;

-- Phase 6 cleanup (run after Enzo confirms): DROP TABLE temp_sdbi.<ENTITY>;
--   then audit marker 'SDBI_TEMP_CLEANUP_V1'.

-- Verify counts
SELECT '<TARGET_TABLE>' AS t, count(*) FROM sys.<TARGET_TABLE>
UNION ALL
SELECT 'lineage', count(*) FROM sys.sys_source_lineage_records
  WHERE source_lineage_target_table_name = '<TARGET_TABLE>';
