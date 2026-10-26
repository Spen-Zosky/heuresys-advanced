-- ============================================================================
-- PE-4 passo 3b, INVERSA della migrazione 000459 (fuori catena).
--
--   psql -v ON_ERROR_STOP=1 -f db/scripts/pe4-passo3b-inversa.sql
--
-- Toglie la sentinella e il vincolo, e rimette NOT NULL sulla persona SOLO se nessuna riga
-- ha la persona nulla. Se una riga e' nata col solo posto (dopo il passo 3b le regole
-- scrivono solo la posizione), tornare indietro richiede di riempire la persona
-- dall'assegnazione: e' una decisione, quindi l'inversa si RIFIUTA e non tocca niente.
-- Le righe che la 000459 ha riempito o disattivato sui database senza passo 2 stanno nel
-- giornale del passo 2 e si annullano con db/scripts/pe4-passo2-inversa.sql.
-- Per riportare in vigore la catena senza il passo 3b va tolta anche la 000459 dalla catena
-- (o emendata): altrimenti il deploy successivo la riapplica.
-- Idempotente.
-- ============================================================================
BEGIN;
LOCK TABLE sys.sys_process_participants IN SHARE ROW EXCLUSIVE MODE;
DO $$
DECLARE
  v_nulle bigint;
BEGIN
  SELECT count(*) INTO v_nulle FROM sys.sys_process_participants WHERE process_participant_user_id IS NULL;
  IF v_nulle <> 0 THEN
    RAISE EXCEPTION 'pe4-passo3b-inversa: % partecipazioni hanno la persona nulla (nate col solo posto): rimettere NOT NULL richiede di riempirle, mi fermo senza toccare niente', v_nulle;
  END IF;
  DROP VIEW IF EXISTS sys.v_process_participants_active_without_position;
  ALTER TABLE sys.sys_process_participants DROP CONSTRAINT IF EXISTS sys_process_participants_active_has_position;
  ALTER TABLE sys.sys_process_participants ALTER COLUMN process_participant_user_id SET NOT NULL;
  RAISE NOTICE 'pe4-passo3b-inversa: sentinella e vincolo tolti, persona di nuovo obbligatoria.';
END $$;
COMMIT;
