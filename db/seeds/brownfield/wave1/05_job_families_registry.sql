-- db/seeds/brownfield/wave1/05_job_families_registry.sql
-- Wave 1 / Batch X1 — bootstrap registry for public.job_families → sys.sys_job_families.
-- Authored by CLI in batch X1 to unblock the cascade-root target sys_job_families.
-- Reference: cowork_reserved/batch_c1/class_b_diagnostics/sys_job_families.md
-- Pattern: replicates 01-04 seed structure (source_export lookup via WITH, ON CONFLICT DO NOTHING).

-- =============================================================================
-- §1 — source_tables: register public.job_families (export db-export-2026-05-15)
-- =============================================================================
WITH export AS (
  SELECT source_export_id FROM brownfield.source_exports
   WHERE source_export_name = 'db-export-2026-05-15'
)
INSERT INTO brownfield.source_tables (
  source_table_export_id, source_table_schema, source_table_name,
  source_table_rls_enabled, source_table_row_estimate,
  source_table_domain, source_table_classification, source_table_metadata
)
SELECT export.source_export_id, 'public', 'job_families', true, 27::bigint, 'OPOURSKA', 'IMPORT',
  '{"pk_columns":["id"],"fk_count":2,"tenant_scoped":true,"n_columns":10,"all_domains":["OPOURSKA"],"legacy_comment":"Cascade root for sys_job_roles, sys_esco_occupation_mappings, sys_position_skill_requirements. Bootstrapped in batch X1 (was a true source-gap per cowork_reserved/batch_c1/class_b_diagnostics/sys_job_families.md)."}'::jsonb
FROM export
ON CONFLICT (source_table_export_id, COALESCE(source_table_schema, ''), source_table_name) DO NOTHING;

-- =============================================================================
-- §2 — source_columns: 10 columns of public.job_families
-- =============================================================================
WITH src AS (
  SELECT source_table_id FROM brownfield.source_tables
   WHERE source_table_name = 'job_families' AND source_table_schema = 'public'
     AND source_table_export_id = (SELECT source_export_id FROM brownfield.source_exports
         WHERE source_export_name = 'db-export-2026-05-15')
)
INSERT INTO brownfield.source_columns (
  source_column_table_id, source_column_name, source_column_data_type,
  source_column_is_nullable, source_column_pii_flag, source_column_metadata
)
SELECT src.source_table_id, v.name, v.dtype, v.nullable, false, '{}'::jsonb
FROM src, (VALUES
  ('id',          'uuid',                      false),
  ('tenant_id',   'uuid',                      false),
  ('code',        'character varying',         false),
  ('name',        'character varying',         false),
  ('description', 'text',                      true),
  ('parent_id',   'uuid',                      true),
  ('is_active',   'boolean',                   true),
  ('created_at',  'timestamp with time zone',  true),
  ('updated_at',  'timestamp with time zone',  true),
  ('deleted_at',  'timestamp with time zone',  true)
) AS v(name, dtype, nullable)
ON CONFLICT (source_column_table_id, source_column_name) DO NOTHING;

-- =============================================================================
-- §3 — table_mappings: source job_families → target sys.sys_job_families
-- =============================================================================
WITH src AS (
  SELECT source_table_id FROM brownfield.source_tables
   WHERE source_table_name = 'job_families' AND source_table_schema = 'public'
     AND source_table_export_id = (SELECT source_export_id FROM brownfield.source_exports
         WHERE source_export_name = 'db-export-2026-05-15')
)
INSERT INTO brownfield.table_mappings (
  table_mapping_source_table_id, table_mapping_target_schema, table_mapping_target_table,
  table_mapping_classification, table_mapping_approval_status,
  table_mapping_approved_at, table_mapping_rationale, table_mapping_metadata,
  table_mapping_wave
)
SELECT src.source_table_id, 'sys', 'sys_job_families', 'IMPORT', 'APPROVED',
  now(), 'Wave 1 auto-approval per BROWNFIELD_IMPORT_PLAN.md §3. Bootstrapped in batch X1 to unblock sys_job_families cascade root (sys_job_roles, sys_esco_occupation_mappings).',
  '{"natural_key_pattern":"JOB_FAMILY::<code>","auto_approver_rule":"WAVE_1_AUTO_APPROVE","primary_domain":"OPOURSKA","all_domains":["OPOURSKA"]}'::jsonb,
  1
