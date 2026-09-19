-- 000434_x2_origine_dato_sys_user_pay_slips.sql
-- Mandato K, X-2, passo 61. sys_user_pay_slips e' una delle quattro tabelle di D6 (buste
-- paga): dichiarata "importata, porta non ancora costruita" (D6=A). Nessuna interfaccia
-- API scrive su questa tabella. DEFAULT 'MATERIALIZZAZIONE' (seminata dal collaudo, dire il
-- vero). Chi la sorveglia (docs/kb/tools/chi_sorveglia.py sys_user_pay_slips, misurato
-- S1112): 3 sentinelle BLOCCANTI (v_busta_paga_periodo_malformato, v_history_cascade_to_users,
-- v_payslip_contract_mismatch) — nessuna guarda origine_dato, un ADD COLUMN additivo non le
-- tocca; 4 test la asseriscono; una decina di script di seed la scrivono, nessuno da
-- modificare perche' tutti ricadono nel DEFAULT.
--
-- Idempotente. Rollback: nullable + commento "ritirata", mai DROP (ADR-0035).

ALTER TABLE sys.sys_user_pay_slips
  ADD COLUMN IF NOT EXISTS origine_dato varchar(16) NOT NULL DEFAULT 'MATERIALIZZAZIONE';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'sys.sys_user_pay_slips'::regclass
       AND conname  = 'sys_user_pay_slips_origine_dato_check'
  ) THEN
    ALTER TABLE sys.sys_user_pay_slips
      ADD CONSTRAINT sys_user_pay_slips_origine_dato_check
      CHECK (origine_dato IN ('IMPORT', 'NATIVO', 'MATERIALIZZAZIONE'));
  END IF;
END $$;

COMMENT ON COLUMN sys.sys_user_pay_slips.origine_dato IS
  'I23/X-2 (mandato K, mig 000434): IMPORT = da sistema esterno reale; NATIVO = da rotta API di people management; MATERIALIZZAZIONE = seminata dal collaudo, D6=A. Oggi tutte MATERIALIZZAZIONE.';

DO $$
DECLARE
  v_righe   integer;
  v_valori  integer;
BEGIN
  SELECT count(*) INTO v_righe FROM sys.sys_user_pay_slips;
  SELECT count(DISTINCT origine_dato) INTO v_valori FROM sys.sys_user_pay_slips;
  IF v_valori > 1 THEN
    RAISE EXCEPTION '000434: sys_user_pay_slips ha % valori distinti di origine_dato, atteso 1', v_valori;
  END IF;
  RAISE NOTICE '000434 OK — sys_user_pay_slips: % righe, origine_dato uniforme', v_righe;
END $$;
