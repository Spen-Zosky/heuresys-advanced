-- 000440_x2_origine_dato_sys_compensation_recommendations.sql
-- Mandato K, X-2, passo 61. sys_compensation_recommendations e' IBRIDA: lo scrittore nativo
-- e' insertCompensationRecommendation (apps/api/src/modules/compensation/repository.ts).
-- Verificato sul vivo (S1112): tutte le 116 righe esistenti condividono lo STESSO identico
-- created_at (2026-06-03 20:58:38.829941) — impossibile da chiamate API indipendenti, e'
-- l'impronta di un batch (db/seeds/reconciliation/25_compensation_recommendations.sql).
-- DEFAULT 'IMPORT': dire il vero, zero righe native reali oggi.
--
-- Idempotente. Rollback: nullable + commento "ritirata", mai DROP (ADR-0035).

ALTER TABLE sys.sys_compensation_recommendations
  ADD COLUMN IF NOT EXISTS origine_dato varchar(32) NOT NULL DEFAULT 'IMPORT';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'sys.sys_compensation_recommendations'::regclass
       AND conname  = 'sys_compensation_recommendations_origine_dato_check'
  ) THEN
    ALTER TABLE sys.sys_compensation_recommendations
      ADD CONSTRAINT sys_compensation_recommendations_origine_dato_check
      CHECK (origine_dato IN ('IMPORT', 'NATIVO', 'MATERIALIZZAZIONE'));
  END IF;
END $$;

COMMENT ON COLUMN sys.sys_compensation_recommendations.origine_dato IS
  'I23/X-2 (mandato K, mig 000440): IMPORT = da corsa di importazione/materializzazione (batch, stesso created_at su tutte le righe di oggi); NATIVO = scritta da insertCompensationRecommendation (rotta API).';

DO $$
DECLARE
  v_righe   integer;
  v_valori  integer;
BEGIN
  SELECT count(*) INTO v_righe FROM sys.sys_compensation_recommendations;
  SELECT count(DISTINCT origine_dato) INTO v_valori FROM sys.sys_compensation_recommendations;
  IF v_valori > 1 THEN
    RAISE EXCEPTION '000440: sys_compensation_recommendations ha % valori distinti di origine_dato, atteso 1', v_valori;
  END IF;
  RAISE NOTICE '000440 OK — sys_compensation_recommendations: % righe, origine_dato uniforme', v_righe;
END $$;
