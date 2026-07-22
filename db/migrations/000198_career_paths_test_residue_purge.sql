-- ============================================================================
-- Migration 000198 — #71 (S1025): purge dei career path residuo-test.
--
-- Stato misurato (2026-07-22, DB live): sys_career_paths = 28 righe, di cui 21
-- sono residui di test pre-D-52 (creati 2026-06-03, prima della tx-isolation):
--   "Test Auth Path" ×19 + "test" ×2 — tenant-scoped, 0 referenze in TUTTE le
-- FK (career_path_steps, user_career_plans, position_career_paths; misurato).
-- Restano i 7 track reali (Corporate Banking, Risk Management, Technology
-- Leadership, Banking Operations, Compliance & Legal, Management, Software
-- Engineering). Archivio reversibile in audit.career_paths_junk_archive.
--
-- Idempotente + twice-run: al 2° giro 0 righe. Authored: 2026-07-22 (S1025).
-- ============================================================================

CREATE TABLE IF NOT EXISTS audit.career_paths_junk_archive (LIKE sys.sys_career_paths);

DROP TABLE IF EXISTS _career_junk;
CREATE TEMP TABLE _career_junk AS
SELECT career_path_id FROM sys.sys_career_paths
 WHERE career_path_name IN ('Test Auth Path', 'test');

DO $$
DECLARE n int;
BEGIN
  SELECT (SELECT count(*) FROM sys.sys_career_path_steps WHERE career_path_step_path_id IN (SELECT career_path_id FROM _career_junk))
       + (SELECT count(*) FROM sys.sys_user_career_plans WHERE user_career_plan_path_id IN (SELECT career_path_id FROM _career_junk))
       + (SELECT count(*) FROM sys.sys_position_career_paths WHERE career_path_id IN (SELECT career_path_id FROM _career_junk))
    INTO n;
  IF n > 0 THEN
    RAISE EXCEPTION '000198: % referenze vive sui career path junk — repoint necessario', n;
  END IF;
END $$;

INSERT INTO audit.career_paths_junk_archive
SELECT p.* FROM sys.sys_career_paths p
 WHERE p.career_path_id IN (SELECT career_path_id FROM _career_junk)
   AND NOT EXISTS (SELECT 1 FROM audit.career_paths_junk_archive a
                    WHERE a.career_path_id = p.career_path_id);

DELETE FROM sys.sys_career_paths
 WHERE career_path_id IN (SELECT career_path_id FROM _career_junk);

DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM sys.sys_career_paths
   WHERE career_path_name IN ('Test Auth Path', 'test');
  IF n > 0 THEN
    RAISE EXCEPTION '000198: % career path junk ancora presenti', n;
  END IF;
  RAISE NOTICE '000198: career path di test rimossi (restano i track reali).';
END $$;
