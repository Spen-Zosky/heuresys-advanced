-- 000435_x2_origine_dato_sys_user_identity_documents.sql
-- Mandato K, X-2, passo 61. sys_user_identity_documents e' una delle quattro tabelle di D6
-- (documenti d'identita'): "importata, porta non ancora costruita" (D6=A). Nessuna interfaccia
-- API scrive su questa tabella. DEFAULT 'MATERIALIZZAZIONE' (seminata dal collaudo).
--
-- Idempotente. Rollback: nullable + commento "ritirata", mai DROP (ADR-0035).

ALTER TABLE sys.sys_user_identity_documents
  ADD COLUMN IF NOT EXISTS origine_dato varchar(32) NOT NULL DEFAULT 'MATERIALIZZAZIONE';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'sys.sys_user_identity_documents'::regclass
       AND conname  = 'sys_user_identity_documents_origine_dato_check'
  ) THEN
    ALTER TABLE sys.sys_user_identity_documents
      ADD CONSTRAINT sys_user_identity_documents_origine_dato_check
      CHECK (origine_dato IN ('IMPORT', 'NATIVO', 'MATERIALIZZAZIONE'));
  END IF;
END $$;

COMMENT ON COLUMN sys.sys_user_identity_documents.origine_dato IS
  'I23/X-2 (mandato K, mig 000435): IMPORT = da sistema esterno reale; NATIVO = da rotta API di people management; MATERIALIZZAZIONE = seminata dal collaudo, D6=A. Oggi tutte MATERIALIZZAZIONE.';

DO $$
DECLARE
  v_righe   integer;
  v_valori  integer;
BEGIN
  SELECT count(*) INTO v_righe FROM sys.sys_user_identity_documents;
  SELECT count(DISTINCT origine_dato) INTO v_valori FROM sys.sys_user_identity_documents;
  IF v_valori > 1 THEN
    RAISE EXCEPTION '000435: sys_user_identity_documents ha % valori distinti di origine_dato, atteso 1', v_valori;
  END IF;
  RAISE NOTICE '000435 OK — sys_user_identity_documents: % righe, origine_dato uniforme', v_righe;
END $$;
