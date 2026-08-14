-- ─────────────────────────────────────────────────────────────────────────────
-- 000311 — Nessuno lavora con un contratto scaduto (mandato di Enzo, 2026-08-14)
--
-- «Tutti i dipendenti devono avere un contratto in vigore e non scaduto. Se necessario,
--  passare da contratto a tempo determinato a tempo indeterminato adeguando la
--  retribuzione al livello contrattuale del dipendente.»
--
-- ── LA MISURA (2026-08-14, produzione) ───────────────────────────────────────
-- Sette persone con incarico ATTIVO e contratto scaduto fra il 1 luglio e il 12 agosto
-- 2026. Ma non sono un caso solo: sono DUE casi che i dati distinguono.
--
--   CINQUE sono `fixed_term` davvero scaduti  → si convertono a tempo indeterminato.
--   DUE sono gia' `permanent` CON una data di fine → e' una contraddizione, non una
--       scadenza: un tempo indeterminato non ha fine. Si toglie la data, non si converte.
--
-- LA PROVA CHE IL RAPPORTO CONTINUA, per ognuno (criterio della 000289, riusato):
--   cinque hanno buste paga DOPO la scadenza; per gli altri due la busta di agosto non
--   e' ancora stata emessa, ma l'incarico sulla posizione e' ACTIVE oggi. In nessun caso
--   si sta prolungando un rapporto finito.
--
-- LA RETRIBUZIONE NON SI TOCCA, E NON E' UNA SCELTA DI COMODO: misurata contro
-- `staging.storia36_floor_at(livello, data)` — il pavimento CCNL gia' dichiarato dalla
-- 000289 — tutte e sette sono CONGRUE (la piu' vicina, 3A2L, sta a 40.245 su un minimo
-- di 37.575). L'adeguamento previsto dal mandato «se necessario» qui non e' necessario.
-- Il meccanismo resta scritto: se una RAL fosse sotto il pavimento, viene alzata.
--
-- ── PERCHE' TORNERA', SE CI SI FERMA QUI ─────────────────────────────────────
-- La 000289 (#167) ha fatto questo stesso lavoro su 23 persone il 2026-08-06. Otto giorni
-- dopo il fenomeno e' tornato con sette casi nuovi, perche' la storia RTL avanza nel tempo
-- e i contratti a termine scadono da soli. Quindi qui non si corregge soltanto: la vista
-- `v_incarico_attivo_senza_contratto` (000310) si restringe ai soli DIFETTI e diventa una
-- SENTINELLA a zero — chi non ha mai avuto un contratto (il fondatore) non e' un
-- dipendente e non e' un difetto, quindi esce dal conteggio.
--
-- ROLLBACK: `staging.contratti_scaduti_undo` + `staging.contratti_scaduti_ripristina()`.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS staging.contratti_scaduti_undo (
  undo_id            bigserial PRIMARY KEY,
  user_contract_id   uuid        NOT NULL,
  email              varchar(320),
  tipo_precedente    varchar(40),
  fine_precedente    date,
  ral_precedente     numeric(12,2),
  applicato_il       timestamptz NOT NULL DEFAULT now(),
  migrazione         varchar(16) NOT NULL DEFAULT '000311',
  UNIQUE (user_contract_id, migrazione)
);

COMMENT ON TABLE staging.contratti_scaduti_undo IS
  'Giornale di ritorno della 000311: tipo, data di fine e RAL com''erano prima della '
  'messa in vigore. Riapplicabile con staging.contratti_scaduti_ripristina().';

-- (a) il giornale PRIMA della scrittura
INSERT INTO staging.contratti_scaduti_undo
  (user_contract_id, email, tipo_precedente, fine_precedente, ral_precedente)
SELECT c.user_contract_id, u.user_email, c.user_contract_type,
       c.user_contract_end_date, c.user_contract_gross_annual_salary
  FROM sys.sys_user_contracts c
  JOIN sys.sys_users u ON u.user_id = c.user_contract_user_id
 WHERE u.user_status = 'ACTIVE'
   AND c.user_contract_end_date IS NOT NULL
   AND c.user_contract_end_date < CURRENT_DATE
   AND EXISTS (SELECT 1 FROM sys.sys_user_position_assignments a
                WHERE a.user_position_assignment_user_id = u.user_id
                  AND a.user_position_assignment_status = 'ACTIVE')
ON CONFLICT (user_contract_id, migrazione) DO NOTHING;

CREATE OR REPLACE FUNCTION staging.contratti_scaduti_ripristina()
RETURNS int LANGUAGE plpgsql AS $$
DECLARE n int;
BEGIN
  UPDATE sys.sys_user_contracts c
     SET user_contract_type                = u.tipo_precedente,
         user_contract_end_date            = u.fine_precedente,
         user_contract_gross_annual_salary = u.ral_precedente,
         updated_at                        = now()
    FROM staging.contratti_scaduti_undo u
   WHERE u.user_contract_id = c.user_contract_id AND u.migrazione = '000311';
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;

-- (b) guardia: la precondizione si ri-verifica ADESSO
DO $$
DECLARE n_da_fare int; n_giornale int;
BEGIN
  SELECT count(*) INTO n_da_fare
    FROM sys.sys_user_contracts c
    JOIN sys.sys_users u ON u.user_id = c.user_contract_user_id
   WHERE u.user_status = 'ACTIVE'
     AND c.user_contract_end_date IS NOT NULL
     AND c.user_contract_end_date < CURRENT_DATE
     AND EXISTS (SELECT 1 FROM sys.sys_user_position_assignments a
                  WHERE a.user_position_assignment_user_id = u.user_id
                    AND a.user_position_assignment_status = 'ACTIVE');

  IF n_da_fare = 0 THEN
    RAISE NOTICE '000311: nessun contratto scaduto da mettere in vigore (gia applicata, o dataset gia sano)';
    RETURN;
  END IF;

  SELECT count(*) INTO n_giornale
    FROM staging.contratti_scaduti_undo WHERE migrazione = '000311';
  IF n_giornale < n_da_fare THEN
    RAISE EXCEPTION '000311: il giornale copre % contratti ma ne devo toccare %: non procedo senza rollback',
      n_giornale, n_da_fare;
  END IF;
END $$;

-- ① i contratti a termine diventano a tempo indeterminato
UPDATE sys.sys_user_contracts c
   SET user_contract_type     = 'permanent',
       user_contract_end_date = NULL,
       user_contract_notes    = coalesce(c.user_contract_notes || ' | ', '') ||
         'Trasformato a tempo indeterminato il ' || CURRENT_DATE ||
         ' (mig 000311): rapporto in corso con contratto scaduto il ' || c.user_contract_end_date,
       updated_at             = now()
  FROM sys.sys_users u
 WHERE u.user_id = c.user_contract_user_id
   AND u.user_status = 'ACTIVE'
   AND c.user_contract_type = 'fixed_term'
   AND c.user_contract_end_date IS NOT NULL
   AND c.user_contract_end_date < CURRENT_DATE
   AND EXISTS (SELECT 1 FROM sys.sys_user_position_assignments a
                WHERE a.user_position_assignment_user_id = u.user_id
                  AND a.user_position_assignment_status = 'ACTIVE');

-- ② i «tempo indeterminato con data di fine» perdono la data: era una contraddizione
UPDATE sys.sys_user_contracts c
   SET user_contract_end_date = NULL,
       user_contract_notes    = coalesce(c.user_contract_notes || ' | ', '') ||
         'Data di fine rimossa il ' || CURRENT_DATE ||
         ' (mig 000311): un contratto a tempo indeterminato non ha scadenza',
       updated_at             = now()
  FROM sys.sys_users u
 WHERE u.user_id = c.user_contract_user_id
   AND u.user_status = 'ACTIVE'
   AND c.user_contract_type <> 'fixed_term'
   AND c.user_contract_end_date IS NOT NULL
   AND c.user_contract_end_date < CURRENT_DATE
   AND EXISTS (SELECT 1 FROM sys.sys_user_position_assignments a
                WHERE a.user_position_assignment_user_id = u.user_id
                  AND a.user_position_assignment_status = 'ACTIVE');

-- ③ adeguamento al livello: solo verso l'ALTO e solo sotto il pavimento CCNL dichiarato.
--    Oggi tocca zero righe (tutte e sette sono congrue) — il meccanismo resta per domani.
UPDATE sys.sys_user_contracts c
   SET user_contract_gross_annual_salary = round(staging.storia36_floor_at(c.user_contract_ccnl_level, CURRENT_DATE), 2),
       user_contract_notes = coalesce(c.user_contract_notes || ' | ', '') ||
         'Retribuzione portata al minimo CCNL del livello ' || c.user_contract_ccnl_level || ' (mig 000311)',
       updated_at = now()
  FROM staging.contratti_scaduti_undo u
 WHERE u.user_contract_id = c.user_contract_id
   AND u.migrazione = '000311'
   AND c.user_contract_ccnl_level IS NOT NULL
   AND staging.storia36_floor_at(c.user_contract_ccnl_level, CURRENT_DATE) IS NOT NULL
   AND c.user_contract_gross_annual_salary < staging.storia36_floor_at(c.user_contract_ccnl_level, CURRENT_DATE);

-- ④ la vista: la sua forma definitiva sta nella 000310, emendata alla fonte (ADR-0035).
--    Ripeterla qui la farebbe litigare con se stessa alla seconda passata della catena.

-- (c) post-condizioni: cio' che doveva cambiare E cio' che NON doveva
DO $$
DECLARE n_residuo int; n_persone int; n_contratti int; n_ral_abbassate int;
BEGIN
  SELECT count(*) INTO n_residuo FROM sys.v_incarico_attivo_senza_contratto;
  IF n_residuo <> 0 THEN
    RAISE EXCEPTION '000311: restano % persone che lavorano con un contratto scaduto', n_residuo;
  END IF;

  -- NON doveva cambiare: nessuna retribuzione e' stata ABBASSATA
  SELECT count(*) INTO n_ral_abbassate
    FROM staging.contratti_scaduti_undo u
    JOIN sys.sys_user_contracts c ON c.user_contract_id = u.user_contract_id
   WHERE u.migrazione = '000311'
     AND c.user_contract_gross_annual_salary < u.ral_precedente;
  IF n_ral_abbassate > 0 THEN
    RAISE EXCEPTION '000311: % retribuzioni sono state abbassate: l adeguamento va solo verso l alto', n_ral_abbassate;
  END IF;

  -- NON doveva cambiare: le persone e i contratti ci sono ancora tutti
  SELECT count(*) INTO n_persone   FROM sys.sys_users WHERE user_status = 'ACTIVE';
  SELECT count(*) INTO n_contratti FROM sys.sys_user_contracts;
  IF n_persone = 0 OR n_contratti = 0 THEN
    RAISE EXCEPTION '000311: persone o contratti spariti — la scrittura ha sconfinato';
  END IF;

  RAISE NOTICE '000311 ok — nessuno lavora piu con un contratto scaduto; % persone attive, % contratti, 0 retribuzioni abbassate',
    n_persone, n_contratti;
END $$;
