-- ============================================================================
-- PE-4 passo 3, INVERSA delle regole (fuori catena): annulla le corse di
-- db/scripts/pe4-passo3-regole.sql leggendo staging.process_participants_regole_undo.
--
--   psql -v ON_ERROR_STOP=1 -f db/scripts/pe4-passo3-regole-inversa.sql
--
-- Dalla voce piu' recente alla piu' vecchia, per ogni voce non ancora annullata:
--   PROMUOVI / RIATTIVA -> ruolo, stato attivo, metadati e updated_at tornano quelli di prima;
--   INSERISCI           -> la riga inserita si DISATTIVA (non si cancella: la regola del
--                          progetto e' che non si cancella; resta come storia, e una nuova
--                          passata delle regole la riattiva invece di inserirne un'altra).
-- Il giornale non si svuota: ogni voce riceve annullato_il.
--
-- GUARDIA: una voce si annulla solo se la riga e' ancora come la corsa l'aveva lasciata
-- (attiva, con metadata.derived_run = la corsa). Se qualcuno l'ha toccata ci si ferma.
-- POST-CONDIZIONI: nessuna riga attiva porta piu' un derived_run annullato; le righe
-- promosse o riattivate sono tornate identiche al «prima» del giornale.
-- Idempotente: senza voci aperte non fa niente.
-- ============================================================================
BEGIN;
LOCK TABLE sys.sys_process_participants IN SHARE ROW EXCLUSIVE MODE;
DO $$
DECLARE
  voce record;
  v_voci bigint := 0;
  v_resti bigint;
BEGIN
  IF to_regclass('staging.process_participants_regole_undo') IS NULL THEN
    RAISE NOTICE 'pe4-passo3-regole-inversa: nessun giornale, niente da annullare.';
    RETURN;
  END IF;
  FOR voce IN SELECT * FROM staging.process_participants_regole_undo
               WHERE annullato_il IS NULL ORDER BY undo_id DESC LOOP
    IF voce.azione = 'INSERISCI' THEN
      UPDATE sys.sys_process_participants pp
         SET process_participant_is_active = false, updated_at = greatest(now(), pp.created_at)
       WHERE pp.process_participant_id = voce.process_participant_id
         AND pp.process_participant_is_active
         AND pp.process_participant_metadata->>'derived_run' = voce.run_id::text;
    ELSE
      UPDATE sys.sys_process_participants pp
         SET process_participant_role      = voce.role_prima,
             process_participant_is_active = voce.is_active_prima,
             process_participant_metadata  = voce.metadata_prima,
             updated_at                    = voce.updated_at_prima
       WHERE pp.process_participant_id = voce.process_participant_id
         AND pp.process_participant_is_active
         AND pp.process_participant_metadata->>'derived_run' = voce.run_id::text;
    END IF;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'pe4-passo3-regole-inversa: la riga % non e'' piu'' come la corsa % l''aveva lasciata: mi fermo',
        voce.process_participant_id, voce.run_id;
    END IF;
    UPDATE staging.process_participants_regole_undo SET annullato_il = clock_timestamp()
     WHERE undo_id = voce.undo_id;
    v_voci := v_voci + 1;
  END LOOP;

  SELECT count(*) INTO v_resti
    FROM sys.sys_process_participants pp
   WHERE pp.process_participant_is_active
     AND pp.process_participant_metadata->>'derived_run' IN (
       SELECT run_id::text FROM staging.process_participants_regole_undo WHERE annullato_il IS NOT NULL);
  IF v_resti <> 0 THEN
    RAISE EXCEPTION 'pe4-passo3-regole-inversa: % righe attive portano ancora una corsa annullata', v_resti;
  END IF;
  SELECT count(*) INTO v_resti
    FROM staging.process_participants_regole_undo u
    JOIN sys.sys_process_participants pp ON pp.process_participant_id = u.process_participant_id
   WHERE u.annullato_il IS NOT NULL AND u.azione IN ('PROMUOVI', 'RIATTIVA')
     AND u.undo_id = (SELECT min(u2.undo_id) FROM staging.process_participants_regole_undo u2
                       WHERE u2.process_participant_id = u.process_participant_id)
     AND (pp.process_participant_role IS DISTINCT FROM u.role_prima
          OR pp.process_participant_is_active IS DISTINCT FROM u.is_active_prima
          OR pp.process_participant_metadata IS DISTINCT FROM u.metadata_prima
          OR pp.updated_at IS DISTINCT FROM u.updated_at_prima);
  IF v_resti <> 0 THEN
    RAISE EXCEPTION 'pe4-passo3-regole-inversa: % righe non tornate allo stato di prima', v_resti;
  END IF;
  RAISE NOTICE 'pe4-passo3-regole-inversa: % voci del giornale annullate.', v_voci;
END $$;
COMMIT;
