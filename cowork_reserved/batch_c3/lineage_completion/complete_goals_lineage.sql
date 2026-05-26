-- ============================================================================
-- SDBI Goals/OKRs Lineage Completion — 8 remaining tables
-- ============================================================================
-- Purpose: Insert lineage rows in sys.sys_source_lineage_records for the 8
-- Goals/OKRs SDBI tables that were missing lineage after REPORT X2 §3.C.4.
-- Goals/OKRs already covered: sys_goal_templates (40), sys_goals (1067) → 1107 rows.
-- This script adds 8 tables → expected ~4832 NEW lineage records.
--
-- Confidence: HIGH
--   - Schema introspection LIVE (2026-05-21) for all 8 target tables + 9 source
--     tables in legacy_mirror.
--   - JOIN strategy verified by direct row-count match per table:
--       sys_goal_milestones  1000 ↔ legacy_mirror.goal_milestones  1000  (100%)
--       sys_goal_check_ins   1000 ↔ legacy_mirror.goal_check_ins   1000  (100%)
--       sys_goal_updates     1811 ↔ legacy_mirror.goal_updates     1811  (100%)
--       sys_goal_comments     856 ↔ legacy_mirror.goal_comments     856  (100%)
--       sys_goal_alignments   100 ↔ legacy_mirror.goal_alignments   100  (100%)
--       sys_okrs               20 ↔ legacy_mirror.okrs               20  (100%)
--       sys_okr_key_results    20 ↔ legacy_mirror.key_results        20  (100%)
--       sys_okr_check_ins      25 ↔ {okr_check_ins 15 + okr_checkins 10} (100%)
--     Total expected NEW rows: 1000+1000+1811+856+100+20+20+25 = 4832
--
-- A1 ABSOLUTE: no UPDATE/DELETE on existing wave=1 rows. INSERT-only with
--              ON CONFLICT (source_system, source_table, source_record_id,
--              target_table_name) DO NOTHING — idempotent twice-run safe.
--
-- Natural-key pattern (verified live):
--   target.<entity>_natural_key = '<PREFIX>::<tenant_id>::<source_uuid>'
--   except sys_okr_check_ins   = 'OKR_CHECK_IN::<tenant_id>::<src_tbl>::<source_uuid>'
--   JOIN bridge: RIGHT(<entity>_natural_key, 36)::uuid = legacy_mirror.<src>.id
--
-- Source lineage convention (mirrors GOALS-PILOT-MAP-01/07 already shipped):
--   source_system          = 'heuresys_platform'
--   source_table           = legacy table name (e.g. 'goal_milestones')
--   source_record_id       = legacy_mirror.<table>.id::text
--   source_natural_key     = 'OLDDB::<src_table>::<source_uuid>'
--   target_table_name      = 'sys_<plural>'
--   target_record_id       = sys.<table>.<pk>_id  (uuid)
--   mapping_confidence     = 0.900   (parity with existing goals/templates rows)
--   validation_status      = 'VALID'
--   metadata               = JSON with sdbi_ai_model_id + sdbi_mapping_card_id
--
-- Mapping card IDs (extends GOALS-PILOT-MAP-01..07 family):
--   GOALS-PILOT-MAP-02 → sys_goal_milestones
--   GOALS-PILOT-MAP-03 → sys_goal_check_ins
--   GOALS-PILOT-MAP-04 → sys_goal_updates
--   GOALS-PILOT-MAP-05 → sys_goal_comments
--   GOALS-PILOT-MAP-06 → sys_goal_alignments
--   GOALS-PILOT-MAP-08 → sys_okrs
--   GOALS-PILOT-MAP-09 → sys_okr_key_results
--   GOALS-PILOT-MAP-10 → sys_okr_check_ins
--
-- Pre-conditions:
--   - migration 000039 (audit nullable) applied — NOT strictly required, lineage
--     records use existing UQ index; only RUN_LOGGER audits would be affected.
--   - heuresys_advanced reachable via SSH tunnel / sudo -u postgres psql.
--
-- Post-condition check (expected):
--   SELECT source_lineage_source_table, COUNT(*)
--   FROM sys.sys_source_lineage_records
--   WHERE source_lineage_source_table IN (
--     'goal_milestones','goal_check_ins','goal_updates','goal_comments',
--     'goal_alignments','okrs','key_results','okr_check_ins','okr_checkins')
--   GROUP BY 1 ORDER BY 1;
--   →  expected totals: 100, 1000, 856, 1000, 1811, 20, 15, 10, 20
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. sys_goal_milestones (1000 rows)
-- ----------------------------------------------------------------------------
INSERT INTO sys.sys_source_lineage_records (
  source_lineage_tenant_id,
  source_lineage_source_system,
  source_lineage_source_table,
  source_lineage_source_record_id,
  source_lineage_source_natural_key,
  source_lineage_target_table_name,
  source_lineage_target_record_id,
  source_lineage_mapping_confidence,
  source_lineage_validation_status,
  source_lineage_metadata
)
SELECT
  m.milestone_tenant_id,
  'heuresys_platform',
  'goal_milestones',
  lm.id::text,
  'OLDDB::goal_milestones::' || lm.id::text,
  'sys_goal_milestones',
  m.milestone_id,
  0.900,
  'VALID',
  jsonb_build_object(
    'sdbi_ai_model_id',     'cowork-claude-opus-4.7',
    'sdbi_mapping_card_id', 'GOALS-PILOT-MAP-02'
  )
