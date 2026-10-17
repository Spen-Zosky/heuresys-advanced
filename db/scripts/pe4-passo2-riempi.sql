-- ============================================================================
-- PE-4 passo 2 (ADR-0044): riempie la posizione nelle partecipazioni ai processi.
-- FUORI CATENA: non e' una migrazione, non gira al deploy. Si lancia a mano:
--
--   psql -v ON_ERROR_STOP=1 -v fase=tutto -f db/scripts/pe4-passo2-riempi.sql
--
-- fase=A     solo la classe certa (A): la persona ha oggi UNA assegnazione ACTIVE su una
--            posizione attiva dell'unita' del processo. Registra H e N nel registro dei dubbi.
-- fase=D3    le due classi decise dall'Amministratore di Sistema (D3):
--            H -> posizione che la persona occupava nell'unita' alla data di scrittura
--                 della riga (created_at), se UNICA;
--            N -> la riga si DISATTIVA (non si cancella), con il motivo nel registro.
-- fase=tutto A e poi D3 (predefinita).
-- I 57 OWNER non si decidono qui: li corregge il passo 3 (onda 2).
--
-- GUARDIA. La classe di ogni riga si ricalcola QUI, nella stessa transazione, con la
-- tabella bloccata contro le scritture: la misura di un altro giorno non vale. Si ferma
-- (RAISE) se la colonna manca o se due righe candidate cadrebbero sulla stessa coppia
-- (processo, posizione): non si indovina chi vince.
--
-- GIORNALE: staging.process_participants_position_undo (valori prima e dopo di ogni riga
-- toccata, con identificativo di corsa). REGISTRO DEI DUBBI: staging.process_participants_dubbi.
-- INVERSA: db/scripts/pe4-passo2-inversa.sql.
--
-- POST-CONDIZIONI (stessa transazione, RAISE se false): numero di righe invariato; ogni riga
-- NON presente nel giornale di questa corsa e' identica a prima; ogni riga toccata cambia
-- solo posizione / stato attivo / updated_at; persona, ruolo e metadati identici per tutte;
-- righe riempite e disattivate = quelle classificate; nessuna riga con metadata.storia36.
--
-- IDEMPOTENTE: una seconda passata non trova candidati (posizione gia' scritta, riga gia'
-- disattivata), non scrive nel giornale e non cambia niente.
-- ============================================================================
\if :{?fase}
\else
  \set fase tutto
\endif

BEGIN;

SELECT set_config('pe4.fase', :'fase', true);

CREATE TABLE IF NOT EXISTS staging.process_participants_position_undo (
  undo_id                  bigserial PRIMARY KEY,
  run_id                   uuid        NOT NULL,
  process_participant_id   uuid        NOT NULL,
  classe                   varchar(1)  NOT NULL CHECK (classe IN ('A', 'H', 'N')),
  azione                   varchar(16) NOT NULL CHECK (azione IN ('RIEMPI', 'DISATTIVA')),
  position_id_prima        uuid,
  position_id_dopo         uuid,
  is_active_prima          boolean     NOT NULL,
  is_active_dopo           boolean     NOT NULL,
  updated_at_prima         timestamptz NOT NULL,
  eseguito_il              timestamptz NOT NULL DEFAULT clock_timestamp(),
  annullato_il             timestamptz
);
CREATE INDEX IF NOT EXISTS process_participants_position_undo_run_idx
  ON staging.process_participants_position_undo (run_id);

CREATE TABLE IF NOT EXISTS staging.process_participants_dubbi (
  process_participant_id   uuid PRIMARY KEY,
  classe                   varchar(1)  NOT NULL CHECK (classe IN ('H', 'N')),
  motivo                   text        NOT NULL,
  position_candidata_id    uuid,
  esito                    varchar(24) NOT NULL
                             CHECK (esito IN ('IN_ATTESA', 'RIEMPITA_DA_STORIA', 'DISATTIVATA', 'ANNULLATO')),
  run_id                   uuid        NOT NULL,
  registrato_il            timestamptz NOT NULL DEFAULT clock_timestamp()
);

LOCK TABLE sys.sys_process_participants IN SHARE ROW EXCLUSIVE MODE;

DO $$
DECLARE
  v_run    uuid := gen_random_uuid();
  v_fase   text := current_setting('pe4.fase');
  v_n_pre  bigint;
  v_h_pre  text;   -- impronta delle colonne che non devono MAI cambiare, tutte le righe
  v_h_fuori_pre text;
  v_n_a bigint; v_n_h bigint; v_n_n bigint;
  v_riempi bigint; v_disattiva bigint;
  v_coll bigint; v_storia bigint;
  v_toccate uuid[];
