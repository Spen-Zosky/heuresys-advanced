-- ============================================================================
-- Class B Cascade Fix — sys_skill_taxonomy_edges
-- Batch C2.2 P1, authored 2026-05-21 by Cowork autonomous
-- Confidence: MEDIUM-LOW (most complex; self-referential FK on sys_skills;
--                          11 sources with heterogeneous schemas)
-- ============================================================================

-- §1 — Context recap (from batch_c1/class_b_diagnostics/sys_skill_taxonomy_edges.md)
-- ----------------------------------------------------------------------------
-- Target rows pre: 0
-- Staged rows: 17924 (originally 6306 in diagnostic; +11634 skill_adjacencies post-X1 MIRROR-GAP-fix)
-- Silent skip reason: nk_missing_skill_taxonomy_edge_parent_id + child_id
-- Cascade prereq: sys_skills = 14455 ✅ (post-X1, lineage ~14.3k entries ≈99% coverage)
-- Required NOT NULL UUID cols (both):
--   - skill_taxonomy_edge_parent_id (FK → sys_skills)
--   - skill_taxonomy_edge_child_id  (FK → sys_skills)
-- UQ: (parent_id, child_id, kind) — kind is part of natural key
-- Existing LOOKUP_FK count: 2 (skill_relationships.source_skill_id +
--                              skill_relationships.target_skill_id)
-- 11 source tables:
--   - esco_skill_relations (5818)        ← LARGEST. Uses URI strings.
--   - skill_adjacencies (11634 post-X1)  ← 2nd LARGEST. Uses uuid skill_id + adjacent_skill_id.
--   - onet_esco_mappings (135)
--   - ontology_skill_relations (30)
--   - ontology_source_mappings (40)
--   - skill_taxonomy_extensions (52)
--   - skill_pair_usage (111)
--   - semantic_entity_relations (15)
--   - skill_matrices (4)
--   - cross_entity_relations (85)
--   - skill_relationships (16)           ← Already has LOOKUP_FK ✅
--   - import_skill_links (0 in mirror, skipped)
--
-- §2 — Authoring approach
-- ----------------------------------------------------------------------------
-- Pattern: SYNTHETIC ALIASES × 2 cols × 9 sources = up to 18 new aliases + mappings.
--
-- HIGH risk per R-05: esco_skill_relations uses URI not UUID. The lineage for
-- sys_skills was populated via esco_skills.id (14011 UUID entries). The URI in
-- esco_skill_relations DOES NOT MATCH lineage source_record_id directly.
--
-- Resolution strategies per source:
--
--   Source                       | Parent col          | Child col            | Lineage match
--   -----------------------------|---------------------|----------------------|------------------
--   esco_skill_relations         | skill_uri           | related_skill_uri    | ✗ URI not in lineage  → URI→UUID intermediate lookup needed
--   skill_adjacencies            | skill_id (uuid)     | adjacent_skill_id    | ✓ matches esco_skills.id lineage entries
--   onet_esco_mappings           | esco_occupation_id  | esco_skill_id        | ≈ depends (esco_skills.id)
--   ontology_skill_relations     | source_skill_id     | target_skill_id      | ≈ depends (internal skill UUIDs)
--   skill_taxonomy_extensions    | skill_id            | (no child)            | partial: only parent col
--   skill_pair_usage             | skill_id_1          | skill_id_2           | ≈ depends
--   semantic_entity_relations    | source_entity_id    | target_entity_id     | filter by entity_type='skill'
--   skill_matrices               | entity_id (jsonb!)  | varies                | LOW: structure mismatch
--   cross_entity_relations       | source_entity_id    | target_entity_id     | filter by entity_type
--   ontology_source_mappings     | source_id (varchar) | target_id (uuid)     | LOW: source_id is varchar
--
-- HONEST ASSESSMENT: of 17924 staged rows, realistic unlock is 12-15k
-- (skill_adjacencies 11634 + good slice of ontology_skill_relations/skill_pair_usage).
-- The URI-based sources (esco_skill_relations 5818) will largely fail
-- LOOKUP_FK_UNRESOLVABLE without an additional URI→UUID translation layer.
--
-- DECISION: author the 9 highest-confidence pairs. Defer URI-based path
-- (esco_skill_relations) until a `legacy_uri` column is added to sys_skills
-- lineage OR the transform-compiler supports URI→lineage matching natively.
--
-- §3 — Discovery queries — pre-INSERT verification
-- ----------------------------------------------------------------------------

