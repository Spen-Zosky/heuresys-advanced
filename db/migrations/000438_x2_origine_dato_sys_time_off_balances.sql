-- 000438_x2_origine_dato_sys_time_off_balances.sql
-- Mandato K, X-2, passo 61. sys_time_off_balances e' IBRIDA: applyUsageToBalance
-- (apps/api/src/modules/time-off/repository.ts) e' lo scrittore nativo (UPDATE del saldo
-- usato), gli script storia36/rtl-rebuild sono gli scrittori di importazione/materializzazione
-- dei saldi iniziali. DEFAULT 'IMPORT': dire il vero, tutte le righe di oggi vengono da seed.
--
-- Idempotente. Rollback: nullable + commento "ritirata", mai DROP (ADR-0035).

ALTER TABLE sys.sys_time_off_balances
  ADD COLUMN IF NOT EXISTS origine_dato varchar(16) NOT NULL DEFAULT 'IMPORT';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'sys.sys_time_off_balances'::regclass
       AND conname  = 'sys_time_off_balances_origine_dato_check'
  ) THEN
    ALTER TABLE sys.sys_time_off_balances
      ADD CONSTRAINT sys_time_off_balances_origine_dato_check
      CHECK (origine_dato IN ('IMPORT', 'NATIVO', 'MATERIALIZZAZIONE'));
  END IF;
END $$;

COMMENT ON COLUMN sys.sys_time_off_balances.origine_dato IS
  'I23/X-2 (mandato K, mig 000438): IMPORT = saldo iniziale da corsa di importazione/materializzazione; NATIVO = saldo nato da un gesto di people management. Oggi tutte IMPORT.';

DO $$
DECLARE
  v_righe   integer;
  v_valori  integer;
BEGIN
  SELECT count(*) INTO v_righe FROM sys.sys_time_off_balances;
  SELECT count(DISTINCT origine_dato) INTO v_valori FROM sys.sys_time_off_balances;
  IF v_valori > 1 THEN
    RAISE EXCEPTION '000438: sys_time_off_balances ha % valori distinti di origine_dato, atteso 1', v_valori;
  END IF;
  RAISE NOTICE '000438 OK — sys_time_off_balances: % righe, origine_dato uniforme', v_righe;
END $$;