FROM sys.sys_goal_milestones m
JOIN legacy_mirror.goal_milestones lm
  ON lm.id = RIGHT(m.milestone_natural_key, 36)::uuid
ON CONFLICT (source_lineage_source_system,
             source_lineage_source_table,
             source_lineage_source_record_id,
             source_lineage_target_table_name) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 2. sys_goal_check_ins (1000 rows)
-- ----------------------------------------------------------------------------
INSERT INTO sys.sys_source_lineage_records (
  source_lineage_tenant_id,
  source_lineage_source_system,
  source_lineage_source_table,
  source_lineage_source_record_id,
  source_lineage_source_natural_key,
  source_lineage_target_table_name,
  source_lineage_target_record_id,
  source_lineage_mapping_confidence,
  source_lineage_validation_status,
  source_lineage_metadata
)
SELECT
  m.check_in_tenant_id,
  'heuresys_platform',
  'goal_check_ins',
  lm.id::text,
  'OLDDB::goal_check_ins::' || lm.id::text,
  'sys_goal_check_ins',
  m.check_in_id,
  0.900,
  'VALID',
  jsonb_build_object(
    'sdbi_ai_model_id',     'cowork-claude-opus-4.7',
    'sdbi_mapping_card_id', 'GOALS-PILOT-MAP-03'
  )
FROM sys.sys_goal_check_ins m
JOIN legacy_mirror.goal_check_ins lm
  ON lm.id = RIGHT(m.check_in_natural_key, 36)::uuid
ON CONFLICT (source_lineage_source_system,
             source_lineage_source_table,
             source_lineage_source_record_id,
             source_lineage_target_table_name) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 3. sys_goal_updates (1811 rows)
-- ----------------------------------------------------------------------------
INSERT INTO sys.sys_source_lineage_records (
  source_lineage_tenant_id,
  source_lineage_source_system,
  source_lineage_source_table,
  source_lineage_source_record_id,
  source_lineage_source_natural_key,
  source_lineage_target_table_name,
  source_lineage_target_record_id,
  source_lineage_mapping_confidence,
  source_lineage_validation_status,
  source_lineage_metadata
)
SELECT
  m.update_tenant_id,
  'heuresys_platform',
  'goal_updates',
  lm.id::text,
  'OLDDB::goal_updates::' || lm.id::text,
  'sys_goal_updates',
  m.update_id,
  0.900,
  'VALID',
  jsonb_build_object(
    'sdbi_ai_model_id',     'cowork-claude-opus-4.7',
    'sdbi_mapping_card_id', 'GOALS-PILOT-MAP-04'
  )
FROM sys.sys_goal_updates m
JOIN legacy_mirror.goal_updates lm
  ON lm.id = RIGHT(m.update_natural_key, 36)::uuid
ON CONFLICT (source_lineage_source_system,
             source_lineage_source_table,
             source_lineage_source_record_id,
             source_lineage_target_table_name) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 4. sys_goal_comments (856 rows)
