-- ============================================================================
-- Class B Cascade Fix — sys_esco_occupation_mappings
-- Batch C2.2 P1, authored 2026-05-21 by Cowork autonomous
-- Confidence: MEDIUM (cascade depends on sys_job_roles populated FIRST)
-- ============================================================================
-- §1 — Context recap (from batch_c1/class_b_diagnostics/sys_esco_occupation_mappings.md)
-- ----------------------------------------------------------------------------
-- Target rows pre: 0
-- Staged rows: 7645 (the LARGEST silent skip — 18.5% of all staged)
-- Silent skip reason (CW-B17 audit): nk_missing_esco_occupation_mapping_job_role_id
-- Cascade prereq: sys_job_roles ≥ 140 (this fix runs AFTER 01_sys_job_roles_*)
-- Required NOT NULL UUID col: esco_occupation_mapping_job_role_id (FK → sys_job_roles)
-- Existing LOOKUP_FK count: 0
-- Sources (5):
--   - esco_occupations (3040 rows in mirror)
--   - onet_occupations (25)
--   - onet_esco_mappings (135)
--   - occupation_industry_classifications (4565)
--   - industry_occupation_mapping (15)
--
-- §2 — Authoring approach
-- ----------------------------------------------------------------------------
-- Pattern: SYNTHETIC ALIAS column + LOOKUP_FK form (b) lineage JOIN to sys_job_roles.
--
-- HONEST ASSESSMENT: ESCO occupations are a CATALOG (universal taxonomy), not
-- per-organization job roles. The "esco_occupation_mapping_job_role_id" FK is
-- semantically forced — there is no natural unique mapping from a public ESCO
-- occupation URI to an org-specific job role in the legacy schema.
--
-- Realistic resolution paths:
--
--   Source                              | Linking signal                  | Coverage estimate
--   ------------------------------------|---------------------------------|------------------
--   esco_occupations                    | uri (matches job_templates.     | ~91/3040 (3%)
--                                       |   esco_occupation_uri lineage)  |
--   onet_occupations                    | onet_soc_code (no FK to jobs)   | ~0/25 (0%)
--   onet_esco_mappings                  | esco_uri → same as above        | ~30/135 (22%)
--   occupation_industry_classifications | occupation_id (UUID of internal | depends on
--                                       |   occupation; no direct job_role)|   intermediate
--   industry_occupation_mapping         | esco_occupation_uri             | ~12/15 (80%)
--
-- Expected partial unlock: ~1500-2500 rows out of 7645 staged. Remaining
-- ~5000+ will be classified as LOOKUP_FK_UNRESOLVABLE (legitimate — ESCO
-- catalog rows with no matching org job role).
--
-- RECOMMENDED ALTERNATIVE: relax esco_occupation_mapping_job_role_id to
-- NULLABLE (migration 000036). ESCO catalog is enrichment, not transactional.
-- See batch_c1/class_b_diagnostics/sys_esco_occupation_mappings.md §3
-- Alternative.
--
-- This fix proceeds with the partial-unlock authoring path (preserves I7
-- tenant-isolated invariant, additive only).
--
-- §3 — Discovery queries — pre-INSERT verification
-- ----------------------------------------------------------------------------
-- §3.1 PRE-REQUISITE: sys_job_roles must be populated (PHASE A complete)
SELECT 'sys_job_roles_rows' AS k, COUNT(*) AS v FROM sys.sys_job_roles
UNION ALL
SELECT 'sys_job_roles_lineage', COUNT(*) FROM sys.sys_source_lineage_records
  WHERE source_lineage_target_table_name='sys_job_roles';
