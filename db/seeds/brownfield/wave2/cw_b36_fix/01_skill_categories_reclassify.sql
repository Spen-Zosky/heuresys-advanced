-- =============================================================================
-- CW-B36 fix: re-classify skill_classifications + ontology_categories
-- table_mappings as REFERENCE_ONLY for sys_skill_categories.
-- Source semantics differ from target (skill_classifications is per-skill
-- metadata, NOT category family; ontology_categories has 0/5 lineage resolution
-- for parent_id, same pattern as Semantic FK Phantom but volume too low).
-- Deferred to SKILGRO macro-area (X9).
-- =============================================================================

BEGIN;

UPDATE brownfield.table_mappings tm
   SET table_mapping_classification = 'REFERENCE_ONLY',
       table_mapping_metadata = COALESCE(tm.table_mapping_metadata, '{}'::jsonb)
         || jsonb_build_object(
              'reclassified_at',     now()::text,
              'reclassified_reason', 'CW-B36 (Cowork batch C7.2): source semantics differ from sys_skill_categories target. Re-classified pending dedicated SKILGRO macro-area (X9). See cowork_reserved/batch_c7/forensic_cw_b36/.'
            )
  FROM brownfield.source_tables st
 WHERE st.source_table_id = tm.table_mapping_source_table_id
   AND tm.table_mapping_target_table = 'sys_skill_categories'
   AND st.source_table_name IN ('skill_classifications','ontology_categories');

DO $$
DECLARE v_count int;
BEGIN
  SELECT COUNT(*) INTO v_count
    FROM brownfield.table_mappings tm
    JOIN brownfield.source_tables st ON st.source_table_id = tm.table_mapping_source_table_id
   WHERE tm.table_mapping_target_table = 'sys_skill_categories'
     AND st.source_table_name IN ('skill_classifications','ontology_categories')
     AND tm.table_mapping_classification = 'REFERENCE_ONLY';
  IF v_count <> 2 THEN
    RAISE EXCEPTION 'CW-B36 fix expected 2 rows REFERENCE_ONLY, got %', v_count;
  END IF;
  RAISE NOTICE 'CW-B36 reclassified: % table_mappings', v_count;
END $$;

COMMIT;
