-- 000439_x2_origine_dato_sys_leave_balance_transactions.sql
-- Mandato K, X-2, passo 61. sys_leave_balance_transactions e' classificata NATIVA da X-1
-- (insertUsageTransaction esiste in apps/api/src/modules/time-off/repository.ts), ma
-- verificato sul vivo (S1112): TUTTE le 20 righe esistenti hanno transaction_natural_key
-- diverso da 'LBT::APPROVAL::%' — zero righe native reali oggi, tutte da seed. Per "dire il
-- vero" (lo stesso principio che il mandato applica esplicitamente a D6) il DEFAULT segue le
-- righe di oggi, non l'etichetta concettuale della tabella: 'IMPORT', non 'NATIVO'.
--
-- Idempotente. Rollback: nullable + commento "ritirata", mai DROP (ADR-0035).

ALTER TABLE sys.sys_leave_balance_transactions
  ADD COLUMN IF NOT EXISTS origine_dato varchar(32) NOT NULL DEFAULT 'IMPORT';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'sys.sys_leave_balance_transactions'::regclass
       AND conname  = 'sys_leave_balance_transactions_origine_dato_check'
  ) THEN
    ALTER TABLE sys.sys_leave_balance_transactions
      ADD CONSTRAINT sys_leave_balance_transactions_origine_dato_check
      CHECK (origine_dato IN ('IMPORT', 'NATIVO', 'MATERIALIZZAZIONE'));
  END IF;
END $$;

COMMENT ON COLUMN sys.sys_leave_balance_transactions.origine_dato IS
  'I23/X-2 (mandato K, mig 000439): IMPORT = da corsa di importazione/materializzazione; NATIVO = scritta da insertUsageTransaction (rotta API). Verificato S1112: 0/20 righe esistenti sono native, nonostante la classificazione X-1 dica "nativo" per il pattern concettuale — dire il vero sulle righe vince sull''etichetta.';

DO $$
DECLARE
  v_righe   integer;
  v_valori  integer;
BEGIN
  SELECT count(*) INTO v_righe FROM sys.sys_leave_balance_transactions;
  SELECT count(DISTINCT origine_dato) INTO v_valori FROM sys.sys_leave_balance_transactions;
  IF v_valori > 1 THEN
    RAISE EXCEPTION '000439: sys_leave_balance_transactions ha % valori distinti di origine_dato, atteso 1', v_valori;
  END IF;
  RAISE NOTICE '000439 OK — sys_leave_balance_transactions: % righe, origine_dato uniforme', v_righe;
END $$;