-- Expected: ≥ 140 / ≥ 140
-- ⚠ IF v=0 → STOP. Run 01_sys_job_roles_*.sql first + Wave 1 retry.
-- §3.2 source_columns we'll alias (esco_occupation_uri / esco_uri primary)
SELECT st.source_table_name, sc.source_column_name, sc.source_column_id
FROM brownfield.source_columns sc
JOIN brownfield.source_tables st ON st.source_table_id=sc.source_column_table_id
WHERE (st.source_table_name='esco_occupations' AND sc.source_column_name='uri')
   OR (st.source_table_name='onet_esco_mappings' AND sc.source_column_name='esco_uri')
   OR (st.source_table_name='industry_occupation_mapping' AND sc.source_column_name='esco_occupation_uri')
   OR (st.source_table_name='occupation_industry_classifications' AND sc.source_column_name='occupation_id')
   OR (st.source_table_name='onet_occupations' AND sc.source_column_name='onet_soc_code');
-- §4 — Authoring SQL — idempotent INSERTs
-- ============================================================================
BEGIN;
-- §4.1 Synthetic aliases (5 sources, 1 alias each)
INSERT INTO brownfield.source_columns (
  source_column_id, source_column_table_id, source_column_name,
  source_column_data_type, source_column_is_nullable, source_column_ordinal_position
)
SELECT gen_random_uuid(), src.tid, src.alias_name, 'character varying', true, 9001
FROM (VALUES
  ('ae236093-7e3a-4fcc-a840-9c9ac00df167'::uuid, 'uri__fk_job_role_alias'),                              -- esco_occupations
  ('a499e3d8-21ec-4576-9525-1827c27ed5d4'::uuid, 'onet_soc_code__fk_job_role_alias'),                    -- onet_occupations
  ('fe53940e-0aad-457e-a9c2-068e5a48de11'::uuid, 'esco_uri__fk_job_role_alias'),                         -- onet_esco_mappings
  ('67af7f63-f2f2-41b6-bd50-4c197a3ca205'::uuid, 'occupation_id__fk_job_role_alias'),                    -- occupation_industry_classifications
  ('39f25f1b-dbed-4ea5-9f97-083dea07a2aa'::uuid, 'esco_occupation_uri__fk_job_role_alias')               -- industry_occupation_mapping
) AS src(tid, alias_name)
WHERE NOT EXISTS (
  SELECT 1 FROM brownfield.source_columns sc
  WHERE sc.source_column_table_id=src.tid AND sc.source_column_name=src.alias_name
);
-- §4.2 LOOKUP_FK mappings — 5 INSERTs (1 per source → target esco_occupation_mapping_job_role_id)
-- esco_occupations
INSERT INTO brownfield.column_mappings (
  column_mapping_id, column_mapping_table_mapping_id, column_mapping_source_column_id,
  column_mapping_target_column, column_mapping_transform, column_mapping_transform_payload,
  column_mapping_pii_disposition
)
SELECT gen_random_uuid(),
  'fd3c1393-8211-4004-91e6-3239d463214d'::uuid,
  sc.source_column_id,
  'esco_occupation_mapping_job_role_id',
  'LOOKUP_FK',
  jsonb_build_object(
    'target_table', 'sys_job_roles',
    'match_on', 'job_role_metadata->>''legacy_id''',
    'aliased_from', 'uri',
    'fallback_policy', 'NULL_THEN_UNRESOLVABLE',
    'authored_by', 'cowork_batch_c2_2',
    'cascade_fix_for', 'nk_missing_esco_occupation_mapping_job_role_id (CW-B17)'
  ),
  'NONE'
FROM brownfield.source_columns sc
WHERE sc.source_column_table_id='ae236093-7e3a-4fcc-a840-9c9ac00df167'::uuid
  AND sc.source_column_name='uri__fk_job_role_alias'
  AND NOT EXISTS (
    SELECT 1 FROM brownfield.column_mappings cm
    WHERE cm.column_mapping_table_mapping_id='fd3c1393-8211-4004-91e6-3239d463214d'::uuid
      AND cm.column_mapping_source_column_id=sc.source_column_id
  );
