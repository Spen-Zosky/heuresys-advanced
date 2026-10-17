-- ============================================================================
-- PE-4 passo 2, INVERSA (fuori catena): riporta le partecipazioni allo stato di prima
-- del riempimento, leggendo il giornale staging.process_participants_position_undo.
--
--   psql -v ON_ERROR_STOP=1 -f db/scripts/pe4-passo2-inversa.sql
--
-- Ripristina posizione, stato attivo e updated_at di ogni riga del giornale non ancora
-- annullata, dalla piu' recente alla piu' vecchia. Il giornale NON si svuota: ogni voce
-- riceve annullato_il. Il registro dei dubbi passa a ANNULLATO.
--
-- GUARDIA: una riga del giornale si annulla solo se la riga e' ancora come la corsa
-- l'aveva lasciata (posizione e stato attivo "dopo"). Se qualcuno l'ha toccata nel
-- frattempo ci si ferma: non si sovrascrive un cambiamento che il giornale non conosce.
-- POST-CONDIZIONE: dopo l'inversa nessuna riga del giornale ha ancora il valore "dopo"
-- diverso dal "prima"; il numero di righe e' invariato.
-- Idempotente: senza voci aperte non fa niente.
-- ============================================================================
BEGIN;
LOCK TABLE sys.sys_process_participants IN SHARE ROW EXCLUSIVE MODE;
DO $$
DECLARE
  voce record;
  v_n_pre bigint;
  v_voci bigint := 0;
  v_diverse bigint;
BEGIN
  SELECT count(*) INTO v_n_pre FROM sys.sys_process_participants;
  FOR voce IN SELECT * FROM staging.process_participants_position_undo
            WHERE annullato_il IS NULL ORDER BY undo_id DESC LOOP
    UPDATE sys.sys_process_participants pp
       SET process_participant_position_id = voce.position_id_prima,
           process_participant_is_active   = voce.is_active_prima,
           updated_at                      = voce.updated_at_prima
     WHERE pp.process_participant_id = voce.process_participant_id
       AND pp.process_participant_position_id IS NOT DISTINCT FROM voce.position_id_dopo
       AND pp.process_participant_is_active = voce.is_active_dopo;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'pe4-passo2-inversa: la riga % non e'' piu'' come la corsa % l''aveva lasciata: mi fermo',
        voce.process_participant_id, voce.run_id;
    END IF;
    UPDATE staging.process_participants_position_undo SET annullato_il = clock_timestamp()
     WHERE undo_id = voce.undo_id;
    v_voci := v_voci + 1;
  END LOOP;

  UPDATE staging.process_participants_dubbi SET esito = 'ANNULLATO' WHERE esito <> 'ANNULLATO';

  IF (SELECT count(*) FROM sys.sys_process_participants) <> v_n_pre THEN
    RAISE EXCEPTION 'pe4-passo2-inversa: il numero di partecipazioni e'' cambiato';
  END IF;
  SELECT count(*) INTO v_diverse
    FROM staging.process_participants_position_undo u
    JOIN sys.sys_process_participants pp ON pp.process_participant_id = u.process_participant_id
   WHERE u.annullato_il IS NOT NULL
     AND (pp.process_participant_position_id IS DISTINCT FROM u.position_id_prima
          OR pp.process_participant_is_active <> u.is_active_prima);
  IF v_diverse <> 0 THEN
    RAISE EXCEPTION 'pe4-passo2-inversa: % righe non tornate allo stato di prima', v_diverse;
  END IF;
  RAISE NOTICE 'pe4-passo2-inversa: % voci del giornale annullate.', v_voci;
END $$;
COMMIT;