-- §3.1 sys_skills + lineage state
SELECT 'sys_skills_rows' AS k, COUNT(*) AS v FROM sys.sys_skills
UNION ALL
SELECT 'sys_skills_lineage', COUNT(*) FROM sys.sys_source_lineage_records
  WHERE source_lineage_target_table_name='sys_skills';
-- Expected: 14455 / ~14300

-- §3.2 Detailed lineage breakdown for sys_skills
SELECT source_lineage_source_table, COUNT(*) AS n
FROM sys.sys_source_lineage_records
WHERE source_lineage_target_table_name='sys_skills'
GROUP BY 1
ORDER BY 2 DESC LIMIT 10;
-- Expected: esco_skills 14011, ontology_feedback 52, ontology_quality_metrics 50, ...


-- §4 — Authoring SQL — idempotent INSERTs
-- ============================================================================

BEGIN;

-- §4.1 Synthetic aliases — 9 sources × 2 cols (parent + child) = 18 aliases
-- Source ordinal_position 9001 = parent_alias, 9002 = child_alias

INSERT INTO brownfield.source_columns (
  source_column_id, source_column_table_id, source_column_name,
  source_column_data_type, source_column_is_nullable, source_column_ordinal_position
)
SELECT gen_random_uuid(), src.tid, src.alias_name, src.dtype, true, src.pos
FROM (VALUES
  -- skill_adjacencies (HIGH confidence — direct UUID match to esco_skills.id lineage)
  ('50e02d97-799e-4b6a-98da-8e4670943c2b'::uuid, 'skill_id__fk_parent_alias',                       'uuid', 9001),
  ('50e02d97-799e-4b6a-98da-8e4670943c2b'::uuid, 'adjacent_skill_id__fk_child_alias',               'uuid', 9002),
  -- onet_esco_mappings
  ('fe53940e-0aad-457e-a9c2-068e5a48de11'::uuid, 'esco_occupation_id__fk_parent_alias',             'uuid', 9001),
  ('fe53940e-0aad-457e-a9c2-068e5a48de11'::uuid, 'esco_skill_id__fk_child_alias',                   'uuid', 9002),
  -- ontology_skill_relations
  ('b9e611e5-b9c3-4c38-acfd-221ab7389fc0'::uuid, 'source_skill_id__fk_parent_alias',                'uuid', 9001),
  ('b9e611e5-b9c3-4c38-acfd-221ab7389fc0'::uuid, 'target_skill_id__fk_child_alias',                 'uuid', 9002),
  -- skill_pair_usage
  ('aebc8dd8-f824-4325-bb6e-9478ed3bd55e'::uuid, 'skill_id_1__fk_parent_alias',                     'uuid', 9001),
  ('aebc8dd8-f824-4325-bb6e-9478ed3bd55e'::uuid, 'skill_id_2__fk_child_alias',                      'uuid', 9002),
  -- semantic_entity_relations (filter: entity_type='skill' — left to staging filter)
  ('5cd3e72b-fcf9-4398-9a3b-bcdd0763a4f0'::uuid, 'source_entity_id__fk_parent_alias',               'uuid', 9001),
  ('5cd3e72b-fcf9-4398-9a3b-bcdd0763a4f0'::uuid, 'target_entity_id__fk_child_alias',                'uuid', 9002),
  -- cross_entity_relations
  ('5f598197-7f4e-4416-aa6b-c6108edbc68e'::uuid, 'source_entity_id__fk_parent_alias',               'uuid', 9001),
  ('5f598197-7f4e-4416-aa6b-c6108edbc68e'::uuid, 'target_entity_id__fk_child_alias',                'uuid', 9002),
  -- skill_taxonomy_extensions (only parent — extension applies to a single skill)
  ('4158b79f-f372-473c-aa76-908a3860c042'::uuid, 'skill_id__fk_parent_alias',                       'uuid', 9001),
  -- ontology_source_mappings (target_id is uuid; source_id is varchar → skip parent alias)
  ('7d7f3fd6-1d8e-416a-9860-fcec91bed2e5'::uuid, 'target_id__fk_child_alias',                       'uuid', 9002),
  -- skill_matrices (entity_id may be json/uuid; defer — pos 9001 only as best-effort)
  ('691e5323-0897-4806-a141-0a715811fcff'::uuid, 'entity_id__fk_parent_alias',                      'uuid', 9001)
) AS src(tid, alias_name, dtype, pos)
WHERE NOT EXISTS (
  SELECT 1 FROM brownfield.source_columns sc
  WHERE sc.source_column_table_id=src.tid AND sc.source_column_name=src.alias_name
);

