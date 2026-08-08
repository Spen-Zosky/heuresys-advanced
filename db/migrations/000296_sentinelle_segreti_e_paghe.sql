-- ═══════════════════════════════════════════════════════════════════════════════
-- 000296_sentinelle_segreti_e_paghe.sql
--
-- DUE SENTINELLE PERMANENTI, nate da due difetti reali trovati il 2026-08-08.
--
-- `db_health.py` interroga AUTOMATICAMENTE ogni vista `sys.v_*` che non sia
-- nell'elenco delle informative: una vista che ritorna righe accende l'allarme al
-- prossimo avvio di sessione. Non serve registrarle da nessun'altra parte.
--
-- ── SENTINELLA 1 — nessun segreto authenticator puo' stare in chiaro ────────────
-- Trovato: 158 fattori TOTP, 157 cifrati a riposo e UNO in chiaro — quello del
-- proprietario, creato il 2026-08-07 durante `#139`, cioe' DOPO che la cifratura
-- di massa (QW-SEC6) era gia' passata sugli altri. Non un difetto di progetto: una
-- riga sfuggita perche' nata dopo la bonifica. Senza una guardia, ricapitera' alla
-- prossima utenza creata a mano.
--
-- ── SENTINELLA 2 — nessuno scarto busta/contratto senza spiegazione ─────────────
-- La domanda giusta NON e' «la somma di 12 mesi di buste fa la retribuzione annua»:
-- quella confronta la STORIA con il PRESENTE e sara' rossa per sempre appena
-- qualcuno prende un aumento. La domanda giusta e': l'ULTIMA busta, moltiplicata
-- per 13 (la tredicesima e' in dicembre, misurata: a dicembre l'importo raddoppia),
-- vale la retribuzione contrattuale — e se non la vale, il contratto dev'essere
-- stato toccato DOPO la chiusura di quella busta.
--
-- Misurato il 2026-08-08 su 158 persone: 148 allineate al centesimo, 10 con scarto,
-- e tutti e 10 gli scarti spiegati da un contratto piu' recente della busta (la
-- promozione della 000264, decorrenza 2026-08-04, contro l'ultima busta che chiude
-- il 2026-07-31). **Scarti non spiegati: 0.** La sentinella nasce quindi verde su
-- uno stato gia' verificato, non su una soglia inventata.
--
-- Rieseguibile. Nessuna scrittura di dati: crea due viste.
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ───────────────────────────────────────────────────────────────────────────────
-- 1. Segreti a riposo. La vista NON espone il segreto: dice CHI e QUALE fattore,
--    mai il valore — una sentinella che stampasse il segreto sarebbe una fuga.
-- ───────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW sys.v_mfa_secrets_in_cleartext AS
SELECT f.auth_mfa_factor_id,
       f.auth_mfa_factor_kind,
       u.user_email,
       length(f.auth_mfa_factor_secret) AS lunghezza,
       f.created_at
  FROM sys.sys_auth_mfa_factors f
  JOIN sys.sys_users u ON u.user_id = f.auth_mfa_factor_user_id
 WHERE f.auth_mfa_factor_secret IS NOT NULL
   AND f.auth_mfa_factor_secret NOT LIKE 'enc:v1:%';

COMMENT ON VIEW sys.v_mfa_secrets_in_cleartext IS
  'SENTINELLA: fattori MFA il cui segreto e'' memorizzato in chiaro invece che come enc:v1:. Attesa: 0 righe. Riparazione: pnpm db:encrypt-totp -- --apply';

-- ───────────────────────────────────────────────────────────────────────────────
-- 2. Paghe contro contratto. Solo gli scarti NON spiegati.
--    `user_pay_slip_period ~ '^[0-9]{4}-[0-9]{2}$'` non e' cosmesi: tre buste
--    portano il periodo in un altro formato (`September 2025`) e ordinarle come
--    testo insieme alle altre darebbe una «ultima busta» sbagliata.
-- ───────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW sys.v_payslip_contract_mismatch AS
WITH ultima AS (
  SELECT DISTINCT ON (user_pay_slip_user_id)
         user_pay_slip_user_id     AS uid,
         user_pay_slip_gross_pay   AS lordo_mensile,
         user_pay_slip_period      AS periodo,
         user_pay_slip_period_end  AS fine_periodo
    FROM sys.sys_user_pay_slips
   WHERE user_pay_slip_period ~ '^[0-9]{4}-[0-9]{2}$'
     AND user_pay_slip_gross_pay IS NOT NULL
   ORDER BY user_pay_slip_user_id, user_pay_slip_period DESC
)
SELECT u.user_email,
       x.periodo                              AS ultima_busta,
       x.lordo_mensile,
       round(x.lordo_mensile * 13, 2)         AS annuo_dalle_buste,
       c.user_contract_gross_annual_salary    AS annuo_dal_contratto,
       round(x.lordo_mensile * 13 - c.user_contract_gross_annual_salary, 2) AS scarto,
       c.updated_at::date                     AS contratto_aggiornato_il,
       x.fine_periodo                         AS busta_chiusa_il
  FROM ultima x
  JOIN sys.sys_user_contracts c ON c.user_contract_user_id = x.uid
  JOIN sys.sys_users u          ON u.user_id = x.uid
 WHERE c.user_contract_gross_annual_salary IS NOT NULL
   AND abs(x.lordo_mensile * 13 - c.user_contract_gross_annual_salary) > 0.50
   AND c.updated_at::date <= x.fine_periodo;

