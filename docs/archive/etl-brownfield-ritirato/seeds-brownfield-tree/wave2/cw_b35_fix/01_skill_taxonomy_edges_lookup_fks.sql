-- =============================================================================
-- CW-B35 fix: re-route 10 column_mappings for sys_skill_taxonomy_edges from
-- JSON_EXTRACT (skill_taxonomy_edge_metadata embed) → LOOKUP_FK (skill_taxonomy
-- _edge_parent_id / child_id resolved via sys_source_lineage_records).
--
-- Live state at X7 author time:
--   - 8/10 (table_mapping × source_column) pairs are JSON_EXTRACT → metadata
--   - 2/10 (skill_relationships source_skill_id + target_skill_id) ALREADY
--     LOOKUP_FK with payload {match_on:"skill_metadata->>legacy_id"} (no quotes)
-- Engine transform-compiler regex accepts both with/without quotes; the
-- registry-level brownfield.validate_lookup_fk_payload() function rejects the
-- unquoted form. We normalize all 10 to the canonical QUOTED form
-- ('skill_metadata->>''legacy_id''') for validator compatibility + consistency.
--
-- UQ constraint `(column_mapping_table_mapping_id, column_mapping_source_column_id)`
-- is one row per pair; INSERT-pattern is impossible — must UPDATE in place.
--
-- Trade-off: per-source-col legacy UUID is no longer embedded in
-- skill_taxonomy_edge_metadata JSON_EXTRACT. Source UUID remains queryable via
-- sys.sys_source_lineage_records (source_record_id) → no information loss.
-- =============================================================================

BEGIN;

-- parent_id UPDATEs (5 sources)
UPDATE brownfield.column_mappings cm
   SET column_mapping_target_column   = 'skill_taxonomy_edge_parent_id',
       column_mapping_transform        = 'LOOKUP_FK',
       column_mapping_transform_payload = jsonb_build_object(
         'target_table', 'sys_skills',
         'match_on',     'skill_metadata->>''legacy_id''',
         'note',         'CW-B35 fix — resolve legacy skill UUID → sys_skills.skill_id via lineage'
       )
  FROM (VALUES
    ('skill_adjacencies',        'skill_id'),
    ('esco_skill_relations',     'source_skill_id'),
    ('ontology_skill_relations', 'source_skill_id'),
    ('skill_relationships',      'source_skill_id'),
    ('skill_pair_usage',         'skill_id_1')
  ) AS sg(src, parent_col)
  JOIN brownfield.table_mappings tm
    ON tm.table_mapping_target_table = 'sys_skill_taxonomy_edges'
  JOIN brownfield.source_tables st
    ON st.source_table_id = tm.table_mapping_source_table_id
   AND st.source_table_name = sg.src
  JOIN brownfield.source_columns sc
    ON sc.source_column_table_id = st.source_table_id
   AND sc.source_column_name = sg.parent_col
 WHERE cm.column_mapping_table_mapping_id = tm.table_mapping_id
   AND cm.column_mapping_source_column_id = sc.source_column_id;

-- child_id UPDATEs (5 sources)
UPDATE brownfield.column_mappings cm
   SET column_mapping_target_column   = 'skill_taxonomy_edge_child_id',
       column_mapping_transform        = 'LOOKUP_FK',
       column_mapping_transform_payload = jsonb_build_object(
         'target_table', 'sys_skills',
         'match_on',     'skill_metadata->>''legacy_id''',
         'note',         'CW-B35 fix — resolve legacy skill UUID → sys_skills.skill_id via lineage'
       )
  FROM (VALUES
    ('skill_adjacencies',        'adjacent_skill_id'),
    ('esco_skill_relations',     'target_skill_id'),
    ('ontology_skill_relations', 'target_skill_id'),
    ('skill_relationships',      'target_skill_id'),
    ('skill_pair_usage',         'skill_id_2')
  ) AS sg(src, child_col)
  JOIN brownfield.table_mappings tm
    ON tm.table_mapping_target_table = 'sys_skill_taxonomy_edges'
  JOIN brownfield.source_tables st
    ON st.source_table_id = tm.table_mapping_source_table_id
   AND st.source_table_name = sg.src
  JOIN brownfield.source_columns sc
    ON sc.source_column_table_id = st.source_table_id
   AND sc.source_column_name = sg.child_col
 WHERE cm.column_mapping_table_mapping_id = tm.table_mapping_id
   AND cm.column_mapping_source_column_id = sc.source_column_id;

-- Assertion: exactly 10 column_mappings updated to CW-B35 LOOKUP_FK pattern
DO $$
DECLARE
  v_count int;
BEGIN
  SELECT COUNT(*) INTO v_count
    FROM brownfield.column_mappings cm
    JOIN brownfield.table_mappings tm
      ON tm.table_mapping_id = cm.column_mapping_table_mapping_id
   WHERE tm.table_mapping_target_table = 'sys_skill_taxonomy_edges'
     AND cm.column_mapping_target_column IN ('skill_taxonomy_edge_parent_id','skill_taxonomy_edge_child_id')
     AND cm.column_mapping_transform = 'LOOKUP_FK'
     AND cm.column_mapping_transform_payload->>'note' LIKE 'CW-B35%';
  IF v_count <> 10 THEN
    RAISE EXCEPTION 'CW-B35 fix expected 10 LOOKUP_FK column_mappings, got %', v_count;
  END IF;
  RAISE NOTICE 'CW-B35 column_mappings normalized: %', v_count;
END $$;

COMMIT;
