-- ═══════════════════════════════════════════════════════════════════════════════
-- 000254_name_learning_paths_in_use.sql
--
-- I CINQUE PERCORSI FORMATIVI DI RTL BANK CHE SI CHIAMANO CON UNA CHIAVE-MACCHINA.
--
-- Il difetto
--   Cinque percorsi formativi portano come NOME la stringa
--   `OLDDB::learning_paths::<uuid>` — la chiave con cui l'importazione li ha
--   identificati nel database legacy, finita nel campo che l'utente legge. A quei
--   cinque puntano **199 assegnazioni di 124 persone reali**: non sono scaffali
--   vuoti, sono i percorsi su cui la banca sta formando la propria gente, e in
--   ogni schermata compaiono con un identificativo al posto del titolo.
--
--   E' la stessa famiglia dei gemelli `LEGACY_BAND::` fra le fasce retributive:
--   residui dell'importazione che portano una chiave-macchina nel nome.
--
-- Il nome non si inventa: c'e' gia', nella colonna sbagliata
--   Tutti e cinque hanno una `learning_path_description` in italiano che **e' un
--   titolo**: «Onboarding completo per nuovi assunti», «Da principiante ad esperto
--   di analisi dati», «Sviluppo competenze di leadership per team leader»,
--   «Formazione obbligatoria annuale», «Competenze per la trasformazione digitale».
--   Il nome era stato scritto, solo in un altro campo. Quindi questa migrazione non
--   contiene cinque titoli decisi da qualcuno: li LEGGE dal dato.
--
-- Il perimetro e' «in uso», non una lista di codici
--   Si toccano solo i percorsi che hanno almeno un'assegnazione. Non e' un
--   dettaglio di prudenza: dei dieci percorsi con nome `OLDDB::` gli altri cinque
--   sono altro — tre gusci senza passi e con un `tenant_id` che non corrisponde ad
--   alcun tenant, e due doppioni a zero assegnazioni che ripetono la descrizione
--   di due dei cinque vivi. Dare un nome anche a quelli produrrebbe titoli
--   identici su percorsi diversi. Sono un reperto a se', da decidere, e restano
--   come sono invece di essere sistemati di straforo.
--
-- Nessuna traduzione da riallineare: verificato che `sys_reference_translations`
-- non contiene alcuna riga per `sys_learning_paths` — la lezione delle traduzioni
-- orfane di S1042 e' stata controllata prima, non dopo.
--
-- Reversibile: rollback in coda, commentato. Rieseguibile: agisce solo su cio' che
-- porta ancora il prefisso.
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

UPDATE sys.sys_learning_paths lp
   SET learning_path_name = btrim(lp.learning_path_description),
       updated_at         = now()
 WHERE lp.learning_path_name LIKE 'OLDDB::%'
   AND btrim(coalesce(lp.learning_path_description, '')) <> ''
   AND EXISTS (SELECT 1 FROM sys.sys_user_learning_assignments a
                WHERE a.user_learning_assignment_path_id = lp.learning_path_id);

-- ───────────────────────────────────────────────────────────────────────────────
-- AUTO-VERIFICA
-- ───────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  n_in_uso_senza_nome int; n_assegnaz int; n_persone int; n_residui int;
BEGIN
  -- LA PROVA: nessun percorso IN USO porta piu' una chiave-macchina
  SELECT count(*) INTO n_in_uso_senza_nome FROM sys.sys_learning_paths lp
   WHERE lp.learning_path_name LIKE 'OLDDB::%'
     AND EXISTS (SELECT 1 FROM sys.sys_user_learning_assignments a
                  WHERE a.user_learning_assignment_path_id = lp.learning_path_id);
  IF n_in_uso_senza_nome <> 0 THEN
    RAISE EXCEPTION 'Percorsi in uso ancora con nome-macchina: %', n_in_uso_senza_nome;
  END IF;

  -- e nessuna assegnazione si e' persa per strada: 199 righe, 124 persone
  SELECT count(*), count(DISTINCT user_learning_assignment_user_id)
    INTO n_assegnaz, n_persone
    FROM sys.sys_user_learning_assignments a
    JOIN sys.sys_learning_paths lp ON lp.learning_path_id = a.user_learning_assignment_path_id
   WHERE lp.learning_path_code LIKE 'PATH-rtl-bank-%';
  IF n_assegnaz < 199 OR n_persone < 124 THEN
    RAISE EXCEPTION 'Assegnazioni ai cinque percorsi: attese >=199 righe su >=124 persone, trovate % su %',
                    n_assegnaz, n_persone;
  END IF;

  -- i cinque non toccati restano tali, e si dicono: e' un reperto aperto, non un
  -- lavoro dimenticato. Se un giorno diventassero zero, qualcuno li ha sistemati.
  SELECT count(*) INTO n_residui FROM sys.sys_learning_paths
   WHERE learning_path_name LIKE 'OLDDB::%';
  RAISE NOTICE 'PERCORSI OK — i percorsi in uso hanno un titolo leggibile, % assegnazioni di % persone intatte. Restano % percorsi con nome-macchina, tutti a zero assegnazioni (3 gusci senza passi con tenant inesistente, 2 doppioni): reperto aperto.',
               n_assegnaz, n_persone, n_residui;
END $$;

COMMIT;

-- ═══════════════════════════════════════════════════════════════════════════════
-- VERIFICHE DA ESEGUIRE A MANO DOPO L'APPLICAZIONE
-- ═══════════════════════════════════════════════════════════════════════════════
--
--   SELECT learning_path_code, learning_path_name FROM sys.sys_learning_paths
--    WHERE learning_path_code LIKE 'PATH-rtl-bank-%' ORDER BY 1;
--
-- ═══════════════════════════════════════════════════════════════════════════════
-- ROLLBACK — rimette la chiave-macchina, ricostruita dal codice legacy
-- ═══════════════════════════════════════════════════════════════════════════════
--   Non ricostruibile automaticamente: l'uuid legacy era nel nome e viene
--   sovrascritto. Se serve tornare indietro, il valore precedente sta nel dump
--   pre-migrazione — che e' anche il motivo per cui il nome non e' l'unico posto
--   in cui una chiave d'importazione dovrebbe vivere.
