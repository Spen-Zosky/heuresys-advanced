-- ─────────────────────────────────────────────────────────────────────────────
-- 000383 — Una banca ha sempre un ascolto aperto. Anche domani.
--
-- ── IL FENOMENO, MISURATO (2026-09-09, produzione via tunnel) ───────────────
-- Il cancello locale e' rosso su `me-surveys.integration.test.ts`, che si ferma
-- prima ancora di provare l'endpoint: «nessuna rilevazione aperta e assegnata
-- alla persona di prova». Non e' un difetto del clone, e non e' un bug dell'API.
-- La misura sulla PRODUZIONE:
--
--   sys.sys_surveys per stato:  archived 5  ·  closed 9  ·  active 0
--
-- Zero. E la piu' recente delle quattordici si chiama, alla lettera,
-- «Rilevazione di clima in corso» — natural key `STORIA36-ENG-IN-CORSO`,
-- 160 inviti, 8 domande di tipo rating — con finestra 2026-07-18 → 2026-08-07.
-- Chiusa da un mese. Il nome dice cosa dovrebbe essere; lo stato dice cos'e'.
--
-- ── PERCHE' E' SUCCESSO, E PERCHE' TORNEREBBE ───────────────────────────────
-- `db/seeds/storia36/08_engagement.sql` la crea, e il suo commento aveva gia'
-- visto il problema: «una banca ha sempre un ascolto in corso, e senza di esso
-- il portale del dipendente non ha nulla da compilare — la riparazione che ha
-- chiuso i cicli scaduti aveva lasciato l'ESS a mani vuote».
--
-- Ma la finestra e' `(c_to - 6, c_to + 14)`, dove `c_to` e' la data di
-- COSTRUZIONE, e l'identita' della riga e' un UUID deterministico:
--   uuid_generate_v5(c_ns, 'STORIA36::C8::SURVEY::IN-CORSO')  ... ON CONFLICT DO NOTHING
-- Quindi alla riesecuzione la riga esiste gia', l'INSERT non fa nulla, e la
-- finestra NON SI SPOSTA MAI. Venti giorni dopo la costruzione l'ascolto e'
-- chiuso, e resta chiuso per sempre.
--
-- E' lo stesso fenomeno dei contratti a termine (000289 → 000311 → 000371): il
-- tempo avanza per tutti, ma `13_avanzamento.sql` dichiara il proprio perimetro
-- — calendario, presenze/assenze, buste paga — e le rilevazioni non ci sono.
-- La 000371 ha smesso di fotografare e ha reso il rinnovo RICORRENTE. Questa fa
-- la stessa cosa per l'ascolto, con la stessa forma: funzione idempotente in
-- `staging`, chiamata da `storia36.sh avanzamento` subito dopo l'estensione.
--
-- ── L'INVARIANTE, DICHIARATA (C3: si porta a uno STATO, non si negozia) ─────
--   «Per il tenant RTL esiste sempre una rilevazione di clima aperta la cui
--    finestra copre oggi.»
-- Se e' gia' vera: 0 righe, e lo dice. Se non lo e': la finestra della
-- rilevazione in corso scorre in avanti (oggi-6 → oggi+14) e lo stato torna
-- `active`. Non si crea un ciclo nuovo a ogni scadenza: la rilevazione «in
-- corso» e' una sola per costruzione, e i cicli conclusi restano quelli che
-- sono — con le loro risposte, che non si toccano.
--
-- ROLLBACK: `staging.rilevazione_clima_undo`, una riga per passata con il tag
-- `RIC-YYYYMMDD`. Ripristino di una passata:
--   SELECT staging.rilevazione_clima_ripristina('RIC-20260909');
--
-- ⚠ FUORI PERIMETRO, dichiarato: le assegnazioni gia' completate NON vengono
--   azzerate quando la finestra riparte. Sono risposte che qualcuno ha dato
--   davvero, e cancellarle per far sembrare l'ascolto «appena aperto» sarebbe
--   perdere un dato reale per un'estetica. Chi ha risposto risulta completato.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── (a) il giornale, PRIMA di qualunque scrittura ────────────────────────────
CREATE TABLE IF NOT EXISTS staging.rilevazione_clima_undo (
  survey_id          uuid        NOT NULL,
  natural_key        text        NOT NULL,
  status_precedente  varchar(32) NOT NULL,
  start_precedente   date,
  end_precedente     date,
  migrazione         varchar(16) NOT NULL,
  registrato_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (survey_id, migrazione)
);