-- §4.2 LOOKUP_FK mappings
-- For each source above, INSERT mapping to skill_taxonomy_edge_parent_id and/or
-- skill_taxonomy_edge_child_id. Using a single multi-row INSERT-SELECT for brevity.

INSERT INTO brownfield.column_mappings (
  column_mapping_id, column_mapping_table_mapping_id, column_mapping_source_column_id,
  column_mapping_target_column, column_mapping_transform, column_mapping_transform_payload,
  column_mapping_pii_disposition
)
SELECT
  gen_random_uuid(),
  pairs.tm_id,
  sc.source_column_id,
  pairs.target_col,
  'LOOKUP_FK',
  jsonb_build_object(
    'target_table', 'sys_skills',
    'match_on', 'skill_metadata->>''legacy_id''',
    'aliased_from', pairs.aliased_from,
    'fallback_policy', 'NULL_THEN_UNRESOLVABLE',
    'authored_by', 'cowork_batch_c2_2',
    'cascade_fix_for', pairs.fix_reason,
    'expected_coverage', pairs.coverage_note
  ),
  'NONE'
FROM brownfield.source_columns sc
JOIN (VALUES
  -- (alias_name, source_table_id, table_mapping_id, target_col, aliased_from, fix_reason, coverage)

  -- skill_adjacencies
  ('skill_id__fk_parent_alias',          '50e02d97-799e-4b6a-98da-8e4670943c2b'::uuid, 'a8753f6b-2a4f-4fc5-b300-07028c6ae1a3'::uuid, 'skill_taxonomy_edge_parent_id', 'skill_id',          'nk_missing_skill_taxonomy_edge_parent_id', 'HIGH (11634 rows; esco_skills.id lineage)'),
  ('adjacent_skill_id__fk_child_alias',  '50e02d97-799e-4b6a-98da-8e4670943c2b'::uuid, 'a8753f6b-2a4f-4fc5-b300-07028c6ae1a3'::uuid, 'skill_taxonomy_edge_child_id',  'adjacent_skill_id', 'nk_missing_skill_taxonomy_edge_child_id',  'HIGH (11634 rows; esco_skills.id lineage)'),

  -- onet_esco_mappings
  ('esco_occupation_id__fk_parent_alias','fe53940e-0aad-457e-a9c2-068e5a48de11'::uuid, '18eb07d3-3f76-467e-a458-c1f9ffcf2a27'::uuid, 'skill_taxonomy_edge_parent_id', 'esco_occupation_id','nk_missing_skill_taxonomy_edge_parent_id', 'LOW (occupation_id != skill_id; semantic mismatch — may fully fail)'),
  ('esco_skill_id__fk_child_alias',      'fe53940e-0aad-457e-a9c2-068e5a48de11'::uuid, '18eb07d3-3f76-467e-a458-c1f9ffcf2a27'::uuid, 'skill_taxonomy_edge_child_id',  'esco_skill_id',     'nk_missing_skill_taxonomy_edge_child_id',  'MEDIUM (esco_skill_id may match lineage)'),

  -- ontology_skill_relations
  ('source_skill_id__fk_parent_alias',   'b9e611e5-b9c3-4c38-acfd-221ab7389fc0'::uuid, 'fcd69494-d075-435d-9cc7-5b71fe38c9f5'::uuid, 'skill_taxonomy_edge_parent_id', 'source_skill_id',   'nk_missing_skill_taxonomy_edge_parent_id', 'MEDIUM (30 rows; internal skill UUIDs)'),
  ('target_skill_id__fk_child_alias',    'b9e611e5-b9c3-4c38-acfd-221ab7389fc0'::uuid, 'fcd69494-d075-435d-9cc7-5b71fe38c9f5'::uuid, 'skill_taxonomy_edge_child_id',  'target_skill_id',   'nk_missing_skill_taxonomy_edge_child_id',  'MEDIUM (30 rows)'),

  -- skill_pair_usage
  ('skill_id_1__fk_parent_alias',        'aebc8dd8-f824-4325-bb6e-9478ed3bd55e'::uuid, 'acc0d592-1596-4088-ad04-8c01f9b4259b'::uuid, 'skill_taxonomy_edge_parent_id', 'skill_id_1',        'nk_missing_skill_taxonomy_edge_parent_id', 'MEDIUM (111 rows)'),
  ('skill_id_2__fk_child_alias',         'aebc8dd8-f824-4325-bb6e-9478ed3bd55e'::uuid, 'acc0d592-1596-4088-ad04-8c01f9b4259b'::uuid, 'skill_taxonomy_edge_child_id',  'skill_id_2',        'nk_missing_skill_taxonomy_edge_child_id',  'MEDIUM (111 rows)'),

  -- semantic_entity_relations
  ('source_entity_id__fk_parent_alias',  '5cd3e72b-fcf9-4398-9a3b-bcdd0763a4f0'::uuid, 'b8bb3104-6903-4ad7-ab60-21b01a3d1448'::uuid, 'skill_taxonomy_edge_parent_id', 'source_entity_id',  'nk_missing_skill_taxonomy_edge_parent_id', 'LOW (15 rows; entity_type filter at stage)'),
  ('target_entity_id__fk_child_alias',   '5cd3e72b-fcf9-4398-9a3b-bcdd0763a4f0'::uuid, 'b8bb3104-6903-4ad7-ab60-21b01a3d1448'::uuid, 'skill_taxonomy_edge_child_id',  'target_entity_id',  'nk_missing_skill_taxonomy_edge_child_id',  'LOW (15 rows)'),

  -- cross_entity_relations
  ('source_entity_id__fk_parent_alias',  '5f598197-7f4e-4416-aa6b-c6108edbc68e'::uuid, '9cf8c413-0970-4b71-ae74-4c941c1cf902'::uuid, 'skill_taxonomy_edge_parent_id', 'source_entity_id',  'nk_missing_skill_taxonomy_edge_parent_id', 'LOW (85 rows; entity_type filter at stage)'),
  ('target_entity_id__fk_child_alias',   '5f598197-7f4e-4416-aa6b-c6108edbc68e'::uuid, '9cf8c413-0970-4b71-ae74-4c941c1cf902'::uuid, 'skill_taxonomy_edge_child_id',  'target_entity_id',  'nk_missing_skill_taxonomy_edge_child_id',  'LOW (85 rows)'),

  -- skill_taxonomy_extensions (parent only)
  ('skill_id__fk_parent_alias',          '4158b79f-f372-473c-aa76-908a3860c042'::uuid, 'e707ba5b-8ed2-4b30-9223-455236a0ade2'::uuid, 'skill_taxonomy_edge_parent_id', 'skill_id',          'nk_missing_skill_taxonomy_edge_parent_id', 'MEDIUM (52 rows; child stays unresolvable for extensions — accept partial)'),

  -- ontology_source_mappings (child only)
  ('target_id__fk_child_alias',          '7d7f3fd6-1d8e-416a-9860-fcec91bed2e5'::uuid, '3b53599e-7eeb-4ae3-8bc7-1cb738b2f51f'::uuid, 'skill_taxonomy_edge_child_id',  'target_id',         'nk_missing_skill_taxonomy_edge_child_id',  'LOW (40 rows; target_id may not be skill UUID)'),

  -- skill_matrices (parent only, best-effort)
  ('entity_id__fk_parent_alias',         '691e5323-0897-4806-a141-0a715811fcff'::uuid, '9d3c0b8c-65ea-41b6-a5bf-3858c90ab74f'::uuid, 'skill_taxonomy_edge_parent_id', 'entity_id',         'nk_missing_skill_taxonomy_edge_parent_id', 'LOW (4 rows; entity_id may be other entity)')
) AS pairs(alias_name, source_table_id, tm_id, target_col, aliased_from, fix_reason, coverage_note)
  ON pairs.source_table_id=sc.source_column_table_id AND pairs.alias_name=sc.source_column_name
