-- ============================================================================
-- PE-4 passo 1, INVERSA (fuori catena): toglie la colonna della posizione dalle
-- partecipazioni ai processi (ADR-0044). Non e' una migrazione: non gira al deploy.
--
-- Uso (su una copia o dove deciso dall'Amministratore di Sistema):
--   psql -v ON_ERROR_STOP=1 -f db/scripts/pe4-passo1-inversa.sql
--
-- GUARDIA: si rifiuta se la colonna contiene valori. Prima va applicata
-- l'inversa del passo 2 (db/scripts/pe4-passo2-inversa.sql): cosi' non si perde
-- nulla. Idempotente: se la colonna non c'e' non fa niente.
--
-- Se la catena viene riapplicata con 000457 ancora presente, la colonna ritorna:
-- l'inversa vale insieme al ritiro del file 000457 (ADR-0035).
-- ============================================================================
BEGIN;
DO $$
DECLARE v_valori bigint;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_schema = 'sys' AND table_name = 'sys_process_participants'
                AND column_name = 'process_participant_position_id') THEN
    EXECUTE 'SELECT count(*) FROM sys.sys_process_participants WHERE process_participant_position_id IS NOT NULL'
       INTO v_valori;
    IF v_valori <> 0 THEN
      RAISE EXCEPTION 'pe4-passo1-inversa: la colonna contiene % valori; applica prima pe4-passo2-inversa.sql', v_valori;
    END IF;
  END IF;
END $$;
DROP INDEX IF EXISTS sys.sys_process_participants_process_position_uq;
DROP INDEX IF EXISTS sys.sys_process_participants_position_idx;
ALTER TABLE sys.sys_process_participants DROP CONSTRAINT IF EXISTS sys_process_participants_position_fk;
ALTER TABLE sys.sys_process_participants DROP COLUMN IF EXISTS process_participant_position_id;
COMMIT;
