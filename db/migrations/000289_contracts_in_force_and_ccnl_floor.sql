-- ═══════════════════════════════════════════════════════════════════════════════
-- 000289_contracts_in_force_and_ccnl_floor.sql
--
-- #167 / `C3c` — DUE DIFETTI, E QUELLO CHE IL CONTROLLO MOSTRAVA ERA IL PIÙ PICCOLO.
--
-- ── §1. VENTITRÉ PERSONE ATTIVE PAGATE SU UN CONTRATTO SCADUTO ────────────────
-- Non lo segnalava nessun controllo. Misurato: **322 buste su 23 persone** cadono
-- dopo la data di fine del contratto, e per tutte e 23 il rapporto di lavoro è
-- **ACTIVE**. Le scadenze risalgono fino al **2013**. Un dipendente attivo, pagato
-- ogni mese, non ha un contratto finito tredici anni fa: la data di fine è un
-- residuo, non un fatto. Nessuno ha più di una riga di contratto (158 persone, 158
-- contratti), quindi non esiste una successione da ricostruire — c'è una data stantia
-- da togliere.
-- Si azzera `end_date` **solo** dove c'è la prova che il rapporto continua: persona
-- ACTIVE, rapporto ACTIVE, e almeno una busta **successiva** alla scadenza. Le 6
-- scadenze senza buste successive NON si toccano: lì la fine potrebbe essere vera.
--
-- FALSO ALLARME ESCLUSO: le «5 buste prima dell'inizio del contratto» sono tutte il
-- **mese di assunzione** (busta dal 1°, assunzione a metà mese). È il pro-rata, che
-- `C3c` stesso già esclude. Verificato una per una, non dedotto.
--
-- ── §2. DUE RESPONSABILI PAGATI SOTTO IL MINIMO DEL LORO LIVELLO ──────────────
-- È il rosso che `C3c` mostrava: 60 buste sotto il minimo CCNL. Tutte di livello
-- **QD3**, tutte di **due sole persone**, su tutto il loro storico, con uno scarto
-- che arriva a **−11.088 €/anno**. Non è arrotondamento.
--
-- La domanda del triage era «è sbagliata la paga o è sbagliato il livello?», e la
-- misura risponde: **entrambe guidano una Direzione** — `Responsabile Direzione
-- Bilancio e Segnalazioni` (4 riporti) e `Responsabile Direzione Back Office` (8
-- riporti). QD3 «Quadro Direttivo» è il livello giusto. È la **paga** a essere
-- rimasta indietro: corrisponde a QD1 (50.772) e ad AU (44.063). È la promozione di
-- `#118` («dieci responsabili passano a Quadro Direttivo QD3») applicata al contratto
-- e mai propagata alle buste — stratificazione, esattamente.
--
-- Si porta la retribuzione **al minimo contrattuale, non oltre**: alzarla di più
-- sarebbe inventare uno stipendio. Dicembre è la tredicesima (lordo doppio) e viene
-- trattato come tale, con lo stesso criterio che usa il controllo.
--
-- REVERSIBILE: `staging.storia36_167_contratti_undo` e
-- `staging.storia36_167_buste_undo` salvano i valori PRIMA della scrittura;
-- `staging.storia36_167_c3c_rollback()` li rimette entrambi.
--
-- Idempotente: alla seconda esecuzione non resta nulla da correggere.
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