-- ----------------------------------------------------------------------------
INSERT INTO sys.sys_source_lineage_records (
  source_lineage_tenant_id,
  source_lineage_source_system,
  source_lineage_source_table,
  source_lineage_source_record_id,
  source_lineage_source_natural_key,
  source_lineage_target_table_name,
  source_lineage_target_record_id,
  source_lineage_mapping_confidence,
  source_lineage_validation_status,
  source_lineage_metadata
)
SELECT
  m.comment_tenant_id,
  'heuresys_platform',
  'goal_comments',
  lm.id::text,
  'OLDDB::goal_comments::' || lm.id::text,
  'sys_goal_comments',
  m.comment_id,
  0.900,
  'VALID',
  jsonb_build_object(
    'sdbi_ai_model_id',     'cowork-claude-opus-4.7',
    'sdbi_mapping_card_id', 'GOALS-PILOT-MAP-05'
  )
FROM sys.sys_goal_comments m
JOIN legacy_mirror.goal_comments lm
  ON lm.id = RIGHT(m.comment_natural_key, 36)::uuid
ON CONFLICT (source_lineage_source_system,
             source_lineage_source_table,
             source_lineage_source_record_id,
             source_lineage_target_table_name) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 5. sys_goal_alignments (100 rows)
-- ----------------------------------------------------------------------------
INSERT INTO sys.sys_source_lineage_records (
  source_lineage_tenant_id,
  source_lineage_source_system,
  source_lineage_source_table,
  source_lineage_source_record_id,
  source_lineage_source_natural_key,
  source_lineage_target_table_name,
  source_lineage_target_record_id,
  source_lineage_mapping_confidence,
  source_lineage_validation_status,
  source_lineage_metadata
)
SELECT
  m.alignment_tenant_id,
  'heuresys_platform',
  'goal_alignments',
  lm.id::text,
  'OLDDB::goal_alignments::' || lm.id::text,
  'sys_goal_alignments',
  m.alignment_id,
  0.900,
  'VALID',
  jsonb_build_object(
    'sdbi_ai_model_id',     'cowork-claude-opus-4.7',
    'sdbi_mapping_card_id', 'GOALS-PILOT-MAP-06'
  )
FROM sys.sys_goal_alignments m
JOIN legacy_mirror.goal_alignments lm
  ON lm.id = RIGHT(m.alignment_natural_key, 36)::uuid
ON CONFLICT (source_lineage_source_system,
             source_lineage_source_table,
             source_lineage_source_record_id,
             source_lineage_target_table_name) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 6. sys_okrs (20 rows)
-- ----------------------------------------------------------------------------
INSERT INTO sys.sys_source_lineage_records (
  source_lineage_tenant_id,
  source_lineage_source_system,
  source_lineage_source_table,
  source_lineage_source_record_id,
  source_lineage_source_natural_key,
  source_lineage_target_table_name,
  source_lineage_target_record_id,
  source_lineage_mapping_confidence,
  source_lineage_validation_status,
  source_lineage_metadata
)
SELECT
  m.okr_tenant_id,
  'heuresys_platform',
  'okrs',
  lm.id::text,
  'OLDDB::okrs::' || lm.id::text,
  'sys_okrs',
  m.okr_id,
  0.900,
  'VALID',
  jsonb_build_object(
    'sdbi_ai_model_id',     'cowork-claude-opus-4.7',
    'sdbi_mapping_card_id', 'GOALS-PILOT-MAP-08'
  )
FROM sys.sys_okrs m
JOIN legacy_mirror.okrs lm
  ON lm.id = RIGHT(m.okr_natural_key, 36)::uuid
ON CONFLICT (source_lineage_source_system,
             source_lineage_source_table,
             source_lineage_source_record_id,
             source_lineage_target_table_name) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 7. sys_okr_key_results (20 rows)
-- ----------------------------------------------------------------------------
-- NOTE: legacy_mirror.key_results does NOT have tenant_id on a row-by-row
-- basis tied to KR (tenant_id is present on lm.key_results, verified live).
INSERT INTO sys.sys_source_lineage_records (
  source_lineage_tenant_id,
  source_lineage_source_system,
  source_lineage_source_table,
  source_lineage_source_record_id,
  source_lineage_source_natural_key,
  source_lineage_target_table_name,
  source_lineage_target_record_id,
  source_lineage_mapping_confidence,
  source_lineage_validation_status,
  source_lineage_metadata
)
SELECT
  m.key_result_tenant_id,
  'heuresys_platform',
  'key_results',
  lm.id::text,
  'OLDDB::key_results::' || lm.id::text,
  'sys_okr_key_results',
  m.key_result_id,
  0.900,
  'VALID',
  jsonb_build_object(
    'sdbi_ai_model_id',     'cowork-claude-opus-4.7',
    'sdbi_mapping_card_id', 'GOALS-PILOT-MAP-09'
  )
