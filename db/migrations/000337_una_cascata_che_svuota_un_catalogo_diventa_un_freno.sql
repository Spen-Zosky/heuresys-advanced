-- ============================================================================
-- 000337 — #220 W1.1 (rilievo F1-01): le quattro FK dei mapping di
--          classificazione passano da ON DELETE CASCADE a ON DELETE RESTRICT.
--
-- IL DIFETTO, misurato sul vivo il 2026-08-20 (non ereditato dal dossier):
--   SELECT conrelid::regclass, conname, confdeltype
--     FROM pg_constraint WHERE contype='f'
--      AND conrelid::regclass::text IN
--          ('sys.sys_activity_classification_mappings',
--           'sys.sys_occupation_classification_mappings');
--   -> 4 righe, tutte confdeltype='c'.
--
-- PERCHE' E' SBAGLIATO. Un mapping e' un'affermazione FRA due classificazioni:
-- «questo codice corrisponde a quello». Con CASCADE, cancellare una singola
-- riga di catalogo fa sparire in silenzio ogni corrispondenza che la nomina —
-- e le corrispondenze sono un lavoro di curatela, non un sottoprodotto
-- rigenerabile. Il costo di ricostruirle non c'entra con il costo di
-- cancellare la riga che le ha portate via.
--
-- Con RESTRICT il ritiro di un catalogo diventa una decisione ESPLICITA: chi
-- vuole cancellare deve prima dire cosa ne e' dei mapping. E' esattamente cio'
-- che 000211 fa gia' a mano (cancella i mapping legacy PRIMA delle righe
-- legacy, in due DELETE separate e motivate) — quindi questo cambio non
-- ostacola la catena: le da' ragione, rendendo obbligatorio l'ordine che la
-- sola migrazione scritta bene rispettava gia' per scelta.
--
-- LA FONTE E' EMENDATA (ADR-0035). Le FK nascono in 000007 (activity) e 000206
-- (occupation), entrambe sotto CREATE TABLE IF NOT EXISTS: su un database
-- nuovo nascono gia' RESTRICT. Questo file esiste SOLO per l'esemplare gia'
-- creato, dove il CREATE non rigira. Non e' una cancellazione a valle: e' la
-- forma (3) dell'ADR, ammessa in aggiunta a (1), che qui e' stata fatta.
--
-- ELENCO ESPLICITO, MAI UN JOLLY: le quattro FK sono nominate una per una.
-- Un ciclo su pg_constraint avrebbe preso anche le FK future, comprese quelle
-- per cui CASCADE e' la scelta giusta.
--
-- ROLLBACK DICHIARATO: nessun giornale staging.*_undo, e la ragione e' che qui
-- NON SI TOCCA UN DATO. L'operazione e' puramente strutturale e la sua inversa
-- e' questo stesso file con RESTRICT->CASCADE. Un undo di righe non avrebbe
-- niente da conservare: entrambe le tabelle mapping sono a 0 righe (misurato
-- oggi), e resterebbero a 0 anche se fossero piene.
--
-- IDEMPOTENTE: ogni blocco agisce solo se la FK e' ancora 'c'. Rieseguito, non
-- fa nulla. Su un database nuovo (dove 000007/000206 hanno gia' creato
-- RESTRICT) non entra in nessun ramo.
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint
              WHERE conname = 'sys_activity_classification_m_activity_class_mapping_sourc_fkey'
                AND confdeltype = 'c') THEN
    ALTER TABLE sys.sys_activity_classification_mappings
      DROP CONSTRAINT sys_activity_classification_m_activity_class_mapping_sourc_fkey;
    ALTER TABLE sys.sys_activity_classification_mappings
      ADD CONSTRAINT sys_activity_classification_m_activity_class_mapping_sourc_fkey
      FOREIGN KEY (activity_class_mapping_source_id)
      REFERENCES sys.sys_activity_classifications(activity_classification_id)
      ON DELETE RESTRICT;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_constraint
              WHERE conname = 'sys_activity_classification_m_activity_class_mapping_targe_fkey'
                AND confdeltype = 'c') THEN
    ALTER TABLE sys.sys_activity_classification_mappings
      DROP CONSTRAINT sys_activity_classification_m_activity_class_mapping_targe_fkey;
    ALTER TABLE sys.sys_activity_classification_mappings
      ADD CONSTRAINT sys_activity_classification_m_activity_class_mapping_targe_fkey
      FOREIGN KEY (activity_class_mapping_target_id)
      REFERENCES sys.sys_activity_classifications(activity_classification_id)
      ON DELETE RESTRICT;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_constraint
              WHERE conname = 'sys_occupation_classification_occupation_class_mapping_sou_fkey'
                AND confdeltype = 'c') THEN
    ALTER TABLE sys.sys_occupation_classification_mappings
      DROP CONSTRAINT sys_occupation_classification_occupation_class_mapping_sou_fkey;
    ALTER TABLE sys.sys_occupation_classification_mappings
      ADD CONSTRAINT sys_occupation_classification_occupation_class_mapping_sou_fkey
      FOREIGN KEY (occupation_class_mapping_source_id)
      REFERENCES sys.sys_occupation_classifications(occupation_classification_id)
      ON DELETE RESTRICT;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_constraint
              WHERE conname = 'sys_occupation_classification_occupation_class_mapping_tar_fkey'
                AND confdeltype = 'c') THEN
    ALTER TABLE sys.sys_occupation_classification_mappings
      DROP CONSTRAINT sys_occupation_classification_occupation_class_mapping_tar_fkey;
    ALTER TABLE sys.sys_occupation_classification_mappings
      ADD CONSTRAINT sys_occupation_classification_occupation_class_mapping_tar_fkey
      FOREIGN KEY (occupation_class_mapping_target_id)
      REFERENCES sys.sys_occupation_classifications(occupation_classification_id)
      ON DELETE RESTRICT;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- POST-CONDIZIONE. Due controlli, e il secondo e' quello che conta: protegge
-- cio' che NON doveva cambiare. Contare solo le RESTRICT non distinguerebbe
-- «le quattro sono diventate RESTRICT» da «tre sono sparite e una e' RESTRICT»
-- — un DROP senza ADD, cioe' il guasto piu' probabile di questo file, uscirebbe
-- verde. Il conteggio totale delle FK e' la guardia contro quello.
-- ---------------------------------------------------------------------------
DO $$
DECLARE cascate int; totali int;
BEGIN
  SELECT count(*) INTO cascate
    FROM pg_constraint
   WHERE contype = 'f' AND confdeltype = 'c'
     AND conrelid::regclass::text IN ('sys.sys_activity_classification_mappings',
                                      'sys.sys_occupation_classification_mappings');
  IF cascate > 0 THEN
    RAISE EXCEPTION '000337: % FK dei mapping ancora ON DELETE CASCADE', cascate;
  END IF;

  SELECT count(*) INTO totali
    FROM pg_constraint
   WHERE contype = 'f'
     AND conrelid::regclass::text IN ('sys.sys_activity_classification_mappings',
                                      'sys.sys_occupation_classification_mappings');
  IF totali <> 4 THEN
    RAISE EXCEPTION '000337: attese 4 FK sui mapping, trovate % — un DROP senza il suo ADD?', totali;
  END IF;
END $$;
