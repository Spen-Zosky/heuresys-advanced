-- 000436_x2_origine_dato_sys_position_compensation_profiles.sql
-- Mandato K, X-2, passo 61. sys_position_compensation_profiles e' una delle quattro tabelle
-- di D6 (profili retributivi di posizione): "importata, porta non ancora costruita" (D6=A).
-- DEFAULT 'MATERIALIZZAZIONE'. Nota: db/seeds/storia36/03_compensation.sql fa UPDATE su
-- questa tabella (non solo INSERT) — l'UPDATE non tocca origine_dato, che resta il default
-- della riga gia' scritta al momento dell'INSERT originale.
--
-- Idempotente. Rollback: nullable + commento "ritirata", mai DROP (ADR-0035).

ALTER TABLE sys.sys_position_compensation_profiles
  ADD COLUMN IF NOT EXISTS origine_dato varchar(32) NOT NULL DEFAULT 'MATERIALIZZAZIONE';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'sys.sys_position_compensation_profiles'::regclass
       AND conname  = 'sys_position_compensation_profiles_origine_dato_check'
  ) THEN
    ALTER TABLE sys.sys_position_compensation_profiles
      ADD CONSTRAINT sys_position_compensation_profiles_origine_dato_check
      CHECK (origine_dato IN ('IMPORT', 'NATIVO', 'MATERIALIZZAZIONE'));
  END IF;
END $$;

COMMENT ON COLUMN sys.sys_position_compensation_profiles.origine_dato IS
  'I23/X-2 (mandato K, mig 000436): IMPORT = da sistema esterno reale; NATIVO = da rotta API di people management; MATERIALIZZAZIONE = seminata dal collaudo, D6=A. Oggi tutte MATERIALIZZAZIONE.';

DO $$
DECLARE
  v_righe   integer;
  v_valori  integer;
BEGIN
  SELECT count(*) INTO v_righe FROM sys.sys_position_compensation_profiles;
  SELECT count(DISTINCT origine_dato) INTO v_valori FROM sys.sys_position_compensation_profiles;
  IF v_valori > 1 THEN
    RAISE EXCEPTION '000436: sys_position_compensation_profiles ha % valori distinti di origine_dato, atteso 1', v_valori;
  END IF;
  RAISE NOTICE '000436 OK — sys_position_compensation_profiles: % righe, origine_dato uniforme', v_righe;
END $$;

-- FINE 000436