-- onet_occupations
INSERT INTO brownfield.column_mappings (
  column_mapping_id, column_mapping_table_mapping_id, column_mapping_source_column_id,
  column_mapping_target_column, column_mapping_transform, column_mapping_transform_payload,
  column_mapping_pii_disposition
)
SELECT gen_random_uuid(),
  '0b0bf9ac-cdce-416e-a4cd-8bb8f2da140e'::uuid,
  sc.source_column_id,
  'esco_occupation_mapping_job_role_id',
  'LOOKUP_FK',
  jsonb_build_object(
    'target_table', 'sys_job_roles',
    'match_on', 'job_role_metadata->>''legacy_id''',
    'aliased_from', 'onet_soc_code',
    'fallback_policy', 'NULL_THEN_UNRESOLVABLE',
    'authored_by', 'cowork_batch_c2_2',
    'cascade_fix_for', 'nk_missing_esco_occupation_mapping_job_role_id (CW-B17)'
  ),
  'NONE'
FROM brownfield.source_columns sc
WHERE sc.source_column_table_id='a499e3d8-21ec-4576-9525-1827c27ed5d4'::uuid
  AND sc.source_column_name='onet_soc_code__fk_job_role_alias'
  AND NOT EXISTS (
    SELECT 1 FROM brownfield.column_mappings cm
    WHERE cm.column_mapping_table_mapping_id='0b0bf9ac-cdce-416e-a4cd-8bb8f2da140e'::uuid
      AND cm.column_mapping_source_column_id=sc.source_column_id
  );
-- onet_esco_mappings
INSERT INTO brownfield.column_mappings (
  column_mapping_id, column_mapping_table_mapping_id, column_mapping_source_column_id,
  column_mapping_target_column, column_mapping_transform, column_mapping_transform_payload,
  column_mapping_pii_disposition
)
SELECT gen_random_uuid(),
  -- NB: onet_esco_mappings is also a source for sys_skill_taxonomy_edges (see file 04).
  -- The table_mapping_id below is the one for sys_esco_occupation_mappings.
  -- ⚠ DISCOVERY: live shows onet_esco_mappings is NOT listed as source for
  -- sys_esco_occupation_mappings (no entry for that pair in brownfield.table_mappings).
  -- The diagnostic file lists 5 sources but live shows only 4. Re-check before applying.
  -- Skipping this INSERT pending CLI verification.
  NULL::uuid,
  sc.source_column_id,
  'esco_occupation_mapping_job_role_id',
  'LOOKUP_FK',
  jsonb_build_object(
    'target_table', 'sys_job_roles',
    'match_on', 'job_role_metadata->>''legacy_id''',
    'aliased_from', 'esco_uri',
    'fallback_policy', 'NULL_THEN_UNRESOLVABLE',
    'authored_by', 'cowork_batch_c2_2',
    'note', 'PENDING VERIFICATION — table_mapping_id for onet_esco_mappings→sys_esco_occupation_mappings not found in live registry. Re-confirm CLI-side.',
    'cascade_fix_for', 'nk_missing_esco_occupation_mapping_job_role_id (CW-B17)'
  ),
  'NONE'
FROM brownfield.source_columns sc
WHERE sc.source_column_table_id='fe53940e-0aad-457e-a9c2-068e5a48de11'::uuid
  AND sc.source_column_name='esco_uri__fk_job_role_alias'
  AND FALSE;  -- ⚠ DISABLED until CLI verifies table_mapping for this pair
-- occupation_industry_classifications
INSERT INTO brownfield.column_mappings (
  column_mapping_id, column_mapping_table_mapping_id, column_mapping_source_column_id,
  column_mapping_target_column, column_mapping_transform, column_mapping_transform_payload,
  column_mapping_pii_disposition
)
SELECT gen_random_uuid(),
  '52c9d253-8b4e-48f4-aacc-a6182efe9537'::uuid,
  sc.source_column_id,
  'esco_occupation_mapping_job_role_id',
  'LOOKUP_FK',
  jsonb_build_object(
    'target_table', 'sys_job_roles',
    'match_on', 'job_role_metadata->>''legacy_id''',
    'aliased_from', 'occupation_id',
    'fallback_policy', 'NULL_THEN_UNRESOLVABLE',
    'authored_by', 'cowork_batch_c2_2',
    'cascade_fix_for', 'nk_missing_esco_occupation_mapping_job_role_id (CW-B17)'
  ),
  'NONE'
