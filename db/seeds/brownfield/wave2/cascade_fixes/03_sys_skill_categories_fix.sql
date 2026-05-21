-- ============================================================================
-- Class B Cascade Fix — sys_skill_categories
-- Batch C2.2 P1, authored 2026-05-21 by Cowork autonomous
-- Confidence: MEDIUM-HIGH (prereq satisfied; UQ collision handled via alias)
-- ============================================================================
-- §1 — Context recap (from batch_c1/class_b_diagnostics/sys_skill_categories.md)
-- ----------------------------------------------------------------------------
-- Target rows pre: 0
-- Staged rows: 7256 (skill_classifications 7215 + competencies 32 + ontology_categories 9)
-- Silent skip reason (CW-B17 audit): required_missing_skill_category_family_id
-- Cascade prereq: sys_skill_families = 77 rows ✅ (lineage 77/77 verified live)
-- Required NOT NULL UUID col: skill_category_family_id (FK → sys_skill_families)
-- Existing LOOKUP_FK count: 0
-- UQ: sys_skill_categories_code_uq (skill_category_code) — collapse on code expected
-- Sources (3):
--   - skill_classifications (7215) — link via skill_cluster_id → skill_clusters
--                                    → sys_skill_families lineage (49 entries)
--   - competencies (32)            — link via framework_id → competency_frameworks
--                                    → sys_skill_families lineage (4 entries)
--   - ontology_categories (9)      — link via parent_id (self-ref) OR
--                                    via esco_pillar → sys_skill_families
--
-- §2 — Authoring approach
-- ----------------------------------------------------------------------------
-- Pattern: SYNTHETIC ALIAS column + LOOKUP_FK form (b) lineage JOIN to sys_skill_families.
--
-- UQ collision: ALL 3 candidate source cols are already mapped as JSON_EXTRACT:
--   - competencies.framework_id      → skill_category_metadata
--   - skill_classifications.skill_cluster_id → skill_category_metadata
--   - ontology_categories.parent_id  → skill_category_metadata
-- Hence alias strategy mandatory.
--
-- Resolution path (HIGH confidence given live lineage check):
--   sys_skill_families lineage by source_table:
--     skill_clusters: 49 entries  (matches skill_classifications.skill_cluster_id)
--     esco_isco_groups: 14
--     esco_skill_groups: 10
--     competency_frameworks: 4    (matches competencies.framework_id)
--
-- Coverage estimate:
--   - skill_classifications.skill_cluster_id: very high if 7215 rows reference
--     the 49 known clusters. UQ collapse on skill_category_code will dedupe
--     heavily (likely 49-150 distinct categories after dedupe).
--   - competencies.framework_id: 4/4 frameworks → likely all 32 rows resolve.
--   - ontology_categories.parent_id: self-ref, may NOT resolve to skill_families
--     directly. Use esco_pillar as fallback alias.
--
-- §3 — Discovery queries — pre-INSERT verification
-- ----------------------------------------------------------------------------
-- §3.1 sys_skill_families lineage coverage
SELECT source_lineage_source_table, COUNT(*) AS n
FROM sys.sys_source_lineage_records
WHERE source_lineage_target_table_name='sys_skill_families'
GROUP BY 1
ORDER BY 2 DESC;
-- Expected: skill_clusters 49, esco_isco_groups 14, esco_skill_groups 10, competency_frameworks 4
-- §3.2 source_column_ids
SELECT st.source_table_name, sc.source_column_name, sc.source_column_id
FROM brownfield.source_columns sc
JOIN brownfield.source_tables st ON st.source_table_id=sc.source_column_table_id
WHERE (st.source_table_name='skill_classifications' AND sc.source_column_name='skill_cluster_id')
   OR (st.source_table_name='competencies' AND sc.source_column_name='framework_id')
   OR (st.source_table_name='ontology_categories' AND sc.source_column_name IN ('parent_id','esco_pillar'));
