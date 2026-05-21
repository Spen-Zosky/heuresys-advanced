-- =============================================================================
-- CW-B39 fix: re-classify course_modules + learning_path_courses table_mappings
-- for sys_learning_path_steps as REFERENCE_ONLY.
-- Learning domain architectural mismatch: course_id (UUID) doesn't resolve to
-- sys_learning_modules via current lineage (sys_learning_modules sourced from
-- analytics derivatives, not canonical courses). Defer to X9 SKILGRO holistic
-- re-design (per cowork_reserved/batch_c8/cw_b39_forensic/01_CW_B39_FORENSIC.md
-- §4 conclusion).
--
-- Net effect: 688 staged rows out of Wave 1 audit noise. No functional
-- regression (sys_learning_path_steps was already 0 populated).
-- =============================================================================

BEGIN;

UPDATE brownfield.table_mappings
   SET table_mapping_classification = 'REFERENCE_ONLY',
       table_mapping_metadata = jsonb_set(
         coalesce(table_mapping_metadata, '{}'::jsonb),
         '{reclassified_reason}',
         to_jsonb('CW-B39 (Cowork batch C8.3): learning domain architectural mismatch. course_modules + learning_path_courses cannot resolve module_id via current sys_learning_modules lineage (sourced from analytics, not canonical courses). Defer to X9 SKILGRO holistic rebuild.'::text)
       )
 WHERE table_mapping_id IN (
   SELECT tm.table_mapping_id
     FROM brownfield.table_mappings tm
     JOIN brownfield.source_tables st ON st.source_table_id = tm.table_mapping_source_table_id
    WHERE tm.table_mapping_target_table = 'sys_learning_path_steps'
      AND st.source_table_name IN ('course_modules','learning_path_courses')
 );

DO $$
DECLARE v_count int;
BEGIN
  SELECT COUNT(*) INTO v_count
    FROM brownfield.table_mappings tm
    JOIN brownfield.source_tables st ON st.source_table_id = tm.table_mapping_source_table_id
   WHERE tm.table_mapping_target_table = 'sys_learning_path_steps'
     AND st.source_table_name IN ('course_modules','learning_path_courses')
     AND tm.table_mapping_classification = 'REFERENCE_ONLY';
  IF v_count <> 2 THEN
    RAISE EXCEPTION 'CW-B39 expected 2 rows REFERENCE_ONLY, got %', v_count;
  END IF;
  RAISE NOTICE 'CW-B39 reclassified: % table_mappings', v_count;
END $$;

COMMIT;
