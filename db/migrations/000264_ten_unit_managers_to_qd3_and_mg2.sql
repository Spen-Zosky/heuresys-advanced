-- ═══════════════════════════════════════════════════════════════════════════════
-- 000264_ten_unit_managers_to_qd3_and_mg2.sql
--
-- DIECI RESPONSABILI DI UNITA' DIVENTANO QUADRI, E LA RETRIBUZIONE SEGUE.
--
-- Due decisioni di Enzo del 2026-08-04 (registro #118 e #120), applicate insieme
-- perche' separarle lascerebbe il dato incoerente a meta' strada: un quadro
-- direttivo pagato sotto il minimo della fascia manageriale, oppure una fascia
-- manageriale su chi e' ancora inquadrato nelle aree professionali.
--
-- A. IL LIVELLO (#118)
--   I dieci reggono un'unita' ma sono inquadrati nelle aree professionali (3A3L,
--   3A4L). Passano a Quadro Direttivo. Il livello di destinazione e' `QD3` per una
--   ragione misurata e non per scelta estetica: in questa banca esistono solo `QD3`
--   e `QD4`; `QD1` e `QD2` non sono usati da nessuno e introdurli creerebbe un
--   livello senza coorte.
--
-- B. LA FASCIA (#120)
--   Portavano fasce PROFESSIONALI (`PR-1`, `PR-2`, `IT-2`) mentre la fascia
--   manageriale `MG-2` [65.000-100.000] esiste ed e' gia' portata da 17 posizioni
--   di comando. E' lo stesso difetto corretto dalla 000262 sui ruoli apicali, un
--   livello piu' in basso.
--
--   ⚠ MA LE POSIZIONI DI COMANDO SONO OTTO, NON DIECI. Misurato qui: `alice.costa`
--   ricopre `POS-00000300 System Administrator` e `pietro.gallo` ricopre
--   `POS-00000324 Software Developer`, pur reggendo rispettivamente la Direzione
--   Infrastrutture e la Direzione Sviluppo Software. Le altre otto ricoprono una
--   `POS-CMD-*`.
--
--   La fascia NON viene spostata su quelle due, e la ragione e' il principio che la
--   000262 ha gia' dichiarato: *la fascia descrive la POSIZIONE, non la persona che
--   la occupa*. Agganciare `MG-2` a una posizione intitolata «System Administrator»
--   direbbe che quel mestiere e' un mestiere manageriale, e lo direbbe anche al
--   prossimo sistemista che ci venisse assegnato. Il difetto vero e' che due
--   responsabili di direzione non hanno una posizione di comando — ed e' un buco
--   dell'organigramma, non della retribuzione: si corregge creando la posizione,
--   che e' lavoro di struttura e non appartiene a questa migrazione.
--
--   La verifica X3a si chiude lo stesso: le loro nuove retribuzioni (77.000 e
--   77.400) cadono DENTRO `IT-2` [50.000-85.000], quindi nessuna delle dieci
--   risulta fuori dalla fascia della propria posizione.
--
-- C. LA RETRIBUZIONE (#120)
--   La collocazione dentro `MG-2` e' derivata dall'anzianita' con la regressione
--   misurata sui 17 che la fascia gia' la portano (posizione% ~ 2,57 x anni - 1,9),
--   corretta per valutazione con (voto - 3,33) x 3 punti percentuali, dove 3,33 e'
--   la valutazione mediana di quei 17 — il neutro non e' scelto, e' la popolazione
--   di riferimento.
--
--   Totale: da 592.986 a 729.900 EUR/anno, +136.914 (+23%).
--
--   ⚠ DUE AUMENTI FUORI SCALA, VISTI E APPROVATI DA ENZO PRIMA DELL'APPLICAZIONE:
--   `roberta.caputo` +52% (48.049 -> 73.200) e `martina.sala` +45% (46.071 ->
--   66.800). Non nascono dalla regola di collocazione ma dal PAVIMENTO della
--   fascia: prendevano 48.049 e 46.071 contro un minimo di 65.000, quindi
--   qualunque collocazione dentro `MG-2` produce quel salto. E' la misura di quanto
--   fossero sottopagate rispetto all'incarico — `roberta.caputo` regge la Direzione
--   Back Office, la piu' popolosa delle dieci con 9 persone.
--
-- Le persone si risolvono PER EMAIL, mai per identificativo.
-- Rieseguibile. Prerequisiti: 000262 applicata.
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ───────────────────────────────────────────────────────────────────────────────
-- La decisione, scritta una volta sola: chi, e quanto.
-- ───────────────────────────────────────────────────────────────────────────────
CREATE TEMP TABLE decisione (email text PRIMARY KEY, ral numeric(15,2)) ON COMMIT DROP;
INSERT INTO decisione (email, ral) VALUES
  ('pietro.gallo@rtl-bank.org',      77400.00),
  ('alice.costa@rtl-bank.org',       77000.00),
  ('paolo.barbieri@rtl-bank.org',    75600.00),
  ('filippo.galli@rtl-bank.org',     73800.00),
  ('roberta.benedetti@rtl-bank.org', 73700.00),
  ('roberta.caputo@rtl-bank.org',    73200.00),
  ('tommaso.fiore@rtl-bank.org',     73000.00),
  ('alberto.serra@rtl-bank.org',     70100.00),
  ('elisa.monti@rtl-bank.org',       69300.00),
  ('martina.sala@rtl-bank.org',      66800.00);

-- Ancora ogni riga a una persona reale: se un'email non trova nessuno, la
-- decisione riguarda qualcuno che non esiste e la migrazione si ferma qui invece
-- di applicarne nove su dieci in silenzio.
DO $$
DECLARE n_orfane int;
BEGIN
  SELECT count(*) INTO n_orfane
    FROM decisione d
   WHERE NOT EXISTS (SELECT 1 FROM sys.sys_users u WHERE lower(u.user_email) = lower(d.email));
  IF n_orfane <> 0 THEN
    RAISE EXCEPTION 'Decisione riferita a % email che non corrispondono ad alcuna persona', n_orfane;
  END IF;
END $$;

-- ───────────────────────────────────────────────────────────────────────────────
-- B. LA FASCIA MANAGERIALE VA ALLE POSIZIONI DI COMANDO — e solo a quelle.
--    Il filtro e' una PROPRIETA' della posizione (essere una `POS-CMD-*`), non un
--    elenco di codici scritto a mano: se domani a una delle due si desse la
--    posizione di comando che le manca, la riga entrerebbe da sola.
-- ───────────────────────────────────────────────────────────────────────────────
UPDATE sys.sys_position_compensation_profiles pc
   SET compensation_band_id = b.compensation_band_id,
       updated_at = now()
  FROM sys.sys_compensation_bands b,
       sys.sys_positions p,
       sys.sys_user_position_assignments a,
       sys.sys_users u,
       decisione d
 WHERE b.compensation_band_code = 'MG-2'
   AND p.position_id = pc.position_id
   AND p.position_code LIKE 'POS-CMD-%'
   AND a.user_position_assignment_position_id = p.position_id
   AND a.user_position_assignment_status = 'ACTIVE'
   AND u.user_id = a.user_position_assignment_user_id
   AND lower(u.user_email) = lower(d.email)
   AND pc.compensation_band_id IS DISTINCT FROM b.compensation_band_id;

-- ───────────────────────────────────────────────────────────────────────────────
-- C. LA RETRIBUZIONE
-- ───────────────────────────────────────────────────────────────────────────────
UPDATE sys.sys_user_contracts c
   SET user_contract_gross_annual_salary = d.ral,
       updated_at = now()
  FROM sys.sys_users u, decisione d
 WHERE u.user_id = c.user_contract_user_id
   AND lower(u.user_email) = lower(d.email)
   AND c.user_contract_status = 'ACTIVE'
   AND c.user_contract_gross_annual_salary IS DISTINCT FROM d.ral;

-- ───────────────────────────────────────────────────────────────────────────────
-- A. IL LIVELLO — per ultimo, cosi' nessun istante intermedio mostra un quadro
--    direttivo pagato sotto il minimo della fascia manageriale.
-- ───────────────────────────────────────────────────────────────────────────────
UPDATE sys.sys_user_contracts c
   SET user_contract_ccnl_level = 'QD3',
       updated_at = now()
  FROM sys.sys_users u, decisione d
 WHERE u.user_id = c.user_contract_user_id
   AND lower(u.user_email) = lower(d.email)
   AND c.user_contract_status = 'ACTIVE'
   AND c.user_contract_ccnl_level IS DISTINCT FROM 'QD3';

-- ───────────────────────────────────────────────────────────────────────────────
-- D. LA PROMOZIONE ARRIVA ANCHE DOVE LA PERSONA LA LEGGE  (emendamento S1050)
--
--    Difetto misurato il 2026-08-08: A e C aggiornavano il CONTRATTO e si
--    fermavano li'. Ma lo stipendio e l'inquadramento vivono anche in
--    `sys.sys_user_employment`, che e' la scheda esposta da `/v1/me/profile/full`
--    — cioe' esattamente cio' che i dieci vedono aprendo il PROPRIO portale.
--    Risultato: promossi e aumentati sul contratto, ancora 3A3L/3A4L e vecchio
--    stipendio nella pagina che li riguarda. Dieci righe su 160.
--
--    Il seed `seed_user_role_coherence.sql` (E2) sincronizza gia' impiego←contratto
--    e ha perfino una post-condizione che esplode sui disallineati: non l'ha
--    intercettato perche' ha girato il 2026-07-21, PRIMA di questa migrazione.
--    Ecco perche' la riparazione sta QUI e non a valle (ADR-0035): la catena si
--    ri-applica per intero a ogni deploy, quindi una correzione a valle verrebbe
--    disfatta dal giro dopo in cui questa migrazione rialza il contratto da sola.
--
--    ⚠ LE BUSTE PAGA NON SI TOCCANO, ed e' una scelta misurata, non una omissione.
--    L'aumento decorre dal 2026-08-04; l'ultima busta chiude il 2026-07-31. La
--    busta di agosto non esiste ancora. Riscrivere le buste passate significherebbe
--    falsificare cio' che e' stato realmente pagato. La verifica 6 qui sotto
--    protegge proprio questo.
-- ───────────────────────────────────────────────────────────────────────────────

-- Rollback dichiarato (regola 4d del metodo di bonifica): lo stato PRECEDENTE,
-- salvato prima di scrivere. `DO NOTHING` perche' la migrazione si ri-applica a
-- ogni deploy e il giornale deve conservare il PRIMO stato, non quello di ieri.
CREATE TABLE IF NOT EXISTS staging.mig264_employment_undo (
  user_employment_user_id uuid PRIMARY KEY,
  salario_precedente      numeric(15,2),
  livello_precedente      varchar(32),
  salvato_il              timestamptz NOT NULL DEFAULT now()
);

INSERT INTO staging.mig264_employment_undo
       (user_employment_user_id, salario_precedente, livello_precedente)
SELECT e.user_employment_user_id, e.user_employment_salary, e.user_employment_pay_scale_level
  FROM sys.sys_user_employment e
  JOIN sys.sys_users u ON u.user_id = e.user_employment_user_id
  JOIN decisione d ON lower(u.user_email) = lower(d.email)
ON CONFLICT (user_employment_user_id) DO NOTHING;

CREATE OR REPLACE FUNCTION staging.mig264_employment_undo_apply()
RETURNS int LANGUAGE plpgsql AS $undo$
DECLARE n int;
BEGIN
  UPDATE sys.sys_user_employment e
     SET user_employment_salary         = j.salario_precedente,
         user_employment_pay_scale_level = j.livello_precedente,
         updated_at = now()
    FROM staging.mig264_employment_undo j
   WHERE j.user_employment_user_id = e.user_employment_user_id;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $undo$;

UPDATE sys.sys_user_employment e
   SET user_employment_salary          = c.user_contract_gross_annual_salary,
       user_employment_pay_scale_level = c.user_contract_ccnl_level,
       updated_at = now()
  FROM sys.sys_user_contracts c, sys.sys_users u, decisione d
 WHERE c.user_contract_user_id = e.user_employment_user_id
   AND u.user_id = e.user_employment_user_id
   AND lower(u.user_email) = lower(d.email)
   AND c.user_contract_status = 'ACTIVE'
   AND (e.user_employment_salary          IS DISTINCT FROM c.user_contract_gross_annual_salary
     OR e.user_employment_pay_scale_level IS DISTINCT FROM c.user_contract_ccnl_level);

-- ═══════════════════════════════════════════════════════════════════════════════
-- AUTO-VERIFICHE — principi, non conteggi congelati.
-- ═══════════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  n_non_qd3      int;
  n_sotto_minimo int;
  n_fuori_fascia int;
  n_universo     int;
  n_impiego      int;
  n_buste_rotte  int;
  n_buste_univ   int;
  med_qd3        numeric;
  med_3a4l       numeric;
BEGIN
  -- 1. Tutti e dieci sono QD3.
  SELECT count(*) INTO n_non_qd3
    FROM decisione d
    JOIN sys.sys_users u ON lower(u.user_email) = lower(d.email)
    JOIN sys.sys_user_contracts c
      ON c.user_contract_user_id = u.user_id AND c.user_contract_status = 'ACTIVE'
   WHERE c.user_contract_ccnl_level <> 'QD3';
  IF n_non_qd3 <> 0 THEN
    RAISE EXCEPTION '% dei dieci non risultano QD3', n_non_qd3;
  END IF;

  -- 2. Nessuno dei dieci resta sotto il pavimento della fascia manageriale.
  SELECT count(*) INTO n_sotto_minimo
    FROM decisione d
    JOIN sys.sys_users u ON lower(u.user_email) = lower(d.email)
    JOIN sys.sys_user_contracts c
      ON c.user_contract_user_id = u.user_id AND c.user_contract_status = 'ACTIVE'
    JOIN sys.sys_compensation_bands b ON b.compensation_band_code = 'MG-2'
   WHERE c.user_contract_gross_annual_salary < b.compensation_band_min_eur;
  IF n_sotto_minimo <> 0 THEN
    RAISE EXCEPTION '% dei dieci restano sotto il minimo di MG-2', n_sotto_minimo;
  END IF;

  -- 3. X3a: nessuna retribuzione fuori dalla fascia della propria posizione —
  --    e l'universo su cui si misura NON dev'essere vuoto, altrimenti lo zero
  --    non dimostra niente.
  SELECT count(*) FILTER (WHERE c.user_contract_gross_annual_salary < b.compensation_band_min_eur
                             OR c.user_contract_gross_annual_salary > b.compensation_band_max_eur),
         count(*)
    INTO n_fuori_fascia, n_universo
    FROM sys.sys_user_position_assignments a
    JOIN sys.sys_users u ON u.user_id = a.user_position_assignment_user_id
    JOIN sys.sys_user_contracts c
      ON c.user_contract_user_id = u.user_id AND c.user_contract_status = 'ACTIVE'
    JOIN sys.sys_position_compensation_profiles pc
      ON pc.position_id = a.user_position_assignment_position_id
    JOIN sys.sys_compensation_bands b ON b.compensation_band_id = pc.compensation_band_id
   WHERE a.user_position_assignment_status = 'ACTIVE'
     AND c.user_contract_gross_annual_salary IS NOT NULL;
  IF n_universo = 0 THEN
    RAISE EXCEPTION 'X3a misura su un universo vuoto: lo zero non dimostrerebbe nulla';
  END IF;
  IF n_fuori_fascia <> 0 THEN
    RAISE EXCEPTION 'X3a: % retribuzioni fuori dalla fascia della posizione (universo %)',
                    n_fuori_fascia, n_universo;
  END IF;

  -- 4. Il rango empirico dei livelli resta ordinato: la mediana QD3 non scende
  --    sotto quella di 3A4L. E' la condizione che rende leggibile la scala.
  SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY user_contract_gross_annual_salary)
         FILTER (WHERE user_contract_ccnl_level = 'QD3'),
         percentile_cont(0.5) WITHIN GROUP (ORDER BY user_contract_gross_annual_salary)
         FILTER (WHERE user_contract_ccnl_level = '3A4L')
    INTO med_qd3, med_3a4l
    FROM sys.sys_user_contracts WHERE user_contract_status = 'ACTIVE';
  IF med_qd3 IS NULL OR med_3a4l IS NULL THEN
    RAISE EXCEPTION 'Mediane non calcolabili: QD3=% 3A4L=%', med_qd3, med_3a4l;
  END IF;
  IF med_qd3 <= med_3a4l THEN
    RAISE EXCEPTION 'La mediana QD3 (%) e'' scesa sotto quella di 3A4L (%): la scala dei livelli non e'' piu'' ordinata',
                    med_qd3, med_3a4l;
  END IF;

  -- 5. La promozione e' arrivata dove la persona la legge: la scheda d'impiego
  --    dei dieci rispecchia il contratto. Si misura su TUTTI, non solo sui dieci:
  --    se un altro seed la disallineasse, va visto qui.
  SELECT count(*) INTO n_impiego
    FROM sys.sys_user_employment e
    JOIN sys.sys_user_contracts c ON c.user_contract_user_id = e.user_employment_user_id
   WHERE e.user_employment_salary          IS DISTINCT FROM c.user_contract_gross_annual_salary
      OR e.user_employment_pay_scale_level IS DISTINCT FROM c.user_contract_ccnl_level;
  IF n_impiego <> 0 THEN
    RAISE EXCEPTION '% schede d''impiego non rispecchiano il contratto (stipendio o inquadramento)', n_impiego;
  END IF;

  -- 6. PROTEGGE CIO' CHE NON DOVEVA CAMBIARE: le buste paga.
  --    Uno scarto fra l'ultima busta (x13, la tredicesima e' in dicembre) e la
  --    retribuzione contrattuale e' AMMESSO solo se il contratto e' stato toccato
  --    DOPO la chiusura di quella busta — cioe' l'aumento e' piu' recente della
  --    paga, che e' esattamente il caso dei dieci. Uno scarto senza quella
  --    spiegazione significa che qualcuno ha riscritto la storia delle paghe.
  --    L'universo dev'essere non vuoto, altrimenti lo zero non dimostra nulla.
  WITH ultima AS (
    SELECT DISTINCT ON (user_pay_slip_user_id)
           user_pay_slip_user_id AS uid, user_pay_slip_gross_pay AS lordo,
           user_pay_slip_period_end AS fine
      FROM sys.sys_user_pay_slips
     WHERE user_pay_slip_period ~ '^[0-9]{4}-[0-9]{2}$'
     ORDER BY user_pay_slip_user_id, user_pay_slip_period DESC
  )
  SELECT count(*) FILTER (WHERE abs(u.lordo * 13 - c.user_contract_gross_annual_salary) > 0.50
                            AND c.updated_at::date <= u.fine),
         count(*)
    INTO n_buste_rotte, n_buste_univ
    FROM ultima u
    JOIN sys.sys_user_contracts c ON c.user_contract_user_id = u.uid
   WHERE c.user_contract_gross_annual_salary IS NOT NULL;
  IF n_buste_univ = 0 THEN
    RAISE EXCEPTION 'La verifica sulle buste misura su un universo vuoto: lo zero non dimostrerebbe nulla';
  END IF;
  IF n_buste_rotte <> 0 THEN
    RAISE EXCEPTION '% persone hanno uno scarto busta/contratto NON spiegato da un contratto piu'' recente (universo %)',
                    n_buste_rotte, n_buste_univ;
  END IF;

  RAISE NOTICE 'OK — dieci responsabili a QD3; nessuno sotto il minimo di MG-2; X3a a zero su universo %; mediana QD3 % > mediana 3A4L %; schede d''impiego allineate; buste intatte (universo %).',
               n_universo, med_qd3, med_3a4l, n_buste_univ;
END $$;

COMMIT;

-- ═══════════════════════════════════════════════════════════════════════════════
-- ROLLBACK — dallo snapshot pre-migrazione: le righe non conservano il livello,
-- la retribuzione ne' la fascia precedenti.
-- ═══════════════════════════════════════════════════════════════════════════════
