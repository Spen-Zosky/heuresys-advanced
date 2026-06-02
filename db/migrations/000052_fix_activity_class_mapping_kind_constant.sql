-- 000052_fix_activity_class_mapping_kind_constant.sql
-- WS-3 (v1.0.0 CW-B60-A silent-skip remediation, 2026-06-01): correct the
-- brownfield CONSTANT mapping value for sys_activity_classification_mappings.activity_class_mapping_kind.
--
-- ROOT CAUSE (audit-verified on the capped Wave-1 re-run, run log
-- /tmp/ws3_wave_capped.log): once the missing legacy source dump
-- (wave1_indoor_industry_ccnl_mapping.sql) was added, all 14 industry_ccnl_mapping
-- rows STAGED and both LOOKUP_FKs RESOLVED (source_id <- industry_code,
-- target_id <- ccnl_code) — but the INSERT failed with:
--   new row violates check constraint "sys_activity_class_mapping_kind_check"
-- The column_mapping for activity_class_mapping_kind is a CONSTANT transform with
-- payload {"value":"PRIMARY"} (derived from legacy is_primary). But the column's
-- CHECK domain is the ESCO-style relation-kind set:
--   {EXACT, NARROWER, BROADER, RELATED, APPROXIMATE}
-- 'PRIMARY' is NOT in that set => every INSERT fails the CHECK => 0 rows.
--
-- FIX (deterministic 1:1 mapping correction; NO engine change): all 14 source
-- rows have is_primary = TRUE, and a "primary" industry->CCNL classification is
-- semantically an EXACT classification (EXACT is also the column DEFAULT). So set
-- the CONSTANT value to 'EXACT' — the valid, semantically-correct member of the
-- CHECK domain. This is the MAPPING-CARD deterministic rule: boolean is_primary
-- uniformly TRUE => the exact-classification kind.
--
-- IDEMPOTENT: the UPDATE is guarded to fire only when the current value is the
-- broken 'PRIMARY' (WHERE ... ->>'value' = 'PRIMARY'); a 2nd run matches 0 rows.
-- Twice-run => empty pg_dump diff.

BEGIN;

UPDATE brownfield.column_mappings cm
   SET column_mapping_transform_payload =
         jsonb_set(cm.column_mapping_transform_payload, '{value}', '"EXACT"'::jsonb)
  FROM brownfield.table_mappings tm
 WHERE cm.column_mapping_table_mapping_id = tm.table_mapping_id
   AND tm.table_mapping_target_table = 'sys_activity_classification_mappings'
   AND tm.table_mapping_classification = 'IMPORT'
   AND cm.column_mapping_target_column = 'activity_class_mapping_kind'
   AND cm.column_mapping_transform = 'CONSTANT'
   AND cm.column_mapping_transform_payload->>'value' = 'PRIMARY';

-- Integrity guard: after the migration there must be NO IMPORT CONSTANT mapping
-- for activity_class_mapping_kind whose value violates the CHECK domain.
DO $$
DECLARE bad int;
BEGIN
  SELECT count(*) INTO bad
  FROM brownfield.column_mappings cm
  JOIN brownfield.table_mappings tm ON tm.table_mapping_id = cm.column_mapping_table_mapping_id
  WHERE tm.table_mapping_target_table = 'sys_activity_classification_mappings'
    AND tm.table_mapping_classification = 'IMPORT'
    AND cm.column_mapping_target_column = 'activity_class_mapping_kind'
    AND cm.column_mapping_transform = 'CONSTANT'
    AND cm.column_mapping_transform_payload->>'value'
        NOT IN ('EXACT','NARROWER','BROADER','RELATED','APPROXIMATE');
  IF bad > 0 THEN
    RAISE EXCEPTION '000052: % activity_class_mapping_kind CONSTANT mapping(s) still carry an out-of-domain value', bad;
  END IF;
  RAISE NOTICE '000052: activity_class_mapping_kind CONSTANT value normalized to EXACT (in-CHECK-domain).';
END $$;

COMMIT;
