-- 000442_x2_origine_dato_sys_leave_accrual_rules.sql
-- Mandato K, X-2, passo 61. sys_leave_accrual_rules e' classificata IMPORTATO: nessuno
-- scrittore API (grep vuoto su apps/api/src), scritta da script di seed adiacenti a
-- storia36. DEFAULT 'IMPORT'.
--
-- Idempotente. Rollback: nullable + commento "ritirata", mai DROP (ADR-0035).

ALTER TABLE sys.sys_leave_accrual_rules
  ADD COLUMN IF NOT EXISTS origine_dato varchar(32) NOT NULL DEFAULT 'IMPORT';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'sys.sys_leave_accrual_rules'::regclass
       AND conname  = 'sys_leave_accrual_rules_origine_dato_check'
  ) THEN
    ALTER TABLE sys.sys_leave_accrual_rules
      ADD CONSTRAINT sys_leave_accrual_rules_origine_dato_check
      CHECK (origine_dato IN ('IMPORT', 'NATIVO', 'MATERIALIZZAZIONE'));
  END IF;
END $$;

COMMENT ON COLUMN sys.sys_leave_accrual_rules.origine_dato IS
  'I23/X-2 (mandato K, mig 000442): IMPORT = da corsa di importazione/materializzazione; NATIVO = da rotta API (oggi non esiste). Nessuno scrittore applicativo su questa tabella, verificato S1112.';

DO $$
DECLARE
  v_righe   integer;
  v_valori  integer;
BEGIN
  SELECT count(*) INTO v_righe FROM sys.sys_leave_accrual_rules;
  SELECT count(DISTINCT origine_dato) INTO v_valori FROM sys.sys_leave_accrual_rules;
  IF v_valori > 1 THEN
    RAISE EXCEPTION '000442: sys_leave_accrual_rules ha % valori distinti di origine_dato, atteso 1', v_valori;
  END IF;
  RAISE NOTICE '000442 OK — sys_leave_accrual_rules: % righe, origine_dato uniforme', v_righe;
END $$;

-- FINE 000442