WHERE NOT EXISTS (
  SELECT 1 FROM brownfield.column_mappings cm
  WHERE cm.column_mapping_table_mapping_id=pairs.tm_id
    AND cm.column_mapping_source_column_id=sc.source_column_id
);

COMMIT;

-- DEFERRED (not in this batch):
--   - esco_skill_relations.skill_uri + related_skill_uri
--     Requires URI→UUID lineage layer (e.g. an INDEX on
--     source_lineage_metadata->>'esco_uri' or a new lineage entry per esco_skills.uri).
--     Decision: defer to a separate authoring batch (C2.3?) after engine.ts
--     supports varchar URI matching in lineage JOIN.
--   - import_skill_links (0 rows in mirror, source-empty)


-- §5 — Pre-INSERT verification
-- ============================================================================
SELECT 'sys_skills_prereq' AS check, (SELECT COUNT(*) FROM sys.sys_skills) AS rows;
-- Expected: ≥ 14000

SELECT 'esco_skills_lineage' AS check,
  (SELECT COUNT(*) FROM sys.sys_source_lineage_records
   WHERE source_lineage_target_table_name='sys_skills'
     AND source_lineage_source_table='esco_skills') AS rows;
-- Expected: ~14011

SELECT 'skill_adjacencies_mirror' AS check,
  (SELECT COUNT(*) FROM legacy_mirror.skill_adjacencies) AS rows;
