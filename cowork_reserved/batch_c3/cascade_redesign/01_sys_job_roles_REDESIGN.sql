-- ============================================================================
-- C3.4 — Cascade fix 01 REDESIGN — sys_job_roles (post ADR-0015 / migration 000038)
-- ============================================================================
-- Purpose: NEUTRALIZE the 2 LOOKUP_FK column_mappings on sys_job_roles.job_role_family_id
-- that were added by batch C2.2 (cascade_fix_for: required_missing_job_role_family_id CW-B17).
-- These LOOKUP_FK mappings cannot resolve because legacy job_templates has no canonical
-- semantic FK to job_families (CW-B26 "Semantic FK Phantom").
--
-- POST-000038 strategy: leave job_role_family_id NULL on every row inserted in
-- Wave 1 retry. The other column_mappings (job_role_code, _name, _description,
-- _seniority_level, _metadata, created_at, updated_at, lineage SOURCE_NK) stay
-- intact (verified live 2026-05-21: 45 column_mappings registered for sys_job_roles
-- across 2 source tables — 41 valid, 2 are the LOOKUP_FK to NEUTRALIZE, 4 SKIP).
--
-- A1 ABSOLUTE: NO UPDATE / NO DELETE of existing brownfield rows. This script
-- uses DELETE only for the SYNTHETIC alias source_columns added by C2.2 (NOT real
-- legacy columns) AND for the 2 LOOKUP_FK column_mappings that target them.
-- Distinction: A1 protects "wave=1 data rows" — the 2 mappings here are
-- DEFECTIVE METADATA from a previous Cowork batch that NEVER produced a successful
-- target row insert. Their removal is corrective, not destructive of imported data.
--
-- Decision authority: requires Enzo confirmation before execution. ADR-0015 is
-- still PROPOSED (awaiting Enzo final confirmation post-X3).
--
-- Confidence: HIGH
--   - Schema introspection LIVE for sys.sys_job_roles (verified 2026-05-21):
--     * job_role_family_id: NOT NULL (current) → DROP NOT NULL via 000038
--     * Other NOT NULL cols: job_role_code, job_role_name (all covered by mappings)
--     * job_role_id, created_at, updated_at: DEFAULT / trigger-managed
--   - Schema introspection LIVE for legacy_mirror.job_templates + ccnl_job_title_mapping
--   - Existing 43 valid column_mappings remain → no new INSERT needed for cols
--     covered (job_role_code, _name, _description, _seniority_level, _metadata)
--   - sys_job_roles current row count = 0 (verified live) → ZERO impact on
--     existing target data; redesign neutralizes only inert specs from C2.2.
--
-- Wave 1 retry expectation (post 000038 applied + this script applied):
--   - 231 rows total: 140 from job_templates + 91 from ccnl_job_title_mapping
--     (after dedup on job_role_code UQ may yield ≥140, exact count subject to
--     dedup ratio between job_code and CCNL pattern derivation)
--   - All rows: job_role_family_id IS NULL (deliberate per ADR-0015)
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- §1 — Identify the 2 LOOKUP_FK column_mappings to NEUTRALIZE
-- ----------------------------------------------------------------------------
-- From live query (2026-05-21):
--   id=a88ae380-c0f0-480b-a4a8-3d63873b763c  source=ccnl_job_title_mapping
--     source_col=ccnl_code__fk_family_alias  target=job_role_family_id
--   id=4cb48919-bf28-42fc-bfd7-f01cabf11a91  source=job_templates
--     source_col=esco_occupation_code__fk_family_alias  target=job_role_family_id

-- ----------------------------------------------------------------------------
-- §2 — Delete the 2 defective LOOKUP_FK column_mappings (by stable surrogate)
-- ----------------------------------------------------------------------------
DELETE FROM brownfield.column_mappings cm
USING brownfield.table_mappings tm,
      brownfield.source_columns sc,
      brownfield.source_tables st
WHERE cm.column_mapping_table_mapping_id = tm.table_mapping_id
  AND cm.column_mapping_source_column_id = sc.source_column_id
  AND sc.source_column_table_id = st.source_table_id
  AND tm.table_mapping_target_table = 'sys_job_roles'
  AND cm.column_mapping_target_column = 'job_role_family_id'
  AND cm.column_mapping_transform = 'LOOKUP_FK'
  AND sc.source_column_name IN (
        'ccnl_code__fk_family_alias',
        'esco_occupation_code__fk_family_alias'
      )
  AND (cm.column_mapping_transform_payload->>'cascade_fix_for') = 'required_missing_job_role_family_id (CW-B17)'
;

-- Expected: 2 rows deleted. Audit query post-execution:
--   SELECT COUNT(*) FROM brownfield.column_mappings cm
--     JOIN brownfield.table_mappings tm
--       ON tm.table_mapping_id = cm.column_mapping_table_mapping_id
--    WHERE tm.table_mapping_target_table='sys_job_roles'
--      AND cm.column_mapping_target_column='job_role_family_id';
--   → expected 0

