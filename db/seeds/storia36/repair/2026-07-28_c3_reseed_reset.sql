-- ============================================================================
-- storia36 C3 — RESET del reseed (one-shot, review adversarial v2 2026-07-28)
-- Elimina le righe di provenienza STORIA36::C3 per la ri-semina coi generatori
-- corretti (RAL dell'esercizio, pro-rata assunzione, no VAP nel giugno 2026,
-- handoff m+22, uscite causali da gate, evaluator mai self). Idempotente.
-- ============================================================================

\set ON_ERROR_STOP on
SET client_encoding = 'UTF8';

BEGIN;

DO $$
DECLARE
  v_n bigint := 0;
  v_tot bigint := 0;
BEGIN
  DELETE FROM sys.sys_payroll_handoff_records
   WHERE payroll_handoff_record_payload->>'storia36' = 'C3';
  GET DIAGNOSTICS v_n = ROW_COUNT; v_tot := v_tot + v_n;
  RAISE NOTICE 'reset handoff C3: %', v_n;

  DELETE FROM sys.sys_user_pay_slips WHERE user_pay_slip_metadata->>'storia36' = 'C3';
  GET DIAGNOSTICS v_n = ROW_COUNT; v_tot := v_tot + v_n;
  RAISE NOTICE 'reset buste C3: %', v_n;

  DELETE FROM sys.sys_variable_pay_calculations
   WHERE variable_pay_calculation_payload->>'storia36' = 'C3';
  GET DIAGNOSTICS v_n = ROW_COUNT; v_tot := v_tot + v_n;
  RAISE NOTICE 'reset variable-pay C3: %', v_n;

  DELETE FROM sys.sys_reward_gate_results
   WHERE reward_gate_result_payload->>'storia36' = 'C3';
  GET DIAGNOSTICS v_n = ROW_COUNT; v_tot := v_tot + v_n;
  RAISE NOTICE 'reset gate results C3: %', v_n;

  DELETE FROM sys.sys_reward_gates WHERE reward_gate_payload->>'storia36' = 'C3';
  GET DIAGNOSTICS v_n = ROW_COUNT; v_tot := v_tot + v_n;
  RAISE NOTICE 'reset gates C3: %', v_n;

  DELETE FROM sys.sys_payout_curves WHERE payout_curve_payload->>'storia36' = 'C3';
  GET DIAGNOSTICS v_n = ROW_COUNT; v_tot := v_tot + v_n;
  RAISE NOTICE 'reset curve C3: %', v_n;

  INSERT INTO staging.storia36_runs (cluster_code, seed_file, rows_written, twice_run_delta)
  VALUES ('C3', 'repair/2026-07-28_c3_reseed_reset.sql', v_tot, v_tot);

  RAISE NOTICE 'storia36 C3 reseed-reset OK: % righe eliminate in questa corsa', v_tot;
END $$;

COMMIT;
