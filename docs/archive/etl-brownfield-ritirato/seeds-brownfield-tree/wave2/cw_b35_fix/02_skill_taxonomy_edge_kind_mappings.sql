-- =============================================================================
-- CW-B35 fix (continuation): supply skill_taxonomy_edge_kind mappings for the
-- 4 CLEAN sources that lacked them. Without this, engine §2 NK fallback emits
-- LEFT(nkFallback, 32) for kind (because kind is in naturalKeyColumns via UQ
-- on (parent_id, child_id, kind)) producing values like 'OLDDB::esco...' which
-- violate sys_skill_taxonomy_edge_kind_check (allowed: IS_A/PART_OF/RELATED/
-- PREREQUISITE_OF).
--
-- Approach: UPDATE the existing JSON_EXTRACT mapping on the relation/adjacency
-- type source column → CAST_ENUM into skill_taxonomy_edge_kind. The legacy
-- type value is no longer embedded in metadata, but available via lineage.
-- skill_relationships already has UPPERCASE kind mapping (kept as-is).
-- =============================================================================

BEGIN;

-- skill_adjacencies: adjacency_type (competency, domain) → RELATED
UPDATE brownfield.column_mappings cm
   SET column_mapping_target_column   = 'skill_taxonomy_edge_kind',
       column_mapping_transform        = 'CAST_ENUM',
       column_mapping_transform_payload = jsonb_build_object(
         'value_map', jsonb_build_object(
           'competency', 'RELATED',
           'domain',     'RELATED'
         ),
         'default', 'RELATED',
         'note', 'CW-B35 fix supplement — kind mapping for skill_adjacencies'
       )
  FROM brownfield.table_mappings tm
  JOIN brownfield.source_tables st ON st.source_table_id = tm.table_mapping_source_table_id
  JOIN brownfield.source_columns sc ON sc.source_column_table_id = st.source_table_id
 WHERE cm.column_mapping_table_mapping_id = tm.table_mapping_id
   AND cm.column_mapping_source_column_id = sc.source_column_id
   AND tm.table_mapping_target_table = 'sys_skill_taxonomy_edges'
   AND st.source_table_name = 'skill_adjacencies'
   AND sc.source_column_name = 'adjacency_type';

-- esco_skill_relations: relation_type (essential, optional) → mapped
UPDATE brownfield.column_mappings cm
   SET column_mapping_target_column   = 'skill_taxonomy_edge_kind',
       column_mapping_transform        = 'CAST_ENUM',
       column_mapping_transform_payload = jsonb_build_object(
         'value_map', jsonb_build_object(
           'essential', 'PREREQUISITE_OF',
           'optional',  'RELATED'
         ),
         'default', 'RELATED',
         'note', 'CW-B35 fix supplement — kind mapping for esco_skill_relations'
       )
  FROM brownfield.table_mappings tm
  JOIN brownfield.source_tables st ON st.source_table_id = tm.table_mapping_source_table_id
  JOIN brownfield.source_columns sc ON sc.source_column_table_id = st.source_table_id
 WHERE cm.column_mapping_table_mapping_id = tm.table_mapping_id
   AND cm.column_mapping_source_column_id = sc.source_column_id
   AND tm.table_mapping_target_table = 'sys_skill_taxonomy_edges'
   AND st.source_table_name = 'esco_skill_relations'
   AND sc.source_column_name = 'relation_type';

-- ontology_skill_relations: relation_type (7 values) → mapped
UPDATE brownfield.column_mappings cm
   SET column_mapping_target_column   = 'skill_taxonomy_edge_kind',
       column_mapping_transform        = 'CAST_ENUM',
       column_mapping_transform_payload = jsonb_build_object(
         'value_map', jsonb_build_object(
           'complementary', 'RELATED',
           'enables',       'PREREQUISITE_OF',
           'part_of',       'PART_OF',
           'related_to',    'RELATED',
           'requires',      'PREREQUISITE_OF',
           'similar_to',    'RELATED',
           'supersedes',    'RELATED'
         ),
         'default', 'RELATED',
         'note', 'CW-B35 fix supplement — kind mapping for ontology_skill_relations'
       )
  FROM brownfield.table_mappings tm
  JOIN brownfield.source_tables st ON st.source_table_id = tm.table_mapping_source_table_id
  JOIN brownfield.source_columns sc ON sc.source_column_table_id = st.source_table_id
 WHERE cm.column_mapping_table_mapping_id = tm.table_mapping_id
   AND cm.column_mapping_source_column_id = sc.source_column_id
   AND tm.table_mapping_target_table = 'sys_skill_taxonomy_edges'
   AND st.source_table_name = 'ontology_skill_relations'
   AND sc.source_column_name = 'relation_type';

-- skill_pair_usage: context_type (employee_profile) → RELATED
UPDATE brownfield.column_mappings cm
   SET column_mapping_target_column   = 'skill_taxonomy_edge_kind',
       column_mapping_transform        = 'CAST_ENUM',
       column_mapping_transform_payload = jsonb_build_object(
         'value_map', jsonb_build_object(
           'employee_profile', 'RELATED'
         ),
         'default', 'RELATED',
         'note', 'CW-B35 fix supplement — kind mapping for skill_pair_usage'
       )
  FROM brownfield.table_mappings tm
  JOIN brownfield.source_tables st ON st.source_table_id = tm.table_mapping_source_table_id
  JOIN brownfield.source_columns sc ON sc.source_column_table_id = st.source_table_id
 WHERE cm.column_mapping_table_mapping_id = tm.table_mapping_id
   AND cm.column_mapping_source_column_id = sc.source_column_id
   AND tm.table_mapping_target_table = 'sys_skill_taxonomy_edges'
   AND st.source_table_name = 'skill_pair_usage'
   AND sc.source_column_name = 'context_type';

-- Assertion: 4 column_mappings updated
DO $$
DECLARE v_count int;
BEGIN
  SELECT COUNT(*) INTO v_count
    FROM brownfield.column_mappings cm
    JOIN brownfield.table_mappings tm ON tm.table_mapping_id = cm.column_mapping_table_mapping_id
   WHERE tm.table_mapping_target_table='sys_skill_taxonomy_edges'
     AND cm.column_mapping_target_column='skill_taxonomy_edge_kind'
     AND cm.column_mapping_transform='CAST_ENUM'
     AND cm.column_mapping_transform_payload->>'note' LIKE 'CW-B35 fix supplement%';
  IF v_count <> 4 THEN
    RAISE EXCEPTION 'CW-B35 kind-fix supplement expected 4 column_mappings, got %', v_count;
  END IF;
  RAISE NOTICE 'CW-B35 kind supplement applied: %', v_count;
END $$;

COMMIT;
