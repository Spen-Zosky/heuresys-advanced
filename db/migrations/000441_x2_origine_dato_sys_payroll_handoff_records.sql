-- 000441_x2_origine_dato_sys_payroll_handoff_records.sql
-- Mandato K, X-2, passo 61. sys_payroll_handoff_records e' IBRIDA: lo scrittore nativo e'
-- insertPayrollHandoffRecord (apps/api/src/modules/compensation/repository.ts). Le 37 righe
-- esistenti sono scritte da db/seeds/storia36/03_compensation.sql (recipient_system=
-- 'ZUCCHETTI_PAGHE' e' il destinatario dell'handoff, non la fonte della riga: non e' un
-- indicatore di origine). DEFAULT 'IMPORT': dire il vero, zero righe native reali oggi.
--
-- Idempotente. Rollback: nullable + commento "ritirata", mai DROP (ADR-0035).

ALTER TABLE sys.sys_payroll_handoff_records
  ADD COLUMN IF NOT EXISTS origine_dato varchar(32) NOT NULL DEFAULT 'IMPORT';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'sys.sys_payroll_handoff_records'::regclass
       AND conname  = 'sys_payroll_handoff_records_origine_dato_check'
  ) THEN
    ALTER TABLE sys.sys_payroll_handoff_records
      ADD CONSTRAINT sys_payroll_handoff_records_origine_dato_check
      CHECK (origine_dato IN ('IMPORT', 'NATIVO', 'MATERIALIZZAZIONE'));
  END IF;
END $$;

COMMENT ON COLUMN sys.sys_payroll_handoff_records.origine_dato IS
  'I23/X-2 (mandato K, mig 000441): IMPORT = da corsa di importazione/materializzazione; NATIVO = scritta da insertPayrollHandoffRecord (rotta API). Il recipient_system (es. ZUCCHETTI_PAGHE) e'' il destinatario dell''handoff, non indica l''origine della riga.';

DO $$
DECLARE
  v_righe   integer;
  v_valori  integer;
BEGIN
  SELECT count(*) INTO v_righe FROM sys.sys_payroll_handoff_records;
  SELECT count(DISTINCT origine_dato) INTO v_valori FROM sys.sys_payroll_handoff_records;
  IF v_valori > 1 THEN
    RAISE EXCEPTION '000441: sys_payroll_handoff_records ha % valori distinti di origine_dato, atteso 1', v_valori;
  END IF;
  RAISE NOTICE '000441 OK — sys_payroll_handoff_records: % righe, origine_dato uniforme', v_righe;
END $$;

-- FINE 000441
