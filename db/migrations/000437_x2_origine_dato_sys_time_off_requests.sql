-- 000437_x2_origine_dato_sys_time_off_requests.sql
-- Mandato K, X-2, passo 61. sys_time_off_requests e' classificata IBRIDA (ha uno scrittore
-- nativo, insertApprovedTimeOffRequest in apps/api/src/modules/time-off/repository.ts, E
-- scrittori di importazione/materializzazione). Verificato sul vivo (S1112): TUTTE le 2.213
-- righe esistenti hanno request_natural_key diverso da 'TOR::APPROVAL::%' (la marca dello
-- scrittore nativo) — zero righe native reali oggi. DEFAULT 'IMPORT': dire il vero sulle
-- righe di oggi, non sulla classificazione concettuale.
--
-- Lo scrittore nativo (insertApprovedTimeOffRequest) viene aggiornato in un commit separato
-- di questa stessa sessione per scrivere origine_dato='NATIVO' esplicitamente sulle righe
-- future (dettaglio in esiti/X-2_tabelle.md).
--
-- Idempotente. Rollback: nullable + commento "ritirata", mai DROP (ADR-0035).

ALTER TABLE sys.sys_time_off_requests
  ADD COLUMN IF NOT EXISTS origine_dato varchar(32) NOT NULL DEFAULT 'IMPORT';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'sys.sys_time_off_requests'::regclass
       AND conname  = 'sys_time_off_requests_origine_dato_check'
  ) THEN
    ALTER TABLE sys.sys_time_off_requests
      ADD CONSTRAINT sys_time_off_requests_origine_dato_check
      CHECK (origine_dato IN ('IMPORT', 'NATIVO', 'MATERIALIZZAZIONE'));
  END IF;
END $$;

COMMENT ON COLUMN sys.sys_time_off_requests.origine_dato IS
  'I23/X-2 (mandato K, mig 000437): IMPORT = da corsa di importazione/materializzazione; NATIVO = scritta da insertApprovedTimeOffRequest (rotta API, gesto di people management). Verificato S1112: 0/2213 righe esistenti sono native.';

DO $$
DECLARE
  v_righe   integer;
  v_valori  integer;
BEGIN
  SELECT count(*) INTO v_righe FROM sys.sys_time_off_requests;
  SELECT count(DISTINCT origine_dato) INTO v_valori FROM sys.sys_time_off_requests;
  IF v_valori > 1 THEN
    RAISE EXCEPTION '000437: sys_time_off_requests ha % valori distinti di origine_dato, atteso 1', v_valori;
  END IF;
  RAISE NOTICE '000437 OK — sys_time_off_requests: % righe, origine_dato uniforme', v_righe;
END $$;

-- FINE 000437
