-- ============================================================================
-- storia36 C2 — RESET del reseed (one-shot, review adversarial 2026-07-28)
-- Elimina TUTTE le righe di provenienza STORIA36::C2 per la ri-semina con i
-- generatori corretti (ancoraggio rating, snap calendario, titoli per famiglia,
-- pesi MBO, terzo check-in, link 360). Tocca SOLO provenienza STORIA36::C2.
-- FUORI dal glob custodia. Idempotente: seconda corsa → 0.
-- ============================================================================

\set ON_ERROR_STOP on
SET client_encoding = 'UTF8';

BEGIN;

DO $$
DECLARE
  v_n bigint := 0;
  v_tot bigint := 0;
BEGIN
  DELETE FROM sys.sys_feedback_360_responses WHERE response_natural_key LIKE 'STORIA36::C2::%';
  GET DIAGNOSTICS v_n = ROW_COUNT; v_tot := v_tot + v_n;
  RAISE NOTICE 'reset f360 STORIA36::C2: %', v_n;

  DELETE FROM sys.sys_performance_review_competency_ratings WHERE rating_natural_key LIKE 'STORIA36::C2::%';
  GET DIAGNOSTICS v_n = ROW_COUNT; v_tot := v_tot + v_n;
  RAISE NOTICE 'reset competency ratings STORIA36::C2: %', v_n;

  DELETE FROM sys.sys_performance_reviews WHERE review_natural_key LIKE 'STORIA36::C2::%';
  GET DIAGNOSTICS v_n = ROW_COUNT; v_tot := v_tot + v_n;
  RAISE NOTICE 'reset review STORIA36::C2: %', v_n;

  DELETE FROM sys.sys_goal_check_ins WHERE check_in_natural_key LIKE 'STORIA36::C2::%';
  GET DIAGNOSTICS v_n = ROW_COUNT; v_tot := v_tot + v_n;
  RAISE NOTICE 'reset check-in STORIA36::C2: %', v_n;

  DELETE FROM sys.sys_goals WHERE goal_natural_key LIKE 'STORIA36::C2::%';
  GET DIAGNOSTICS v_n = ROW_COUNT; v_tot := v_tot + v_n;
  RAISE NOTICE 'reset goals STORIA36::C2: %', v_n;

  INSERT INTO staging.storia36_runs (cluster_code, seed_file, rows_written, twice_run_delta)
  VALUES ('C2', 'repair/2026-07-28_c2_reseed_reset.sql', v_tot, v_tot);

  RAISE NOTICE 'storia36 C2 reseed-reset OK: % righe eliminate in questa corsa', v_tot;
END $$;

COMMIT;
