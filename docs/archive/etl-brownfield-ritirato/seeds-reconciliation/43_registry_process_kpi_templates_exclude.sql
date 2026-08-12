-- 43_registry_process_kpi_templates_exclude.sql — #4 close out-of-scope (S970, 2026-06-06).
-- DECISION (Enzo): sys_process_kpi_templates LOOKUP_FK silent-skip is BY-DESIGN, not a code bug.
-- The v5 sys_blueprint_process_registry (23 banking processes 00..22) is a clean v5-native taxonomy,
-- NOT a translation of legacy business_processes (26 rows: 12 banking / 7 energy / 7 food; 0 code-overlap,
-- 1 exact name match only). Process-level KPI templates, if ever needed, are v5-native authoring -- not a legacy import.
-- ACTION: reclass the brownfield card IMPORT -> EXCLUDE (the card_classification wins over declared_status
--   in fn_reconciliation_status) AND set the registry declared_status -> EXCLUDE. resolved_status becomes EXCLUDE.
-- IDEMPOTENT: card reclass keyed on classification='IMPORT'; registry update keyed on missing S970 marker.
BEGIN;
-- 1. reclass the brownfield IMPORT card (this is what fn_reconciliation_status reads first)
UPDATE brownfield.table_mappings
SET table_mapping_classification = 'EXCLUDE',
    table_mapping_rationale = '[OUT-OF-SCOPE S970: taxonomy mismatch, v5-native authoring] ' || COALESCE(table_mapping_rationale,'')
WHERE table_mapping_target_table = 'sys_process_kpi_templates'
  AND table_mapping_classification = 'IMPORT';
-- 2. align the reconciliation registry
UPDATE sys.sys_reconciliation_registry
SET reconciliation_registry_declared_status = 'EXCLUDE',
    reconciliation_registry_rationale =
      '[OUT-OF-SCOPE S970 (Enzo): v5-native banking taxonomy; legacy business_processes multi-industry '
      || '(12 banking/7 energy/7 food), 0 code-overlap / 1 name-match -> taxonomy mismatch not a code bug; '
      || 'process-KPI-templates = future v5-native authoring, not a legacy import] '
      || reconciliation_registry_rationale
WHERE reconciliation_registry_table_name = 'sys_process_kpi_templates'
  AND reconciliation_registry_rationale NOT LIKE '%OUT-OF-SCOPE S970%';
DO $$ DECLARE v text; BEGIN
  SELECT resolved_status INTO v FROM sys.v_reconciliation_status WHERE table_name='sys_process_kpi_templates';
  RAISE NOTICE 'sys_process_kpi_templates resolved_status = % (expect EXCLUDE)', v;
  IF v <> 'EXCLUDE' THEN RAISE EXCEPTION 'expected EXCLUDE, got %', v; END IF;
END $$;
COMMIT;
