-- ============================================================================
-- PE-4 passo 3 (ADR-0044), LE REGOLE DECISE dall'Amministratore di Sistema il 2026-10-26.
-- FUORI CATENA: non e' una migrazione, non gira al deploy. Si lancia a mano, dopo il passo 2:
--
--   psql -v ON_ERROR_STOP=1 -f db/scripts/pe4-passo3-regole.sql
--
-- D-P3-1, IL PROCESS OWNER (RULE-OWNER-UNITA-GOVERNO). Ogni processo ha UN owner: il
--   responsabile dell'unita' che nella matrice RACI delle unita'
--   (sys.sys_organization_unit_processes) ha il ruolo OWNER su quel processo, cioe' l'unita'
--   con il dominio di governo. La persona si traduce nel posto: responsabile
--   (organization_unit_manager_user_id) -> la sua assegnazione ACTIVE in corso -> la posizione
--   attiva NELL'UNITA' DI GOVERNO, se e' una sola. La riga OWNER sta sulla riga unita'-processo
--   dell'unita' di governo. Se il posto vi partecipa gia' (riga attiva), la riga si PROMUOVE a
--   OWNER: una riga nuova urterebbe gli indici unici (processo, posto) e (processo, persona).
--   Non si indovina: processo senza unita' OWNER, piu' unita' OWNER, unita' disattivata, senza
--   responsabile, responsabile senza un posto unico nell'unita', persona gia' presente su un
--   altro posto dello stesso processo -> nessun owner, il caso va nel registro degli esclusi.
--
-- D-P3-3, I POSTI DELL'UNITA' (RULE-CONTRIBUTOR-POSIZIONE). Ogni posizione attiva di un'unita'
--   attiva partecipa come CONTRIBUTOR alle righe unita'-processo della sua unita'. Finche' la
--   persona sulla riga e' obbligatoria (fino al passo 3b) si scrivono solo i posti con UN
--   titolare oggi, con la persona del titolare; i posti vacanti, quelli con piu' titolari e
--   quelli il cui titolare ha gia' una riga (di un altro posto) sullo stesso processo vanno
--   negli esclusi. Dopo il passo 3b (persona annullabile) lo stesso script scrive SOLO il posto,
--   e una seconda passata li riprende tutti.
--
-- Non decide altro: non tocca le righe esistenti salvo la promozione a OWNER, non disattiva
-- niente (e' D-P3-2, passo 3b), non scrive mai metadata.storia36 (controllo C7d).
--
-- GUARDIA: tutto si calcola QUI, nella stessa transazione, con la tabella bloccata contro le
--   scritture. Si ferma (RAISE) se manca il passo 2 (righe attive senza posizione), se un
--   processo avrebbe piu' di un owner che si risolve in una persona, o se due candidati
--   cadrebbero sulla stessa coppia (processo, posto).
-- GIORNALE: staging.process_participants_regole_undo (valori prima di ogni riga toccata).
-- ESCLUSI:  staging.process_participants_regole_esclusi (caso, motivo, corsa).
-- INVERSA:  db/scripts/pe4-passo3-regole-inversa.sql.
-- POST-CONDIZIONI: le righe fuori dal giornale di questa corsa sono identiche a prima; ogni
--   processo con un owner ne ha esattamente uno che si risolve in una persona; nessuna riga
--   con metadata.storia36.
-- IDEMPOTENTE: una seconda passata non trova candidati e non scrive nel giornale.
-- ============================================================================
BEGIN;

CREATE TABLE IF NOT EXISTS staging.process_participants_regole_undo (
  undo_id                  bigserial PRIMARY KEY,
  run_id                   uuid        NOT NULL,
  process_participant_id   uuid        NOT NULL,
  regola                   varchar(32) NOT NULL
                             CHECK (regola IN ('RULE-OWNER-UNITA-GOVERNO', 'RULE-CONTRIBUTOR-POSIZIONE')),
  azione                   varchar(16) NOT NULL CHECK (azione IN ('INSERISCI', 'PROMUOVI', 'RIATTIVA')),
  role_prima               varchar(16),
  is_active_prima          boolean,
  metadata_prima           jsonb,
  updated_at_prima         timestamptz,
  eseguito_il              timestamptz NOT NULL DEFAULT clock_timestamp(),
  annullato_il             timestamptz
);
CREATE INDEX IF NOT EXISTS process_participants_regole_undo_run_idx
  ON staging.process_participants_regole_undo (run_id);

CREATE TABLE IF NOT EXISTS staging.process_participants_regole_esclusi (
  esclusione_id            bigserial PRIMARY KEY,
  run_id                   uuid        NOT NULL,
  regola                   varchar(32) NOT NULL,
  tenant_id                uuid        NOT NULL,
  blueprint_process_id     uuid,
  organization_unit_process_id uuid,
  position_id              uuid,
  motivo                   text        NOT NULL,
  registrato_il            timestamptz NOT NULL DEFAULT clock_timestamp()
);

LOCK TABLE sys.sys_process_participants IN SHARE ROW EXCLUSIVE MODE;

DO $$
DECLARE
  v_run   uuid := gen_random_uuid();
  v_n_pre bigint;
  v_senza_pos bigint;
  v_coll  bigint;
  v_h_fuori_pre text;
  v_promossi bigint; v_inseriti_o bigint; v_inseriti_c bigint; v_riattivati bigint;
  v_esclusi_o bigint; v_esclusi_c bigint; v_multi bigint; v_storia bigint;
  v_solo_posto boolean;  -- dopo il passo 3b la persona e' annullabile: si scrive solo il posto
BEGIN
  SELECT is_nullable = 'YES' INTO v_solo_posto FROM information_schema.columns
   WHERE table_schema = 'sys' AND table_name = 'sys_process_participants'
     AND column_name = 'process_participant_user_id';
  -- PRECONDIZIONE: il passo 2 c'e' (nessuna partecipazione attiva senza posizione).
  SELECT count(*) INTO v_senza_pos FROM sys.sys_process_participants
   WHERE process_participant_is_active AND process_participant_position_id IS NULL;
  IF v_senza_pos <> 0 THEN
    RAISE EXCEPTION 'pe4-passo3-regole: % partecipazioni attive senza posizione: prima il passo 2', v_senza_pos;
  END IF;
  SELECT count(*) INTO v_n_pre FROM sys.sys_process_participants;

  -- Il titolare UNICO di oggi di ogni posizione attiva (null se vacante o con piu' titolari).
  CREATE TEMP TABLE _r_titolari ON COMMIT DROP AS
  SELECT p.position_id, p.position_tenant_id AS tenant_id, p.position_organization_unit_id AS unit_id,
         count(a.user_position_assignment_id) AS n_titolari,
         CASE WHEN count(a.user_position_assignment_id) = 1
              THEN min(a.user_position_assignment_user_id::text)::uuid END AS user_id
    FROM sys.sys_positions p
    LEFT JOIN sys.sys_user_position_assignments a
      ON a.user_position_assignment_position_id = p.position_id
     AND a.user_position_assignment_status = 'ACTIVE'
     AND a.user_position_assignment_start_date <= current_date
     AND (a.user_position_assignment_end_date IS NULL OR a.user_position_assignment_end_date >= current_date)
   WHERE p.position_is_active
   GROUP BY p.position_id, p.position_tenant_id, p.position_organization_unit_id;

  -- ------------------------------------------------------------------ D-P3-1
  -- Per ogni processo (tenant, blueprint): le sue unita' OWNER.
  CREATE TEMP TABLE _r_gov ON COMMIT DROP AS
  SELECT oup.org_unit_process_tenant_id AS tenant_id, oup.org_unit_process_blueprint_process_id AS bp,
         count(*) FILTER (WHERE oup.org_unit_process_role = 'OWNER') AS n_owner_units,
         min(oup.organization_unit_process_id::text) FILTER (WHERE oup.org_unit_process_role = 'OWNER')::uuid AS oup_id
    FROM sys.sys_organization_unit_processes oup
   GROUP BY 1, 2;

  CREATE TEMP TABLE _r_owner ON COMMIT DROP AS
  SELECT g.tenant_id, g.bp, g.oup_id, g.n_owner_units,
         ou.organization_unit_id AS unit_id, ou.organization_unit_is_active AS unit_active,
         ou.organization_unit_manager_user_id AS mgr,
         (SELECT count(*) FROM _r_titolari t
           WHERE t.unit_id = ou.organization_unit_id AND t.user_id = ou.organization_unit_manager_user_id) AS n_posti,
         (SELECT min(t.position_id::text)::uuid FROM _r_titolari t
           WHERE t.unit_id = ou.organization_unit_id AND t.user_id = ou.organization_unit_manager_user_id) AS pos
    FROM _r_gov g
    LEFT JOIN sys.sys_organization_unit_processes oup ON oup.organization_unit_process_id = g.oup_id
    LEFT JOIN sys.sys_organization_units ou ON ou.organization_unit_id = oup.org_unit_process_org_unit_id;

  ALTER TABLE _r_owner ADD COLUMN motivo text, ADD COLUMN riga_id uuid, ADD COLUMN riga_attiva boolean,
                       ADD COLUMN riga_ruolo text, ADD COLUMN riga_regola text, ADD COLUMN persona_altrove boolean;
  UPDATE _r_owner o SET
    riga_id = pp.process_participant_id, riga_attiva = pp.process_participant_is_active,
    riga_ruolo = pp.process_participant_role, riga_regola = pp.process_participant_metadata->>'derived'
    FROM sys.sys_process_participants pp
   WHERE pp.process_participant_org_unit_process_id = o.oup_id AND pp.process_participant_position_id = o.pos;
  UPDATE _r_owner o SET persona_altrove = EXISTS (
    SELECT 1 FROM sys.sys_process_participants pp
     WHERE pp.process_participant_org_unit_process_id = o.oup_id AND pp.process_participant_user_id = o.mgr
       AND pp.process_participant_position_id IS DISTINCT FROM o.pos);
  UPDATE _r_owner SET motivo = CASE
      WHEN n_owner_units = 0 THEN 'processo senza unita'' OWNER nella matrice delle unita'''
      WHEN n_owner_units > 1 THEN 'piu'' unita'' OWNER sullo stesso processo (' || n_owner_units || ')'
      WHEN NOT unit_active THEN 'unita'' OWNER disattivata'
      WHEN mgr IS NULL THEN 'unita'' OWNER senza responsabile'
      WHEN n_posti = 0 THEN 'il responsabile non occupa oggi da solo nessuna posizione attiva dell''unita'' OWNER'
      WHEN n_posti > 1 THEN 'il responsabile occupa ' || n_posti || ' posizioni attive dell''unita'' OWNER'
      WHEN riga_id IS NOT NULL AND NOT riga_attiva AND riga_regola IS DISTINCT FROM 'RULE-OWNER-UNITA-GOVERNO'
        THEN 'la partecipazione del posto su questo processo e'' disattivata'
      WHEN riga_id IS NULL AND persona_altrove AND NOT v_solo_posto
        THEN 'il responsabile partecipa gia'' a questo processo da un altro posto: si scrive dopo il passo 3b'
    END;

  INSERT INTO staging.process_participants_regole_esclusi
    (run_id, regola, tenant_id, blueprint_process_id, organization_unit_process_id, position_id, motivo)
  SELECT v_run, 'RULE-OWNER-UNITA-GOVERNO', tenant_id, bp, oup_id, pos, motivo
    FROM _r_owner WHERE motivo IS NOT NULL;
  GET DIAGNOSTICS v_esclusi_o = ROW_COUNT;

  -- ------------------------------------------------------------------ D-P3-3
  CREATE TEMP TABLE _r_contrib ON COMMIT DROP AS
  SELECT oup.org_unit_process_tenant_id AS tenant_id, oup.organization_unit_process_id AS oup_id,
         t.position_id AS pos, t.user_id, t.n_titolari,
         pp.process_participant_id AS riga_id, pp.process_participant_is_active AS riga_attiva,
         pp.process_participant_metadata->>'derived' AS riga_regola,
         EXISTS (SELECT 1 FROM sys.sys_process_participants px
                  WHERE px.process_participant_org_unit_process_id = oup.organization_unit_process_id
                    AND px.process_participant_user_id = t.user_id
                    AND px.process_participant_position_id IS DISTINCT FROM t.position_id) AS persona_altrove
    FROM sys.sys_organization_unit_processes oup
    JOIN sys.sys_organization_units ou
      ON ou.organization_unit_id = oup.org_unit_process_org_unit_id AND ou.organization_unit_is_active
    JOIN _r_titolari t ON t.unit_id = oup.org_unit_process_org_unit_id AND t.tenant_id = oup.org_unit_process_tenant_id
    LEFT JOIN sys.sys_process_participants pp
      ON pp.process_participant_org_unit_process_id = oup.organization_unit_process_id
     AND pp.process_participant_position_id = t.position_id;

  ALTER TABLE _r_contrib ADD COLUMN motivo text;
  UPDATE _r_contrib SET motivo = CASE
      WHEN riga_id IS NOT NULL AND NOT riga_attiva AND riga_regola IS DISTINCT FROM 'RULE-CONTRIBUTOR-POSIZIONE'
        THEN 'la partecipazione del posto su questo processo e'' disattivata'
      WHEN riga_id IS NOT NULL THEN NULL
      WHEN v_solo_posto THEN NULL
      WHEN n_titolari = 0 THEN 'posto vacante: si scrive dopo il passo 3b (persona obbligatoria fino ad allora)'
      WHEN n_titolari > 1 THEN 'posto con ' || n_titolari || ' titolari oggi: si scrive dopo il passo 3b'
      WHEN persona_altrove THEN 'il titolare partecipa gia'' a questo processo da un altro posto: si scrive dopo il passo 3b'
    END;

  INSERT INTO staging.process_participants_regole_esclusi
    (run_id, regola, tenant_id, organization_unit_process_id, position_id, motivo)
  SELECT v_run, 'RULE-CONTRIBUTOR-POSIZIONE', tenant_id, oup_id, pos, motivo
    FROM _r_contrib WHERE motivo IS NOT NULL;
  GET DIAGNOSTICS v_esclusi_c = ROW_COUNT;

  -- ------------------------------------------------------------------ il piano
  CREATE TEMP TABLE _r_piano ON COMMIT DROP AS
  SELECT 'RULE-OWNER-UNITA-GOVERNO'::text AS regola, tenant_id, oup_id, pos, mgr AS user_id, riga_id,
         CASE WHEN riga_id IS NULL THEN 'INSERISCI'
              WHEN NOT riga_attiva THEN 'RIATTIVA'
              ELSE 'PROMUOVI' END AS azione
    FROM _r_owner
   WHERE motivo IS NULL
     AND NOT (riga_id IS NOT NULL AND riga_attiva AND riga_ruolo = 'OWNER'
              AND riga_regola = 'RULE-OWNER-UNITA-GOVERNO')
  UNION ALL
  SELECT 'RULE-CONTRIBUTOR-POSIZIONE', c.tenant_id, c.oup_id, c.pos, c.user_id, c.riga_id,
         CASE WHEN c.riga_id IS NULL THEN 'INSERISCI' ELSE 'RIATTIVA' END
    FROM _r_contrib c
   WHERE c.motivo IS NULL
     AND (c.riga_id IS NULL OR (NOT c.riga_attiva AND c.riga_regola = 'RULE-CONTRIBUTOR-POSIZIONE'))
     -- il posto del process owner e' affare di D-P3-1, non si scrive due volte
     AND NOT EXISTS (SELECT 1 FROM _r_owner o WHERE o.motivo IS NULL AND o.oup_id = c.oup_id AND o.pos = c.pos);

  -- GUARDIA: due candidati sulla stessa coppia (processo, posto) o (processo, persona).
  SELECT count(*) INTO v_coll FROM (
    SELECT oup_id, pos FROM _r_piano GROUP BY 1, 2 HAVING count(*) > 1
    UNION ALL
    SELECT oup_id, user_id FROM _r_piano WHERE azione = 'INSERISCI' AND NOT v_solo_posto
     GROUP BY 1, 2 HAVING count(*) > 1) x;
  IF v_coll <> 0 THEN
    RAISE EXCEPTION 'pe4-passo3-regole: % coppie con piu'' candidati: mi fermo', v_coll;
  END IF;

  SELECT coalesce(md5(string_agg(to_jsonb(t)::text, E'\n' ORDER BY t.process_participant_id)), '')
    INTO v_h_fuori_pre
    FROM sys.sys_process_participants t
   WHERE t.process_participant_id NOT IN (SELECT riga_id FROM _r_piano WHERE riga_id IS NOT NULL);

  -- GIORNALE e SCRITTURA.
  INSERT INTO staging.process_participants_regole_undo
    (run_id, process_participant_id, regola, azione, role_prima, is_active_prima, metadata_prima, updated_at_prima)
  SELECT v_run, pi.riga_id, pi.regola, pi.azione, pp.process_participant_role, pp.process_participant_is_active,
         pp.process_participant_metadata, pp.updated_at
    FROM _r_piano pi JOIN sys.sys_process_participants pp ON pp.process_participant_id = pi.riga_id
   WHERE pi.azione IN ('PROMUOVI', 'RIATTIVA');

  UPDATE sys.sys_process_participants pp
     SET process_participant_role = CASE WHEN pi.regola = 'RULE-OWNER-UNITA-GOVERNO' THEN 'OWNER'
                                         ELSE pp.process_participant_role END,
         process_participant_is_active = true,
         process_participant_metadata = pp.process_participant_metadata
           || jsonb_build_object('derived', pi.regola, 'derived_run', v_run::text),
         updated_at = greatest(now(), pp.created_at)
    FROM _r_piano pi
   WHERE pp.process_participant_id = pi.riga_id AND pi.azione IN ('PROMUOVI', 'RIATTIVA');
  GET DIAGNOSTICS v_promossi = ROW_COUNT;

  WITH nuove AS (
    INSERT INTO sys.sys_process_participants
      (process_participant_tenant_id, process_participant_org_unit_process_id, process_participant_user_id,
       process_participant_position_id, process_participant_role, process_participant_metadata)
    SELECT pi.tenant_id, pi.oup_id, CASE WHEN v_solo_posto THEN NULL ELSE pi.user_id END, pi.pos,
           CASE WHEN pi.regola = 'RULE-OWNER-UNITA-GOVERNO' THEN 'OWNER' ELSE 'CONTRIBUTOR' END,
           jsonb_build_object('derived', pi.regola, 'derived_run', v_run::text)
      FROM _r_piano pi WHERE pi.azione = 'INSERISCI'
    RETURNING process_participant_id, process_participant_metadata->>'derived' AS regola
  )
  INSERT INTO staging.process_participants_regole_undo (run_id, process_participant_id, regola, azione)
  SELECT v_run, process_participant_id, regola, 'INSERISCI' FROM nuove;

  SELECT count(*) FILTER (WHERE regola = 'RULE-OWNER-UNITA-GOVERNO' AND azione = 'INSERISCI'),
         count(*) FILTER (WHERE regola = 'RULE-CONTRIBUTOR-POSIZIONE' AND azione = 'INSERISCI'),
         count(*) FILTER (WHERE azione = 'RIATTIVA')
    INTO v_inseriti_o, v_inseriti_c, v_riattivati
    FROM staging.process_participants_regole_undo WHERE run_id = v_run;

  -- POST-CONDIZIONI.
  IF (SELECT count(*) FROM sys.sys_process_participants) <> v_n_pre + v_inseriti_o + v_inseriti_c THEN
    RAISE EXCEPTION 'pe4-passo3-regole: il numero di partecipazioni non torna';
  END IF;
  IF (SELECT coalesce(md5(string_agg(to_jsonb(t)::text, E'\n' ORDER BY t.process_participant_id)), '')
        FROM sys.sys_process_participants t
       WHERE t.process_participant_id NOT IN (SELECT process_participant_id
                                                FROM staging.process_participants_regole_undo
                                               WHERE run_id = v_run)) <> v_h_fuori_pre THEN
    RAISE EXCEPTION 'pe4-passo3-regole: una riga fuori dal giornale e'' cambiata';
  END IF;
  -- Ogni processo ha al piu' UN owner che si risolve in una persona oggi.
  SELECT count(*) INTO v_multi FROM (
    SELECT oup.org_unit_process_tenant_id, oup.org_unit_process_blueprint_process_id
      FROM sys.sys_process_participants pp
      JOIN sys.sys_organization_unit_processes oup
        ON oup.organization_unit_process_id = pp.process_participant_org_unit_process_id
      JOIN _r_titolari t ON t.position_id = pp.process_participant_position_id AND t.n_titolari > 0
     WHERE pp.process_participant_is_active AND pp.process_participant_role = 'OWNER'
     GROUP BY 1, 2 HAVING count(*) > 1) x;
  IF v_multi <> 0 THEN
    RAISE EXCEPTION 'pe4-passo3-regole: % processi con piu'' di un owner che si risolve in una persona: mi fermo', v_multi;
  END IF;
  SELECT count(*) INTO v_storia FROM sys.sys_process_participants WHERE process_participant_metadata ? 'storia36';
  IF v_storia <> 0 THEN
    RAISE EXCEPTION 'pe4-passo3-regole: % righe con metadata.storia36 (il controllo C7d vuole zero)', v_storia;
  END IF;

  RAISE NOTICE 'pe4-passo3-regole [corsa %]: owner promossi/riattivati %, owner inseriti %, contributor inseriti %, riattivati %; esclusi owner %, esclusi contributor %.',
    v_run, v_promossi - v_riattivati, v_inseriti_o, v_inseriti_c, v_riattivati, v_esclusi_o, v_esclusi_c;
END $$;

COMMIT;