FROM src
ON CONFLICT (table_mapping_source_table_id, table_mapping_target_schema, table_mapping_target_table) DO NOTHING;

-- =============================================================================
-- §4 — column_mappings: 10 entries
--   id           → job_family_id          (LINEAGE_SOURCE_NK)
--   code         → job_family_code        (TRIM)
--   name         → job_family_name        (TRIM)
--   description  → job_family_description (TRIM)
--   created_at   → created_at             (CAST_TIMESTAMPTZ)
--   updated_at   → updated_at             (CAST_TIMESTAMPTZ)
--   tenant_id    → job_family_metadata    (JSON_EXTRACT)
--   parent_id    → job_family_metadata    (JSON_EXTRACT)
--   is_active    → job_family_metadata    (JSON_EXTRACT)
--   deleted_at   → job_family_metadata    (JSON_EXTRACT)
-- =============================================================================
WITH tm AS (
  SELECT tm.table_mapping_id, tm.table_mapping_source_table_id
    FROM brownfield.table_mappings tm
    JOIN brownfield.source_tables st ON st.source_table_id = tm.table_mapping_source_table_id
   WHERE st.source_table_name = 'job_families' AND st.source_table_schema = 'public'
     AND tm.table_mapping_target_schema = 'sys' AND tm.table_mapping_target_table = 'sys_job_families'
     AND st.source_table_export_id = (SELECT source_export_id FROM brownfield.source_exports
         WHERE source_export_name = 'db-export-2026-05-15')
),
cols AS (
  SELECT sc.source_column_id, sc.source_column_name
    FROM brownfield.source_columns sc
    JOIN tm ON sc.source_column_table_id = tm.table_mapping_source_table_id
)
INSERT INTO brownfield.column_mappings (
  column_mapping_table_mapping_id, column_mapping_source_column_id,
  column_mapping_target_column, column_mapping_transform,
  column_mapping_transform_payload, column_mapping_pii_disposition, column_mapping_metadata
)
SELECT tm.table_mapping_id, cols.source_column_id, m.target_col, m.transform_code,
       m.payload::jsonb, 'NONE', '{}'::jsonb
FROM tm
CROSS JOIN (VALUES
  ('id',          'job_family_id',          'LINEAGE_SOURCE_NK', '{"note": "legacy primary key stored on lineage row (sys_source_lineage_records.source_pk_value)"}'),
  ('code',        'job_family_code',        'TRIM',              '{}'),
  ('name',        'job_family_name',        'TRIM',              '{}'),
  ('description', 'job_family_description', 'TRIM',              '{}'),
  ('created_at',  'created_at',             'CAST_TIMESTAMPTZ',  '{}'),
  ('updated_at',  'updated_at',             'CAST_TIMESTAMPTZ',  '{}'),
  ('tenant_id',   'job_family_metadata',    'JSON_EXTRACT',      '{"path": "$.legacy.tenant_id", "direction": "embed", "source_dtype": "uuid"}'),
  ('parent_id',   'job_family_metadata',    'JSON_EXTRACT',      '{"path": "$.legacy.parent_id", "direction": "embed", "source_dtype": "uuid"}'),
  ('is_active',   'job_family_metadata',    'JSON_EXTRACT',      '{"path": "$.legacy.is_active", "direction": "embed", "source_dtype": "boolean"}'),
  ('deleted_at',  'job_family_metadata',    'JSON_EXTRACT',      '{"path": "$.legacy.deleted_at", "direction": "embed", "source_dtype": "timestamp with time zone"}')
) AS m(src_col, target_col, transform_code, payload)
JOIN cols ON cols.source_column_name = m.src_col
ON CONFLICT (column_mapping_table_mapping_id, column_mapping_source_column_id) DO NOTHING;
