-- ============================================================================
-- PE-4 passo 3b, D-P3-2 (ADR-0044; decisione dell'Amministratore di Sistema del 2026-10-26):
-- le partecipazioni ATTIVE su posizioni DISATTIVATE si disattivano. Non si cancella niente.
-- FUORI CATENA: si lancia a mano, PRIMA della migrazione del passo 3b:
--
--   psql -v ON_ERROR_STOP=1 -f db/scripts/pe4-passo3b-disattiva.sql
--
-- Una posizione disattivata non e' un posto da cui si partecipa: con le letture del passo 3a
-- queste righe non danno gia' nessuna persona, quindi la disattivazione non toglie
-- visibilita' a nessuno; rende vero sul dato cio' che le letture gia' dicono.
--
-- GUARDIA: l'elenco si calcola QUI, nella stessa transazione, con la tabella bloccata.
-- GIORNALE: staging.process_participants_disattiva_undo. INVERSA: pe4-passo3b-disattiva-inversa.sql.
-- POST-CONDIZIONI: le righe fuori dal giornale identiche a prima; le righe del giornale
--   cambiano solo stato attivo e updated_at; nessuna riga attiva resta su una posizione
--   disattivata; numero di righe invariato.
-- IDEMPOTENTE: una seconda passata non trova righe.
-- ============================================================================
BEGIN;

CREATE TABLE IF NOT EXISTS staging.process_participants_disattiva_undo (
  undo_id                  bigserial PRIMARY KEY,
  run_id                   uuid        NOT NULL,
  process_participant_id   uuid        NOT NULL,
  position_id              uuid        NOT NULL,
  updated_at_prima         timestamptz NOT NULL,
  eseguito_il              timestamptz NOT NULL DEFAULT clock_timestamp(),
  annullato_il             timestamptz
);
CREATE INDEX IF NOT EXISTS process_participants_disattiva_undo_run_idx
  ON staging.process_participants_disattiva_undo (run_id);

LOCK TABLE sys.sys_process_participants IN SHARE ROW EXCLUSIVE MODE;

DO $$
DECLARE
  v_run uuid := gen_random_uuid();
  v_n_pre bigint; v_n_piano bigint; v_fatte bigint; v_resti bigint;
  v_h_fuori text; v_h_toccate text;
BEGIN
  SELECT count(*) INTO v_n_pre FROM sys.sys_process_participants;

  CREATE TEMP TABLE _d_piano ON COMMIT DROP AS
  SELECT pp.process_participant_id AS id, pp.process_participant_position_id AS pos, pp.updated_at
    FROM sys.sys_process_participants pp
    JOIN sys.sys_positions p ON p.position_id = pp.process_participant_position_id
   WHERE pp.process_participant_is_active AND NOT p.position_is_active;
  SELECT count(*) INTO v_n_piano FROM _d_piano;

  SELECT coalesce(md5(string_agg(to_jsonb(t)::text, E'\n' ORDER BY t.process_participant_id)), '')
    INTO v_h_fuori FROM sys.sys_process_participants t
   WHERE t.process_participant_id NOT IN (SELECT id FROM _d_piano);
  SELECT coalesce(md5(string_agg((to_jsonb(t) - 'process_participant_is_active' - 'updated_at')::text,
                                 E'\n' ORDER BY t.process_participant_id)), '')
    INTO v_h_toccate FROM sys.sys_process_participants t
   WHERE t.process_participant_id IN (SELECT id FROM _d_piano);

  INSERT INTO staging.process_participants_disattiva_undo (run_id, process_participant_id, position_id, updated_at_prima)
  SELECT v_run, id, pos, updated_at FROM _d_piano;

  UPDATE sys.sys_process_participants pp
     SET process_participant_is_active = false, updated_at = greatest(now(), pp.created_at)
    FROM _d_piano d WHERE pp.process_participant_id = d.id;
  GET DIAGNOSTICS v_fatte = ROW_COUNT;

  IF v_fatte <> v_n_piano THEN
    RAISE EXCEPTION 'pe4-passo3b-disattiva: disattivate %, attese %', v_fatte, v_n_piano;
  END IF;
  IF (SELECT count(*) FROM sys.sys_process_participants) <> v_n_pre THEN
    RAISE EXCEPTION 'pe4-passo3b-disattiva: il numero di partecipazioni e'' cambiato';
  END IF;
  IF (SELECT coalesce(md5(string_agg(to_jsonb(t)::text, E'\n' ORDER BY t.process_participant_id)), '')
        FROM sys.sys_process_participants t
       WHERE t.process_participant_id NOT IN (SELECT id FROM _d_piano)) <> v_h_fuori THEN
    RAISE EXCEPTION 'pe4-passo3b-disattiva: una riga fuori dal piano e'' cambiata';
  END IF;
  IF (SELECT coalesce(md5(string_agg((to_jsonb(t) - 'process_participant_is_active' - 'updated_at')::text,
                                     E'\n' ORDER BY t.process_participant_id)), '')
        FROM sys.sys_process_participants t
       WHERE t.process_participant_id IN (SELECT id FROM _d_piano)) <> v_h_toccate THEN
    RAISE EXCEPTION 'pe4-passo3b-disattiva: una riga del piano e'' cambiata oltre allo stato attivo';
  END IF;
  SELECT count(*) INTO v_resti FROM sys.sys_process_participants pp
    JOIN sys.sys_positions p ON p.position_id = pp.process_participant_position_id
   WHERE pp.process_participant_is_active AND NOT p.position_is_active;
  IF v_resti <> 0 THEN
    RAISE EXCEPTION 'pe4-passo3b-disattiva: % partecipazioni attive restano su posizioni disattivate', v_resti;
  END IF;

  RAISE NOTICE 'pe4-passo3b-disattiva [corsa %]: disattivate %.', v_run, v_fatte;
END $$;

COMMIT;
