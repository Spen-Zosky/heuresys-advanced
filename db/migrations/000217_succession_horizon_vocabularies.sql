-- ============================================================================
-- 000217 — Vocabolari chiusi sulle colonne «orizzonte» della successione
--
-- Rilievo C5 #41 (review adversarial, coda non assorbita): tre colonne
-- categoriali reggevano un vocabolario senza dichiararlo. RD-08 impone
-- varchar(N) + CHECK per ogni campo categoriale: senza il CHECK il vocabolario
-- vive solo nella testa di chi scrive il seed, e la prima riga scritta a mano
-- da un'API lo allarga in silenzio.
--
--   · sys_succession_scores.succession_score_horizon        — nessun CHECK
--   · sys_successor_readiness.successor_readiness_horizon   — nessun CHECK
--   · sys_user_target_positions.user_target_position_horizon— nessun CHECK
--
-- Il vocabolario NON è inventato qui: è quello già dichiarato da
-- sys_psr_readiness_horizon_check (prontezza) e quello già in uso sui dati
-- (orizzonte dell'obiettivo). Misurato prima di scrivere il vincolo:
--   readiness_horizon → NOT_READY 67 · READY_1_YEAR 25 · READY_2_YEARS 25
--                       READY_6_MONTHS 14 · READY_NOW 10   (nessun altro)
--   score_horizon     → NOT_READY 30 · READY_1_YEAR 22 · READY_2_YEARS 24
--                       READY_NOW 14                       (nessun altro)
--   target_horizon    → LONG_TERM 47 · MEDIUM_TERM 59 · SHORT_TERM 39
--
-- Idempotente: ogni vincolo è aggiunto solo se non esiste.
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_succession_score_horizon_check') THEN
    ALTER TABLE sys.sys_succession_scores
      ADD CONSTRAINT sys_succession_score_horizon_check
      CHECK (succession_score_horizon IS NULL OR succession_score_horizon IN
             ('READY_NOW','READY_6_MONTHS','READY_1_YEAR','READY_2_YEARS','NOT_READY'));
    RAISE NOTICE '000217: CHECK aggiunto su sys_succession_scores.succession_score_horizon';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_successor_readiness_horizon_check') THEN
    ALTER TABLE sys.sys_successor_readiness
      ADD CONSTRAINT sys_successor_readiness_horizon_check
      CHECK (successor_readiness_horizon IS NULL OR successor_readiness_horizon IN
             ('READY_NOW','READY_6_MONTHS','READY_1_YEAR','READY_2_YEARS','NOT_READY'));
    RAISE NOTICE '000217: CHECK aggiunto su sys_successor_readiness.successor_readiness_horizon';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_utp_horizon_check') THEN
    ALTER TABLE sys.sys_user_target_positions
      ADD CONSTRAINT sys_utp_horizon_check
      CHECK (user_target_position_horizon IS NULL OR user_target_position_horizon IN
             ('SHORT_TERM','MEDIUM_TERM','LONG_TERM'));
    RAISE NOTICE '000217: CHECK aggiunto su sys_user_target_positions.user_target_position_horizon';
  END IF;
END $$;
