-- =============================================================================
-- X9 SKILGRO mega-bundle Block B + C + D SQL changes
-- Author: CLI X9 (2026-05-23)
-- Spec: cowork_code_exchange/_01_PROMPT_013_batch_x9.md §4 §5 §6
--       cowork_reserved/batch_c9/sys_learning_modules_forensic/01_FORENSIC.md
--       cowork_reserved/batch_c9/cw_b35_phase_bc/01_FORENSIC.md
-- Inline Mitigation Scope authorized: PROMPT §0
-- =============================================================================

BEGIN;

-- =========================================================================
-- Block B — Canonical learning re-mapping (Option B revised per FORENSIC §3.1'/§3.2')
-- =========================================================================

-- §B.0 — Re-classify legacy courses → sys_learning_modules to REFERENCE_ONLY
-- Rationale: spec REVISED chooses Option B (courses are "paths", course_modules
-- are "modules"); the older Option-A mapping (eb431a77) never produced lineage
-- rows so no data loss occurs by re-classifying.
UPDATE brownfield.table_mappings
   SET table_mapping_classification = 'REFERENCE_ONLY',
       table_mapping_metadata = jsonb_set(
         coalesce(table_mapping_metadata, '{}'::jsonb),
         '{reclassified_reason}',
         to_jsonb('CW-X9 Block B (Cowork C9.3): replaced by Option B revised — courses now → sys_learning_paths; course_modules → sys_learning_modules. Original Option-A mapping never produced lineage rows (0 imported), no data loss.'::text)
       ),
       updated_at = NOW()
 WHERE table_mapping_id = 'eb431a77-7764-422f-af4b-5f4b9d5c1213';