-- Expected: 11634 (post-X1 MIRROR-GAP-fix)


-- §6 — Post-INSERT verification (after Wave 1 retry)
-- ============================================================================
SELECT COUNT(*) FROM sys.sys_skill_taxonomy_edges;
-- Acceptance per diagnostic §4: ≥ 5000.
-- Realistic estimate:
--   - skill_adjacencies: 11634 rows × ~0.95 resolution (esco_skills.id lineage) = ~11000
--   - skill_pair_usage: 111 × 0.5 = ~55
--   - ontology_skill_relations: 30 × 0.5 = ~15
--   - others: marginal
--   - TOTAL realistic: ~11000-12000 (after UQ-collapse on (parent,child,kind))
--   - LEGITIMATE unresolved: ~5000-6000 from esco_skill_relations URIs (deferred)

SELECT
  import_validation_result_payload->>'exclusion_reason' AS reason,
  COUNT(*)
FROM audit.import_validation_results
WHERE import_validation_result_rule_code='WHERE_SKIP_FILTER_EXCLUDED_V1'
  AND import_validation_result_payload->>'target_table'='sys_skill_taxonomy_edges'
  AND created_at > (SELECT MAX(import_run_started_at) FROM brownfield.import_runs)
GROUP BY 1
ORDER BY 2 DESC;
-- Expected: nk_missing_*_parent_id → ~0; LOOKUP_FK_UNRESOLVABLE residual for URI sources.


-- §7 — Risk + rollback
-- ============================================================================
-- HIGH RISK (R-05): URI vs UUID source mismatch in esco_skill_relations.
-- Defer URI sources to a separate authoring round once URI lineage available.
-- This fix prioritizes skill_adjacencies (largest, cleanest UUID-based).
--
-- Rollback:
-- DELETE FROM brownfield.column_mappings
-- WHERE column_mapping_transform='LOOKUP_FK'
--   AND column_mapping_transform_payload->>'authored_by'='cowork_batch_c2_2'
--   AND column_mapping_target_column IN (
--     'skill_taxonomy_edge_parent_id',
--     'skill_taxonomy_edge_child_id'
--   );
-- DELETE FROM brownfield.source_columns
-- WHERE source_column_name LIKE '%__fk_parent_alias'
--    OR source_column_name LIKE '%__fk_child_alias';
