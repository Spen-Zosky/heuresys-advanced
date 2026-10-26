-- ============================================================================
-- PE-4 passo 3b, INVERSA di D-P3-2 (fuori catena): riattiva le righe disattivate da
-- db/scripts/pe4-passo3b-disattiva.sql, leggendo staging.process_participants_disattiva_undo.
--
--   psql -v ON_ERROR_STOP=1 -f db/scripts/pe4-passo3b-disattiva-inversa.sql
--
-- ATTENZIONE: va lanciata PRIMA dell'inversa della migrazione del passo 3b solo se il vincolo
-- non c'e' piu'; con il vincolo in piedi la riattivazione di righe con posizione e' ammessa
-- (hanno la posizione), quindi l'ordine non e' vincolante.
-- GUARDIA: una voce si annulla solo se la riga e' ancora disattivata con la stessa posizione.
-- Il giornale non si svuota (annullato_il). Idempotente.
-- ============================================================================
BEGIN;
LOCK TABLE sys.sys_process_participants IN SHARE ROW EXCLUSIVE MODE;
DO $$
DECLARE
  voce record;
  v_voci bigint := 0;
BEGIN
  IF to_regclass('staging.process_participants_disattiva_undo') IS NULL THEN
    RAISE NOTICE 'pe4-passo3b-disattiva-inversa: nessun giornale, niente da annullare.';
    RETURN;
  END IF;
  FOR voce IN SELECT * FROM staging.process_participants_disattiva_undo
               WHERE annullato_il IS NULL ORDER BY undo_id DESC LOOP
    UPDATE sys.sys_process_participants pp
       SET process_participant_is_active = true, updated_at = voce.updated_at_prima
     WHERE pp.process_participant_id = voce.process_participant_id
       AND NOT pp.process_participant_is_active
       AND pp.process_participant_position_id = voce.position_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'pe4-passo3b-disattiva-inversa: la riga % non e'' piu'' come la corsa % l''aveva lasciata: mi fermo',
        voce.process_participant_id, voce.run_id;
    END IF;
    UPDATE staging.process_participants_disattiva_undo SET annullato_il = clock_timestamp()
     WHERE undo_id = voce.undo_id;
    v_voci := v_voci + 1;
  END LOOP;
  RAISE NOTICE 'pe4-passo3b-disattiva-inversa: % voci annullate.', v_voci;
END $$;
COMMIT;