FROM sys.sys_okr_key_results m
JOIN legacy_mirror.key_results lm
  ON lm.id = RIGHT(m.key_result_natural_key, 36)::uuid
ON CONFLICT (source_lineage_source_system,
             source_lineage_source_table,
             source_lineage_source_record_id,
             source_lineage_target_table_name) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 8a. sys_okr_check_ins via legacy_mirror.okr_check_ins (15 rows)
-- ----------------------------------------------------------------------------
-- Natural key pattern split: 'OKR_CHECK_IN::<tenant>::okr_check_ins::<uuid>'
-- → discriminator at SPLIT_PART(_, '::', 3)
INSERT INTO sys.sys_source_lineage_records (
  source_lineage_tenant_id,
  source_lineage_source_system,
  source_lineage_source_table,
  source_lineage_source_record_id,
  source_lineage_source_natural_key,
  source_lineage_target_table_name,
  source_lineage_target_record_id,
  source_lineage_mapping_confidence,
  source_lineage_validation_status,
  source_lineage_metadata
)
SELECT
  m.check_in_tenant_id,
  'heuresys_platform',
  'okr_check_ins',
  lm.id::text,
  'OLDDB::okr_check_ins::' || lm.id::text,
  'sys_okr_check_ins',
  m.check_in_id,
  0.900,
  'VALID',
  jsonb_build_object(
    'sdbi_ai_model_id',     'cowork-claude-opus-4.7',
    'sdbi_mapping_card_id', 'GOALS-PILOT-MAP-10',
    'source_variant',       'okr_check_ins'
  )
FROM sys.sys_okr_check_ins m
JOIN legacy_mirror.okr_check_ins lm
  ON lm.id = RIGHT(m.check_in_natural_key, 36)::uuid
WHERE SPLIT_PART(m.check_in_natural_key, '::', 3) = 'okr_check_ins'
ON CONFLICT (source_lineage_source_system,
             source_lineage_source_table,
             source_lineage_source_record_id,
             source_lineage_target_table_name) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 8b. sys_okr_check_ins via legacy_mirror.okr_checkins (10 rows)
-- ----------------------------------------------------------------------------
INSERT INTO sys.sys_source_lineage_records (
  source_lineage_tenant_id,
  source_lineage_source_system,
  source_lineage_source_table,
  source_lineage_source_record_id,
  source_lineage_source_natural_key,
  source_lineage_target_table_name,
  source_lineage_target_record_id,
  source_lineage_mapping_confidence,
  source_lineage_validation_status,
  source_lineage_metadata
)
SELECT
  m.check_in_tenant_id,
  'heuresys_platform',
  'okr_checkins',
  lm.id::text,
  'OLDDB::okr_checkins::' || lm.id::text,
  'sys_okr_check_ins',
  m.check_in_id,
  0.900,
  'VALID',
  jsonb_build_object(
    'sdbi_ai_model_id',     'cowork-claude-opus-4.7',
    'sdbi_mapping_card_id', 'GOALS-PILOT-MAP-10',
    'source_variant',       'okr_checkins'
  )
FROM sys.sys_okr_check_ins m
JOIN legacy_mirror.okr_checkins lm
  ON lm.id = RIGHT(m.check_in_natural_key, 36)::uuid
WHERE SPLIT_PART(m.check_in_natural_key, '::', 3) = 'okr_checkins'
ON CONFLICT (source_lineage_source_system,
             source_lineage_source_table,
             source_lineage_source_record_id,
             source_lineage_target_table_name) DO NOTHING;

-- ----------------------------------------------------------------------------
-- Verification queries (run as standalone after COMMIT)
-- ----------------------------------------------------------------------------
-- SELECT source_lineage_target_table_name, source_lineage_source_table, COUNT(*)
-- FROM sys.sys_source_lineage_records
-- WHERE source_lineage_source_table IN (
--   'goal_milestones','goal_check_ins','goal_updates','goal_comments',
--   'goal_alignments','okrs','key_results','okr_check_ins','okr_checkins')
-- GROUP BY 1,2 ORDER BY 1,2;
-- Expected: 4832 NEW rows (1000+1000+1811+856+100+20+20+15+10).

COMMIT;
