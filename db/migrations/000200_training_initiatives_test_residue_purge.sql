-- ============================================================================
-- Migration 000200 — #68 F4 (S1026): purge del residuo-test training initiatives.
--
-- Stato misurato (2026-07-22, DB live): sys_training_initiatives contiene UNA
-- sola riga in tutto il sistema, `IT_TI_A00EDC19_BAD_FAC` (creata 2026-05-16,
-- pre-D-52 tx-isolation, dal test "Non-existent facilitator -> 404" di
-- training-initiatives.integration.test.ts: prefisso IT_TI_<8hex> + suffisso
-- _BAD_FAC combaciano lettera per lettera), con il modulo orfano collegato
-- `IT_TI_A00EDC19_GLOBAL_MOD` in sys_learning_modules (FK RESTRICT: va tolta
-- prima l'iniziativa, poi il modulo). Il census F4 la fotografava come "nome
-- sospetto anche lato DB" su /learning/training-initiatives: il 100% del
-- contenuto della pagina era scarto di test. Stesso pattern e stessa cura
-- della 000198 (career path junk): archivio reversibile in audit.*.
--
-- Idempotente + twice-run: al 2° giro 0 righe. Authored: 2026-07-22 (S1026).
-- ============================================================================

CREATE TABLE IF NOT EXISTS audit.training_initiatives_junk_archive (LIKE sys.sys_training_initiatives);
CREATE TABLE IF NOT EXISTS audit.learning_modules_junk_archive (LIKE sys.sys_learning_modules);

DROP TABLE IF EXISTS _ti_junk;
CREATE TEMP TABLE _ti_junk AS
SELECT training_initiative_id FROM sys.sys_training_initiatives
 WHERE training_initiative_code = 'IT_TI_A00EDC19_BAD_FAC';

DROP TABLE IF EXISTS _lm_junk;
CREATE TEMP TABLE _lm_junk AS
SELECT learning_module_id FROM sys.sys_learning_modules
 WHERE learning_module_code = 'IT_TI_A00EDC19_GLOBAL_MOD';

-- guardia: nessuna referenza viva oltre a quelle che stiamo rimuovendo
DO $$
DECLARE n int;
BEGIN
  SELECT (SELECT count(*) FROM sys.sys_user_learning_assignments
           WHERE user_learning_assignment_initiative_id IN (SELECT training_initiative_id FROM _ti_junk)
              OR user_learning_assignment_module_id IN (SELECT learning_module_id FROM _lm_junk))
       + (SELECT count(*) FROM sys.sys_user_learning_evidence
           WHERE user_learning_evidence_module_id IN (SELECT learning_module_id FROM _lm_junk))
       + (SELECT count(*) FROM sys.sys_learning_path_steps
           WHERE learning_path_step_module_id IN (SELECT learning_module_id FROM _lm_junk))
       + (SELECT count(*) FROM sys.sys_skill_learning_mappings
           WHERE skill_learning_mapping_module_id IN (SELECT learning_module_id FROM _lm_junk))
       + (SELECT count(*) FROM sys.sys_training_initiatives
           WHERE training_initiative_module_id IN (SELECT learning_module_id FROM _lm_junk)
             AND training_initiative_id NOT IN (SELECT training_initiative_id FROM _ti_junk))
    INTO n;
  IF n > 0 THEN
    RAISE EXCEPTION '000200: % referenze vive sul residuo-test — repoint necessario', n;
  END IF;
END $$;

INSERT INTO audit.training_initiatives_junk_archive
SELECT t.* FROM sys.sys_training_initiatives t
 WHERE t.training_initiative_id IN (SELECT training_initiative_id FROM _ti_junk)
   AND NOT EXISTS (SELECT 1 FROM audit.training_initiatives_junk_archive a
                    WHERE a.training_initiative_id = t.training_initiative_id);

INSERT INTO audit.learning_modules_junk_archive
SELECT m.* FROM sys.sys_learning_modules m
 WHERE m.learning_module_id IN (SELECT learning_module_id FROM _lm_junk)
   AND NOT EXISTS (SELECT 1 FROM audit.learning_modules_junk_archive a
                    WHERE a.learning_module_id = m.learning_module_id);

DELETE FROM sys.sys_training_initiatives
 WHERE training_initiative_id IN (SELECT training_initiative_id FROM _ti_junk);

DELETE FROM sys.sys_learning_modules
 WHERE learning_module_id IN (SELECT learning_module_id FROM _lm_junk);

-- La purge lascia sys_training_initiatives a 0 righe: senza una dichiarazione
-- il census di riconciliazione la marcherebbe UNCLASSIFIED (fn_reconciliation_
-- status: empty + no mapping + no registry row). Dichiarata EXCLUDE/D come le
-- gemelle event-driven sys_approval_requests/steps: app-authored, si popola
-- quando un'iniziativa formativa reale viene creata, nessuna sorgente legacy.
INSERT INTO sys.sys_reconciliation_registry
  (reconciliation_registry_table_name, reconciliation_registry_bucket,
   reconciliation_registry_declared_status, reconciliation_registry_rationale)
VALUES
  ('sys_training_initiatives', 'D', 'EXCLUDE',
   '[000200 S1026] App-authored training-initiative runtime (coorti/edizioni). Era POPULATED solo per una riga residuo-test pre-D-52 (IT_TI_A00EDC19_BAD_FAC), purgata qui: event-driven, si popola quando un''iniziativa reale viene creata. Nessuna sorgente legacy (le iniziative non esistono nel DB evo).')
ON CONFLICT (reconciliation_registry_table_name) DO NOTHING;

DO $$
DECLARE n int;
BEGIN
  SELECT (SELECT count(*) FROM sys.sys_training_initiatives WHERE training_initiative_code = 'IT_TI_A00EDC19_BAD_FAC')
       + (SELECT count(*) FROM sys.sys_learning_modules WHERE learning_module_code = 'IT_TI_A00EDC19_GLOBAL_MOD')
    INTO n;
  IF n > 0 THEN
    RAISE EXCEPTION '000200: % righe residuo-test ancora presenti', n;
  END IF;
  -- EXCLUDE *oppure* POPULATED: la decisione dice che questa tabella è fuori
  -- dalla riconciliazione col legacy, e resta vera adesso che il programma
  -- storia36 l'ha riempita — i dati non vengono dal legacy. Pretendere EXCLUDE
  -- significherebbe pretendere che resti vuota, e la migration fallirebbe alla
  -- riesecuzione su un database vivo.
  IF NOT EXISTS (SELECT 1 FROM sys.v_reconciliation_status
                  WHERE table_name = 'sys_training_initiatives'
                    AND resolved_status IN ('EXCLUDE', 'POPULATED')) THEN
    RAISE EXCEPTION '000200: sys_training_initiatives non risolve EXCLUDE/POPULATED nel census';
  END IF;
  RAISE NOTICE '000200: residuo-test rimosso (archivio audit.*) + registry EXCLUDE/D dichiarato.';
END $$;
