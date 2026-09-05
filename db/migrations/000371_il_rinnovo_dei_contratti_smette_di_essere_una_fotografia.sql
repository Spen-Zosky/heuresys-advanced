-- ─────────────────────────────────────────────────────────────────────────────
-- 000371 — Il rinnovo dei contratti smette di essere una fotografia
--
-- ── IL FENOMENO, MISURATO (2026-09-05, produzione) ──────────────────────────
-- La sentinella `sys.v_incarico_attivo_senza_contratto` e' tornata a 1 riga:
-- matteo.esposito@rtl-bank.org, Vice Direttore di Filiale, contratto scaduto il
-- 2026-09-04 con l'incarico ancora ATTIVO.
--
-- E' la TERZA occorrenza dello stesso fenomeno:
--   000289 (#167) — 23 casi corretti il 2026-08-06
--   000311        —  7 casi corretti il 2026-08-14 (otto giorni dopo)
--   oggi          —  1 caso
--
-- Le prime due sono state FOTOGRAFIE: hanno corretto le righe di quel giorno e
-- hanno lasciato in piedi il meccanismo che le produce. La 000311 lo scriveva
-- gia' a chiare lettere («PERCHE' TORNERA', SE CI SI FERMA QUI») e ha risposto
-- con una sentinella. Ma una sentinella SEGNALA, non ripara.
--
-- ── PERCHE' TORNERA' 26 VOLTE, SE CI SI FERMA ANCORA QUI ────────────────────
-- Parco contratti RTL misurato oggi:
--
--   permanent   108 senza data di fine ·  0 scaduti ·  0 in scadenza
--   fixed_term   25 senza data di fine ·  1 scaduto  · 26 in scadenza entro l'anno
--
-- Le 26 scadenze future, per mese:
--   2026-09  9  ·  2026-10  3  ·  2026-11  3  ·  2026-12  7  ·  2027-01  3  ·  2027-02  2
--
-- L'avanzamento giornaliero della storia (`storia36.sh avanzamento`, 03:45 sulla
-- VM) porta la finestra a ieri, ma il suo perimetro ESCLUDE i contratti — lo
-- dichiara `13_avanzamento.sql` per iscritto: dentro ci sono calendario,
-- presenze/assenze e buste paga, non l'anagrafica contrattuale. Quindi i
-- contratti a termine scadono da soli, in silenzio, uno alla volta, e ogni volta
-- serve una persona che se ne accorga e scriva una migrazione.
--
-- ── COSA FA QUESTA, CHE LE DUE PRIMA NON FACEVANO ───────────────────────────
-- Non aggiunge una terza fotografia: rende il rinnovo RICORRENTE.
--   · `staging.contratti_rinnova_scaduti()` porta il criterio della 000311 —
--     NON una politica nuova — dentro una funzione richiamabile ogni giorno.
--   · `storia36.sh avanzamento` la chiama subito dopo aver esteso la storia,
--     nello stesso punto in cui gia' ri-esegue i seed derivati.
--   · La sentinella resta a zero DA SOLA, e le 26 scadenze future si rinnovano
--     il giorno stesso in cui maturano.
--
-- IL CRITERIO (identico alla 000311, riusato e non reinventato):
--   ① `fixed_term` scaduto + incarico ATTIVO  → a tempo indeterminato, data via
--   ② non-`fixed_term` CON data di fine passata → si toglie la data: era una
--      contraddizione, non una scadenza
--   ③ retribuzione portata al pavimento CCNL del livello SOLO se sotto, e SOLO
--      verso l'alto (`staging.storia36_floor_at`)
-- La prova che il rapporto continua resta l'incarico ACTIVE: chi cessa davvero
-- non ha l'incarico attivo e non viene toccato.
--
-- ROLLBACK: `staging.contratti_scaduti_undo` (giornale gia' esistente, 000311),
-- con `migrazione = 'RIC-YYYYMMDD'` per ogni passata ricorrente.
-- Ripristino: `staging.contratti_scaduti_ripristina_ric('RIC-20260905')`.
--
-- ⚠ FUORI PERIMETRO, dichiarato: i 25 `fixed_term` SENZA data di fine. Sono la
--   contraddizione speculare a quella che la ② corregge, nessuna sentinella li
--   vede (uno senza fine e' in vigore per sempre), e non sono il difetto per cui
--   questa migrazione esiste. Riportati a Enzo, non toccati.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── (a) la funzione ricorrente ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION staging.contratti_rinnova_scaduti()
RETURNS TABLE (convertiti int, date_rimosse int, ral_adeguate int)
LANGUAGE plpgsql AS $$
DECLARE
  v_tag       varchar(16) := 'RIC-' || to_char(CURRENT_DATE, 'YYYYMMDD');
  v_da_fare   int;
  v_giornale  int;
  v_conv      int := 0;
  v_date      int := 0;
  v_ral       int := 0;
BEGIN
  -- guardia: la precondizione si ri-verifica ADESSO, mai ereditata
  SELECT count(*) INTO v_da_fare
    FROM sys.sys_user_contracts c
    JOIN sys.sys_users u ON u.user_id = c.user_contract_user_id
   WHERE u.user_status = 'ACTIVE'
     AND c.user_contract_end_date IS NOT NULL
     AND c.user_contract_end_date < CURRENT_DATE
     AND EXISTS (SELECT 1 FROM sys.sys_user_position_assignments a
                  WHERE a.user_position_assignment_user_id = u.user_id
                    AND a.user_position_assignment_status = 'ACTIVE');

  IF v_da_fare = 0 THEN
    RAISE NOTICE 'rinnovo contratti: niente da fare (0 scaduti con incarico attivo)';
    RETURN QUERY SELECT 0, 0, 0;
    RETURN;
  END IF;

  -- il giornale PRIMA della scrittura
  INSERT INTO staging.contratti_scaduti_undo
    (user_contract_id, email, tipo_precedente, fine_precedente, ral_precedente, migrazione)
  SELECT c.user_contract_id, u.user_email, c.user_contract_type,
         c.user_contract_end_date, c.user_contract_gross_annual_salary, v_tag
    FROM sys.sys_user_contracts c
    JOIN sys.sys_users u ON u.user_id = c.user_contract_user_id
   WHERE u.user_status = 'ACTIVE'
     AND c.user_contract_end_date IS NOT NULL
     AND c.user_contract_end_date < CURRENT_DATE
     AND EXISTS (SELECT 1 FROM sys.sys_user_position_assignments a
                  WHERE a.user_position_assignment_user_id = u.user_id
                    AND a.user_position_assignment_status = 'ACTIVE')
  ON CONFLICT (user_contract_id, migrazione) DO NOTHING;

  SELECT count(*) INTO v_giornale
    FROM staging.contratti_scaduti_undo WHERE migrazione = v_tag;
  IF v_giornale < v_da_fare THEN
    RAISE EXCEPTION 'rinnovo contratti: il giornale copre % contratti ma ne devo toccare %: non procedo senza rollback',
      v_giornale, v_da_fare;
  END IF;

  -- ① i contratti a termine diventano a tempo indeterminato
  UPDATE sys.sys_user_contracts c
     SET user_contract_type     = 'permanent',
         user_contract_end_date = NULL,
         user_contract_notes    = coalesce(c.user_contract_notes || ' | ', '') ||
           'Trasformato a tempo indeterminato il ' || CURRENT_DATE ||
           ' (rinnovo ricorrente ' || v_tag || '): rapporto in corso con contratto scaduto il ' ||
           c.user_contract_end_date,
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
  GET DIAGNOSTICS v_conv = ROW_COUNT;

  -- ② i «tempo indeterminato con data di fine» perdono la data
  UPDATE sys.sys_user_contracts c
     SET user_contract_end_date = NULL,
         user_contract_notes    = coalesce(c.user_contract_notes || ' | ', '') ||
           'Data di fine rimossa il ' || CURRENT_DATE ||
           ' (rinnovo ricorrente ' || v_tag || '): un contratto a tempo indeterminato non ha scadenza',
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
  GET DIAGNOSTICS v_date = ROW_COUNT;

  -- ③ adeguamento al pavimento CCNL: solo verso l'ALTO, solo se sotto
  UPDATE sys.sys_user_contracts c
     SET user_contract_gross_annual_salary =
           round(staging.storia36_floor_at(c.user_contract_ccnl_level, CURRENT_DATE), 2),
         user_contract_notes = coalesce(c.user_contract_notes || ' | ', '') ||
           'Retribuzione portata al minimo CCNL del livello ' || c.user_contract_ccnl_level ||
           ' (rinnovo ricorrente ' || v_tag || ')',
         updated_at = now()
    FROM staging.contratti_scaduti_undo j
   WHERE j.user_contract_id = c.user_contract_id
     AND j.migrazione = v_tag
     AND c.user_contract_ccnl_level IS NOT NULL
     AND staging.storia36_floor_at(c.user_contract_ccnl_level, CURRENT_DATE) IS NOT NULL
     AND c.user_contract_gross_annual_salary < staging.storia36_floor_at(c.user_contract_ccnl_level, CURRENT_DATE);
  GET DIAGNOSTICS v_ral = ROW_COUNT;

  RAISE NOTICE 'rinnovo contratti (%): % convertiti, % date rimosse, % retribuzioni adeguate',
    v_tag, v_conv, v_date, v_ral;
  RETURN QUERY SELECT v_conv, v_date, v_ral;
END $$;

COMMENT ON FUNCTION staging.contratti_rinnova_scaduti() IS
  'Rinnovo RICORRENTE dei contratti scaduti con incarico attivo (mig 000371). Porta il criterio '
  'della 000311 dentro una funzione richiamabile ogni giorno: la chiama storia36.sh avanzamento '
  'subito dopo aver esteso la storia. Idempotente: a campo pulito scrive 0 righe e ritorna 0,0,0.';

-- ── (b) il ripristino di una passata ricorrente ──────────────────────────────
CREATE OR REPLACE FUNCTION staging.contratti_scaduti_ripristina_ric(p_tag varchar)
RETURNS int LANGUAGE plpgsql AS $$
DECLARE n int;
BEGIN
  IF p_tag IS NULL OR p_tag !~ '^RIC-[0-9]{8}$' THEN
    RAISE EXCEPTION 'ripristino: il tag deve avere la forma RIC-YYYYMMDD, ricevuto %', p_tag;
  END IF;
  UPDATE sys.sys_user_contracts c
     SET user_contract_type                = j.tipo_precedente,
         user_contract_end_date            = j.fine_precedente,
         user_contract_gross_annual_salary = j.ral_precedente,
         updated_at                        = now()
    FROM staging.contratti_scaduti_undo j
   WHERE j.user_contract_id = c.user_contract_id AND j.migrazione = p_tag;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;

COMMENT ON FUNCTION staging.contratti_scaduti_ripristina_ric(varchar) IS
  'Disfa UNA passata del rinnovo ricorrente, identificata dal suo tag RIC-YYYYMMDD (mig 000371).';

-- ── (c) la misura PRIMA, per la post-condizione di cio' che NON deve cambiare ─
DROP TABLE IF EXISTS _371_prima;
CREATE TEMP TABLE _371_prima AS
SELECT
  count(*) FILTER (WHERE c.user_contract_type = 'permanent'
                     AND c.user_contract_end_date IS NULL)              AS permanent_sani,
  count(*) FILTER (WHERE c.user_contract_type = 'fixed_term'
                     AND c.user_contract_end_date IS NULL)              AS fixed_senza_fine,
  count(*) FILTER (WHERE c.user_contract_type = 'fixed_term'
                     AND c.user_contract_end_date >= CURRENT_DATE)      AS fixed_ancora_in_corso
  FROM sys.sys_user_contracts c;

-- ── (d) la prima passata: chiude il caso di oggi ─────────────────────────────
SELECT * FROM staging.contratti_rinnova_scaduti();

-- ── (e) post-condizioni: cio' che DOVEVA cambiare E cio' che NON doveva ──────
DO $$
DECLARE
  n_residuo int;
  p_perm int; p_senza int; p_corso int;
  d_perm int; d_senza int; d_corso int;
  n_ral_abbassate int;
BEGIN
  -- cio' che doveva cambiare: la sentinella e' a zero
  SELECT count(*) INTO n_residuo FROM sys.v_incarico_attivo_senza_contratto;
  IF n_residuo <> 0 THEN
    RAISE EXCEPTION '000371: restano % persone che lavorano con un contratto scaduto', n_residuo;
  END IF;

  -- cio' che NON doveva cambiare: i fixed_term senza fine sono fuori perimetro,
  -- e i fixed_term ancora in corso non si toccano prima della loro scadenza.
  SELECT permanent_sani, fixed_senza_fine, fixed_ancora_in_corso
    INTO p_perm, p_senza, p_corso FROM _371_prima;
  SELECT count(*) FILTER (WHERE c.user_contract_type = 'permanent'
                            AND c.user_contract_end_date IS NULL),
         count(*) FILTER (WHERE c.user_contract_type = 'fixed_term'
                            AND c.user_contract_end_date IS NULL),
         count(*) FILTER (WHERE c.user_contract_type = 'fixed_term'
                            AND c.user_contract_end_date >= CURRENT_DATE)
    INTO d_perm, d_senza, d_corso
    FROM sys.sys_user_contracts c;

  IF d_senza <> p_senza THEN
    RAISE EXCEPTION '000371: i fixed_term senza data di fine sono FUORI perimetro ma sono passati da % a %',
      p_senza, d_senza;
  END IF;
  IF d_corso <> p_corso THEN
    RAISE EXCEPTION '000371: i fixed_term ancora in corso non si toccano, ma sono passati da % a %',
      p_corso, d_corso;
  END IF;
  IF d_perm < p_perm THEN
    RAISE EXCEPTION '000371: i permanent sani sono DIMINUITI, da % a %', p_perm, d_perm;
  END IF;

  -- nessuna retribuzione e' stata ABBASSATA da una passata ricorrente
  SELECT count(*) INTO n_ral_abbassate
    FROM staging.contratti_scaduti_undo j
    JOIN sys.sys_user_contracts c ON c.user_contract_id = j.user_contract_id
   WHERE j.migrazione LIKE 'RIC-%'
     AND j.ral_precedente IS NOT NULL
     AND c.user_contract_gross_annual_salary < j.ral_precedente;
  IF n_ral_abbassate <> 0 THEN
    RAISE EXCEPTION '000371: % retribuzioni sono state abbassate', n_ral_abbassate;
  END IF;

  RAISE NOTICE '000371 OK: sentinella a zero · fixed_term senza fine % intatti · fixed_term in corso % intatti',
    d_senza, d_corso;
END $$;

DROP TABLE IF EXISTS _371_prima;