BEGIN
  IF v_fase NOT IN ('A', 'D3', 'tutto') THEN
    RAISE EXCEPTION 'pe4-passo2: fase % sconosciuta (A, D3, tutto)', v_fase;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_schema = 'sys' AND table_name = 'sys_process_participants'
                    AND column_name = 'process_participant_position_id') THEN
    RAISE EXCEPTION 'pe4-passo2: manca la colonna process_participant_position_id (passo 1, migrazione 000457)';
  END IF;

  -- MISURA prima.
  SELECT count(*) INTO v_n_pre FROM sys.sys_process_participants;
  SELECT coalesce(md5(string_agg(concat_ws('|', process_participant_id, process_participant_tenant_id,
           process_participant_org_unit_process_id, process_participant_user_id, process_participant_role,
           process_participant_metadata::text, created_at, coalesce(created_by::text, '-'),
           coalesce(updated_by::text, '-')), E'\n' ORDER BY process_participant_id)), '')
    INTO v_h_pre FROM sys.sys_process_participants;

  -- GUARDIA: la classe di ogni riga attiva senza posizione, ricalcolata adesso.
  CREATE TEMP TABLE _pe4_cls ON COMMIT DROP AS
  WITH r AS (
    SELECT pp.process_participant_id AS id, pp.process_participant_org_unit_process_id AS op,
           pp.created_at::date AS d, oup.org_unit_process_org_unit_id AS ou,
           pp.process_participant_user_id AS u
      FROM sys.sys_process_participants pp
      JOIN sys.sys_organization_unit_processes oup
        ON oup.organization_unit_process_id = pp.process_participant_org_unit_process_id
     WHERE pp.process_participant_is_active AND pp.process_participant_position_id IS NULL
  ), s AS (
    SELECT r.*,
      (SELECT array_agg(DISTINCT a.user_position_assignment_position_id)
         FROM sys.sys_user_position_assignments a
         JOIN sys.sys_positions p ON p.position_id = a.user_position_assignment_position_id
        WHERE a.user_position_assignment_user_id = r.u AND a.user_position_assignment_status = 'ACTIVE'
          AND p.position_is_active AND p.position_organization_unit_id = r.ou) AS pa,
      (SELECT array_agg(DISTINCT a.user_position_assignment_position_id)
         FROM sys.sys_user_position_assignments a
         JOIN sys.sys_positions p ON p.position_id = a.user_position_assignment_position_id
        WHERE a.user_position_assignment_user_id = r.u AND p.position_organization_unit_id = r.ou
          AND a.user_position_assignment_start_date <= r.d
          AND (a.user_position_assignment_end_date IS NULL OR a.user_position_assignment_end_date >= r.d)) AS ph
      FROM r
  )
  SELECT id, op,
         CASE WHEN cardinality(pa) = 1 THEN 'A' WHEN cardinality(ph) = 1 THEN 'H' ELSE 'N' END AS cl,
         CASE WHEN cardinality(pa) = 1 THEN pa[1] WHEN cardinality(ph) = 1 THEN ph[1] END AS pos
    FROM s;

  -- Che cosa si tocca in questa corsa.
  CREATE TEMP TABLE _pe4_piano ON COMMIT DROP AS
  SELECT id, op, cl, pos,
         CASE WHEN cl IN ('A', 'H') THEN 'RIEMPI' ELSE 'DISATTIVA' END AS azione
    FROM _pe4_cls
   WHERE (v_fase IN ('A', 'tutto') AND cl = 'A')
      OR (v_fase IN ('D3', 'tutto') AND cl IN ('H', 'N'));

  -- GUARDIA sulla collisione: due candidati sulla stessa coppia (processo, posizione), o un
  -- candidato su una coppia gia' occupata da una riga con posizione. Non si indovina.
  SELECT count(*) INTO v_coll FROM (
    SELECT op, pos FROM _pe4_piano WHERE pos IS NOT NULL GROUP BY op, pos HAVING count(*) > 1) x;
  IF v_coll <> 0 THEN
    RAISE EXCEPTION 'pe4-passo2: % coppie (processo, posizione) con piu'' candidati: mi fermo', v_coll;
  END IF;
  SELECT count(*) INTO v_coll
    FROM _pe4_piano pi JOIN sys.sys_process_participants pp
      ON pp.process_participant_org_unit_process_id = pi.op
     AND pp.process_participant_position_id = pi.pos
   WHERE pi.pos IS NOT NULL;
  IF v_coll <> 0 THEN
    RAISE EXCEPTION 'pe4-passo2: % candidati su una coppia (processo, posizione) gia'' occupata: mi fermo', v_coll;
  END IF;

  SELECT count(*) FILTER (WHERE cl = 'A'), count(*) FILTER (WHERE cl = 'H'), count(*) FILTER (WHERE cl = 'N')
    INTO v_n_a, v_n_h, v_n_n FROM _pe4_piano;

  -- Impronta delle righe che questa corsa NON deve toccare (intera riga, posizione compresa).
  SELECT coalesce(md5(string_agg(to_jsonb(t)::text, E'\n' ORDER BY t.process_participant_id)), '')
    INTO v_h_fuori_pre
    FROM sys.sys_process_participants t
   WHERE t.process_participant_id NOT IN (SELECT id FROM _pe4_piano);

  -- REGISTRO DEI DUBBI: H e N, con il motivo. Non scrive nulla in sys.
  INSERT INTO staging.process_participants_dubbi
    (process_participant_id, classe, motivo, position_candidata_id, esito, run_id)
  SELECT c.id, c.cl,
         CASE WHEN c.cl = 'H'
              THEN 'La persona non e'' piu'' nell''unita'' del processo; alla data di scrittura della riga occupava esattamente una posizione dell''unita'' (ricostruzione dalle date delle assegnazioni).'
              ELSE 'Ne'' oggi ne'' alla data di scrittura della riga la persona occupava una posizione dell''unita'' del processo.' END,
         c.pos,
         CASE WHEN v_fase = 'A' THEN 'IN_ATTESA'
              WHEN c.cl = 'H' THEN 'RIEMPITA_DA_STORIA' ELSE 'DISATTIVATA' END,
         v_run
    FROM _pe4_cls c
   WHERE c.cl IN ('H', 'N')
  ON CONFLICT (process_participant_id) DO UPDATE
     SET esito = EXCLUDED.esito, run_id = EXCLUDED.run_id, classe = EXCLUDED.classe,
         motivo = EXCLUDED.motivo, position_candidata_id = EXCLUDED.position_candidata_id,
         registrato_il = clock_timestamp()
   WHERE staging.process_participants_dubbi.esito IS DISTINCT FROM EXCLUDED.esito
      OR staging.process_participants_dubbi.position_candidata_id IS DISTINCT FROM EXCLUDED.position_candidata_id;

  -- GIORNALE prima della scrittura.
  INSERT INTO staging.process_participants_position_undo
    (run_id, process_participant_id, classe, azione, position_id_prima, position_id_dopo,
     is_active_prima, is_active_dopo, updated_at_prima)
  SELECT v_run, pi.id, pi.cl, pi.azione, pp.process_participant_position_id,
         CASE WHEN pi.azione = 'RIEMPI' THEN pi.pos ELSE pp.process_participant_position_id END,
         pp.process_participant_is_active, (pi.azione = 'RIEMPI'), pp.updated_at
    FROM _pe4_piano pi
    JOIN sys.sys_process_participants pp ON pp.process_participant_id = pi.id;

  -- SCRITTURA.
  UPDATE sys.sys_process_participants pp
     SET process_participant_position_id = pi.pos, updated_at = greatest(now(), pp.created_at)
    FROM _pe4_piano pi
   WHERE pp.process_participant_id = pi.id AND pi.azione = 'RIEMPI';
  GET DIAGNOSTICS v_riempi = ROW_COUNT;
  UPDATE sys.sys_process_participants pp
     SET process_participant_is_active = false, updated_at = greatest(now(), pp.created_at)
    FROM _pe4_piano pi
   WHERE pp.process_participant_id = pi.id AND pi.azione = 'DISATTIVA';
  GET DIAGNOSTICS v_disattiva = ROW_COUNT;

  -- POST-CONDIZIONI.
  IF (SELECT count(*) FROM sys.sys_process_participants) <> v_n_pre THEN
    RAISE EXCEPTION 'pe4-passo2: il numero di partecipazioni e'' cambiato';
  END IF;
  IF v_riempi <> (v_n_a + v_n_h) OR v_disattiva <> v_n_n THEN
    RAISE EXCEPTION 'pe4-passo2: scritte % riempite e % disattivate, attese % e %',
      v_riempi, v_disattiva, v_n_a + v_n_h, v_n_n;
  END IF;
  IF (SELECT coalesce(md5(string_agg(concat_ws('|', process_participant_id, process_participant_tenant_id,
           process_participant_org_unit_process_id, process_participant_user_id, process_participant_role,
           process_participant_metadata::text, created_at, coalesce(created_by::text, '-'),
           coalesce(updated_by::text, '-')), E'\n' ORDER BY process_participant_id)), '')
        FROM sys.sys_process_participants) <> v_h_pre THEN
    RAISE EXCEPTION 'pe4-passo2: persona, ruolo, metadati o chiavi di almeno una riga sono cambiati';
  END IF;
  IF (SELECT coalesce(md5(string_agg(to_jsonb(t)::text, E'\n' ORDER BY t.process_participant_id)), '')
        FROM sys.sys_process_participants t
       WHERE t.process_participant_id NOT IN (SELECT id FROM _pe4_piano)) <> v_h_fuori_pre THEN
    RAISE EXCEPTION 'pe4-passo2: una riga fuori dal piano e'' cambiata';
  END IF;
  SELECT count(*) INTO v_storia FROM sys.sys_process_participants
   WHERE process_participant_metadata ? 'storia36';
  IF v_storia <> 0 THEN
    RAISE EXCEPTION 'pe4-passo2: % righe con metadata.storia36 (il controllo C7d vuole zero)', v_storia;
  END IF;

  RAISE NOTICE 'pe4-passo2 [%]: riempite % (A %, H %), disattivate % (N %).',
    v_fase, v_riempi, v_n_a, v_n_h, v_disattiva, v_n_n;
END $$;

COMMIT;
