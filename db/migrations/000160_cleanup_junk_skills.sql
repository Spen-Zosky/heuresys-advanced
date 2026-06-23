-- ============================================================================
-- 000160_cleanup_junk_skills.sql
-- Data-quality cleanup (audit S1006, Enzo "clean"): remove the legacy import
-- artifacts that were mis-loaded into sys.sys_skills and polluted the /skills
-- catalogue. They are NOT skills — their name is a raw legacy code
-- ('OLDDB::semantic_entity_index::<uuid>', 'OLDDB::skill_gap_analyses::<uuid>',
-- 'OLDDB::skill_demand_metrics::<uuid>', 'OLDDB::competency_review_ratings::<uuid>')
-- or an analysis-run / rating-scale label ('Qx YYYY Skills Analysis',
-- 'Standard 5-Point Scale'). Verified orphans: 0 references in the real-usage
-- tables (position_skill_requirements, user_skill_evidence — RESTRICT; learning_gaps,
-- mentor_match_scores, occupation_skill_requirements — SET NULL). The derived
-- index tables (skill_embeddings/aliases/taxonomy_edges/learning_mappings/
-- requirement_history) are ON DELETE CASCADE, so they clean up automatically.
--
-- Reversible: the deleted skill rows are archived to audit.skills_junk_archive
-- first. Idempotent (archive guarded by NOT EXISTS; the DELETE matches only the
-- junk patterns, which no real/ESCO skill matches).
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS audit;
CREATE TABLE IF NOT EXISTS audit.skills_junk_archive (LIKE sys.sys_skills);

INSERT INTO audit.skills_junk_archive
SELECT s.*
  FROM sys.sys_skills s
 WHERE (s.skill_name LIKE 'OLDDB::%'
        OR s.skill_name ~ 'Skills Analysis'
        OR s.skill_name ~ '5-Point Scale')
   AND NOT EXISTS (SELECT 1 FROM audit.skills_junk_archive a WHERE a.skill_id = s.skill_id);

DELETE FROM sys.sys_skills
 WHERE skill_name LIKE 'OLDDB::%'
    OR skill_name ~ 'Skills Analysis'
    OR skill_name ~ '5-Point Scale';

DO $$
DECLARE remaining int; archived int;
BEGIN
  SELECT count(*) INTO remaining FROM sys.sys_skills
    WHERE skill_name LIKE 'OLDDB::%' OR skill_name ~ 'Skills Analysis' OR skill_name ~ '5-Point Scale';
  SELECT count(*) INTO archived FROM audit.skills_junk_archive;
  IF remaining <> 0 THEN
    RAISE EXCEPTION '000160: % junk skill rows still present after cleanup', remaining;
  END IF;
  RAISE NOTICE '000160: junk skills removed; % archived to audit.skills_junk_archive (reversible).', archived;
END $$;
