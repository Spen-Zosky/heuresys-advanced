-- 000240_remove_probe_rows_from_terminal_table.sql
--
-- Tre righe di prova dimenticate in una tabella dichiarata terminale NO_SOURCE.
--
-- `sys.sys_reward_gate_results` e' una delle tabelle che il registro di
-- riconciliazione dichiara **terminali NO_SOURCE**: nessuna sorgente legacy
-- importabile, e le uniche righe legittime sono le derivazioni storia36, che
-- portano il marcatore `payload->>'storia36'`. Su 3.286 righe, 3 ne erano prive:
--
--   2026-08-02 01:35:37  {"prova": "verifica motore #37"}
--   2026-08-02 01:35:38  {"prova": "verifica motore #37"}
--   2026-08-02 01:35:38  {"prova": "ripristino dopo verifica motore #37"}
--
-- Sono i residui di una verifica manuale condotta in un'altra sessione e mai
-- ripulita. Il test `reconciliation-registry` le segnalava gia' — «un import ha
-- invaso una tabella dichiarata NO_SOURCE» — ed era rosso da prima della
-- sessione che scrive questa migrazione. Non e' una scusa per lasciarlo rosso:
-- una prova che nessuno ripulisce diventa indistinguibile da un dato vero.
--
-- Il criterio e' l'assenza del marcatore su una tabella terminale, non l'elenco
-- dei tre identificativi: cosi' la migrazione resta corretta se un'altra prova
-- dimenticata compare prima che questa venga applicata su un clone.
BEGIN;

DO $$
DECLARE v_rimosse bigint;
BEGIN
  DELETE FROM sys.sys_reward_gate_results
   WHERE reward_gate_result_payload->>'storia36' IS NULL;
  GET DIAGNOSTICS v_rimosse = ROW_COUNT;
  RAISE NOTICE '000240: rimosse % righe prive del marcatore storia36 da '
               'sys_reward_gate_results (tabella terminale NO_SOURCE).', v_rimosse;
END $$;

COMMIT;
