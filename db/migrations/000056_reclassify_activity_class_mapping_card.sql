-- =============================================================================
-- 000056_reclassify_activity_class_mapping_card.sql
-- =============================================================================
-- WS-3 residual blocker closure (ADR-0025 §5.3 → RESOLVED-BY-RECLASSIFY).
--
-- The brownfield Wave-1 IMPORT card sourcing legacy `public.industry_ccnl_mapping`
-- into `sys_activity_classification_mappings` is MIS-AUTHORED:
--   - `sys_activity_classification_mappings` (mig 000007, "cross-scheme mappings")
--     models a classification<->classification crosswalk: BOTH source_id AND
--     target_id FK reference `sys.sys_activity_classifications`.
--   - The card's `activity_class_mapping_target_id` LOOKUP_FK resolves against
--     `sys_compensation_bands` (match_on compensation_band_code). Verified 0-overlap
--     (7 ccnl_codes present in sys_compensation_bands, 0 in sys_activity_classifications)
--     => every INSERT violates the target_id FK => the table stays at 0 rows.
--   - The legacy fact (industry-code -> CCNL/labor-contract) is an industry->compensation
--     mapping, NOT a classification crosswalk. It is ALREADY modeled by
--     `sys_compensation_bands` + `sys_position_compensation_profiles`. The card has no
--     correct classification<->classification target; the MAPPING-CARD rule forbids
--     guessing a FK resolution (ADR-0025 §5.3).
--
-- DECISION (evidence-correct, lower-risk than the two redesign options in ADR-0025 §5.3):
--   reclassify this single card IMPORT -> REFERENCE_ONLY (same pattern as ADR-0020 /
--   migration 000044). This removes the permanent FK-violation import attempt and the
--   silent-skip noise WITHOUT touching the shipped 000007 FK or the activity-classification
--   -mappings API contract (which assumes target in sys_activity_classifications and is
--   covered by activity-classification-mappings.integration.test.ts — a redesign would
--   break it). `sys_activity_classification_mappings` stays EMPTY-BY-DESIGN until a real
--   ATECO<->NACE crosswalk source is authored (candidates: legacy
--   occupation_industry_classifications / industry_occupation_mapping — future work).
--
-- REVERSIBLE: a single inverse UPDATE (REFERENCE_ONLY -> IMPORT) restores the prior state.
-- IDEMPOTENT: only flips a varchar(32) column where current value is 'IMPORT'; 2nd run
-- matches 0 rows; twice-run => empty pg_dump diff.
-- Safe to re-run; safe on a partially-migrated / fresh (pre-bootstrap) DB.
-- =============================================================================

BEGIN;

DO $mig$
DECLARE
  v_tbl_exists  boolean;
  v_count_pre   integer := 0;
  v_count_post  integer := 0;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
     WHERE table_schema = 'brownfield' AND table_name = 'table_mappings'
  ) INTO v_tbl_exists;

  IF NOT v_tbl_exists THEN
    RAISE NOTICE '000056: brownfield.table_mappings does not exist — no-op (DB pre-bootstrap)';
    RETURN;
  END IF;

  SELECT count(*) INTO v_count_pre
    FROM brownfield.table_mappings
   WHERE table_mapping_target_table = 'sys_activity_classification_mappings'
     AND table_mapping_classification = 'IMPORT';

  RAISE NOTICE '000056: pre-update IMPORT card(s) for sys_activity_classification_mappings: %', v_count_pre;

  UPDATE brownfield.table_mappings
     SET table_mapping_classification = 'REFERENCE_ONLY',
         table_mapping_rationale = COALESCE(table_mapping_rationale, '')
           || ' [000056 / ADR-0025 §5.3 2026-06-02: reclassified IMPORT->REFERENCE_ONLY. '
           || 'Card is mis-authored — target_id LOOKUP_FK resolves to sys_compensation_bands '
           || 'but the shipped FK + API require sys_activity_classifications (0 overlap). The '
           || 'industry->CCNL fact is already modeled in sys_compensation_bands / '
           || 'sys_position_compensation_profiles. Table left EMPTY-BY-DESIGN until a real '
           || 'ATECO<->NACE crosswalk source is authored. Reversible: REFERENCE_ONLY->IMPORT.]'
   WHERE table_mapping_target_table = 'sys_activity_classification_mappings'
     AND table_mapping_classification = 'IMPORT';

  SELECT count(*) INTO v_count_post
    FROM brownfield.table_mappings
   WHERE table_mapping_target_table = 'sys_activity_classification_mappings'
     AND table_mapping_classification = 'IMPORT';

  RAISE NOTICE '000056: post-update IMPORT card(s) for sys_activity_classification_mappings: % (expected 0)', v_count_post;

  IF v_count_post != 0 THEN
    RAISE EXCEPTION '000056: post-update guard failed — % IMPORT card(s) still present', v_count_post;
  END IF;
END $mig$;

-- Migration recording handled by db/scripts/migrate.{ps1,sh} (sys.sys_schema_migrations
-- upsert), matching the 000044/000052 pattern. No INSERT INTO sys.sys_schema_migrations here.

COMMIT;