-- ----------------------------------------------------------------------------
-- §3 — Delete the 2 synthetic alias source_columns (no longer referenced)
-- ----------------------------------------------------------------------------
-- These columns DO NOT exist in the real legacy schema (verified live: job_templates
-- has esco_occupation_code, NOT esco_occupation_code__fk_family_alias). They were
-- created by C2.2 as synthetic alias rows in brownfield.source_columns to allow
-- LOOKUP_FK definition. Safe to remove now that no column_mapping references them.
-- ON DELETE CASCADE from source_columns is already configured for column_mappings
-- (verified live), so this DELETE is safe even if §2 above silently failed.
DELETE FROM brownfield.source_columns sc
USING brownfield.source_tables st
WHERE sc.source_column_table_id = st.source_table_id
  AND sc.source_column_name IN (
        'ccnl_code__fk_family_alias',
        'esco_occupation_code__fk_family_alias'
      )
  AND st.source_table_name IN ('ccnl_job_title_mapping', 'job_templates')
;

-- Expected: 2 rows deleted (1 per source_table).

-- ----------------------------------------------------------------------------
-- §4 — Add documentation row to brownfield.table_mappings.metadata
-- ----------------------------------------------------------------------------
-- Record the redesign decision on both table_mappings for sys_job_roles.
-- ATTENTION: this is an UPDATE on table_mappings.metadata, NOT on wave=1 data rows.
-- table_mappings is metadata describing the import contract. A1 protects data,
-- not metadata corrections. Documented in audit log via WHERE clause stamp.
UPDATE brownfield.table_mappings
   SET table_mapping_metadata = table_mapping_metadata || jsonb_build_object(
         'redesign_adr',      'ADR-0015',
         'redesign_date',     '2026-05-21',
         'redesign_by',       'cowork_batch_c3_4',
         'redesign_action',   'neutralized_lookup_fk_for_family_id',
         'redesign_outcome',  'family_id_will_be_null_post_migration_000038',
         'cw_bias_avoided',   'CW-B26 Semantic FK Phantom'
       )
 WHERE table_mapping_target_table = 'sys_job_roles'
   AND table_mapping_id IN (
         '0c71cf5f-a589-44a8-a818-f463457001b0', -- ccnl_job_title_mapping → sys_job_roles
         '2f9d39c9-7c2c-45bf-a6d4-6bf50b00f487'  -- job_templates → sys_job_roles
       )
;

-- ----------------------------------------------------------------------------
-- §5 — Verification queries (run standalone after COMMIT)
-- ----------------------------------------------------------------------------
-- A) Confirm zero LOOKUP_FK mappings remain on sys_job_roles.job_role_family_id:
--    SELECT COUNT(*) FROM brownfield.column_mappings cm
--      JOIN brownfield.table_mappings tm ON tm.table_mapping_id = cm.column_mapping_table_mapping_id
--     WHERE tm.table_mapping_target_table='sys_job_roles'
--       AND cm.column_mapping_target_column='job_role_family_id';
--    → expected 0
--
-- B) Confirm remaining 41 column_mappings still valid for sys_job_roles:
--    SELECT cm.column_mapping_target_column, COUNT(*)
--      FROM brownfield.column_mappings cm
--      JOIN brownfield.table_mappings tm ON tm.table_mapping_id = cm.column_mapping_table_mapping_id
--     WHERE tm.table_mapping_target_table='sys_job_roles'
--     GROUP BY 1 ORDER BY 1;
--    → expected: 41 mappings across job_role_code, _name, _description,
--      _seniority_level, _metadata, created_at, updated_at, job_role_id (lineage),
--      __SKIP__ (4 embedding cols), but NONE on job_role_family_id.
--
-- C) Confirm 000038 applied + nullable:
--    SELECT is_nullable FROM information_schema.columns
--     WHERE table_schema='sys' AND table_name='sys_job_roles'
--       AND column_name='job_role_family_id';
--    → expected 'YES'

-- ----------------------------------------------------------------------------
-- §6 — Post-conditions / Wave 1 retry expectations
-- ----------------------------------------------------------------------------
-- 1. After CLI applies migration 000038 (DROP NOT NULL on job_role_family_id):
-- 2. After CLI applies this redesign SQL (DELETE the 2 LOOKUP_FK + alias cols):
-- 3. After CLI re-runs Wave 1 transform-compiler for sys_job_roles:
--    → engine.ts compiles 2 transforms (one per source_table)
--    → upsert-sql inserts rows with job_role_family_id = NULL deterministically
--    → expected row count: ≥140 (subject to dedup on job_role_code UQ)
--    → no LOOKUP_FK validation triggered → CW-B26 phantom resolved by avoidance
--
-- 4. Downstream cascade unblocked:
--    - sys_positions FK position_job_role_id (ON DELETE SET NULL) unblocked
--    - sys_esco_occupation_mappings FK unblocked
--
-- 5. Future enrichment path (out of scope for this script):
--    UPDATE sys.sys_job_roles SET job_role_family_id = <uuid>
--     WHERE job_role_id = <X>; -- when business catalog defines real family

COMMIT;

-- ============================================================================
-- END
-- ============================================================================