COMMENT ON TABLE staging.rilevazione_clima_undo IS
  'Giornale di rollback del rinnovo ricorrente dell''ascolto (000383): una riga per passata, tag RIC-YYYYMMDD.';

-- ── (b) la funzione ricorrente ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION staging.rilevazione_clima_rinnova()
RETURNS TABLE (rinnovate int, tag varchar)
LANGUAGE plpgsql AS $$
DECLARE
  c_natural  text        := 'STORIA36-ENG-IN-CORSO';
  v_tag      varchar(16) := 'RIC-' || to_char(CURRENT_DATE, 'YYYYMMDD');
  v_aperte   int;
  v_id       uuid;
  v_altre_prima  int;
  v_altre_dopo   int;
  v_n        int := 0;
BEGIN
  -- GUARDIA — la precondizione si ri-verifica ADESSO, mai ereditata da chi chiama.
  -- La domanda non e' «lo stato dice active?» ma «la finestra copre oggi?»: una
  -- rilevazione `active` con la finestra scaduta e' esattamente il difetto che
  -- questa funzione esiste per chiudere, e contarla come aperta lo nasconderebbe.
  SELECT count(*) INTO v_aperte
    FROM sys.sys_surveys s
   WHERE s.survey_type = 'engagement'
     AND s.survey_status = 'active'
     AND s.survey_start_date IS NOT NULL
     AND s.survey_end_date   IS NOT NULL
     AND CURRENT_DATE BETWEEN s.survey_start_date AND s.survey_end_date;

  IF v_aperte > 0 THEN
    RAISE NOTICE 'ascolto: niente da fare (% rilevazioni aperte coprono oggi)', v_aperte;
    RETURN QUERY SELECT 0, v_tag;
    RETURN;
  END IF;

  SELECT s.survey_id INTO v_id
    FROM sys.sys_surveys s
   WHERE s.survey_natural_key = c_natural;

  IF v_id IS NULL THEN
    -- Non la creo da zero: nascerebbe senza inviti e senza domande, cioe' un
    -- ascolto che nessuno puo' compilare — un verde peggiore del rosso. Chi
    -- l'ha rimossa lo ha fatto per una ragione, e la ricostruzione e' del seed.
    RAISE NOTICE 'ascolto: la rilevazione «%» NON ESISTE — non la ricostruisco qui (la crea 08_engagement.sql)', c_natural;
    RETURN QUERY SELECT 0, v_tag;
    RETURN;
  END IF;

  -- quante rilevazioni NON devono cambiare: si misura prima, si riverifica dopo
  SELECT count(*) INTO v_altre_prima FROM sys.sys_surveys WHERE survey_id <> v_id;

  -- il giornale PRIMA della scrittura, e si procede solo se copre
  INSERT INTO staging.rilevazione_clima_undo
    (survey_id, natural_key, status_precedente, start_precedente, end_precedente, migrazione)
  SELECT s.survey_id, s.survey_natural_key, s.survey_status,
         s.survey_start_date, s.survey_end_date, v_tag
    FROM sys.sys_surveys s WHERE s.survey_id = v_id
  ON CONFLICT (survey_id, migrazione) DO NOTHING;

  IF NOT EXISTS (SELECT 1 FROM staging.rilevazione_clima_undo
                  WHERE survey_id = v_id AND migrazione = v_tag) THEN
    RAISE EXCEPTION 'ascolto: il giornale non ha registrato la riga: non procedo senza rollback';
  END IF;

  -- la finestra scorre in avanti, con la stessa ampiezza del seed (20 giorni)
  UPDATE sys.sys_surveys s
     SET survey_status     = 'active',
         survey_start_date = CURRENT_DATE - 6,
         survey_end_date   = CURRENT_DATE + 14,
         updated_at        = now()
   WHERE s.survey_id = v_id;
  GET DIAGNOSTICS v_n = ROW_COUNT;

  -- POST-CONDIZIONE — protegge cio' che NON doveva cambiare, non solo cio' che doveva
  SELECT count(*) INTO v_altre_dopo FROM sys.sys_surveys WHERE survey_id <> v_id;
  IF v_altre_dopo <> v_altre_prima THEN
    RAISE EXCEPTION 'ascolto: le altre rilevazioni erano % e adesso sono %: annullo',
      v_altre_prima, v_altre_dopo;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM sys.sys_surveys s
                  WHERE s.survey_id = v_id AND s.survey_status = 'active'
                    AND CURRENT_DATE BETWEEN s.survey_start_date AND s.survey_end_date) THEN
    RAISE EXCEPTION 'ascolto: dopo la scrittura la finestra ancora non copre oggi: annullo';
  END IF;

  RAISE NOTICE 'ascolto: rilevazione «%» riaperta (% → %), tag %',
    c_natural, CURRENT_DATE - 6, CURRENT_DATE + 14, v_tag;
  RETURN QUERY SELECT v_n, v_tag;
