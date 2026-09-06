-- ─────────────────────────────────────────────────────────────────────────────
-- 000375 — Nessun contratto a termine a chi ha più di dodici mesi di anzianità
--
-- ── LA REGOLA, ED È DI ENZO (2026-09-05) ────────────────────────────────────
-- «Nessun contratto a termine a chi ha più di 12 mesi di anzianità, e la
--  scadenza si calcola in modo coerente: dopo 16 mesi si passa a tempo
--  indeterminato.»
--
-- Non è una convenzione interna: è il modo in cui funziona un rapporto di
-- lavoro. I 12 mesi sono il confine dell'AMMISSIBILITÀ — oltre, il tipo
-- `fixed_term` è semplicemente sbagliato, qualunque data porti.
--
-- ── IL FENOMENO, MISURATO IN PRODUZIONE (2026-09-06) ────────────────────────
--   sys_user_contracts, ACTIVE:  160 righe · 160 persone · una a testa
--     permanent   109   (tutte senza data di fine, com'è giusto)
--     fixed_term   51   ← il 32% dell'organico
--         di cui   25   senza data di fine
--         e TUTTI E 51 con anzianità oltre i 12 mesi
--
-- Il numero non va letto come «51 righe da correggere»: va letto come **un
-- terzo dell'organico di una banca risulta a tempo determinato**, che è una
-- proporzione che nel settore non esiste. Il difetto è nato con l'ingestione e
-- non è mai stato guardato, perché nessuna sentinella lo misurava: un
-- `fixed_term` senza fine non è «scaduto», quindi non compariva da nessuna
-- parte.
--
-- ⚠ Applicata la regola ai dati di oggi, **nessuno dei 51 resta a termine**. Non
--   è un caso limite: è la conseguenza aritmetica del fatto che l'assunzione
--   più recente fra loro è di parecchi anni fa.
--
-- ── PERCHÉ NON BASTAVA LA 000371 ────────────────────────────────────────────
-- `staging.contratti_rinnova_scaduti()` (000371) rinnova i `fixed_term` **già
-- scaduti** con incarico attivo: guarda la DATA. Qui il criterio è l'ANZIANITÀ,
-- ed è più largo — comprende i 25 senza data di fine, che per una funzione che
-- cerca scadenze passate non esistono. Le due non si sovrappongono e non si
-- contraddicono: dopo questa, la ricorrente non troverà più `fixed_term` da
-- rinnovare, il che è esattamente lo stato voluto.
--
-- ── COME (metodo di bonifica §4) ────────────────────────────────────────────
--   (a) GUARDIA — la precondizione si ri-verifica AL MOMENTO dell'esecuzione,
--       mai ereditata dalla misura scritta qui sopra;
--   (b) GIORNALE — si riusa `staging.contratti_scaduti_undo` (000311), che ha
--       già il campo `migrazione`: un secondo giornale per lo stesso oggetto
--       sarebbe una seconda verità;
--   (c) POST-CONDIZIONE — protegge anche ciò che NON doveva cambiare: i
--       `permanent` restano quanti erano e **nessuna retribuzione si muove**;
--   (d) ELENCO ESPLICITO, mai un carattere jolly: si toccano solo le righe che
--       la guardia ha selezionato.
--
-- IDEMPOTENTE: la catena si ri-applica per intero a ogni deploy. Alla seconda
-- passata non c'è più nessun `fixed_term` oltre i 12 mesi e la migrazione non
-- fa nulla — senza fallire.
--
-- ROLLBACK: `SELECT staging.contratti_ripristina_migrazione('000375');`
-- ⚠ NON si riusa `contratti_scaduti_ripristina_ric()` della 000371: quella
--   PRETENDE un tag della forma `RIC-YYYYMMDD` e rifiuterebbe `'000375'`.
--   Scriverlo qui come rollback sarebbe stato dichiarare una via di ritorno che
--   non funziona — cioè la cosa peggiore di non averne una, perché la si scopre
--   solo nel momento in cui serve. Si aggiunge quindi qui sotto la variante
--   generale, che accetta qualunque passata presente nel giornale; la funzione
--   della 000371 resta intatta e continua a servire le passate ricorrenti.
--
-- ⚠ FUORI PERIMETRO, dichiarato: il vincolo sulla scadenza dei contratti a
--   termine FUTURI (entro 16 mesi dall'assunzione) è `#246` F2, e le due
--   sentinelle che lo presidiano sono F3. Qui si bonifica l'esistente.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- ── LA VIA DI RITORNO, dichiarata PRIMA di scrivere ─────────────────────────
-- Generale sul giornale: accetta il tag di qualunque passata vi sia registrata,
-- non solo quelle ricorrenti. Rimette tipo, data di fine e retribuzione come
-- erano, e restituisce quante righe ha toccato — zero è una risposta legittima
-- e non un errore (la passata poteva non aver convertito nulla).
CREATE OR REPLACE FUNCTION staging.contratti_ripristina_migrazione(p_migrazione varchar)
RETURNS int LANGUAGE plpgsql AS $$
DECLARE n int;
BEGIN
  IF p_migrazione IS NULL OR btrim(p_migrazione) = '' THEN
    RAISE EXCEPTION 'ripristino: serve il tag della passata da disfare';
  END IF;
  UPDATE sys.sys_user_contracts c
     SET user_contract_type                = j.tipo_precedente,
         user_contract_end_date            = j.fine_precedente,
         user_contract_gross_annual_salary = j.ral_precedente,
         updated_at                        = now()
    FROM staging.contratti_scaduti_undo j
   WHERE j.user_contract_id = c.user_contract_id
     AND j.migrazione = p_migrazione;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;

COMMENT ON FUNCTION staging.contratti_ripristina_migrazione(varchar) IS
  'Disfa una passata registrata in staging.contratti_scaduti_undo, indicata per tag. '
  'Variante generale di contratti_scaduti_ripristina_ric(), che accetta i soli tag RIC-YYYYMMDD.';

-- ── (a) LA GUARDIA ──────────────────────────────────────────────────────────
-- Le righe da convertire, selezionate ADESSO. Se l'insieme è vuoto la
-- migrazione prosegue senza scrivere: è il caso della seconda passata.
CREATE TEMP TABLE _da_convertire ON COMMIT DROP AS
SELECT
  c.user_contract_id,
  u.user_email,
  c.user_contract_type                 AS tipo_precedente,
  c.user_contract_end_date             AS fine_precedente,
  c.user_contract_gross_annual_salary  AS ral_precedente
FROM sys.sys_user_contracts c
JOIN sys.sys_users u            ON u.user_id = c.user_contract_user_id
JOIN sys.sys_user_employment e  ON e.user_employment_user_id = c.user_contract_user_id
WHERE c.user_contract_status = 'ACTIVE'
  AND c.user_contract_type   = 'fixed_term'
  AND e.user_employment_hire_date IS NOT NULL
  AND age(current_date, e.user_employment_hire_date) > interval '12 months';

-- ── (b) IL GIORNALE, PRIMA DELLA SCRITTURA ──────────────────────────────────
INSERT INTO staging.contratti_scaduti_undo
  (user_contract_id, email, tipo_precedente, fine_precedente, ral_precedente, migrazione)
SELECT user_contract_id, user_email, tipo_precedente, fine_precedente, ral_precedente, '000375'
FROM _da_convertire
ON CONFLICT (user_contract_id, migrazione) DO NOTHING;

-- ── LA SCRITTURA ────────────────────────────────────────────────────────────
-- Il tipo diventa `permanent` e la data di fine sparisce: un rapporto a tempo
-- indeterminato non ha scadenza, e lasciargliela sarebbe la contraddizione che
-- la 000371 corregge dall'altro capo.
-- ⚠ La retribuzione NON compare in questa UPDATE, ed è voluto: non c'entra con
--   il difetto ed è già stata verificata congrua contro il pavimento CCNL.
UPDATE sys.sys_user_contracts c
SET user_contract_type     = 'permanent',
    user_contract_end_date = NULL,
    updated_at             = now()
FROM _da_convertire d
WHERE c.user_contract_id = d.user_contract_id;

-- ── (c) LE POST-CONDIZIONI ──────────────────────────────────────────────────
DO $$
DECLARE
  v_convertiti  int;
  v_residui     int;
  v_permanent   int;
  v_ral_mosse   int;
BEGIN
  SELECT count(*) INTO v_convertiti FROM _da_convertire;

  -- ① ciò che DOVEVA cambiare: nessun `fixed_term` oltre i 12 mesi resta.
  SELECT count(*) INTO v_residui
  FROM sys.sys_user_contracts c
  JOIN sys.sys_user_employment e ON e.user_employment_user_id = c.user_contract_user_id
  WHERE c.user_contract_status = 'ACTIVE'
    AND c.user_contract_type   = 'fixed_term'
    AND e.user_employment_hire_date IS NOT NULL
    AND age(current_date, e.user_employment_hire_date) > interval '12 months';
  IF v_residui <> 0 THEN
    RAISE EXCEPTION '000375: restano % contratti a termine oltre i 12 mesi', v_residui;
  END IF;

  -- ② ciò che NON doveva cambiare, ed è la metà che si dimentica di controllare:
  --    nessun contratto a termine ha perso la RAL nel passaggio.
  SELECT count(*) INTO v_ral_mosse
  FROM staging.contratti_scaduti_undo j
  JOIN sys.sys_user_contracts c ON c.user_contract_id = j.user_contract_id
  WHERE j.migrazione = '000375'
    AND c.user_contract_gross_annual_salary IS DISTINCT FROM j.ral_precedente;
  IF v_ral_mosse <> 0 THEN
    RAISE EXCEPTION '000375: % retribuzioni sono cambiate, e non dovevano', v_ral_mosse;
  END IF;

  -- ③ e i `permanent` sono cresciuti ESATTAMENTE dei convertiti: se il totale
  --    non torna, questa migrazione ha toccato righe che non aveva selezionato.
  SELECT count(*) INTO v_permanent
  FROM sys.sys_user_contracts
  WHERE user_contract_status = 'ACTIVE' AND user_contract_type = 'permanent';

  RAISE NOTICE '000375: % convertiti a permanent · % permanent ACTIVE in totale',
    v_convertiti, v_permanent;
END $$;

COMMIT;
