-- ============================================================================
-- 000457 — PE-4 passo 1: la posizione nelle partecipazioni ai processi (ADR-0044)
--
-- COSA FA. Aggiunge a sys.sys_process_participants la colonna annullabile
-- process_participant_position_id (uuid), la FK su sys.sys_positions con
-- ON DELETE RESTRICT, un indice (posizione, attiva) e un indice unico parziale
-- (processo di unita', posizione) dove la posizione c'e'.
--
-- COSA NON FA. Non scrive nessun dato: la colonna nasce vuota. Nessuna lettura
-- cambia. La direzione del dato resta `importato` (000429): nessuna rotta scrive.
-- Il riempimento e' il passo 2 (db/scripts/pe4-passo2-riempi.sql, fuori catena).
--
-- GUARDIA SUL FORMATO. Se la colonna esiste gia' con un tipo diverso da uuid, o
-- la FK esiste e punta altrove, la migrazione si ferma: non si adatta.
--
-- POST-CONDIZIONE. Numero di righe e impronta di ogni riga (tutte le colonne
-- tranne la nuova) identici a prima, nella stessa transazione.
--
-- INVERSA, FUORI CATENA: db/scripts/pe4-passo1-inversa.sql (rifiuta di girare se
-- la colonna contiene valori).
--
-- IDEMPOTENTE: ogni oggetto e' IF NOT EXISTS o controllato; alla seconda passata
-- non cambia niente. Authored: 2026-10-17 (PE-4).
-- ============================================================================

BEGIN;

DO $$
DECLARE
  v_tipo      text;
  v_fk_target text;
  v_n_prima   bigint;
  v_h_prima   text;
  v_n_dopo    bigint;
  v_h_dopo    text;
BEGIN
  -- GUARDIA sul formato: colonna e FK gia' presenti devono essere quelle attese.
  SELECT data_type INTO v_tipo
    FROM information_schema.columns
   WHERE table_schema = 'sys' AND table_name = 'sys_process_participants'
     AND column_name = 'process_participant_position_id';
  IF v_tipo IS NOT NULL AND v_tipo <> 'uuid' THEN
    RAISE EXCEPTION '000457: process_participant_position_id esiste con tipo % (atteso uuid)', v_tipo;
  END IF;

  SELECT confrelid::regclass::text INTO v_fk_target
    FROM pg_constraint
   WHERE conrelid = 'sys.sys_process_participants'::regclass
     AND conname = 'sys_process_participants_position_fk';
  IF v_fk_target IS NOT NULL AND v_fk_target <> 'sys.sys_positions' THEN
    RAISE EXCEPTION '000457: sys_process_participants_position_fk punta a % (atteso sys.sys_positions)', v_fk_target;
  END IF;

  -- MISURA prima: conteggio e impronta di tutte le colonne esistenti prima del passo.
  SELECT count(*),
         coalesce(md5(string_agg((to_jsonb(t) - 'process_participant_position_id')::text, '|'
                                 ORDER BY t.process_participant_id)), '')
    INTO v_n_prima, v_h_prima
    FROM sys.sys_process_participants t;

  ALTER TABLE sys.sys_process_participants
    ADD COLUMN IF NOT EXISTS process_participant_position_id uuid;

  IF v_fk_target IS NULL THEN
    ALTER TABLE sys.sys_process_participants
      ADD CONSTRAINT sys_process_participants_position_fk
      FOREIGN KEY (process_participant_position_id)
      REFERENCES sys.sys_positions (position_id) ON DELETE RESTRICT;
  END IF;

  CREATE INDEX IF NOT EXISTS sys_process_participants_position_idx
    ON sys.sys_process_participants (process_participant_position_id, process_participant_is_active);

  CREATE UNIQUE INDEX IF NOT EXISTS sys_process_participants_process_position_uq
    ON sys.sys_process_participants (process_participant_org_unit_process_id, process_participant_position_id)
    WHERE process_participant_position_id IS NOT NULL;

  -- POST-CONDIZIONE: niente di cio' che c'era e' cambiato.
  SELECT count(*),
         coalesce(md5(string_agg((to_jsonb(t) - 'process_participant_position_id')::text, '|'
                                 ORDER BY t.process_participant_id)), '')
    INTO v_n_dopo, v_h_dopo
    FROM sys.sys_process_participants t;
  IF v_n_dopo <> v_n_prima OR v_h_dopo <> v_h_prima THEN
    RAISE EXCEPTION '000457: le partecipazioni sono cambiate (righe % -> %, impronta % -> %)',
      v_n_prima, v_n_dopo, v_h_prima, v_h_dopo;
  END IF;
  RAISE NOTICE '000457: colonna della posizione presente; % partecipazioni invariate.', v_n_dopo;
END $$;

COMMIT;
