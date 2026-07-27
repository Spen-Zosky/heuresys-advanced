-- ============================================================================
-- storia36 C0 — riparazione puntuale (triage esito c: rottura vera)
-- 3 contratti con user_contract_end_date < user_contract_start_date
-- (tutti dal medesimo batch di seed created_at 2026-06-28; end/probation
-- retrodatati a caso rispetto a start, che coincide sempre con la hire date).
-- Valori di riparazione DERIVATI dalle righe sane:
--   - permanent → end NULL (pattern 87/100 permanent esistenti)
--   - fixed_term di lungo corso ancora impiegato → end NULL (pattern 12/57)
--   - fixed_term recente → end = start + 24 mesi (massimo legale IT)
--   - probation_end = start + 183 gg (cluster modale 181-184 delle righe sane)
-- Idempotente: guardie sui valori rotti — la seconda corsa non tocca nulla.
-- NOTA per C3: restano 14 righe con probation_end < start (tema sistemico
-- contratti, registrato nel diario storia36) — il check G4 sulla probation
-- arriva con la riparazione sistemica al C3.
-- ============================================================================

\set ON_ERROR_STOP on

BEGIN;

DO $$
DECLARE
  v_n   int := 0;
  v_tot int := 0;
BEGIN
  -- alberto.rossetti — permanent, start 2012-02-26 (= hire): end era 2009-07-25
  UPDATE sys.sys_user_contracts
     SET user_contract_end_date = NULL,
         user_contract_probation_end_date = user_contract_start_date + 183
   WHERE user_contract_id = '9163fdad-d03c-4eac-bee1-bb8f84835ad3'
     AND user_contract_end_date = DATE '2009-07-25';
  GET DIAGNOSTICS v_n = ROW_COUNT; v_tot := v_tot + v_n;

  -- alberto.messina — fixed_term, start 2022-06-13 (= hire), tuttora impiegato:
  -- end era 2016-11-15 → NULL (pattern fixed_term senza end, in attesa del
  -- riordino sistemico del ciclo contrattuale al C3)
  UPDATE sys.sys_user_contracts
     SET user_contract_end_date = NULL,
         user_contract_probation_end_date = user_contract_start_date + 183
   WHERE user_contract_id = 'ca5a98f6-8962-4fe0-9115-9e57438490b2'
     AND user_contract_end_date = DATE '2016-11-15';
  GET DIAGNOSTICS v_n = ROW_COUNT; v_tot := v_tot + v_n;

  -- davide.cattaneo — fixed_term, start 2024-12-15 (= hire, recente):
  -- end era 2009-03-03 → start + 24 mesi - 1 giorno = 2026-12-14
  UPDATE sys.sys_user_contracts
     SET user_contract_end_date = (user_contract_start_date + interval '24 months' - interval '1 day')::date,
         user_contract_probation_end_date = user_contract_start_date + 183
   WHERE user_contract_id = '542aa17e-ccf5-4b56-ab5d-ca9b2055ee9c'
     AND user_contract_end_date = DATE '2009-03-03';
  GET DIAGNOSTICS v_n = ROW_COUNT; v_tot := v_tot + v_n;

  INSERT INTO staging.storia36_runs (cluster_code, seed_file, rows_written, twice_run_delta)
  VALUES ('C0', '00_repair_g4_contracts.sql', v_tot, v_tot);

  RAISE NOTICE 'storia36 C0 repair contracts: % righe riparate in questa corsa', v_tot;
END $$;

-- Post-condizione fail-loud: nessun contratto con end < start; le 3 righe
-- riparate coerenti (end NULL o > start; probation >= start).
DO $$
DECLARE
  v_bad bigint;
BEGIN
  SELECT count(*) INTO v_bad
    FROM sys.sys_user_contracts
   WHERE user_contract_end_date IS NOT NULL
     AND user_contract_end_date < user_contract_start_date;
  IF v_bad > 0 THEN
    RAISE EXCEPTION 'repair contracts: restano % contratti con end < start', v_bad;
  END IF;

  SELECT count(*) INTO v_bad
    FROM sys.sys_user_contracts
   WHERE user_contract_id IN ('9163fdad-d03c-4eac-bee1-bb8f84835ad3',
                              'ca5a98f6-8962-4fe0-9115-9e57438490b2',
                              '542aa17e-ccf5-4b56-ab5d-ca9b2055ee9c')
     AND (user_contract_probation_end_date IS NULL
          OR user_contract_probation_end_date < user_contract_start_date);
  IF v_bad > 0 THEN
    RAISE EXCEPTION 'repair contracts: % delle 3 righe riparate ha ancora probation incoerente', v_bad;
  END IF;

  RAISE NOTICE 'storia36 C0 repair contracts OK: 0 contratti con end < start';
END $$;

COMMIT;
