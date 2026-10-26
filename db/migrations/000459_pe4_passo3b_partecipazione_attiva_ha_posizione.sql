-- ============================================================================
-- 000459 — PE-4 passo 3b (ADR-0044): una partecipazione attiva ha sempre una posizione
--
-- COSA FA, in quest'ordine, nella stessa transazione:
--   1. PORTA ALLO STATO DELLA PRODUZIONE le partecipazioni attive senza posizione. In
--      produzione non ne trova (le ha gia' sistemate il passo 2, fuori catena); su un
--      database nuovo e su quello della CI le scrive la 000184, che gira prima della 000457.
--      Si applica la sola parte CERTA del passo 2: la persona ha oggi una sola assegnazione
--      ACTIVE su una posizione attiva dell'unita' del processo -> si scrive quella posizione;
--      altrimenti la riga si DISATTIVA (non si cancella). Giornale nella stessa tabella del
--      passo 2 (staging.process_participants_position_undo), classe 'A' o 'N'.
--   2. La persona sulla riga diventa facoltativa (DROP NOT NULL): chi partecipa e' il posto.
--      La colonna resta: il suo ritiro e' un passo successivo, con archivio (ADR-0035).
--   3. Vincolo CHECK (NOT is_active OR position_id IS NOT NULL), aggiunto NOT VALID, poi una
--      GUARDIA che conta le righe che lo violerebbero e si ferma se non sono zero, poi VALIDATE.
--      E' lo scostamento da ADR-0044 approvato dall'Amministratore di Sistema il 2026-10-26:
--      le righe disattivate senza posizione (classe N del passo 2) restano valide.
--   4. Sentinella sys.v_process_participants_active_without_position (db_health la raccoglie
--      da pg_views e pretende zero righe).
--
-- COSA NON FA. Non disattiva le partecipazioni su posizioni disattivate: e' D-P3-2, lo script
-- fuori catena db/scripts/pe4-passo3b-disattiva.sql, da lanciare prima. Non tocca la FK
-- sulla persona (ON DELETE CASCADE) ne' la mappa GDPR (000304): restano finche' la colonna
-- esiste. La regola B per persona (000184) e' stata emendata nello stesso passo: con la
-- colonna della posizione presente non scrive piu' niente.
--
-- INVERSA, FUORI CATENA: db/scripts/pe4-passo3b-inversa.sql.
-- IDEMPOTENTE: il punto 1 alla seconda passata non trova righe; vincolo e vista controllati.
-- Authored: 2026-10-26 (O2-10).
-- ============================================================================

BEGIN;

DO $$
DECLARE
  v_run uuid := gen_random_uuid();
  v_n_pre bigint; v_riempite bigint; v_disattivate bigint; v_coll bigint; v_viol bigint;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_schema = 'sys' AND table_name = 'sys_process_participants'
                    AND column_name = 'process_participant_position_id') THEN
    RAISE EXCEPTION '000459: manca process_participant_position_id (000457)';
  END IF;

  LOCK TABLE sys.sys_process_participants IN SHARE ROW EXCLUSIVE MODE;
  SELECT count(*) INTO v_n_pre FROM sys.sys_process_participants;

  -- 1. Le partecipazioni attive senza posizione: la parte certa del passo 2.
  CREATE TEMP TABLE _p3b_piano ON COMMIT DROP AS
  SELECT pp.process_participant_id AS id, pp.process_participant_org_unit_process_id AS op,
         pp.updated_at,
         (SELECT CASE WHEN count(DISTINCT a.user_position_assignment_position_id) = 1
                      THEN min(a.user_position_assignment_position_id::text)::uuid END
            FROM sys.sys_user_position_assignments a
            JOIN sys.sys_positions p ON p.position_id = a.user_position_assignment_position_id
           WHERE a.user_position_assignment_user_id = pp.process_participant_user_id
             AND a.user_position_assignment_status = 'ACTIVE'
             AND p.position_is_active
             AND p.position_organization_unit_id = oup.org_unit_process_org_unit_id) AS pos
    FROM sys.sys_process_participants pp
    JOIN sys.sys_organization_unit_processes oup
      ON oup.organization_unit_process_id = pp.process_participant_org_unit_process_id
   WHERE pp.process_participant_is_active AND pp.process_participant_position_id IS NULL;

  IF EXISTS (SELECT 1 FROM _p3b_piano) THEN
    -- Una posizione candidata gia' presa sullo stesso processo, o presa due volte: la riga
    -- non si riempie, si disattiva (non si indovina chi vince).
    UPDATE _p3b_piano x SET pos = NULL
     WHERE x.pos IS NOT NULL
       AND (EXISTS (SELECT 1 FROM sys.sys_process_participants pp
                     WHERE pp.process_participant_org_unit_process_id = x.op
                       AND pp.process_participant_position_id = x.pos)
            OR (SELECT count(*) FROM _p3b_piano y WHERE y.op = x.op AND y.pos = x.pos) > 1);

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
    INSERT INTO staging.process_participants_position_undo
      (run_id, process_participant_id, classe, azione, position_id_prima, position_id_dopo,
       is_active_prima, is_active_dopo, updated_at_prima)
    SELECT v_run, id, CASE WHEN pos IS NULL THEN 'N' ELSE 'A' END,
           CASE WHEN pos IS NULL THEN 'DISATTIVA' ELSE 'RIEMPI' END,
           NULL, pos, true, pos IS NOT NULL, updated_at
      FROM _p3b_piano;

    UPDATE sys.sys_process_participants pp
       SET process_participant_position_id = x.pos, updated_at = greatest(now(), pp.created_at)
      FROM _p3b_piano x WHERE pp.process_participant_id = x.id AND x.pos IS NOT NULL;
    GET DIAGNOSTICS v_riempite = ROW_COUNT;
    UPDATE sys.sys_process_participants pp
       SET process_participant_is_active = false, updated_at = greatest(now(), pp.created_at)
      FROM _p3b_piano x WHERE pp.process_participant_id = x.id AND x.pos IS NULL;
    GET DIAGNOSTICS v_disattivate = ROW_COUNT;
    RAISE NOTICE '000459: partecipazioni attive senza posizione portate allo stato della produzione: % riempite, % disattivate',
      v_riempite, v_disattivate;
  END IF;

  IF (SELECT count(*) FROM sys.sys_process_participants) <> v_n_pre THEN
    RAISE EXCEPTION '000459: il numero di partecipazioni e'' cambiato';
  END IF;

  -- 2. La persona diventa facoltativa.
  ALTER TABLE sys.sys_process_participants ALTER COLUMN process_participant_user_id DROP NOT NULL;

  -- 3. Il vincolo: NOT VALID, guardia, VALIDATE.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conrelid = 'sys.sys_process_participants'::regclass
                    AND conname = 'sys_process_participants_active_has_position') THEN
    ALTER TABLE sys.sys_process_participants
      ADD CONSTRAINT sys_process_participants_active_has_position
      CHECK (NOT process_participant_is_active OR process_participant_position_id IS NOT NULL) NOT VALID;
  END IF;
  SELECT count(*) INTO v_viol FROM sys.sys_process_participants
   WHERE process_participant_is_active AND process_participant_position_id IS NULL;
  IF v_viol <> 0 THEN
    RAISE EXCEPTION '000459: % partecipazioni attive senza posizione: il vincolo non si valida, mi fermo', v_viol;
  END IF;
  ALTER TABLE sys.sys_process_participants VALIDATE CONSTRAINT sys_process_participants_active_has_position;
END $$;

-- 4. La sentinella: partecipazioni attive senza posizione (attesa: zero righe).
CREATE OR REPLACE VIEW sys.v_process_participants_active_without_position AS
SELECT pp.process_participant_id, pp.process_participant_tenant_id,
       pp.process_participant_org_unit_process_id, pp.process_participant_user_id,
       pp.process_participant_role
  FROM sys.sys_process_participants pp
 WHERE pp.process_participant_is_active
   AND pp.process_participant_position_id IS NULL;

COMMENT ON VIEW sys.v_process_participants_active_without_position IS
  'Sentinella ADR-0044 passo 3b: una partecipazione attiva appartiene a un posto. Attesa: zero righe.';

COMMIT;