END $$;

COMMENT ON FUNCTION staging.rilevazione_clima_rinnova() IS
  'Invariante: per RTL esiste sempre un ascolto aperto che copre oggi. Idempotente: a invariante vera scrive 0 righe. Chiamata da storia36.sh avanzamento.';

-- ── (c) il ripristino, dichiarato e provabile ────────────────────────────────
CREATE OR REPLACE FUNCTION staging.rilevazione_clima_ripristina(p_tag varchar)
RETURNS int LANGUAGE plpgsql AS $$
DECLARE v_n int := 0;
BEGIN
  UPDATE sys.sys_surveys s
     SET survey_status     = u.status_precedente,
         survey_start_date = u.start_precedente,
         survey_end_date   = u.end_precedente,
         updated_at        = now()
    FROM staging.rilevazione_clima_undo u
   WHERE u.survey_id = s.survey_id AND u.migrazione = p_tag;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RAISE NOTICE 'ascolto: ripristinate % righe dal tag %', v_n, p_tag;
  RETURN v_n;
END $$;

-- ── (d) la prima passata, adesso ─────────────────────────────────────────────
-- La catena si riapplica a ogni deploy (ADR-0035): questa chiamata e' idempotente
-- per costruzione — a invariante gia' vera scrive 0 righe e lo dichiara.
DO $$
DECLARE r record;
BEGIN
  SELECT * INTO r FROM staging.rilevazione_clima_rinnova();
  RAISE NOTICE '000383: rinnovate=% tag=%', r.rinnovate, r.tag;
END $$;

-- ── (e) la verifica finale: l'invariante regge, o la migrazione fallisce ─────
DO $$
DECLARE v_aperte int; v_tot int;
BEGIN
  SELECT count(*) INTO v_aperte
    FROM sys.sys_surveys s
   WHERE s.survey_type = 'engagement' AND s.survey_status = 'active'
     AND CURRENT_DATE BETWEEN s.survey_start_date AND s.survey_end_date;
  SELECT count(*) INTO v_tot FROM sys.sys_surveys;

  IF v_aperte < 1 THEN
    RAISE EXCEPTION '000383: dopo la migrazione NON c''e'' un ascolto aperto — invariante violata';
  END IF;
  RAISE NOTICE '000383 OK: % ascolti aperti su % rilevazioni totali', v_aperte, v_tot;
END $$;