-- §B.1 — courses → sys_learning_paths (canonical path semantics)
-- Generate fresh table_mapping_id; INSERT column_mappings via embedded CTE.
WITH new_tm AS (
  INSERT INTO brownfield.table_mappings (
    table_mapping_id,
    table_mapping_source_table_id,
    table_mapping_target_schema,
    table_mapping_target_table,
    table_mapping_classification,
    table_mapping_approval_status,
    table_mapping_rationale,
    table_mapping_metadata,
    table_mapping_wave
  ) VALUES (
    gen_random_uuid(),
    '40aef58b-b597-47cf-b0a7-5fdc57ed89bb', -- courses
    'sys',
    'sys_learning_paths',
    'IMPORT',
    'APPROVED',
    'X9 Block B (Cowork C9.3, Option B revised): legacy `courses` are semantically learning *paths* (ordered sequences of modules). Canonical lineage feed for sys_learning_paths.',
    jsonb_build_object('origin','X9_block_B','spec','01_FORENSIC.md_§3.1prime'),
    1
  )
  RETURNING table_mapping_id
)
INSERT INTO brownfield.column_mappings (
  column_mapping_id, column_mapping_table_mapping_id, column_mapping_source_column_id,
  column_mapping_target_column, column_mapping_transform, column_mapping_transform_payload,
  column_mapping_metadata
)
SELECT gen_random_uuid(), (SELECT table_mapping_id FROM new_tm), sc.col_id, sc.target_col, sc.xform, sc.payload::jsonb, '{}'::jsonb
FROM (VALUES
  ('5d3e3c5f-33b7-4843-a883-7fe3af7ff92b'::uuid, 'learning_path_id',          'LINEAGE_SOURCE_NK', '{"note": "legacy primary key stored on lineage row"}'),
  ('cdba9a20-6a7e-4e0f-b464-f031d6b1cd5e'::uuid, 'learning_path_code',        'TRIM',              '{}'),
  ('e717660c-6f69-4340-a207-4e34501e8b3d'::uuid, 'learning_path_name',        'TRIM',              '{}'),
  ('f8d1c391-7d48-4b26-a096-42c20aaac179'::uuid, 'learning_path_name',        'TRIM',              '{"note": "EN fallback"}'),
  ('fbf3b7f3-6b3c-43e4-b994-4a808ed040a6'::uuid, 'learning_path_description', 'TRIM',              '{}'),
  ('78dc484d-f5fd-41cb-a44a-d3dad0a433cf'::uuid, 'learning_path_description', 'TRIM',              '{"note": "EN fallback"}'),
  ('4ab18e71-861d-4f89-9175-82ef6992dc58'::uuid, 'learning_path_tenant_id',   'LOOKUP_FK',         '{"match_on": "legacy_tenant_id", "target_table": "sys_tenancies"}'),
  ('3a010edd-2b6c-4e69-950c-59a6f8b85150'::uuid, 'created_at',                'CAST_TIMESTAMPTZ',  '{}'),
  ('53926892-3006-4563-b105-781d79d02af8'::uuid, 'updated_at',                'CAST_TIMESTAMPTZ',  '{}'),
  ('da812990-2836-4f63-955a-2bb57830f38f'::uuid, 'created_by',                'LOOKUP_FK',         '{"match_on": "legacy_user_id", "target_table": "sys_users"}'),
  ('807fa5bd-a87a-41c3-b22e-2c716e0e9523'::uuid, 'learning_path_metadata',    'JSON_EXTRACT',      '{"path": "$.legacy.course_type", "direction": "embed", "source_dtype": "character varying"}'),
  ('e63259b3-393c-4e54-b434-8040aa93a77a'::uuid, 'learning_path_metadata',    'JSON_EXTRACT',      '{"path": "$.legacy.category", "direction": "embed", "source_dtype": "character varying"}'),
  ('36a16ed0-6004-4ffc-b1ad-3c43e9a7c6a6'::uuid, 'learning_path_metadata',    'JSON_EXTRACT',      '{"path": "$.legacy.duration_hours", "direction": "embed", "source_dtype": "numeric"}'),
  ('b5c5fd26-dfbd-4971-a6f3-6da042bf71ba'::uuid, 'learning_path_metadata',    'JSON_EXTRACT',      '{"path": "$.legacy.skill_level", "direction": "embed", "source_dtype": "character varying"}'),
  ('cd1a407c-b057-4e03-8a49-12ee29220103'::uuid, 'learning_path_metadata',    'JSON_EXTRACT',      '{"path": "$.legacy.provider", "direction": "embed", "source_dtype": "character varying"}'),
  ('f51f76a8-cb6d-4431-ad70-533da847e9eb'::uuid, 'learning_path_metadata',    'JSON_EXTRACT',      '{"path": "$.legacy.provider_course_id", "direction": "embed", "source_dtype": "character varying"}'),
  ('15e9bf96-1ca8-42dc-bcf1-58cc6b81f6dd'::uuid, 'learning_path_metadata',    'JSON_EXTRACT',      '{"path": "$.legacy.provider_url", "direction": "embed", "source_dtype": "character varying"}'),
  ('ce584c2e-1fca-4919-b013-c6c5b45037c9'::uuid, 'learning_path_metadata',    'JSON_EXTRACT',      '{"path": "$.legacy.language", "direction": "embed", "source_dtype": "character varying"}'),
  ('7fc0f132-cbe2-4ac7-a8e3-9246ec340f34'::uuid, 'learning_path_metadata',    'JSON_EXTRACT',      '{"path": "$.legacy.tags", "direction": "embed", "source_dtype": "array"}'),
  ('be27eab3-452a-45e4-81ad-892a0d835092'::uuid, 'learning_path_metadata',    'JSON_EXTRACT',      '{"path": "$.legacy.is_certification", "direction": "embed", "source_dtype": "boolean"}'),
  ('d52e3637-cd9e-4928-b54f-de4b8e60d060'::uuid, 'learning_path_metadata',    'JSON_EXTRACT',      '{"path": "$.legacy.is_mandatory", "direction": "embed", "source_dtype": "boolean"}'),
  ('0281edf6-004b-4f88-91b7-2bedb30eacae'::uuid, 'learning_path_metadata',    'JSON_EXTRACT',      '{"path": "$.legacy.status", "direction": "embed", "source_dtype": "character varying"}'),
  ('dc8e9e6a-8f2a-4961-8ce9-b7942fdb8e43'::uuid, '__SKIP__',                  'SKIP',              '{"reason": "embedding_en (pgvector) — recomputable"}'),
  ('6d2d8375-5fc2-4ccb-9671-c8491d4b0b32'::uuid, '__SKIP__',                  'SKIP',              '{"reason": "embedding_it (pgvector) — recomputable"}'),
  ('cef82217-48d8-444e-ab31-4ef97e0cf3f6'::uuid, '__SKIP__',                  'SKIP',              '{"reason": "embedding_model (pgvector) — recomputable"}'),
  ('851001e9-eef1-4643-a397-11d48b1b2099'::uuid, '__SKIP__',                  'SKIP',              '{"reason": "embedding_generated_at (pgvector) — recomputable"}')
) AS sc(col_id, target_col, xform, payload);

