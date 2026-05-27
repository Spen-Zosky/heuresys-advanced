-- =============================================================================
-- 000044_cw_b60_b_reclassify_application_level_targets.sql
-- =============================================================================
-- ADR-0020 — Wave-2 scope for application-level targets (CW-B60-B closure).
--
-- Reclassifies brownfield.table_mappings rows targeting 3 application-level
-- sys tables from `IMPORT` to `REFERENCE_ONLY`. Rationale: these targets carry
-- `created_by`/`updated_by` FKs to sys_users + tenant-scoped activation FKs;
-- they are operational data populated by user UI actions in MVP-4 features,
-- not catalog data eligible for legacy import.
--
-- Targets:
--   - sys_blueprint_overrides
--   - sys_position_skill_requirements
--   - sys_position_learning_requirements
--
-- Idempotent: only flips a varchar(32) column where current value is 'IMPORT'.
-- Safe to re-run; safe to apply on a partially-migrated DB.
-- =============================================================================

BEGIN;

-- Defensive guard: if `brownfield.table_mappings` doesn't exist (running on
-- a fresh DB pre-bootstrap), make this migration a no-op rather than fail.
DO $mig$
DECLARE
  v_tbl_exists boolean;
  v_count_pre integer := 0;
  v_count_post integer := 0;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
     WHERE table_schema = 'brownfield' AND table_name = 'table_mappings'
  ) INTO v_tbl_exists;

  IF NOT v_tbl_exists THEN
    RAISE NOTICE '000044: brownfield.table_mappings does not exist — no-op (DB pre-bootstrap)';
    RETURN;
  END IF;

  SELECT count(*) INTO v_count_pre
    FROM brownfield.table_mappings
   WHERE table_mapping_target_table IN (
     'sys_blueprint_overrides',
     'sys_position_skill_requirements',
     'sys_position_learning_requirements'
   )
     AND table_mapping_classification = 'IMPORT';

  RAISE NOTICE '000044: pre-update IMPORT mappings for 3 application-level targets: %', v_count_pre;

  UPDATE brownfield.table_mappings
     SET table_mapping_classification = 'REFERENCE_ONLY',
         table_mapping_rationale = COALESCE(table_mapping_rationale, '')
           || ' [ADR-0020 2026-05-26: reclassified IMPORT->REFERENCE_ONLY; target is application-level operational data, not eligible for brownfield import. See docs/architecture/adr/0020_wave2_scope_application_level_targets.md]'
   WHERE table_mapping_target_table IN (
     'sys_blueprint_overrides',
     'sys_position_skill_requirements',
     'sys_position_learning_requirements'
   )
     AND table_mapping_classification = 'IMPORT';

  SELECT count(*) INTO v_count_post
    FROM brownfield.table_mappings
   WHERE table_mapping_target_table IN (
     'sys_blueprint_overrides',
     'sys_position_skill_requirements',
     'sys_position_learning_requirements'
   )
     AND table_mapping_classification = 'IMPORT';

  RAISE NOTICE '000044: post-update IMPORT mappings for 3 application-level targets: % (expected 0)', v_count_post;

  IF v_count_post != 0 THEN
    RAISE EXCEPTION '000044: post-update guard failed — % IMPORT mappings still present for application-level targets', v_count_post;
  END IF;
END $mig$;

-- CW-B29 mitigation: NO INSERT INTO sys.sys_schema_migrations — the migrate
-- runner (db/scripts/migrate*.{ps1,sh}) writes the audit row with the correct
-- (file_name, sha256, applied_by, duration_ms) tuple after this script runs.

COMMIT;
