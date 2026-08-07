-- ═══════════════════════════════════════════════════════════════════════════════
-- 000290_variable_pay_at_current_level_and_paid_in_june.sql
--
-- #167 / `C3d(iv)` + `C3e` — IL PREMIO SI CALCOLA SUL LIVELLO DI OGGI, E SI VEDE IN BUSTA.
--
-- STESSA RADICE DI `C3c`, TERZA MANIFESTAZIONE. La promozione di `#118` («dieci
-- responsabili passano a Quadro Direttivo QD3») ha cambiato il **livello nel
-- contratto** e non ha propagato nulla a ciò che dal livello discende. Si è visto in
-- tre posti diversi, e ogni volta sembrava un difetto a sé:
--   · `C3c` — le buste paga sotto il minimo del nuovo livello (chiuso, mig `000289`);
--   · `C3d(iv)` — il premio variabile calcolato con la percentuale del livello VECCHIO;
--   · `C3e` — e di conseguenza un premio che in busta non si vede.
--
-- LA MISURA CHE LO DIMOSTRA. Le righe fuori curva sono **tutte** di persone che oggi
-- sono **QD3 e guidano davvero**: 7, 1, 3, 4 e 8 riporti diretti. Gli importi stanno
-- al **~55%** dell'atteso — che è quasi esattamente il rapporto fra la percentuale del
-- livello di prima e quella di QD3 (7% contro 12% = 0,58; 5% contro 12% = 0,42).
-- Lo scostamento va da **−2.374 €** a **−8.067 €**: non è arrotondamento.
--
-- ── §1 — IL PREMIO TORNA SULLA CURVA ──────────────────────────────────────────
-- L'importo si ricalcola con **la stessa identica formula che usa `C3d(iv)`**: RAL al
-- dicembre dell'esercizio × percentuale del livello × curva di raggiungimento, con il
-- tetto del 30% della RAL. Usare una formula anche solo leggermente diversa
-- significherebbe correggere il dato verso un criterio che nessuno misura.
--
-- ── §2 — E SI VEDE NELLA BUSTA DI GIUGNO ──────────────────────────────────────
-- `C3e` pretende che il variabile dell'esercizio N compaia nella busta di **giugno
-- N+1**: lordo ≥ mensilità base + premio. Alzando il premio (§1) la busta di giugno
-- che prima bastava non basta più — quindi le due correzioni **devono** stare nella
-- stessa migrazione: separate, lascerebbero il database in uno stato in cui `C3e` è
-- rosso per colpa della riparazione di `C3d`.
-- Si alza il lordo di giugno **al minimo necessario** perché il premio sia visibile,
-- e non oltre.
--
-- REVERSIBILE: `staging.storia36_167_premi_undo` per gli importi;
-- le buste riusano `staging.storia36_167_buste_undo`, con `ON CONFLICT DO NOTHING`
-- così una busta già salvata dalla `000289` conserva il valore **originale** e il
-- rollback riporta davvero all'inizio, non a metà strada.
-- `staging.storia36_167_c3d_rollback()` rimette entrambi.
--
-- Idempotente.
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

CREATE TABLE IF NOT EXISTS staging.storia36_167_premi_undo (
  variable_pay_calculation_id uuid PRIMARY KEY,
  amount_precedente numeric,
  salvato_il timestamptz NOT NULL DEFAULT now()
);

DO $mig$
DECLARE
  c_rtl constant uuid := '86ba7a65-217f-48ba-8ce5-5c09b40a66b0';
  v_p bigint; v_b bigint; v_res bigint;