-- §B.2 — course_modules → sys_learning_modules (canonical module semantics)
WITH new_tm AS (
  INSERT INTO brownfield.table_mappings (
    table_mapping_id, table_mapping_source_table_id, table_mapping_target_schema,
    table_mapping_target_table, table_mapping_classification, table_mapping_approval_status,
    table_mapping_rationale, table_mapping_metadata, table_mapping_wave
  ) VALUES (
    gen_random_uuid(),
    '5aa4a835-77b1-482e-874e-b95d3562038b', -- course_modules
    'sys',
    'sys_learning_modules',
    'IMPORT',
    'APPROVED',
    'X9 Block B (Cowork C9.3, Option B revised): legacy `course_modules` are atomic learning units → sys_learning_modules canonical feed.',
    jsonb_build_object('origin','X9_block_B','spec','01_FORENSIC.md_§3.2prime'),
    1
  )
  RETURNING table_mapping_id
)
INSERT INTO brownfield.column_mappings (
  column_mapping_id, column_mapping_table_mapping_id, column_mapping_source_column_id,
  column_mapping_target_column, column_mapping_transform, column_mapping_transform_payload,
  column_mapping_metadata
)
SELECT gen_random_uuid(), (SELECT table_mapping_id FROM new_tm), sc.col_id, sc.target_col, sc.xform, sc.payload::jsonb, '{}'::jsonb
FROM (VALUES
  ('b7183ea7-2d71-43f9-92d4-3e25a07ac078'::uuid, 'learning_module_id',          'LINEAGE_SOURCE_NK', '{"note": "legacy primary key stored on lineage row"}'),
  ('4df448fc-96dd-485a-aabf-64c77a746bf7'::uuid, 'learning_module_title',       'TRIM',              '{}'),
  ('d6aa06d1-afbe-4289-bc2d-d32a7cdc98d7'::uuid, 'learning_module_description', 'TRIM',              '{}'),
  ('cc4d9374-f99b-46a7-9ac5-b2663223b74f'::uuid, 'learning_module_duration_minutes', 'CAST_INT',     '{}'),
  ('55f82ca7-82b5-4878-b76e-5aafc6014eb9'::uuid, 'learning_module_tenant_id',   'LOOKUP_FK',         '{"match_on": "legacy_tenant_id", "target_table": "sys_tenancies"}'),
  ('73b65c6e-fa83-431a-a0c9-535985f50be9'::uuid, 'created_at',                  'CAST_TIMESTAMPTZ',  '{}'),
  ('c904bf13-4ccd-4f7d-b8f3-5e93c656f507'::uuid, 'learning_module_metadata',    'JSON_EXTRACT',      '{"path": "$.legacy.course_id", "direction": "embed", "source_dtype": "uuid"}'),
  ('00220522-4a7e-41dc-b990-025751efb8cb'::uuid, 'learning_module_metadata',    'JSON_EXTRACT',      '{"path": "$.legacy.content_type", "direction": "embed", "source_dtype": "character varying"}'),
  ('9e4813ce-bd44-436a-875b-b54418336c45'::uuid, 'learning_module_metadata',    'JSON_EXTRACT',      '{"path": "$.legacy.content_url", "direction": "embed", "source_dtype": "character varying"}'),
  ('d1c8a7db-9cec-48d5-bf58-78e9ad5f0da6'::uuid, 'learning_module_metadata',    'JSON_EXTRACT',      '{"path": "$.legacy.sequence_order", "direction": "embed", "source_dtype": "integer"}'),
  ('409dfa18-5a29-4dd9-ae79-7c26eb7cad1f'::uuid, 'learning_module_metadata',    'JSON_EXTRACT',      '{"path": "$.legacy.is_mandatory", "direction": "embed", "source_dtype": "boolean"}'),
  ('423355ee-6828-48de-8847-fff81af8c3d5'::uuid, 'learning_module_metadata',    'JSON_EXTRACT',      '{"path": "$.legacy.passing_score", "direction": "embed", "source_dtype": "numeric"}')
) AS sc(col_id, target_col, xform, payload);

