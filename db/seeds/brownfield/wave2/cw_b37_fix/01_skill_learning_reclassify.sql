-- =============================================================================
-- CW-B37 fix: re-classify job_title_courses table_mapping for
-- sys_skill_learning_mappings as REFERENCE_ONLY.
-- staging_raw_record has only course_id; LOOKUP_FK {match_on:skill_name} is
-- unresolvable. Semantically belongs to sys_job_role_skill_mappings (X10 H2R
-- or X12 TALPIPE). CW-B37 deep fix (2-hop esco_skill_uri LOOKUP) deferred to
-- X9 SKILGRO macro-area.
-- =============================================================================

BEGIN;

UPDATE brownfield.table_mappings tm
   SET table_mapping_classification = 'REFERENCE_ONLY',
       table_mapping_metadata = COALESCE(tm.table_mapping_metadata, '{}'::jsonb)
         || jsonb_build_object(
              'reclassified_at',     now()::text,
              'reclassified_reason', 'CW-B37 (Cowork batch C7.3): job_title_courses lacks skill UUID/URI/name in staging_raw_record. LOOKUP_FK payload {match_on:skill_name} unresolvable. Source semantically belongs to sys_job_role_skill_mappings (X10 H2R or X12 TALPIPE). See cowork_reserved/batch_c7/forensic_cw_b37/.'
            )
  FROM brownfield.source_tables st
 WHERE st.source_table_id = tm.table_mapping_source_table_id
   AND tm.table_mapping_target_table = 'sys_skill_learning_mappings'
   AND st.source_table_name = 'job_title_courses';

DO $$
DECLARE v_count int;
BEGIN
  SELECT COUNT(*) INTO v_count
    FROM brownfield.table_mappings tm
    JOIN brownfield.source_tables st ON st.source_table_id = tm.table_mapping_source_table_id
   WHERE tm.table_mapping_target_table = 'sys_skill_learning_mappings'
     AND st.source_table_name = 'job_title_courses'
     AND tm.table_mapping_classification = 'REFERENCE_ONLY';
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'CW-B37 fix expected 1 row REFERENCE_ONLY, got %', v_count;
  END IF;
  RAISE NOTICE 'CW-B37 reclassified: % table_mapping', v_count;
END $$;

COMMIT;
