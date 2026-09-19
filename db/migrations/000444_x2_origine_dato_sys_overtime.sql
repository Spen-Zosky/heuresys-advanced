-- 000444_x2_origine_dato_sys_overtime.sql
-- Mandato K, X-2, passo 61. sys_overtime e' classificata IMPORTATO: nessuno scrittore API
-- (grep vuoto su apps/api/src, incluso time-off/repository.ts e compensation/repository.ts,
-- i moduli concettualmente piu' vicini), scritta da db/seeds/storia36/13_avanzamento.sql.
-- DEFAULT 'IMPORT'. Ultima delle 12 tabelle di questa sessione (sys_attendance esclusa,
-- ATTESA_ENZO — esiti/X-2_attendance.md).
--
-- Idempotente. Rollback: nullable + commento "ritirata", mai DROP (ADR-0035).

ALTER TABLE sys.sys_overtime
  ADD COLUMN IF NOT EXISTS origine_dato varchar(32) NOT NULL DEFAULT 'IMPORT';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'sys.sys_overtime'::regclass
       AND conname  = 'sys_overtime_origine_dato_check'
  ) THEN
    ALTER TABLE sys.sys_overtime
      ADD CONSTRAINT sys_overtime_origine_dato_check
      CHECK (origine_dato IN ('IMPORT', 'NATIVO', 'MATERIALIZZAZIONE'));
  END IF;
END $$;

COMMENT ON COLUMN sys.sys_overtime.origine_dato IS
  'I23/X-2 (mandato K, mig 000444): IMPORT = da corsa di importazione/materializzazione; NATIVO = da rotta API (oggi non esiste). Nessuno scrittore applicativo su questa tabella, verificato S1112.';

DO $$
DECLARE
  v_righe   integer;
  v_valori  integer;
BEGIN
  SELECT count(*) INTO v_righe FROM sys.sys_overtime;
  SELECT count(DISTINCT origine_dato) INTO v_valori FROM sys.sys_overtime;
  IF v_valori > 1 THEN
    RAISE EXCEPTION '000444: sys_overtime ha % valori distinti di origine_dato, atteso 1', v_valori;
  END IF;
  RAISE NOTICE '000444 OK — sys_overtime: % righe, origine_dato uniforme', v_righe;
END $$;

-- FINE 000444