-- =========================================================================
-- Block C — CW-B37 deep fix via LOOKUP_FK_2HOP
-- Inline mitigation note: the spec said "UPDATE 2 existing column_mappings
-- for skill_id" — but no such existing mappings target skill_id (registry
-- currently only maps esco_skill_uri → metadata JSON_EXTRACT for these two
-- sources). So we INSERT new column_mappings instead (pattern memo §13).
-- =========================================================================

-- §C.1 — certification_esco_skills.esco_skill_uri: re-target from metadata embed to skill_id LOOKUP_FK_2HOP
-- UQ (table_mapping_id, source_column_id) forces UPDATE-in-place per pattern memo §13.
UPDATE brownfield.column_mappings
   SET column_mapping_target_column = 'skill_learning_mapping_skill_id',
       column_mapping_transform     = 'LOOKUP_FK_2HOP',
       column_mapping_transform_payload = '{"target_table":"sys_skills","match_on":"esco_skill_uri","lookup_2hop":{"intermediate_schema":"legacy_mirror","intermediate_table":"esco_skills","intermediate_match_col":"uri","intermediate_pk_col":"id"}}'::jsonb,
       column_mapping_metadata = jsonb_build_object(
         'origin','X9_block_C','spec','ADR-0017_§2',
         'expected_unlock','~664 cert rows',
         'replaced_prior',jsonb_build_object('target','skill_learning_mapping_metadata','transform','JSON_EXTRACT')
       )
 WHERE column_mapping_table_mapping_id='72d730ed-9603-4f69-ace3-4d807c07a8ca'
   AND column_mapping_source_column_id='6a87673e-939c-498d-a65f-50fe0e4311ad';

-- §C.2 — course_esco_skills.esco_skill_uri: re-target idem
UPDATE brownfield.column_mappings
   SET column_mapping_target_column = 'skill_learning_mapping_skill_id',
       column_mapping_transform     = 'LOOKUP_FK_2HOP',
       column_mapping_transform_payload = '{"target_table":"sys_skills","match_on":"esco_skill_uri","lookup_2hop":{"intermediate_schema":"legacy_mirror","intermediate_table":"esco_skills","intermediate_match_col":"uri","intermediate_pk_col":"id"}}'::jsonb,
       column_mapping_metadata = jsonb_build_object(
         'origin','X9_block_C','spec','ADR-0017_§2',
         'expected_unlock','~717 course rows',
         'replaced_prior',jsonb_build_object('target','skill_learning_mapping_metadata','transform','JSON_EXTRACT')
       )
 WHERE column_mapping_table_mapping_id='94f5172a-056c-4954-8154-400b886f89e0'
   AND column_mapping_source_column_id='e11a8030-8a4b-4fa6-add3-4d34c3718986';

