-- ============================================================================
-- storia36 C3 — fixups ONE-SHOT dalla review adversarial (2026-07-28).
-- FUORI dal glob custodia. Guardati e idempotenti.
--  X1 reconciliation registry: marker storia36 sulle 2 tabelle NO_SOURCE ora
--     popolate dal seed authored (la rationale B-50 chiedeva esattamente una
--     "human-authored derivation rule": C3 l'ha scritta)
--  X2 27 righe variable-pay legacy DUPLICATE esatte (stesso utente+periodo,
--     rumore d'import) → resta la riga con amount non-NULL più alto
--  X3 buste legacy con gross incoerente con la RAL contrattuale (>5% di
--     scarto dalla mensilità attesa alla data — il repair floor era
--     under-inclusive: 2 QD4 con "taglio stipendio" del 21-23% a marzo→aprile
--     2026) → ricalcolate
--  X4 156 buste legacy 2026-06 pagate di SABATO (27/6) → venerdì 26/6
--     (item rinviato dal C1 al C3)
-- ============================================================================

\set ON_ERROR_STOP on
SET client_encoding = 'UTF8';

BEGIN;

DO $$
DECLARE
  c_rtl constant uuid := '86ba7a65-217f-48ba-8ce5-5c09b40a66b0';
  v_n bigint := 0;
  v_tot bigint := 0;
BEGIN
  -- X1: marker storia36 nel registry (preservando i marker storici)
  UPDATE sys.sys_reconciliation_registry
     SET reconciliation_registry_rationale =
           '[storia36 C3 2026-07-28: popolata dal seed authored 03_compensation.sql — la derivation rule human-authored che questa rationale richiedeva; NO_SOURCE resta vero per la PROVENIENZA legacy] | '
           || reconciliation_registry_rationale,
         updated_at = now()
   WHERE reconciliation_registry_table_name IN ('sys_payout_curves', 'sys_reward_gate_results')
     AND reconciliation_registry_rationale NOT LIKE '%storia36 C3%';
  GET DIAGNOSTICS v_n = ROW_COUNT; v_tot := v_tot + v_n;
  RAISE NOTICE 'X1 registry marcato: %', v_n;

  -- X2: dedupe variable-pay legacy (stesso utente + periodo esatto)
  DELETE FROM sys.sys_variable_pay_calculations v
   WHERE v.variable_pay_calculation_payload ? 'legacy'
     AND v.variable_pay_calculation_id NOT IN (
       SELECT DISTINCT ON (variable_pay_calculation_user_id,
                           variable_pay_calculation_period_start,
                           variable_pay_calculation_period_end)
              variable_pay_calculation_id
       FROM sys.sys_variable_pay_calculations
       WHERE variable_pay_calculation_payload ? 'legacy'
       ORDER BY variable_pay_calculation_user_id,
                variable_pay_calculation_period_start,
                variable_pay_calculation_period_end,
                variable_pay_calculation_amount_eur DESC NULLS LAST,
                variable_pay_calculation_id)
     AND EXISTS (
       SELECT 1 FROM sys.sys_variable_pay_calculations v2
       WHERE v2.variable_pay_calculation_id <> v.variable_pay_calculation_id
         AND v2.variable_pay_calculation_user_id = v.variable_pay_calculation_user_id
         AND v2.variable_pay_calculation_period_start = v.variable_pay_calculation_period_start
         AND v2.variable_pay_calculation_period_end = v.variable_pay_calculation_period_end
         AND v2.variable_pay_calculation_payload ? 'legacy');
  GET DIAGNOSTICS v_n = ROW_COUNT; v_tot := v_tot + v_n;
  RAISE NOTICE 'X2 variable-pay legacy dedupe: %', v_n;

  -- X3: buste legacy con gross fuori >5% dalla mensilità attesa alla data
  UPDATE sys.sys_user_pay_slips p
     SET user_pay_slip_gross_pay = f.g,
         user_pay_slip_net_pay = round(f.g * 0.72, 2),
         user_pay_slip_deductions = jsonb_build_object(
           'gross', f.g, 'inps', round(f.g * 0.0919, 2), 'irpef', round(f.g * 0.1881, 2),
           'total_deductions', round(f.g * 0.0919, 2) + round(f.g * 0.1881, 2),
           'net', round(f.g * 0.72, 2)),
         updated_at = now()
  FROM (
    SELECT p2.user_pay_slip_id,
           round(staging.storia36_ral_at(c.user_contract_gross_annual_salary,
                                         c.user_contract_ccnl_level,
                                         p2.user_pay_slip_period_start) / 13.0
                 * CASE WHEN extract(month FROM p2.user_pay_slip_period_start) = 12 THEN 2 ELSE 1 END,
                 2) AS g
    FROM sys.sys_user_pay_slips p2
    JOIN sys.sys_user_contracts c ON c.user_contract_user_id = p2.user_pay_slip_user_id
    WHERE p2.user_pay_slip_tenant_id = '86ba7a65-217f-48ba-8ce5-5c09b40a66b0'
      AND (p2.user_pay_slip_metadata->>'storia36' IS NULL OR p2.user_pay_slip_metadata->>'storia36' = 'C1')  -- legacy + copie C1
      AND p2.user_pay_slip_period NOT LIKE '%2026-06%'            -- giugno legacy resta flat (deviazione FY2025)
      AND c.user_contract_gross_annual_salary IS NOT NULL
      AND abs(p2.user_pay_slip_gross_pay
              - staging.storia36_ral_at(c.user_contract_gross_annual_salary,
                                        c.user_contract_ccnl_level,
                                        p2.user_pay_slip_period_start) / 13.0
                * CASE WHEN extract(month FROM p2.user_pay_slip_period_start) = 12 THEN 2 ELSE 1 END)
          > 0.05 * (staging.storia36_ral_at(c.user_contract_gross_annual_salary,
                                            c.user_contract_ccnl_level,
                                            p2.user_pay_slip_period_start) / 13.0)
  ) f
  WHERE f.user_pay_slip_id = p.user_pay_slip_id;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_tot := v_tot + v_n;
  RAISE NOTICE 'X3 buste legacy incoerenti con la RAL: %', v_n;

  -- X4: payment di sabato 2026-06-27 → venerdì 2026-06-26
  UPDATE sys.sys_user_pay_slips
     SET user_pay_slip_payment_date = DATE '2026-06-26', updated_at = now()
   WHERE user_pay_slip_tenant_id = c_rtl
     AND user_pay_slip_payment_date = DATE '2026-06-27';
  GET DIAGNOSTICS v_n = ROW_COUNT; v_tot := v_tot + v_n;
  RAISE NOTICE 'X4 payment sabato → venerdì: %', v_n;

  INSERT INTO staging.storia36_runs (cluster_code, seed_file, rows_written, twice_run_delta)
  VALUES ('C3', 'repair/2026-07-28_c3_fixups_oneshot.sql', v_tot, v_tot);

  RAISE NOTICE 'storia36 C3 fixups OK: % righe toccate in questa corsa', v_tot;
END $$;

COMMIT;