FROM brownfield.source_columns sc
WHERE sc.source_column_table_id='67af7f63-f2f2-41b6-bd50-4c197a3ca205'::uuid
  AND sc.source_column_name='occupation_id__fk_job_role_alias'
  AND NOT EXISTS (
    SELECT 1 FROM brownfield.column_mappings cm
    WHERE cm.column_mapping_table_mapping_id='52c9d253-8b4e-48f4-aacc-a6182efe9537'::uuid
      AND cm.column_mapping_source_column_id=sc.source_column_id
  );
-- industry_occupation_mapping
INSERT INTO brownfield.column_mappings (
  column_mapping_id, column_mapping_table_mapping_id, column_mapping_source_column_id,
  column_mapping_target_column, column_mapping_transform, column_mapping_transform_payload,
  column_mapping_pii_disposition
)
SELECT gen_random_uuid(),
  'd056cbb5-8f7f-4a28-abc1-9563b7699d43'::uuid,
  sc.source_column_id,
  'esco_occupation_mapping_job_role_id',
  'LOOKUP_FK',
  jsonb_build_object(
    'target_table', 'sys_job_roles',
    'match_on', 'job_role_metadata->>''legacy_id''',
    'aliased_from', 'esco_occupation_uri',
    'fallback_policy', 'NULL_THEN_UNRESOLVABLE',
    'authored_by', 'cowork_batch_c2_2',
    'cascade_fix_for', 'nk_missing_esco_occupation_mapping_job_role_id (CW-B17)'
  ),
  'NONE'
FROM brownfield.source_columns sc
WHERE sc.source_column_table_id='39f25f1b-dbed-4ea5-9f97-083dea07a2aa'::uuid
  AND sc.source_column_name='esco_occupation_uri__fk_job_role_alias'
  AND NOT EXISTS (
    SELECT 1 FROM brownfield.column_mappings cm
    WHERE cm.column_mapping_table_mapping_id='d056cbb5-8f7f-4a28-abc1-9563b7699d43'::uuid
      AND cm.column_mapping_source_column_id=sc.source_column_id
  );
COMMIT;
-- §5 — Pre-INSERT verification
-- ============================================================================
SELECT 'sys_job_roles_prereq' AS check, (SELECT COUNT(*) > 0 FROM sys.sys_job_roles) AS pass;
-- Expected: pass=true. If false → STOP, apply 01_sys_job_roles_*.sql first.
-- §6 — Post-INSERT verification (after Wave 1 retry)
-- ============================================================================
SELECT COUNT(*) FROM sys.sys_esco_occupation_mappings;
-- Acceptance: ≥ 1500 (partial unlock realistic). Diagnostic file aims for ≥ 3000.
SELECT
  import_validation_result_payload->>'exclusion_reason' AS reason,
  COUNT(*)
FROM audit.import_validation_results
WHERE import_validation_result_rule_code='WHERE_SKIP_FILTER_EXCLUDED_V1'
  AND import_validation_result_payload->>'target_table'='sys_esco_occupation_mappings'
  AND created_at > (SELECT MAX(import_run_started_at) FROM brownfield.import_runs)
GROUP BY 1
ORDER BY 2 DESC;
-- Expected: original block reason → reduced; LOOKUP_FK_UNRESOLVABLE may appear
--           for ESCO catalog rows with no matching job_role (~5000+ legitimate).
-- §7 — Risk + rollback
-- ============================================================================
-- HIGH RISK: see R-06 in 00_README §5. Likely PARTIAL unlock only (~20-40%).
-- If acceptance criteria fails (< 1500 rows), escalate to architectural relax
-- (nullable FK migration 000036).
--
-- Rollback:
-- DELETE FROM brownfield.column_mappings
-- WHERE column_mapping_transform='LOOKUP_FK'
--   AND column_mapping_transform_payload->>'authored_by'='cowork_batch_c2_2'
--   AND column_mapping_target_column='esco_occupation_mapping_job_role_id';
-- DELETE FROM brownfield.source_columns
-- WHERE source_column_name LIKE '%__fk_job_role_alias';