CREATE TABLE IF NOT EXISTS staging.storia36_167_contratti_undo (
  user_contract_id uuid PRIMARY KEY,
  end_date_precedente date,
  salvato_il timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS staging.storia36_167_buste_undo (
  user_pay_slip_id uuid PRIMARY KEY,
  gross_precedente numeric,
  salvato_il timestamptz NOT NULL DEFAULT now()
);

DO $mig$
DECLARE
  c_rtl constant uuid := '86ba7a65-217f-48ba-8ce5-5c09b40a66b0';
  v_c bigint; v_b bigint; v_res bigint;
BEGIN
  -- ── §1 ──────────────────────────────────────────────────────────────────────
  INSERT INTO staging.storia36_167_contratti_undo (user_contract_id, end_date_precedente)
  SELECT c.user_contract_id, c.user_contract_end_date
    FROM sys.sys_user_contracts c
    JOIN sys.sys_users u ON u.user_id = c.user_contract_user_id
    JOIN sys.sys_user_employment e ON e.user_employment_user_id = u.user_id
   WHERE u.user_tenant_id = c_rtl AND u.user_status = 'ACTIVE'
     AND e.user_employment_status = 'ACTIVE'
     AND c.user_contract_end_date IS NOT NULL
     AND EXISTS (SELECT 1 FROM sys.sys_user_pay_slips p
                  WHERE p.user_pay_slip_user_id = u.user_id
                    AND p.user_pay_slip_period_start > c.user_contract_end_date)
  ON CONFLICT (user_contract_id) DO NOTHING;

  UPDATE sys.sys_user_contracts c
     SET user_contract_end_date = NULL, updated_at = now()
    FROM staging.storia36_167_contratti_undo u
   WHERE u.user_contract_id = c.user_contract_id AND c.user_contract_end_date IS NOT NULL;
  GET DIAGNOSTICS v_c = ROW_COUNT;

  -- ── §2 ──────────────────────────────────────────────────────────────────────
  CREATE TEMP TABLE sotto_minimo ON COMMIT DROP AS
  SELECT p.user_pay_slip_id,
         p.user_pay_slip_gross_pay AS lordo_attuale,
         CASE WHEN extract(month FROM p.user_pay_slip_period_start) = 12 THEN 2 ELSE 1 END AS mensilita,
         staging.storia36_floor_at(c.user_contract_ccnl_level, p.user_pay_slip_period_start) AS minimo
    FROM sys.sys_user_pay_slips p
    JOIN sys.sys_users u ON u.user_id = p.user_pay_slip_user_id
    JOIN sys.sys_user_contracts c ON c.user_contract_user_id = u.user_id
    JOIN sys.sys_user_employment e ON e.user_employment_user_id = u.user_id
   WHERE p.user_pay_slip_tenant_id = c_rtl
     AND date_trunc('month', e.user_employment_hire_date) <> date_trunc('month', p.user_pay_slip_period_start)
     AND c.user_contract_ccnl_level IS NOT NULL AND c.user_contract_ccnl_level <> 'Dirigente'
     AND (p.user_pay_slip_gross_pay / CASE WHEN extract(month FROM p.user_pay_slip_period_start) = 12 THEN 2 ELSE 1 END) * 13
         < staging.storia36_floor_at(c.user_contract_ccnl_level, p.user_pay_slip_period_start) - 1;

  INSERT INTO staging.storia36_167_buste_undo (user_pay_slip_id, gross_precedente)
  SELECT user_pay_slip_id, lordo_attuale FROM sotto_minimo
  ON CONFLICT (user_pay_slip_id) DO NOTHING;

  UPDATE sys.sys_user_pay_slips p
     SET user_pay_slip_gross_pay = round((s.minimo / 13.0) * s.mensilita, 2),
         updated_at = now()
    FROM sotto_minimo s
   WHERE s.user_pay_slip_id = p.user_pay_slip_id;
  GET DIAGNOSTICS v_b = ROW_COUNT;

  -- ── post-condizioni ─────────────────────────────────────────────────────────
  -- Il predicato di C3c, ricalcolato: deve essere zero.
  SELECT count(*) INTO v_res
    FROM sys.sys_user_pay_slips p
    JOIN sys.sys_users u ON u.user_id = p.user_pay_slip_user_id
    JOIN sys.sys_user_contracts c ON c.user_contract_user_id = u.user_id
    JOIN sys.sys_user_employment e ON e.user_employment_user_id = u.user_id
   WHERE p.user_pay_slip_tenant_id = c_rtl
     AND date_trunc('month', e.user_employment_hire_date) <> date_trunc('month', p.user_pay_slip_period_start)
     AND c.user_contract_ccnl_level IS NOT NULL AND c.user_contract_ccnl_level <> 'Dirigente'
     AND (p.user_pay_slip_gross_pay / CASE WHEN extract(month FROM p.user_pay_slip_period_start) = 12 THEN 2 ELSE 1 END) * 13
         < staging.storia36_floor_at(c.user_contract_ccnl_level, p.user_pay_slip_period_start) - 1;
  IF v_res > 0 THEN
    RAISE EXCEPTION '000289: restano % buste sotto il minimo CCNL', v_res;
  END IF;

  -- Nessuna busta deve piu' cadere fuori dal contratto DOPO la fine. Il caso «prima
  -- dell'inizio» resta ammesso: e' il mese di assunzione, pro-rata.
  SELECT count(*) INTO v_res
    FROM sys.sys_user_pay_slips p
    JOIN sys.sys_user_contracts c ON c.user_contract_user_id = p.user_pay_slip_user_id
    JOIN sys.sys_users u ON u.user_id = p.user_pay_slip_user_id
   WHERE p.user_pay_slip_tenant_id = c_rtl AND u.user_status = 'ACTIVE'
     AND c.user_contract_end_date IS NOT NULL
     AND p.user_pay_slip_period_start > c.user_contract_end_date;
  IF v_res > 0 THEN
    RAISE EXCEPTION '000289: restano % buste dopo la fine del contratto di una persona attiva', v_res;
  END IF;

  RAISE NOTICE '000289 done: % contratti riportati in forza, % buste portate al minimo CCNL', v_c, v_b;
END $mig$;

CREATE OR REPLACE FUNCTION staging.storia36_167_c3c_rollback()
RETURNS TABLE(contratti bigint, buste bigint) LANGUAGE plpgsql AS $fn$
DECLARE v_c bigint; v_b bigint;
BEGIN
  UPDATE sys.sys_user_contracts c SET user_contract_end_date = u.end_date_precedente, updated_at = now()
    FROM staging.storia36_167_contratti_undo u WHERE u.user_contract_id = c.user_contract_id;
  GET DIAGNOSTICS v_c = ROW_COUNT;
  UPDATE sys.sys_user_pay_slips p SET user_pay_slip_gross_pay = u.gross_precedente, updated_at = now()
    FROM staging.storia36_167_buste_undo u WHERE u.user_pay_slip_id = p.user_pay_slip_id;
  GET DIAGNOSTICS v_b = ROW_COUNT;
  RETURN QUERY SELECT v_c, v_b;
END $fn$;

COMMIT;
