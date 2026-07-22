-- ============================================================================
-- Migration 000197 — #71 (S1025): bonifica del catalogo learning.
--
-- Stato misurato (2026-07-22, DB live): sys_learning_modules = 7.427 righe, di
-- cui 6.454 NON sono moduli ma righe di tabelle legacy di FATTI (completamenti,
-- raccomandazioni, rating, bookmark, provider) ingerite per errore come moduli:
--   OLDDB::module_completions::*        4.166
--   OLDDB::learning_recommendations::*  1.625
--   OLDDB::learning_ratings::*            568
--   OLDDB::learning_bookmarks::*           71
--   OLDDB::learning_content_providers::*   24
-- Firma del junk: code E title identici (OLDDB::<tabella-fatti>::<uuid>) —
-- illeggibili in ogni dropdown/catalogo UI. I moduli REALI restano:
--   OLDDB::course_modules::* (845, titoli reali) + 128 nativi senza prefisso.
--
-- Referenze misurate sul junk in TUTTE e 5 le FK (path_steps, skill_mappings,
-- training_initiatives, user_assignments, user_evidence): 0 → delete pulito.
-- Archivio reversibile in audit.learning_junk_archive (pattern 000160).
--
-- Idempotente + twice-run: al 2° giro 0 righe da archiviare/cancellare.
-- Authored: 2026-07-22 (S1025).
-- ============================================================================

CREATE TABLE IF NOT EXISTS audit.learning_junk_archive (LIKE sys.sys_learning_modules);

DROP TABLE IF EXISTS _learning_junk;
CREATE TEMP TABLE _learning_junk AS
SELECT learning_module_id
  FROM sys.sys_learning_modules
 WHERE learning_module_code LIKE 'OLDDB::%'
   AND split_part(learning_module_code, '::', 2) IN
       ('module_completions','learning_recommendations','learning_ratings',
        'learning_bookmarks','learning_content_providers');

-- guardia: nessuna referenza viva sul junk (fail loud se lo stato è cambiato)
DO $$
DECLARE n int;
BEGIN
  SELECT (SELECT count(*) FROM sys.sys_learning_path_steps WHERE learning_path_step_module_id IN (SELECT learning_module_id FROM _learning_junk))
       + (SELECT count(*) FROM sys.sys_skill_learning_mappings WHERE skill_learning_mapping_module_id IN (SELECT learning_module_id FROM _learning_junk))
       + (SELECT count(*) FROM sys.sys_training_initiatives WHERE training_initiative_module_id IN (SELECT learning_module_id FROM _learning_junk))
       + (SELECT count(*) FROM sys.sys_user_learning_assignments WHERE user_learning_assignment_module_id IN (SELECT learning_module_id FROM _learning_junk))
       + (SELECT count(*) FROM sys.sys_user_learning_evidence WHERE user_learning_evidence_module_id IN (SELECT learning_module_id FROM _learning_junk))
    INTO n;
  IF n > 0 THEN
    RAISE EXCEPTION '000197: % referenze vive sui moduli junk — repoint necessario prima del purge', n;
  END IF;
END $$;

INSERT INTO audit.learning_junk_archive
SELECT m.* FROM sys.sys_learning_modules m
 WHERE m.learning_module_id IN (SELECT learning_module_id FROM _learning_junk)
   AND NOT EXISTS (SELECT 1 FROM audit.learning_junk_archive a
                    WHERE a.learning_module_id = m.learning_module_id);

DELETE FROM sys.sys_learning_modules
 WHERE learning_module_id IN (SELECT learning_module_id FROM _learning_junk);

-- ---- Post-conditions (fail-loud) ------------------------------------------
DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM sys.sys_learning_modules
   WHERE learning_module_code LIKE 'OLDDB::%'
     AND split_part(learning_module_code, '::', 2) NOT IN ('course_modules');
  IF n > 0 THEN
    RAISE EXCEPTION '000197: % moduli junk ancora presenti', n;
  END IF;

  SELECT count(*) INTO n FROM sys.sys_learning_modules
   WHERE learning_module_title = learning_module_code;
  IF n > 0 THEN
    RAISE EXCEPTION '000197: % moduli con title==code (illeggibili) ancora presenti', n;
  END IF;

  RAISE NOTICE '000197: catalogo learning bonificato (restano solo moduli reali).';
END $$;