-- §C.3 — course_esco_skills.course_id: re-target to module_id via lineage to sys_learning_modules
-- Block B §B.2 creates the course_modules → sys_learning_modules lineage. However
-- course_esco_skills.course_id refers to a parent COURSE not a module, so the
-- direct lineage match is loose: rows whose course has no co-located course_module
-- in lineage drop to NULL module_id and audit-skip on NOT NULL. Documented in
-- REPORT 013 §3 as residual finding (not a P0 halt — the spec's skill_id audit
-- target unlocks regardless).
UPDATE brownfield.column_mappings
   SET column_mapping_target_column = 'skill_learning_mapping_module_id',
       column_mapping_transform     = 'LOOKUP_FK',
       column_mapping_transform_payload = '{"target_table":"sys_learning_modules","match_on":"learning_module_metadata->>''legacy_id''","return_col":"learning_module_id"}'::jsonb,
       column_mapping_metadata = jsonb_build_object(
         'origin','X9_block_C',
         'note','Best-effort module_id resolution; course-level FK relation, may silent-skip',
         'replaced_prior',jsonb_build_object('target','skill_learning_mapping_metadata','transform','JSON_EXTRACT')
       )
 WHERE column_mapping_table_mapping_id='94f5172a-056c-4954-8154-400b886f89e0'
   AND column_mapping_source_column_id='ecf9fb31-3827-4e52-901e-fd2df7100321';

-- =========================================================================
-- Block D — CW-B35 Phase C cleanup
-- =========================================================================

-- §D.1 — REFERENCE_ONLY re-classify 4 heterogeneous sources → sys_skill_taxonomy_edges
-- Per cw_b35_phase_bc/01_FORENSIC.md §4 verbatim
UPDATE brownfield.table_mappings
   SET table_mapping_classification = 'REFERENCE_ONLY',
       table_mapping_metadata = jsonb_set(
         coalesce(table_mapping_metadata, '{}'::jsonb),
         '{reclassified_reason}',
         to_jsonb('CW-B35 Phase C (Cowork C9.4, X9 Block D): heterogeneous source not matching sys_skill_taxonomy_edges homogeneous skill-edge semantics. Re-classify pending dedicated macro-area or new sys_cross_domain_mappings target.'::text)
       ),
       updated_at = NOW()
 WHERE table_mapping_id IN (
   SELECT tm.table_mapping_id
     FROM brownfield.table_mappings tm
     JOIN brownfield.source_tables st ON st.source_table_id = tm.table_mapping_source_table_id
    WHERE tm.table_mapping_target_table = 'sys_skill_taxonomy_edges'
      AND st.source_table_name IN (
        'onet_esco_mappings',
        'ontology_source_mappings',
        'skill_taxonomy_extensions',
        'skill_matrices'
      )
 );

COMMIT;

-- Post-commit summary
\echo '----- X9 Block B+C+D applied -----'
SELECT 'courses_reclassified_to_ref_only' label, COUNT(*) FROM brownfield.table_mappings WHERE table_mapping_id = 'eb431a77-7764-422f-af4b-5f4b9d5c1213' AND table_mapping_classification='REFERENCE_ONLY'
UNION ALL SELECT 'cw_b35_phase_c_count', COUNT(*) FROM brownfield.table_mappings tm JOIN brownfield.source_tables st ON st.source_table_id = tm.table_mapping_source_table_id WHERE tm.table_mapping_target_table='sys_skill_taxonomy_edges' AND st.source_table_name IN ('onet_esco_mappings','ontology_source_mappings','skill_taxonomy_extensions','skill_matrices') AND tm.table_mapping_classification='REFERENCE_ONLY'
UNION ALL SELECT 'new_table_mappings', COUNT(*) FROM brownfield.table_mappings WHERE table_mapping_metadata->>'origin'='X9_block_B'
UNION ALL SELECT 'new_column_mappings_block_B_paths', COUNT(*) FROM brownfield.column_mappings cm JOIN brownfield.table_mappings tm ON tm.table_mapping_id = cm.column_mapping_table_mapping_id WHERE tm.table_mapping_metadata->>'spec' LIKE '%§3.1prime'
UNION ALL SELECT 'new_column_mappings_block_B_modules', COUNT(*) FROM brownfield.column_mappings cm JOIN brownfield.table_mappings tm ON tm.table_mapping_id = cm.column_mapping_table_mapping_id WHERE tm.table_mapping_metadata->>'spec' LIKE '%§3.2prime'
UNION ALL SELECT 'block_C_lookup_fk_2hop_mappings', COUNT(*) FROM brownfield.column_mappings WHERE column_mapping_transform='LOOKUP_FK_2HOP';
