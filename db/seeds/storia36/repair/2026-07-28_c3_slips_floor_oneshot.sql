-- ============================================================================
-- storia36 C3 — one-shot: buste legacy sotto il floor CCNL (triage esito c).
-- 116 buste 2026 (import + copie C1) hanno gross×13 < floor del livello: erano
-- state generate PRIMA dell'adeguamento delle RAL ai floors (S1025). Si
-- ricalcolano dalla RAL contrattuale ODIERNA con la formula deductions FLAT
-- misurata sul corpus (INPS 9,19% · IRPEF 18,81% · net 72,00%).
-- FUORI dal glob custodia. Guardato dalla violazione stessa → idempotente.
-- ============================================================================

\set ON_ERROR_STOP on
SET client_encoding = 'UTF8';

BEGIN;

DO $$
DECLARE
  v_n bigint := 0;
BEGIN
  UPDATE sys.sys_user_pay_slips p
     SET user_pay_slip_gross_pay = f.g,
         user_pay_slip_net_pay = round(f.g * 0.72, 2),
         user_pay_slip_deductions = jsonb_build_object(
           'gross', f.g,
           'inps',  round(f.g * 0.0919, 2),
           'irpef', round(f.g * 0.1881, 2),
           'total_deductions', round(f.g * 0.0919, 2) + round(f.g * 0.1881, 2),
           'net',   round(f.g * 0.72, 2)),
         updated_at = now()
  FROM (
    SELECT p2.user_pay_slip_id,
           round(c.user_contract_gross_annual_salary / 13.0, 2) AS g
    FROM sys.sys_user_pay_slips p2
    JOIN sys.sys_user_contracts c ON c.user_contract_user_id = p2.user_pay_slip_user_id
    WHERE p2.user_pay_slip_tenant_id = '86ba7a65-217f-48ba-8ce5-5c09b40a66b0'
      AND c.user_contract_ccnl_level IS NOT NULL
      AND c.user_contract_ccnl_level <> 'Dirigente'
      AND (p2.user_pay_slip_gross_pay
           / CASE WHEN extract(month FROM p2.user_pay_slip_period_start) = 12 THEN 2 ELSE 1 END) * 13
          < staging.storia36_floor_at(c.user_contract_ccnl_level, p2.user_pay_slip_period_start) - 1
  ) f
  WHERE f.user_pay_slip_id = p.user_pay_slip_id;
  GET DIAGNOSTICS v_n = ROW_COUNT;

  INSERT INTO staging.storia36_runs (cluster_code, seed_file, rows_written, twice_run_delta)
  VALUES ('C3', 'repair/2026-07-28_c3_slips_floor_oneshot.sql', v_n, v_n);

  RAISE NOTICE 'storia36 C3 slips-floor OK: % buste riallineate alla RAL contrattuale', v_n;
END $$;

COMMIT;
