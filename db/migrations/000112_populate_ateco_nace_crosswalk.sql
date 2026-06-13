-- 000112_populate_ateco_nace_crosswalk.sql
-- R2 Fase3 (S988) — populate the ATECO<->NACE crosswalk (decision: "popola ~5.5k").
--
-- sys_activity_classification_mappings has been EMPTY-BY-DESIGN since mig 000056: the
-- brownfield IMPORT card (legacy industry_ccnl_mapping) was mis-authored to target
-- sys_compensation_bands (0 overlap) and was reclassified REFERENCE_ONLY. That card STAYS
-- REFERENCE_ONLY — this is a SEPARATE deterministic derivation, not a revert of 000056, and
-- it is the deferred ATECO<->NACE crosswalk source that 000056 explicitly left for later.
--
-- Derivation (deterministic, confidence 1.000): ATECO is a refinement of NACE Rev-2.1 — every
-- ATECO / ATECO_2025 code whose parent_code IS a NACE code is NARROWER than that NACE node.
-- Source/target ids are FKs to sys_activity_classifications, resolved entirely in-SQL via the
-- self-join code = parent_code (no external lookup). Both directions are populated (the CHECK
-- ships NARROWER + BROADER; a crosswalk is bidirectional):
--   NARROWER  source=ATECO(_2025) -> target=NACE   (child narrower than parent)   ~2865
--   BROADER   source=NACE -> target=ATECO(_2025)   (reciprocal)                   ~2865
--   = ~5730 total (matches the "~5.5k" decision; the decision's "kind=NARROWER" named the
--   primary direction — the reciprocal BROADER completes a real bidirectional crosswalk).
-- Coverage measured 0-unresolved: ATECO L5->NACE L4 920/920 + ATECO_2025 1945/1945.
--
-- Idempotent: ON CONFLICT (source,target) DO NOTHING; twice-run = 0 new rows. No BEGIN/COMMIT
-- (migrate.sh runs each file with `psql -1`). The verification block aborts on any unresolved
-- NARROWER pair (a real coverage regression), else just RAISE NOTICE.

-- NARROWER: ATECO / ATECO_2025 child -> its NACE parent
INSERT INTO sys.sys_activity_classification_mappings
  (activity_class_mapping_source_id, activity_class_mapping_target_id,
   activity_class_mapping_kind, activity_class_mapping_confidence, activity_class_mapping_metadata)
SELECT a.activity_classification_id, n.activity_classification_id,
       'NARROWER', 1.000,
       jsonb_build_object('source','s988-r2-ateco-nace-crosswalk',
                          'rule','parent_code matches a NACE code',
                          'direction','child->parent',
                          'source_scheme', a.activity_classification_scheme)
FROM sys.sys_activity_classifications a
JOIN sys.sys_activity_classifications n
  ON n.activity_classification_scheme = 'NACE'
 AND n.activity_classification_code   = a.activity_classification_parent_code
WHERE a.activity_classification_scheme IN ('ATECO', 'ATECO_2025')
ON CONFLICT (activity_class_mapping_source_id, activity_class_mapping_target_id) DO NOTHING;

-- BROADER: the reciprocal NACE parent -> ATECO / ATECO_2025 child
INSERT INTO sys.sys_activity_classification_mappings
  (activity_class_mapping_source_id, activity_class_mapping_target_id,
   activity_class_mapping_kind, activity_class_mapping_confidence, activity_class_mapping_metadata)
SELECT n.activity_classification_id, a.activity_classification_id,
       'BROADER', 1.000,
       jsonb_build_object('source','s988-r2-ateco-nace-crosswalk',
                          'rule','parent_code matches a NACE code',
                          'direction','parent->child',
                          'target_scheme', a.activity_classification_scheme)
FROM sys.sys_activity_classifications a
JOIN sys.sys_activity_classifications n
  ON n.activity_classification_scheme = 'NACE'
 AND n.activity_classification_code   = a.activity_classification_parent_code
WHERE a.activity_classification_scheme IN ('ATECO', 'ATECO_2025')
ON CONFLICT (activity_class_mapping_source_id, activity_class_mapping_target_id) DO NOTHING;

-- Verification + hard assert on unresolved NARROWER coverage (informational counts).
DO $$
DECLARE n_narrow int; n_broad int; n_total int; n_unresolved int;
BEGIN
  SELECT count(*) INTO n_narrow FROM sys.sys_activity_classification_mappings WHERE activity_class_mapping_kind = 'NARROWER';
  SELECT count(*) INTO n_broad  FROM sys.sys_activity_classification_mappings WHERE activity_class_mapping_kind = 'BROADER';
  SELECT count(*) INTO n_total  FROM sys.sys_activity_classification_mappings;
  SELECT count(*) INTO n_unresolved
    FROM sys.sys_activity_classifications a
    JOIN sys.sys_activity_classifications n
      ON n.activity_classification_scheme = 'NACE'
     AND n.activity_classification_code   = a.activity_classification_parent_code
   WHERE a.activity_classification_scheme IN ('ATECO', 'ATECO_2025')
     AND NOT EXISTS (
       SELECT 1 FROM sys.sys_activity_classification_mappings m
        WHERE m.activity_class_mapping_source_id = a.activity_classification_id
          AND m.activity_class_mapping_target_id = n.activity_classification_id);
  RAISE NOTICE 'R2 crosswalk: NARROWER=% BROADER=% total=% unresolved-narrower=% (expect ~2865 / ~2865 / ~5730 / 0)',
    n_narrow, n_broad, n_total, n_unresolved;
  IF n_unresolved <> 0 THEN
    RAISE EXCEPTION 'R2 crosswalk: % NARROWER pairs unresolved (expected 0) — coverage regression', n_unresolved;
  END IF;
END $$;