COMMENT ON VIEW sys.v_payslip_contract_mismatch IS
  'SENTINELLA: persone la cui ultima busta (x13) non vale la retribuzione contrattuale SENZA che il contratto sia piu'' recente della busta. Attesa: 0 righe. Uno scarto legittimo esiste solo finche'' la busta del mese dell''aumento non e'' stata emessa.';

-- ═══════════════════════════════════════════════════════════════════════════════
-- DOVE VIVE L'ASSERZIONE DI STATO — e perche' NON e' qui.
--
-- La prima stesura faceva fallire la migrazione se una sentinella era accesa. La
-- prova generale (`ci-rehearsal.sh`, 2026-08-08) l'ha bocciata in 11 secondi:
--
--     ERRORE: v_mfa_secrets_in_cleartext: 1 segreti MFA in chiaro
--
-- sul clone della CI. La ragione e' strutturale, non un caso: **la cifratura dei
-- segreti la esegue uno SCRIPT** (`pnpm db:encrypt-totp`), non una migrazione. Il
-- clone della CI e' un'istantanea di produzione congelata al provisioning e
-- riportata a HEAD ri-applicando la catena: gli script non ci girano mai. Quindi
-- quella riga in chiaro sul clone c'e' e ci restera' per sempre, e la catena
-- sarebbe rossa a ogni deploy — su tutti i cloni, per sempre.
--
-- E' esattamente la categoria che ADR-0034 ha censito e nominato: «post-condizioni
-- che pretendono DATI che la catena non crea» (~72 casi su 290). La catena e' uno
-- strato di schema e controlli sopra una base di dati preesistente; un controllo
-- che pretende l'esito di uno script esterno non e' un invariante dello schema.
--
-- Quindi la divisione del lavoro e' questa:
--   • QUI (catena, ogni deploy, ogni clone) — le viste esistono e SANNO ACCENDERSI.
--     E' la proprieta' che vale su qualunque database, vuoto o pieno.
--   • `db_health.py` (database vivo, a ogni avvio di sessione) — le viste sono a
--     zero. Interroga da se' ogni `sys.v_*`: non serve registrarle, e l'esito
--     entra nel cruscotto e nel gate `--strict`.
--
-- Spostare l'asserzione non la indebolisce: la mette dove esistono i dati di cui
-- parla. Toglierla del tutto l'avrebbe indebolita — non e' quello che si e' fatto.
-- ═══════════════════════════════════════════════════════════════════════════════

-- L'universo su cui la sentinella delle paghe misura non dev'essere vuoto: una
-- sentinella che guarda il nulla ritorna zero righe e sembra verde. Questo SI' e'
-- un invariante che regge su ogni database che abbia una base dati.
DO $$
DECLARE n_universo int;
BEGIN
  SELECT count(*) INTO n_universo
    FROM sys.sys_user_pay_slips
   WHERE user_pay_slip_period ~ '^[0-9]{4}-[0-9]{2}$';
  IF n_universo = 0 THEN
    RAISE WARNING 'Nessuna busta con periodo normalizzato: su questo database la sentinella sulle paghe guarda il vuoto';
  ELSE
    RAISE NOTICE 'Sentinella paghe: universo di % buste.', n_universo;
  END IF;
END $$;

