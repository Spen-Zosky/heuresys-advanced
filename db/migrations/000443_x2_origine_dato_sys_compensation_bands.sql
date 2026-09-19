-- 000443_x2_origine_dato_sys_compensation_bands.sql
-- Mandato K, X-2, passo 61. sys_compensation_bands e' classificata IMPORTATO: nessuno
-- scrittore API (grep vuoto su apps/api/src), scritta da db/seeds/rtl-rebuild/05_compensation.sql.
-- DEFAULT 'IMPORT'.
--
-- Idempotente. Rollback: nullable + commento "ritirata", mai DROP (ADR-0035).

ALTER TABLE sys.sys_compensation_bands
  ADD COLUMN IF NOT EXISTS origine_dato varchar(32) NOT NULL DEFAULT 'IMPORT';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'sys.sys_compensation_bands'::regclass
       AND conname  = 'sys_compensation_bands_origine_dato_check'
  ) THEN
    ALTER TABLE sys.sys_compensation_bands
      ADD CONSTRAINT sys_compensation_bands_origine_dato_check
      CHECK (origine_dato IN ('IMPORT', 'NATIVO', 'MATERIALIZZAZIONE'));
  END IF;
END $$;

COMMENT ON COLUMN sys.sys_compensation_bands.origine_dato IS
  'I23/X-2 (mandato K, mig 000443): IMPORT = da corsa di importazione/materializzazione; NATIVO = da rotta API (oggi non esiste). Nessuno scrittore applicativo su questa tabella, verificato S1112.';

DO $$
DECLARE
  v_righe   integer;
  v_valori  integer;
BEGIN
  SELECT count(*) INTO v_righe FROM sys.sys_compensation_bands;
  SELECT count(DISTINCT origine_dato) INTO v_valori FROM sys.sys_compensation_bands;
  IF v_valori > 1 THEN
    RAISE EXCEPTION '000443: sys_compensation_bands ha % valori distinti di origine_dato, atteso 1', v_valori;
  END IF;
  RAISE NOTICE '000443 OK — sys_compensation_bands: % righe, origine_dato uniforme', v_righe;
END $$;
