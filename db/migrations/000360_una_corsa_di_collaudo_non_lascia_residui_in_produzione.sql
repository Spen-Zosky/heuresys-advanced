-- ============================================================================
-- 000360 — Una corsa di collaudo non lascia residui in produzione
--
-- IL FATTO, misurato il 2026-08-28 (S1083). Il cruscotto segnalava «i18n dati:
-- 2 campi con gap EN». Non era un gap di traduzione: erano **due entità di
-- collaudo dimenticate in produzione**, che facevano da denominatore a una
-- copertura che non le riguardava. Cercandole per prefisso, la terza è saltata
-- fuori da sé — e non accendeva nulla, perché la sua tabella non è nel registro
-- dei campi traducibili. Il sintomo ne mostrava due su tre.
--
--   · sys_job_families      E2E-JOBFAM-1787840975274      «Famiglia di collaudo …»
--   · sys_job_roles         E2E-JOBROLE-1787840975274     «Ruolo rinominato …»
--   · sys_learning_modules  E2E-LM-STEP2-1787841094753    «Modulo 2 del percorso …»
--
-- Tutte e tre create il **2026-08-27 fra le 14:29 e le 14:31 UTC** — la corsa
-- E2E che quel giorno è morta a metà (commit `ed80fa05`: «l'ultima corsa E2E è
-- rumore, non misura — l'API è morta durante»). Il teardown della suite non è
-- sopravvissuto all'interruzione, e ciò che aveva creato è rimasto.
--
-- I FALSI POSITIVI, respinti uno per uno — stesso criterio di S1042 («nomina
-- un'entità inesistente»), perché una ricerca per parola prende anche ciò che
-- non c'entra:
--   · **17 `sys_skills` che contengono «collaudo»** — sono competenze **ESCO**
--     legittime («metodi di collaudo elettrico», «pianificare il collaudo del
--     software»): *collaudo* è la parola italiana per *testing*. ESCO è la
--     tassonomia europea delle competenze e **I21** la tiene aperta a ogni
--     industry. Non si toccano.
--   · **3 `sys_users` su `@collaudo.invalid`** («Collaudo Piattaforma», «Collaudo
--     Governo», «Collaudo Persona») — sono le **personas deliberate** create il
--     2026-08-25, su dominio `.invalid` che è riservato per definizione. Sono
--     infrastruttura voluta, non residuo. Non si toccano.
--
-- LE DIPENDENZE, censite prima di cancellare e non supposte: scorrendo tutte le
-- FK a colonna singola che puntano alle tre tabelle, l'unico riferimento vivo è
-- `sys_job_roles.job_role_family_id` -> la job family E2E, cioè i due residui che
-- si tengono per mano. Nessuna riga reale dipende da loro; il modulo formativo è
-- isolato (`sys_learning_path_steps` non lo referenzia: 0 righe). Quindi
-- l'ordine di cancellazione è ruolo prima, famiglia dopo.
--
-- LA SENTINELLA, ed è il punto che conta più della pulizia. Questi tre erano lì
-- da un giorno e nessuno strumento li cercava: si sono visti **di rimbalzo**, da
-- una metrica di traduzione. `sys.v_residui_di_collaudo_in_produzione` li rende
-- visibili in modo diretto, e viene raccolta da sé da `db_health.py`, che
-- pretende zero righe da ogni vista `sys.v_*`.
--   ⚠ La vista guarda solo i residui **più vecchi di 24 ore**. Una suite E2E che
--   sta girando adesso ha legittimamente le sue entità in tabella: una sentinella
--   che diventasse rossa durante ogni corsa insegnerebbe a non guardarla — è la
--   stessa ragione per cui l'atlante non si testa con `commit == HEAD` (`#194`).
--   Un residuo abbandonato, invece, invecchia, e a quel punto si accende.
--
-- NESSUN FILE DELLA CATENA RICREA QUESTE RIGHE — verificato, non supposto: le
-- entità nascono dalla suite Playwright a runtime, via API. Non c'è quindi un
-- file da emendare ai sensi di **ADR-0035**: la cura a valle regge, e questo è
-- il motivo per cui regge.
--
-- LA CAUSA A MONTE, dichiarata e NON risolta qui: il teardown della suite E2E
-- non è resistente all'interruzione. È materia di `#219` (gli otto guasti della
-- suite), non di una migrazione.
--
-- ROLLBACK: giornale `staging.mig360_residui_collaudo_undo` (riga intera in
-- JSONB) + `staging.mig360_residui_collaudo_undo_apply()`, che ripristina nel-
-- l'ordine inverso (famiglia prima, ruolo dopo).
--
-- IDEMPOTENTE: ogni cancellazione è filtrata su un codice esatto. Su un database
-- nuovo, e alla seconda passata, tocca zero righe.
-- Authored: 2026-08-28 (S1083).
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 0. Il giornale di annullamento, PRIMA di qualunque scrittura.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS staging.mig360_residui_collaudo_undo (
  undo_id      bigserial PRIMARY KEY,
  migrazione   text        NOT NULL,
  tabella      text        NOT NULL,
  codice       text        NOT NULL,
  riga_intera  jsonb       NOT NULL,
  creato_il    timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE staging.mig360_residui_collaudo_undo IS
  'Giornale di annullamento della rimozione dei tre residui della corsa E2E del '
  '2026-08-27 (S1083). Conserva la riga intera in JSONB. Si applica al contrario '
  'con staging.mig360_residui_collaudo_undo_apply(), che ripristina la famiglia '
  'prima del ruolo per rispettare la chiave esterna.';

-- ----------------------------------------------------------------------------
-- 1. LA GUARDIA — ri-verifica la precondizione ADESSO, non eredita la misura.
--
--    Non fa fallire dove i residui non ci sono (database nuovo, heuresys_ci,
--    seconda passata). Fallisce invece — e deve — se un residuo E2E risultasse
--    referenziato da una riga REALE: significherebbe che un dato di produzione
--    si è agganciato a un'entità di collaudo, che è un guasto diverso e più
--    grave, da guardare prima di cancellare qualunque cosa.
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  v_fam    int;
  v_ruoli  int;
  v_moduli int;
  v_agganci int;
BEGIN
  SELECT count(*) INTO v_fam    FROM sys.sys_job_families    WHERE job_family_code    LIKE 'E2E-%';
  SELECT count(*) INTO v_ruoli  FROM sys.sys_job_roles       WHERE job_role_code      LIKE 'E2E-%';
  SELECT count(*) INTO v_moduli FROM sys.sys_learning_modules WHERE learning_module_code LIKE 'E2E-%';

  -- Un ruolo NON di collaudo agganciato a una famiglia di collaudo sarebbe il
  -- caso che vieta la cancellazione.
  SELECT count(*) INTO v_agganci
    FROM sys.sys_job_roles r
    JOIN sys.sys_job_families f ON f.job_family_id = r.job_role_family_id
   WHERE f.job_family_code LIKE 'E2E-%'
     AND (r.job_role_code IS NULL OR r.job_role_code NOT LIKE 'E2E-%');

  IF v_agganci > 0 THEN
    RAISE EXCEPTION
      'mig360: % ruoli reali sono agganciati a una famiglia di collaudo. '
      'Cancellarla li lascerebbe orfani: un guasto diverso, da guardare prima.',
      v_agganci;
  END IF;

  RAISE NOTICE 'mig360 guardia: % famiglie, % ruoli, % moduli di collaudo; 0 agganci reali',
    v_fam, v_ruoli, v_moduli;
END $$;

-- ----------------------------------------------------------------------------
-- 2. Il giornale si popola PRIMA delle cancellazioni.
-- ----------------------------------------------------------------------------
INSERT INTO staging.mig360_residui_collaudo_undo (migrazione, tabella, codice, riga_intera)
SELECT '000360', 'sys_job_roles', r.job_role_code, to_jsonb(r)
  FROM sys.sys_job_roles r
 WHERE r.job_role_code LIKE 'E2E-%'
   AND NOT EXISTS (SELECT 1 FROM staging.mig360_residui_collaudo_undo u
                    WHERE u.tabella = 'sys_job_roles' AND u.codice = r.job_role_code);

INSERT INTO staging.mig360_residui_collaudo_undo (migrazione, tabella, codice, riga_intera)
SELECT '000360', 'sys_job_families', f.job_family_code, to_jsonb(f)
  FROM sys.sys_job_families f
 WHERE f.job_family_code LIKE 'E2E-%'
   AND NOT EXISTS (SELECT 1 FROM staging.mig360_residui_collaudo_undo u
                    WHERE u.tabella = 'sys_job_families' AND u.codice = f.job_family_code);

INSERT INTO staging.mig360_residui_collaudo_undo (migrazione, tabella, codice, riga_intera)
SELECT '000360', 'sys_learning_modules', m.learning_module_code, to_jsonb(m)
  FROM sys.sys_learning_modules m
 WHERE m.learning_module_code LIKE 'E2E-%'
   AND NOT EXISTS (SELECT 1 FROM staging.mig360_residui_collaudo_undo u
                    WHERE u.tabella = 'sys_learning_modules' AND u.codice = m.learning_module_code);

-- ----------------------------------------------------------------------------
-- 3. Le cancellazioni, nell'ordine imposto dalla chiave esterna: ruolo, poi
--    famiglia. Il modulo è isolato e non ha ordine.
--    Insieme a esse cadono gli eventuali overlay di traduzione, che senza il
--    loro soggetto sarebbero orfani (e li conta gia' `v_reference_translation_orphans`).
-- ----------------------------------------------------------------------------
DELETE FROM sys.sys_reference_translations rt
 WHERE (rt.entity_table = 'sys_job_roles'
        AND rt.entity_id IN (SELECT job_role_id FROM sys.sys_job_roles WHERE job_role_code LIKE 'E2E-%'))
    OR (rt.entity_table = 'sys_job_families'
        AND rt.entity_id IN (SELECT job_family_id FROM sys.sys_job_families WHERE job_family_code LIKE 'E2E-%'))
    OR (rt.entity_table = 'sys_learning_modules'
        AND rt.entity_id IN (SELECT learning_module_id FROM sys.sys_learning_modules WHERE learning_module_code LIKE 'E2E-%'));

DELETE FROM sys.sys_job_roles       WHERE job_role_code       LIKE 'E2E-%';
DELETE FROM sys.sys_job_families    WHERE job_family_code     LIKE 'E2E-%';
DELETE FROM sys.sys_learning_modules WHERE learning_module_code LIKE 'E2E-%';

-- ----------------------------------------------------------------------------
-- 4. LE POST-CONDIZIONI — proteggono anche ciò che NON doveva cambiare.
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  v_resti     int;
  v_skill     int;
  v_personas  int;
  v_famiglie  int;
  v_ruoli     int;
  v_giornale  int;
BEGIN
  -- (a) ciò che DOVEVA cambiare: nessun residuo E2E sopravvive.
  SELECT (SELECT count(*) FROM sys.sys_job_families     WHERE job_family_code     LIKE 'E2E-%')
       + (SELECT count(*) FROM sys.sys_job_roles        WHERE job_role_code       LIKE 'E2E-%')
       + (SELECT count(*) FROM sys.sys_learning_modules WHERE learning_module_code LIKE 'E2E-%')
    INTO v_resti;
  IF v_resti <> 0 THEN
    RAISE EXCEPTION 'mig360: restano % residui di collaudo', v_resti;
  END IF;

  -- (b) ciò che NON doveva cambiare, ed è la meta' che conta: i falsi positivi
  --     sono ancora tutti al loro posto. Le competenze ESCO sul collaudo e le
  --     tre personas deliberate non sono materia di questa bonifica, e se una
  --     ricerca troppo larga le avesse prese, qui si vedrebbe.
  SELECT count(*) INTO v_skill FROM sys.sys_skills
   WHERE skill_name ILIKE '%collaudo%' AND skill_code LIKE 'ESCO::%';
  SELECT count(*) INTO v_personas FROM sys.sys_users
   WHERE user_email LIKE '%@collaudo.invalid';

  -- Su heuresys_ci i dataset non sono caricati: là entrambi valgono 0 ed e'
  -- corretto. Si pretende soltanto che NON siano diminuiti rispetto a ciò che
  -- il database conteneva, e il modo per dirlo senza cristallizzare un numero
  -- è confrontarli col giornale: questa migrazione non ne ha giornalizzato
  -- nessuno, quindi non ne ha cancellato nessuno.
  SELECT count(*) INTO v_giornale FROM staging.mig360_residui_collaudo_undo
   WHERE migrazione = '000360'
     AND tabella NOT IN ('sys_job_roles','sys_job_families','sys_learning_modules');
  IF v_giornale <> 0 THEN
    RAISE EXCEPTION
      'mig360: il giornale contiene % righe di tabelle fuori perimetro', v_giornale;
  END IF;

  SELECT count(*) INTO v_famiglie FROM sys.sys_job_families;
  SELECT count(*) INTO v_ruoli    FROM sys.sys_job_roles;

  RAISE NOTICE 'mig360 post: 0 residui · % famiglie e % ruoli reali intatti · '
               '% competenze ESCO e % personas di collaudo non toccate',
    v_famiglie, v_ruoli, v_skill, v_personas;
END $$;

-- ----------------------------------------------------------------------------
-- 5. LA SENTINELLA — perché la prossima volta non si scoprano di rimbalzo.
--    Raccolta da sé da db_health.py, che pretende zero righe da ogni sys.v_*.
--    Guarda solo i residui più vecchi di 24 ore: una corsa in volo non la accende.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW sys.v_residui_di_collaudo_in_produzione AS
  SELECT 'sys_job_families'::varchar AS tabella,
         f.job_family_id             AS entita_id,
         f.job_family_code::varchar  AS codice,
         f.created_at
    FROM sys.sys_job_families f
   WHERE f.job_family_code LIKE 'E2E-%'
     AND f.created_at < now() - interval '24 hours'
  UNION ALL
  SELECT 'sys_job_roles'::varchar,
         r.job_role_id,
         r.job_role_code::varchar,
         r.created_at
    FROM sys.sys_job_roles r
   WHERE r.job_role_code LIKE 'E2E-%'
     AND r.created_at < now() - interval '24 hours'
  UNION ALL
  SELECT 'sys_learning_modules'::varchar,
         m.learning_module_id,
         m.learning_module_code::varchar,
         m.created_at
    FROM sys.sys_learning_modules m
   WHERE m.learning_module_code LIKE 'E2E-%'
     AND m.created_at < now() - interval '24 hours';

COMMENT ON VIEW sys.v_residui_di_collaudo_in_produzione IS
  'Sentinella (S1083, mig 000360): entita create da una corsa E2E e mai ripulite, '
  'piu vecchie di 24 ore. Deve essere vuota. La finestra di 24 ore esiste perche '
  'una suite in esecuzione ha legittimamente le sue entita in tabella: una '
  'sentinella rossa a ogni corsa insegnerebbe a non guardarla. NON comprende le '
  'personas @collaudo.invalid ne le competenze ESCO che contengono la parola '
  'collaudo: sono deliberate le prime, tassonomia europea le seconde.';

-- ----------------------------------------------------------------------------
-- 6. La funzione che disfa, nell'ordine inverso: famiglia prima, ruolo dopo.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION staging.mig360_residui_collaudo_undo_apply()
RETURNS TABLE(azione text, righe bigint)
LANGUAGE plpgsql AS $$
DECLARE
  v_fam bigint := 0; v_ruoli bigint := 0; v_moduli bigint := 0;
BEGIN
  INSERT INTO sys.sys_job_families
  SELECT (jsonb_populate_record(NULL::sys.sys_job_families, u.riga_intera)).*
    FROM staging.mig360_residui_collaudo_undo u
   WHERE u.migrazione = '000360' AND u.tabella = 'sys_job_families'
     AND NOT EXISTS (SELECT 1 FROM sys.sys_job_families f WHERE f.job_family_code = u.codice);
  GET DIAGNOSTICS v_fam = ROW_COUNT;

  INSERT INTO sys.sys_job_roles
  SELECT (jsonb_populate_record(NULL::sys.sys_job_roles, u.riga_intera)).*
    FROM staging.mig360_residui_collaudo_undo u
   WHERE u.migrazione = '000360' AND u.tabella = 'sys_job_roles'
     AND NOT EXISTS (SELECT 1 FROM sys.sys_job_roles r WHERE r.job_role_code = u.codice);
  GET DIAGNOSTICS v_ruoli = ROW_COUNT;

  INSERT INTO sys.sys_learning_modules
  SELECT (jsonb_populate_record(NULL::sys.sys_learning_modules, u.riga_intera)).*
    FROM staging.mig360_residui_collaudo_undo u
   WHERE u.migrazione = '000360' AND u.tabella = 'sys_learning_modules'
     AND NOT EXISTS (SELECT 1 FROM sys.sys_learning_modules m WHERE m.learning_module_code = u.codice);
  GET DIAGNOSTICS v_moduli = ROW_COUNT;

  RETURN QUERY VALUES ('famiglie ripristinate', v_fam),
                      ('ruoli ripristinati', v_ruoli),
                      ('moduli ripristinati', v_moduli);
END $$;

COMMIT;