-- ── SELFTEST DI FALSIFICABILITA' — iniezione e rollback ────────────────────────
-- Ogni sentinella viene messa alla prova con una violazione VERA, poi disfatta.
-- Se una non si accende, la migrazione fallisce: meglio un deploy rosso che una
-- guardia che non guarda.
DO $$
DECLARE v_accesa boolean; v_id uuid;
BEGIN
  -- ST-1: riportare un segreto in chiaro deve accendere la prima sentinella.
  SELECT auth_mfa_factor_id INTO v_id FROM sys.sys_auth_mfa_factors
   WHERE auth_mfa_factor_secret IS NOT NULL LIMIT 1;
  IF v_id IS NULL THEN
    RAISE EXCEPTION 'SELFTEST 1 impossibile: nessun fattore MFA con segreto su cui provare';
  END IF;
  UPDATE sys.sys_auth_mfa_factors
     SET auth_mfa_factor_secret = 'AAAABBBBCCCCDDDDEEEEFFFFGGGGHHHH'
   WHERE auth_mfa_factor_id = v_id;
  SELECT EXISTS (SELECT 1 FROM sys.v_mfa_secrets_in_cleartext) INTO v_accesa;
  IF NOT v_accesa THEN
    RAISE EXCEPTION 'SELFTEST 1 FALLITO: segreto in chiaro iniettato e non rilevato';
  END IF;
  RAISE NOTICE '[OK] SELFTEST 1 (segreto in chiaro rilevato)';
  RAISE EXCEPTION 'rollback-selftest-1';
EXCEPTION WHEN OTHERS THEN
  IF SQLERRM <> 'rollback-selftest-1' THEN RAISE; END IF;
END $$;

DO $$
DECLARE v_accesa boolean; v_uid uuid; v_tenant uuid; v_email text;
BEGIN
  -- ST-2: la violazione si COSTRUISCE, non si cerca fra quelle esistenti.
  -- Cercarla renderebbe la prova dipendente dallo stato: oggi i dieci promossi
  -- offrono uno scarto, ma quando uscira' la busta di agosto lo scarto sparira'
  -- e il selftest smetterebbe di potersi accendere senza che nessuno se ne accorga
  -- — cioe' diventerebbe esattamente il tipo di prova che questa regola vieta.
  --
  -- ⚠ E NON si costruisce retrodatando il contratto. Primo tentativo, bocciato
  -- dalla prova generale: `sys_user_contracts` porta il trigger
  -- `sys_user_contracts_set_updated_at`, che riscrive `updated_at` a `now()` a
  -- OGNI update. Backdatare per UPDATE e' impossibile — il selftest combatteva
  -- contro un trigger e leggeva la propria sconfitta come «la vista non vede».
  --
  -- La via giusta e' l'altra: invece di rendere il contratto piu' VECCHIO, si
  -- rende la busta piu' NUOVA. Una busta con periodo futuro e importo palesemente
  -- sbagliato soddisfa entrambe le condizioni della sentinella senza toccare
  -- nulla di esistente, e non dipende da alcun trigger.
  SELECT c.user_contract_user_id, u.user_tenant_id, u.user_email
    INTO v_uid, v_tenant, v_email
    FROM sys.sys_user_contracts c
    JOIN sys.sys_users u ON u.user_id = c.user_contract_user_id
   WHERE c.user_contract_gross_annual_salary IS NOT NULL
     AND EXISTS (SELECT 1 FROM sys.sys_user_pay_slips p
                  WHERE p.user_pay_slip_user_id = c.user_contract_user_id)
   LIMIT 1;
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'SELFTEST 2 impossibile: nessuna persona con busta e contratto su cui provare';
  END IF;

  -- '2099-01' ordina dopo qualunque periodo reale (confronto testuale) e la sua
  -- fine e' molto oltre l'ultimo tocco di qualsiasi contratto: lo scarto risulta
  -- quindi NON spiegato, che e' precisamente cio' che la sentinella cerca.
  INSERT INTO sys.sys_user_pay_slips
         (user_pay_slip_user_id, user_pay_slip_tenant_id, user_pay_slip_period,
          user_pay_slip_period_start, user_pay_slip_period_end,
          user_pay_slip_gross_pay, user_pay_slip_status)
  VALUES (v_uid, v_tenant, '2099-01', DATE '2099-01-01', DATE '2099-01-31', 1.00, 'draft');

  SELECT EXISTS (SELECT 1 FROM sys.v_payslip_contract_mismatch WHERE user_email = v_email)
    INTO v_accesa;
  IF NOT v_accesa THEN
    RAISE EXCEPTION 'SELFTEST 2 FALLITO: scarto non spiegato iniettato e non rilevato';
  END IF;
  RAISE NOTICE '[OK] SELFTEST 2 (scarto busta/contratto non spiegato rilevato)';
  RAISE EXCEPTION 'rollback-selftest-2';
EXCEPTION WHEN OTHERS THEN
  IF SQLERRM <> 'rollback-selftest-2' THEN RAISE; END IF;
END $$;

COMMIT;
