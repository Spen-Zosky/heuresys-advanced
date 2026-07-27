-- ============================================================================
-- storia36 C1 — RESET del reseed (one-shot, review adversarial 2026-07-27)
-- Elimina TUTTE le righe di provenienza STORIA36::C1 (attendance, richieste,
-- balances inseriti, buste marcate) per permettere la ri-semina deterministica
-- con i generatori corretti. Sicuro per costruzione: tocca SOLO provenienza
-- STORIA36::C1 (mai righe organiche/legacy). Idempotente: seconda corsa → 0.
-- FUORI dal glob custodia (directory repair/): si lancia a mano.
-- ============================================================================

\set ON_ERROR_STOP on
SET client_encoding = 'UTF8';

BEGIN;

DO $$
DECLARE
  v_n bigint := 0;
  v_tot bigint := 0;
BEGIN
  DELETE FROM sys.sys_attendance WHERE attendance_natural_key LIKE 'STORIA36::C1::%';
  GET DIAGNOSTICS v_n = ROW_COUNT; v_tot := v_tot + v_n;
  RAISE NOTICE 'reset attendance STORIA36::C1: %', v_n;

  DELETE FROM sys.sys_time_off_requests WHERE request_natural_key LIKE 'STORIA36::C1::%';
  GET DIAGNOSTICS v_n = ROW_COUNT; v_tot := v_tot + v_n;
  RAISE NOTICE 'reset richieste STORIA36::C1: %', v_n;

  DELETE FROM sys.sys_time_off_balances WHERE balance_natural_key LIKE 'STORIA36::C1::%';
  GET DIAGNOSTICS v_n = ROW_COUNT; v_tot := v_tot + v_n;
  RAISE NOTICE 'reset balances STORIA36::C1: %', v_n;

  DELETE FROM sys.sys_user_pay_slips WHERE user_pay_slip_metadata->>'storia36' = 'C1';
  GET DIAGNOSTICS v_n = ROW_COUNT; v_tot := v_tot + v_n;
  RAISE NOTICE 'reset buste STORIA36 C1: %', v_n;

  INSERT INTO staging.storia36_runs (cluster_code, seed_file, rows_written, twice_run_delta)
  VALUES ('C1', 'repair/2026-07-27_c1_reseed_reset.sql', v_tot, v_tot);

  RAISE NOTICE 'storia36 C1 reseed-reset OK: % righe eliminate in questa corsa', v_tot;
END $$;

COMMIT;