-- §4 — Authoring SQL — idempotent INSERTs
-- ============================================================================
BEGIN;
-- §4.1 Synthetic aliases — 3 sources
INSERT INTO brownfield.source_columns (
  source_column_id, source_column_table_id, source_column_name,
  source_column_data_type, source_column_is_nullable, source_column_ordinal_position
)
SELECT gen_random_uuid(), src.tid, src.alias_name, src.dtype, true, 9001
FROM (VALUES
  ('74cf809c-9527-42b1-9e06-35e8f45ca932'::uuid, 'skill_cluster_id__fk_family_alias', 'uuid'),         -- skill_classifications
  ('a0327801-099f-44ab-a2db-11d03de96552'::uuid, 'framework_id__fk_family_alias', 'uuid'),             -- competencies
  ('1209d440-66a1-4351-a3d5-bb9c72c9a82d'::uuid, 'esco_pillar__fk_family_alias', 'character varying')  -- ontology_categories
) AS src(tid, alias_name, dtype)
WHERE NOT EXISTS (
  SELECT 1 FROM brownfield.source_columns sc
  WHERE sc.source_column_table_id=src.tid AND sc.source_column_name=src.alias_name
);
-- §4.2 LOOKUP_FK mappings
-- skill_classifications (table_mapping=111607a9-e80c-4f01-abf3-9070ffabb850)
INSERT INTO brownfield.column_mappings (
  column_mapping_id, column_mapping_table_mapping_id, column_mapping_source_column_id,
  column_mapping_target_column, column_mapping_transform, column_mapping_transform_payload,
  column_mapping_pii_disposition
)
SELECT gen_random_uuid(),
  '111607a9-e80c-4f01-abf3-9070ffabb850'::uuid,
  sc.source_column_id,
  'skill_category_family_id',
  'LOOKUP_FK',
  jsonb_build_object(
    'target_table', 'sys_skill_families',
    'match_on', 'skill_family_metadata->>''legacy_id''',
    'aliased_from', 'skill_cluster_id',
    'fallback_policy', 'NULL_THEN_UNRESOLVABLE',
    'authored_by', 'cowork_batch_c2_2',
    'cascade_fix_for', 'required_missing_skill_category_family_id (CW-B17)',
    'expected_coverage', 'high (49 clusters in lineage, 7215 source rows likely many-to-one)'
  ),
  'NONE'
FROM brownfield.source_columns sc
WHERE sc.source_column_table_id='74cf809c-9527-42b1-9e06-35e8f45ca932'::uuid
  AND sc.source_column_name='skill_cluster_id__fk_family_alias'
  AND NOT EXISTS (
    SELECT 1 FROM brownfield.column_mappings cm
    WHERE cm.column_mapping_table_mapping_id='111607a9-e80c-4f01-abf3-9070ffabb850'::uuid
      AND cm.column_mapping_source_column_id=sc.source_column_id
  );
-- competencies (table_mapping=79b8eda7-0815-42af-8687-265eb424545b)
INSERT INTO brownfield.column_mappings (
  column_mapping_id, column_mapping_table_mapping_id, column_mapping_source_column_id,
  column_mapping_target_column, column_mapping_transform, column_mapping_transform_payload,
  column_mapping_pii_disposition
)
SELECT gen_random_uuid(),
  '79b8eda7-0815-42af-8687-265eb424545b'::uuid,
  sc.source_column_id,
  'skill_category_family_id',
  'LOOKUP_FK',
  jsonb_build_object(
    'target_table', 'sys_skill_families',
    'match_on', 'skill_family_metadata->>''legacy_id''',
    'aliased_from', 'framework_id',
    'fallback_policy', 'NULL_THEN_UNRESOLVABLE',
    'authored_by', 'cowork_batch_c2_2',
    'cascade_fix_for', 'required_missing_skill_category_family_id (CW-B17)',
    'expected_coverage', 'high (4 frameworks in lineage; 32 source rows)'
  ),
  'NONE'
FROM brownfield.source_columns sc
WHERE sc.source_column_table_id='a0327801-099f-44ab-a2db-11d03de96552'::uuid
  AND sc.source_column_name='framework_id__fk_family_alias'
  AND NOT EXISTS (
    SELECT 1 FROM brownfield.column_mappings cm
    WHERE cm.column_mapping_table_mapping_id='79b8eda7-0815-42af-8687-265eb424545b'::uuid
      AND cm.column_mapping_source_column_id=sc.source_column_id
  );