BEGIN
  -- ── §1 ──────────────────────────────────────────────────────────────────────
  CREATE TEMP TABLE curva ON COMMIT DROP AS
  SELECT v.variable_pay_calculation_id AS id,
         v.variable_pay_calculation_amount_eur AS attuale,
         round(LEAST(
           staging.storia36_ral_at(c.user_contract_gross_annual_salary, c.user_contract_ccnl_level,
             make_date(extract(year FROM v.variable_pay_calculation_period_start)::int, 12, 1))
           * CASE WHEN c.user_contract_ccnl_level = 'Dirigente' THEN 0.15
                  WHEN c.user_contract_ccnl_level LIKE 'QD%' OR c.user_contract_ccnl_level = 'Quadro' THEN 0.12
                  WHEN c.user_contract_ccnl_level = '3A4L' THEN 0.08
                  WHEN c.user_contract_ccnl_level = '3A3L' THEN 0.07
                  ELSE 0.05 END
           * LEAST(0.5 + ((v.variable_pay_calculation_payload->>'attainment')::numeric - 0.8) * 2.5, 1.5),
           staging.storia36_ral_at(c.user_contract_gross_annual_salary, c.user_contract_ccnl_level,
             make_date(extract(year FROM v.variable_pay_calculation_period_start)::int, 12, 1)) * 0.30), 2) AS corretto
    FROM sys.sys_variable_pay_calculations v
    JOIN sys.sys_user_contracts c ON c.user_contract_user_id = v.variable_pay_calculation_user_id
   WHERE v.variable_pay_calculation_payload->>'storia36' = 'C3';

  INSERT INTO staging.storia36_167_premi_undo (variable_pay_calculation_id, amount_precedente)
  SELECT id, attuale FROM curva WHERE abs(attuale - corretto) > 1
  ON CONFLICT (variable_pay_calculation_id) DO NOTHING;

  UPDATE sys.sys_variable_pay_calculations v
     SET variable_pay_calculation_amount_eur = k.corretto
    FROM curva k WHERE k.id = v.variable_pay_calculation_id AND abs(k.attuale - k.corretto) > 1;
  GET DIAGNOSTICS v_p = ROW_COUNT;

  -- ── §2 ──────────────────────────────────────────────────────────────────────
  CREATE TEMP TABLE giugno ON COMMIT DROP AS
  SELECT p.user_pay_slip_id AS id, p.user_pay_slip_gross_pay AS attuale,
         round(staging.storia36_ral_at(c.user_contract_gross_annual_salary, c.user_contract_ccnl_level,
                                       p.user_pay_slip_period_start) / 13.0, 2)
         + v.variable_pay_calculation_amount_eur AS minimo
    FROM sys.sys_variable_pay_calculations v
    JOIN sys.sys_user_pay_slips p
      ON p.user_pay_slip_user_id = v.variable_pay_calculation_user_id
     AND p.user_pay_slip_period = (extract(year FROM v.variable_pay_calculation_period_start)::int + 1) || '-06'
    JOIN sys.sys_user_contracts c ON c.user_contract_user_id = p.user_pay_slip_user_id
   WHERE v.variable_pay_calculation_tenant_id = c_rtl
     AND extract(year FROM v.variable_pay_calculation_period_start)::int IN (2023, 2024)
     AND v.variable_pay_calculation_amount_eur IS NOT NULL;

  INSERT INTO staging.storia36_167_buste_undo (user_pay_slip_id, gross_precedente)
  SELECT id, attuale FROM giugno WHERE attuale < minimo - 1
  ON CONFLICT (user_pay_slip_id) DO NOTHING;   -- se gia' salvata dalla 000289, resta l'originale

  UPDATE sys.sys_user_pay_slips p
     SET user_pay_slip_gross_pay = g.minimo, updated_at = now()
    FROM giugno g WHERE g.id = p.user_pay_slip_id AND g.attuale < g.minimo - 1;
  GET DIAGNOSTICS v_b = ROW_COUNT;

  -- ── post-condizioni: i due predicati dei controlli, ricalcolati ─────────────
  SELECT count(*) INTO v_res FROM curva k
    JOIN sys.sys_variable_pay_calculations v ON v.variable_pay_calculation_id = k.id
   WHERE abs(v.variable_pay_calculation_amount_eur - k.corretto) > 1;
  IF v_res > 0 THEN RAISE EXCEPTION '000290: restano % premi fuori dalla curva', v_res; END IF;

  SELECT count(*) INTO v_res
    FROM sys.sys_variable_pay_calculations v
   WHERE v.variable_pay_calculation_tenant_id = c_rtl
     AND extract(year FROM v.variable_pay_calculation_period_start)::int IN (2023, 2024)
     AND v.variable_pay_calculation_amount_eur IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM sys.sys_user_pay_slips p
       JOIN sys.sys_user_contracts c2 ON c2.user_contract_user_id = p.user_pay_slip_user_id
       WHERE p.user_pay_slip_user_id = v.variable_pay_calculation_user_id
         AND p.user_pay_slip_period = (extract(year FROM v.variable_pay_calculation_period_start)::int + 1) || '-06'
         AND p.user_pay_slip_gross_pay >=
             round(staging.storia36_ral_at(c2.user_contract_gross_annual_salary, c2.user_contract_ccnl_level,
                                           p.user_pay_slip_period_start) / 13.0, 2)
             + v.variable_pay_calculation_amount_eur - 1);
  IF v_res > 0 THEN RAISE EXCEPTION '000290: restano % premi FY23/24 senza evidenza nella busta di giugno', v_res; END IF;

  RAISE NOTICE '000290 done: % premi riportati sulla curva del livello attuale, % buste di giugno rese coerenti', v_p, v_b;
END $mig$;

CREATE OR REPLACE FUNCTION staging.storia36_167_c3d_rollback()
RETURNS TABLE(premi bigint, buste bigint) LANGUAGE plpgsql AS $fn$
DECLARE v_p bigint; v_b bigint;
BEGIN
  UPDATE sys.sys_variable_pay_calculations v
     SET variable_pay_calculation_amount_eur = u.amount_precedente
    FROM staging.storia36_167_premi_undo u WHERE u.variable_pay_calculation_id = v.variable_pay_calculation_id;
  GET DIAGNOSTICS v_p = ROW_COUNT;
  UPDATE sys.sys_user_pay_slips p SET user_pay_slip_gross_pay = u.gross_precedente, updated_at = now()
    FROM staging.storia36_167_buste_undo u WHERE u.user_pay_slip_id = p.user_pay_slip_id;
  GET DIAGNOSTICS v_b = ROW_COUNT;
  RETURN QUERY SELECT v_p, v_b;
END $fn$;

COMMIT;
