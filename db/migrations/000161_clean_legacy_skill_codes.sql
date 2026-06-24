-- ============================================================================
-- 000161_clean_legacy_skill_codes.sql
-- Data-quality (audit S1006 tail): the skill_code column carried raw legacy
-- import prefixes ('OLDDB::esco_skills::<uuid>', 'OLDDB::competencies::<uuid>')
-- which surfaced as the CODE column on /positions/[id]/skills and the /skills
-- catalogue. skill_code is NOT a business/upsert key (no UNIQUE constraint, no
-- ON CONFLICT, no FK — those are on skill_id), so it is display-only and safe to
-- rewrite. Rebranded to clean, meaningful prefixes that keep the stable id:
--   OLDDB::esco_skills::<uuid>  -> ESCO::<uuid>   (ESCO-sourced)
--   OLDDB::competencies::<uuid> -> COMP::<uuid>   (legacy competency)
-- Idempotent (only rows still carrying the OLDDB prefix are touched).
-- ============================================================================

UPDATE sys.sys_skills
   SET skill_code = 'ESCO::' || replace(skill_code, 'OLDDB::esco_skills::', '')
 WHERE skill_code LIKE 'OLDDB::esco_skills::%';

UPDATE sys.sys_skills
   SET skill_code = 'COMP::' || replace(skill_code, 'OLDDB::competencies::', '')
 WHERE skill_code LIKE 'OLDDB::competencies::%';

DO $$
DECLARE leftover int;
BEGIN
  SELECT count(*) INTO leftover FROM sys.sys_skills WHERE skill_code LIKE 'OLDDB::%';
  IF leftover <> 0 THEN
    RAISE WARNING '000161: % skill_code(s) still carry an OLDDB:: prefix', leftover;
  END IF;
  RAISE NOTICE '000161: legacy skill_code prefixes cleaned (ESCO:: / COMP::).';
END $$;