-- ontology_categories (table_mapping=c99cc068-7273-4ee6-8168-da817877ceb4)
-- NB: uses esco_pillar (varchar) not parent_id (uuid) — semantic match to ESCO pillar names.
INSERT INTO brownfield.column_mappings (
  column_mapping_id, column_mapping_table_mapping_id, column_mapping_source_column_id,
  column_mapping_target_column, column_mapping_transform, column_mapping_transform_payload,
  column_mapping_pii_disposition
)
SELECT gen_random_uuid(),
  'c99cc068-7273-4ee6-8168-da817877ceb4'::uuid,
  sc.source_column_id,
  'skill_category_family_id',
  'LOOKUP_FK',
  jsonb_build_object(
    'target_table', 'sys_skill_families',
    'match_on', 'skill_family_metadata->>''legacy_id''',
    'aliased_from', 'esco_pillar',
    'fallback_policy', 'NULL_THEN_UNRESOLVABLE',
    'authored_by', 'cowork_batch_c2_2',
    'cascade_fix_for', 'required_missing_skill_category_family_id (CW-B17)',
    'expected_coverage', 'medium-low (semantic match via ESCO pillar names)'
  ),
  'NONE'
FROM brownfield.source_columns sc
WHERE sc.source_column_table_id='1209d440-66a1-4351-a3d5-bb9c72c9a82d'::uuid
  AND sc.source_column_name='esco_pillar__fk_family_alias'
  AND NOT EXISTS (
    SELECT 1 FROM brownfield.column_mappings cm
    WHERE cm.column_mapping_table_mapping_id='c99cc068-7273-4ee6-8168-da817877ceb4'::uuid
      AND cm.column_mapping_source_column_id=sc.source_column_id
  );
COMMIT;
-- §5 — Pre-INSERT verification
-- ============================================================================
SELECT 'sys_skill_families_prereq' AS check, (SELECT COUNT(*) FROM sys.sys_skill_families) AS rows;
-- Expected: 77
SELECT 'lineage_coverage' AS check,
  EXISTS (SELECT 1 FROM sys.sys_source_lineage_records
          WHERE source_lineage_target_table_name='sys_skill_families'
            AND source_lineage_source_table='skill_clusters') AS skill_clusters_lineage_present,
  EXISTS (SELECT 1 FROM sys.sys_source_lineage_records
          WHERE source_lineage_target_table_name='sys_skill_families'
            AND source_lineage_source_table='competency_frameworks') AS competency_frameworks_lineage_present;
-- Expected: true / true
-- §6 — Post-INSERT verification (after Wave 1 retry)
-- ============================================================================
SELECT COUNT(*) FROM sys.sys_skill_categories;
-- Acceptance per diagnostic §4: ≥ 32 (from competencies alone), realistic
-- 50-200 after UQ-collapse on skill_category_code.
SELECT
  import_validation_result_payload->>'exclusion_reason' AS reason,
  COUNT(*)
FROM audit.import_validation_results
WHERE import_validation_result_rule_code='WHERE_SKIP_FILTER_EXCLUDED_V1'
  AND import_validation_result_payload->>'target_table'='sys_skill_categories'
  AND created_at > (SELECT MAX(import_run_started_at) FROM brownfield.import_runs)
GROUP BY 1
ORDER BY 2 DESC;
-- Expected: required_missing_skill_category_family_id → ~0
--           Some LOOKUP_FK_UNRESOLVABLE remainder acceptable for ontology rows.
-- Sources breakdown
SELECT source_lineage_source_table, COUNT(*)
FROM sys.sys_source_lineage_records
WHERE source_lineage_target_table_name='sys_skill_categories'
GROUP BY 1
ORDER BY 2 DESC;
-- §7 — Risk + rollback
-- ============================================================================
-- Risk MEDIUM-LOW: lineage coverage strong (sys_skill_families lineage 100%),
-- and skill_clusters→skill_classifications semantic match should be tight.
-- Worst case: ontology_categories.esco_pillar fails to match → 9 rows unresolved.
--
-- Rollback:
-- DELETE FROM brownfield.column_mappings
-- WHERE column_mapping_transform='LOOKUP_FK'
--   AND column_mapping_transform_payload->>'authored_by'='cowork_batch_c2_2'
--   AND column_mapping_target_column='skill_category_family_id';
-- DELETE FROM brownfield.source_columns
-- WHERE source_column_name IN (
--   'skill_cluster_id__fk_family_alias',
--   'framework_id__fk_family_alias',
--   'esco_pillar__fk_family_alias'
-- );
