-- db/seeds/reconciliation/39_skill_learning_mappings.sql
-- D5 / Wall W3 — sys.sys_skill_learning_mappings from legacy public.course_esco_skills.
-- Dossier docs/kb/RECONCILIATION_WALLS_AND_AI_DECISION_DOSSIER.md §4 + §7 D5.
--
-- UNBLOCKED by the course=module catalog (000061 + seed 37): the NOT-NULL module_id FK now resolves.
-- The skill<->learning bridge maps each course to the ESCO skills it grants. Both legs:
--   module <- course code -> the GLOBAL course=module (seed 37). Course leg resolves 717/717.
--   skill  <- esco_skill_uri -> sys.sys_skills.skill_esco_uri. Skill leg resolves 635/717 (88.6%);
--            the 82 unresolved rows carry an esco_uri absent from sys_skills (e.g. CUSTOM::F6
--            and a handful of non-canonical URIs) — documented as the reduced-recall remainder, NOT
--            imported (no fabrication). Each resolving esco_uri maps to EXACTLY ONE sys_skill (verified
--            no multi-map), so the unique key (skill_id, module_id) is collision-safe.
--
-- IMPORT THE RESOLVABLE SUBSET (635 distinct (course, esco_uri) pairs -> distinct (skill, module)).
-- DOCUMENTED GAP: 82/717 source rows skip on an unresolved ESCO URI (a sys_skills coverage gap, not a
-- catalog gap). Re-runnable to full once those skills are added to sys_skills.
--
-- proficiency: legacy proficiency_level_gained (int 1..5; in the resolvable subset it is 100% NULL —
-- the 82 rows carrying level 3/4 are exactly the unresolvable-URI ones) maps to the CHECK domain
-- (NOVICE/BASIC/COMPETENT/PROFICIENT/EXPERT/MASTER). NULL -> 'COMPETENT' (the mid-tier default for a
-- skill gained by completing a course); the explicit 1..5 map is kept for forward-robustness.
--
-- ==========================================================================================
-- PREREQUISITE staging (supervised COPY pipe — course code resolved, skill leg left to the JOIN):
--   psql … -c "
--     CREATE TABLE IF NOT EXISTS staging.tmp_w3_ces (
--       source_id uuid, course_code text, esco_skill_uri text, skill_name text, proficiency_level_gained int);
--     TRUNCATE staging.tmp_w3_ces;"
--
--   ssh oracle-vm-default 'sudo -u postgres psql -d heuresys_platform -c "\copy (
--     SELECT ces.id, c.code, ces.esco_skill_uri, ces.skill_name, ces.proficiency_level_gained
--       FROM public.course_esco_skills ces JOIN public.courses c ON c.id = ces.course_id
--       WHERE ces.esco_skill_uri IS NOT NULL) TO STDOUT WITH (FORMAT csv)"' \
--     | psql … -c "\copy staging.tmp_w3_ces FROM STDIN WITH (FORMAT csv)"
--
-- Measured live S961: staging = 717 (314 distinct esco_uri, 127 distinct course); 306/314 URIs and
-- 635/717 rows resolve to a sys_skill; 635 distinct (course_code, esco_uri) -> 635 mappings.
-- ==========================================================================================
-- IDEMPOTENT: resolve both legs, DISTINCT ON (skill, module), ON CONFLICT (skill_id, module_id)
-- DO NOTHING (the table's unique key sys_skill_learning_mappings_pair_uq). 2nd run inserts 0.
-- ==========================================================================================

BEGIN;

INSERT INTO sys.sys_skill_learning_mappings (
  skill_learning_mapping_skill_id,
  skill_learning_mapping_module_id,
  skill_learning_mapping_target_proficiency,
  skill_learning_mapping_metadata
)
SELECT DISTINCT ON (sk.skill_id, lm.learning_module_id)
  sk.skill_id,
  lm.learning_module_id,
  CASE s.proficiency_level_gained
    WHEN 1 THEN 'NOVICE'  WHEN 2 THEN 'BASIC'   WHEN 3 THEN 'COMPETENT'
    WHEN 4 THEN 'PROFICIENT' WHEN 5 THEN 'EXPERT'
    ELSE 'COMPETENT' END,
  jsonb_build_object('legacy', jsonb_strip_nulls(jsonb_build_object(
    'source_table', 'course_esco_skills', 'source_id', s.source_id,
    'course_code', s.course_code, 'esco_skill_uri', s.esco_skill_uri,
    'skill_name', s.skill_name, 'proficiency_level_gained', s.proficiency_level_gained)))
FROM staging.tmp_w3_ces s
JOIN sys.sys_skills sk
  ON sk.skill_esco_uri = s.esco_skill_uri
JOIN sys.sys_learning_modules lm
  ON lm.learning_module_code = s.course_code
 AND lm.learning_module_tenant_id IS NULL
ORDER BY sk.skill_id, lm.learning_module_id, s.proficiency_level_gained DESC NULLS LAST
ON CONFLICT (skill_learning_mapping_skill_id, skill_learning_mapping_module_id) DO NOTHING;

DO $$
DECLARE v_total int; v_skills int; v_modules int; v_bad_prof int;
BEGIN
  SELECT count(*), count(DISTINCT skill_learning_mapping_skill_id),
         count(DISTINCT skill_learning_mapping_module_id)
    INTO v_total, v_skills, v_modules FROM sys.sys_skill_learning_mappings;
  SELECT count(*) INTO v_bad_prof FROM sys.sys_skill_learning_mappings
    WHERE skill_learning_mapping_target_proficiency
          NOT IN ('NOVICE','BASIC','COMPETENT','PROFICIENT','EXPERT','MASTER');
  RAISE NOTICE '39: skill_learning_mappings=% across % skills / % modules (bad_proficiency=%)',
    v_total, v_skills, v_modules, v_bad_prof;
  IF v_total = 0 THEN RAISE EXCEPTION '39: skill_learning_mappings still 0 after import'; END IF;
  IF v_bad_prof <> 0 THEN RAISE EXCEPTION '39: % rows violate the proficiency CHECK domain', v_bad_prof; END IF;
END $$;

COMMIT;
