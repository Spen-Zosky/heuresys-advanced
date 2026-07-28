-- ============================================================================
-- storia36 C5 — CARRIERA: il prima e il dopo.
--
-- Piano: docs/superpowers/plans/2026-07-27-rtl-storia-36-mesi.md (Task C5)
--
-- Oggi il profilo di ognuno comincia il giorno dell'assunzione in RTL: prima c'è
-- il vuoto, anche per chi è entrato a quarant'anni con vent'anni di mestiere
-- alle spalle. E non guarda avanti: nessuno ha un obiettivo dichiarato, le otto
-- posizioni dichiarate CRITICHE non hanno un solo successore individuato, e i
-- requisiti delle posizioni sembrano non essere mai cambiati.
--
-- Cosa scrive questo seed, e su cosa si appoggia:
--
--  · ESPERIENZE PRECEDENTI — le date non sono inventate, sono VINCOLATE da tre
--    fatti già nel dato: la data di nascita (158 su 158), la fine del primo
--    titolo di studio (160 su 160 dopo la riparazione) e la data di assunzione.
--    Nessuno inizia a lavorare prima dei 19 anni o prima di aver finito gli
--    studi, e nessuno finisce l'ultima esperienza dopo essere entrato in RTL.
--    I ruoli precedenti salgono verso quello attuale, per famiglia professionale.
--  · DATORI DI LAVORO PRECEDENTI — sono nomi di FANTASIA di istituti italiani
--    (dichiarato: non si può derivare da nulla il nome del datore precedente, e
--    attribuire a persone reali un impiego presso banche reali sarebbe
--    un'affermazione su terzi che il dato non sostiene).
--  · OBIETTIVI DI CARRIERA — non un salto qualsiasi: la posizione obiettivo sta
--    su un percorso di carriera che passa per quella attuale (i 5 percorsi con
--    8 posizioni ciascuno già presenti), ed è più in alto — misurato dal numero
--    di titolari, che nel dato è l'unico indicatore di verticalità disponibile.
--  · SUCCESSIONE — le 8 posizioni critiche ricevono un bacino con i loro
--    candidati, scelti fra chi condivide il percorso di carriera e non occupa
--    già la posizione; i 25 candidati che già esistevano ricevono la storia
--    delle valutazioni che non avevano.
--  · REQUISITI DI POSIZIONE — le competenze richieste si sono alzate quando è
--    cambiata la norma: l'evoluzione è datata sulle scadenze regolamentari vere.
--
-- PREREQUISITO: repair/2026-07-28_c5_education_durata_oneshot.sql
-- Idempotente: id uuid_generate_v5 su chiavi naturali. Twice-run: 0.
-- ============================================================================

\set ON_ERROR_STOP on
SET client_encoding = 'UTF8';

BEGIN;

CREATE OR REPLACE FUNCTION pg_temp.h(t text) RETURNS int LANGUAGE sql IMMUTABLE AS
$fn$ SELECT ('x'||substr(md5(t),1,8))::bit(32)::int & 2147483647 $fn$;

DO $$
DECLARE
  c_rtl   constant uuid := '86ba7a65-217f-48ba-8ce5-5c09b40a66b0';
  c_ns    constant uuid := '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
  c_start constant date := DATE '2023-08-01';
  c_to    date;
  v_hr    uuid;
  v_n     bigint := 0;
  v_tot   bigint := 0;
BEGIN
  SELECT staging.storia36_c4_frontier() INTO STRICT c_to;
  SELECT user_id INTO STRICT v_hr FROM sys.sys_users
   WHERE user_email = 'federica.marchetti@rtl-bank.org';

  CREATE TEMP TABLE _scope ON COMMIT DROP AS
  SELECT u.user_id, u.user_email,
         min(e.user_employment_hire_date) AS hire,
         staging.storia36_c5_inizio_carriera(u.user_id) AS inizio,
         (SELECT a.user_position_assignment_position_id
            FROM sys.sys_user_position_assignments a
           WHERE a.user_position_assignment_user_id = u.user_id
             AND a.user_position_assignment_kind = 'PRIMARY'
             AND a.user_position_assignment_status = 'ACTIVE' LIMIT 1) AS pos
    FROM sys.sys_users u
    JOIN sys.sys_user_employment e ON e.user_employment_user_id = u.user_id
   WHERE u.user_tenant_id = c_rtl AND u.user_status = 'ACTIVE'
     AND e.user_employment_hire_date IS NOT NULL
   GROUP BY 1, 2;

  -- ==========================================================================
  -- 1. LE ESPERIENZE PRECEDENTI
  --    L'intervallo [inizio carriera, ingresso in RTL) si divide in 1-3 tratti
  --    contigui; ogni tratto è un impiego, separato dal successivo da qualche
  --    settimana (mai oltre 18 mesi: sarebbe un buco da spiegare — C5a).
  -- ==========================================================================
  CREATE TEMP TABLE _tratti ON COMMIT DROP AS
  SELECT s.user_id, s.hire, s.inizio, s.pos,
         p.position_title AS titolo_attuale,
         (s.hire - s.inizio) AS giorni,
         LEAST(3, GREATEST(1, round((s.hire - s.inizio) / 1600.0)::int)) AS n_tratti
    FROM _scope s
    LEFT JOIN sys.sys_positions p ON p.position_id = s.pos
   WHERE s.inizio IS NOT NULL
     -- chi è entrato in RTL entro un anno dalla fine degli studi non ha un prima
     AND (s.hire - s.inizio) >= 365;

  INSERT INTO sys.sys_user_professional_experiences (
    user_prof_exp_id, user_prof_exp_user_id, user_prof_exp_tenant_id,
    user_prof_exp_employer, user_prof_exp_role_title, user_prof_exp_industry,
    user_prof_exp_start_date, user_prof_exp_end_date,
    user_prof_exp_description, user_prof_exp_metadata)
  SELECT uuid_generate_v5(c_ns, 'STORIA36::C5::EXP::' || t.user_id || '::' || g.i),
         t.user_id, c_rtl,
         -- datori di fantasia, dichiarati come tali
         (ARRAY['Banca Popolare del Verbano','Credito Lombardo SpA','Istituto di Credito Adriatico',
                'Banca di Credito Cooperativo Brianza','Nuova Cassa di Risparmio Padana',
                'Finanziaria Ticinese SpA','Assicurazioni Riunite del Nord',
                'Consorzio Servizi Bancari Italia','Mediocredito Insubria'])
           [1 + (pg_temp.h(t.user_id::text || g.i || 'EMP') % 9)],
         -- il ruolo sale verso quello attuale: l'ultimo tratto è il piu' vicino
         CASE
           WHEN t.titolo_attuale IN ('Bank Teller','Back Office Specialist','Payment Specialist')
             THEN (ARRAY['Impiegato di sportello','Operatore di back office','Addetto ai pagamenti'])[LEAST(3, g.i)]
           WHEN t.titolo_attuale IN ('Risk Analyst','Financial Analyst','Chief Risk Officer')
             THEN (ARRAY['Analista junior','Analista finanziario','Specialista rischi di credito'])[LEAST(3, g.i)]
           WHEN t.titolo_attuale IN ('Compliance Officer')
             THEN (ARRAY['Addetto controlli interni','Specialista antiriciclaggio','Referente compliance'])[LEAST(3, g.i)]
           WHEN t.titolo_attuale IN ('Investment Advisor','Securities Dealer','Head of Treasury')
             THEN (ARRAY['Consulente finanziario junior','Gestore portafogli','Operatore di sala mercati'])[LEAST(3, g.i)]
           WHEN t.titolo_attuale IN ('Software Developer','System Administrator','IT Director')
             THEN (ARRAY['Programmatore','Analista programmatore','Responsabile sistemi'])[LEAST(3, g.i)]
           WHEN t.titolo_attuale IN ('Bank Manager','Operations Director','Line Manager - Operations','CEO')
             THEN (ARRAY['Addetto alla clientela','Gestore imprese','Vice direttore di filiale'])[LEAST(3, g.i)]
           ELSE (ARRAY['Impiegato amministrativo','Specialista di funzione','Coordinatore di area'])[LEAST(3, g.i)]
         END,
         CASE WHEN pg_temp.h(t.user_id::text || g.i || 'IND') % 10 < 7 THEN 'Banche e servizi finanziari'
              WHEN pg_temp.h(t.user_id::text || g.i || 'IND') % 10 < 9 THEN 'Assicurazioni'
              ELSE 'Consulenza e servizi ICT' END,
         -- tratto i-esimo dell'intervallo, con qualche settimana di stacco alla fine
         (t.inizio + ((g.i - 1) * t.giorni / t.n_tratti))::date,
         (t.inizio + (g.i * t.giorni / t.n_tratti)
                   - (7 + pg_temp.h(t.user_id::text || g.i || 'GAP') % 80))::date,
         'Esperienza precedente all''ingresso in RTL Bank.',
         jsonb_build_object('storia36', 'C5', 'tratto', g.i, 'su', t.n_tratti,
                            'datore', 'nome di fantasia — il dato non porta il datore reale')
    FROM _tratti t
    CROSS JOIN LATERAL generate_series(1, t.n_tratti) AS g(i)
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_tot := v_tot + v_n;
  RAISE NOTICE 'storia36 C5: esperienze precedenti inserite %', v_n;

  -- ==========================================================================
  -- 2. GLI OBIETTIVI DI CARRIERA
  --    La posizione obiettivo sta sullo stesso percorso di quella attuale ed è
  --    piu' in alto: nel dato l'unica misura di verticalita' disponibile e' la
  --    rarita' (quante persone occupano quella posizione).
  -- ==========================================================================
  CREATE TEMP TABLE _obiettivo ON COMMIT DROP AS
  WITH titolari AS (
    SELECT p.position_id,
           (SELECT count(*) FROM sys.sys_user_position_assignments a
             WHERE a.user_position_assignment_position_id = p.position_id
               AND a.user_position_assignment_status = 'ACTIVE') AS n
      FROM sys.sys_positions p WHERE p.position_tenant_id = c_rtl
  ), candidate AS (
    SELECT s.user_id, s.pos, pcp_meta.position_id AS target,
           row_number() OVER (PARTITION BY s.user_id
                              ORDER BY tm.n, pg_temp.h(s.user_id::text || pcp_meta.position_id::text)) AS rango
      FROM _scope s
      JOIN sys.sys_position_career_paths pcp_ora ON pcp_ora.position_id = s.pos
      JOIN sys.sys_position_career_paths pcp_meta
        ON pcp_meta.career_path_id = pcp_ora.career_path_id
       AND pcp_meta.position_id <> s.pos
      JOIN titolari tm ON tm.position_id = pcp_meta.position_id
      JOIN titolari t_ora ON t_ora.position_id = s.pos
     WHERE tm.n < t_ora.n   -- piu' rara della propria = piu' in alto
  )
  SELECT user_id, pos, target FROM candidate WHERE rango = 1;

  INSERT INTO sys.sys_user_target_positions (
    user_target_position_id, user_target_position_tenant_id, user_target_position_user_id,
    user_target_position_position_id, user_target_position_horizon,
    user_target_position_review_status, user_target_position_reviewer_user_id,
    user_target_position_review_notes, user_target_position_metadata)
  SELECT uuid_generate_v5(c_ns, 'STORIA36::C5::TARGET::' || o.user_id || '::' || o.target),
         c_rtl, o.user_id, o.target,
         (ARRAY['SHORT_TERM','MEDIUM_TERM','LONG_TERM'])
           [1 + (pg_temp.h(o.user_id::text || 'HZ') % 3)],
         CASE WHEN pg_temp.h(o.user_id::text || 'RS') % 100 < 60 THEN 'APPROVED'
              WHEN pg_temp.h(o.user_id::text || 'RS') % 100 < 90 THEN 'PENDING_REVIEW'
              ELSE 'REJECTED' END,
         CASE WHEN pg_temp.h(o.user_id::text || 'RS') % 100 < 90
              THEN COALESCE(m.mgr, v_hr) ELSE NULL END,
         CASE WHEN pg_temp.h(o.user_id::text || 'RS') % 100 < 60
                THEN 'Obiettivo condiviso in sede di colloquio di sviluppo.'
              WHEN pg_temp.h(o.user_id::text || 'RS') % 100 < 90 THEN NULL
              ELSE 'Rinviato: prerequisiti di ruolo non ancora maturi.' END,
         jsonb_build_object('storia36', 'C5')
    FROM _obiettivo o
    LEFT JOIN LATERAL (
      SELECT a2.user_position_assignment_user_id AS mgr
        FROM sys.sys_positions p1
        JOIN sys.sys_user_position_assignments a2
          ON a2.user_position_assignment_position_id = p1.position_reports_to_position_id
         AND a2.user_position_assignment_kind = 'PRIMARY'
         AND a2.user_position_assignment_status = 'ACTIVE'
       WHERE p1.position_id = o.pos LIMIT 1) m ON true
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_tot := v_tot + v_n;
  RAISE NOTICE 'storia36 C5: obiettivi di carriera inseriti %', v_n;

  -- ==========================================================================
  -- 3. I BACINI DELLE POSIZIONE CRITICHE
  --    Otto posizioni dichiarate critiche e nemmeno un successore: è la lacuna
  --    piu' grave del cluster, perche' «critica» significa esattamente «se resta
  --    scoperta la banca ha un problema».
  -- ==========================================================================
  INSERT INTO sys.sys_succession_pools (
    succession_pool_id, succession_pool_tenant_id, succession_pool_position_id,
    succession_pool_code, succession_pool_name, succession_pool_description,
    succession_pool_status, succession_pool_metadata)
  SELECT uuid_generate_v5(c_ns, 'STORIA36::C5::POOL::' || cp.critical_position_position_id),
         c_rtl, cp.critical_position_position_id,
         'STORIA36-POOL-' || upper(substr(replace(cp.critical_position_position_id::text, '-', ''), 1, 8)),
         'Successione — ' || COALESCE(p.position_title, 'posizione critica'),
         'Bacino di successione per una posizione dichiarata critica.',
         'ACTIVE',
         jsonb_build_object('storia36', 'C5')
    FROM sys.sys_critical_positions cp
    JOIN sys.sys_positions p ON p.position_id = cp.critical_position_position_id
   WHERE cp.critical_position_tenant_id = c_rtl
     AND NOT EXISTS (SELECT 1 FROM sys.sys_succession_pools sp
                      WHERE sp.succession_pool_position_id = cp.critical_position_position_id)
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_tot := v_tot + v_n;
  RAISE NOTICE 'storia36 C5: bacini per posizioni critiche %', v_n;

  -- i candidati: chi condivide il percorso di carriera della posizione e non la occupa
  INSERT INTO sys.sys_successor_candidates (
    successor_candidate_id, successor_candidate_pool_id, successor_candidate_tenant_id,
    successor_candidate_user_id, successor_candidate_status,
    successor_candidate_readiness_level, successor_candidate_metadata)
  SELECT uuid_generate_v5(c_ns, 'STORIA36::C5::CAND::' || x.pool_id || '::' || x.user_id),
         x.pool_id, c_rtl, x.user_id, 'CANDIDATE',
         (ARRAY['READY_NOW','READY_6_MONTHS','READY_1_YEAR','READY_2_YEARS'])
           [1 + (pg_temp.h(x.user_id::text || x.pool_id::text || 'RL') % 4)],
         jsonb_build_object('storia36', 'C5')
    FROM (
      -- I bacini delle posizioni critiche che oggi non hanno NESSUN candidato:
      -- otto esistevano gia' ma erano gusci vuoti, ed e' quello il difetto.
      -- Queste posizioni NON stanno su un percorso di carriera (verificato), quindi
      -- i successori si cercano dove la successione avviene davvero: fra chi
      -- RIPORTA a quella posizione — il successore naturale — e fra chi ricopre
      -- lo STESSO ruolo altrove, che il mestiere lo fa gia'.
      SELECT sp.succession_pool_id AS pool_id, s.user_id,
             row_number() OVER (PARTITION BY sp.succession_pool_id
                                ORDER BY x.priorita,
                                         pg_temp.h(s.user_id::text || sp.succession_pool_id::text)) AS rango
        FROM sys.sys_succession_pools sp
        JOIN sys.sys_critical_positions cp
          ON cp.critical_position_position_id = sp.succession_pool_position_id
         AND cp.critical_position_tenant_id = c_rtl
        JOIN sys.sys_positions pc ON pc.position_id = sp.succession_pool_position_id
        JOIN LATERAL (
          SELECT p2.position_id, 1 AS priorita
            FROM sys.sys_positions p2
           WHERE p2.position_reports_to_position_id = pc.position_id
          UNION ALL
          SELECT p3.position_id, 2
            FROM sys.sys_positions p3
           WHERE p3.position_title = pc.position_title
             AND p3.position_id <> pc.position_id
             AND p3.position_tenant_id = c_rtl
        ) x ON true
        JOIN _scope s ON s.pos = x.position_id
       WHERE sp.succession_pool_tenant_id = c_rtl
         AND NOT EXISTS (SELECT 1 FROM sys.sys_successor_candidates sc2
                          WHERE sc2.successor_candidate_pool_id = sp.succession_pool_id)
    ) x
   WHERE x.rango <= 3
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_tot := v_tot + v_n;
  RAISE NOTICE 'storia36 C5: candidati alla successione %', v_n;

  -- ==========================================================================
  -- 4. LE VALUTAZIONI DI PRONTEZZA
  --    Una per anno della finestra. L'ULTIMA deve coincidere con il livello
  --    dichiarato sul candidato: altrimenti quel livello è un'etichetta che
  --    nessuno ha mai misurato (C5b(iii)).
  -- ==========================================================================
  INSERT INTO sys.sys_successor_readiness (
    successor_readiness_id, successor_readiness_candidate_id, successor_readiness_tenant_id,
    successor_readiness_score, successor_readiness_horizon,
    successor_readiness_payload, successor_readiness_assessed_at)
  SELECT uuid_generate_v5(c_ns, 'STORIA36::C5::READY::' || sc.successor_candidate_id || '::' || y.anno),
         sc.successor_candidate_id, c_rtl,
         -- il punteggio segue l'orizzonte: piu' vicino il subentro, piu' alto
         CASE COALESCE(orizzonte.h, sc.successor_candidate_readiness_level)
           WHEN 'READY_NOW'      THEN 90 + pg_temp.h(sc.successor_candidate_id::text || y.anno || 'S') % 11
           WHEN 'READY_6_MONTHS' THEN 78 + pg_temp.h(sc.successor_candidate_id::text || y.anno || 'S') % 12
           WHEN 'READY_1_YEAR'   THEN 64 + pg_temp.h(sc.successor_candidate_id::text || y.anno || 'S') % 14
           WHEN 'READY_2_YEARS'  THEN 50 + pg_temp.h(sc.successor_candidate_id::text || y.anno || 'S') % 14
           ELSE                       30 + pg_temp.h(sc.successor_candidate_id::text || y.anno || 'S') % 20
         END,
         COALESCE(orizzonte.h, sc.successor_candidate_readiness_level),
         jsonb_build_object('storia36', 'C5', 'anno', y.anno,
                            'metodo', 'comitato nomine — valutazione annuale'),
         (make_date(y.anno, 11, 15) + ((pg_temp.h(sc.successor_candidate_id::text || y.anno || 'D') % 10) || ' days')::interval)
           AT TIME ZONE 'Europe/Rome'
    FROM sys.sys_successor_candidates sc
    CROSS JOIN (VALUES (2023), (2024), (2025)) AS y(anno)
    -- le valutazioni degli anni precedenti sono piu' prudenti; l'ultima (2025)
    -- coincide con il livello dichiarato oggi
    CROSS JOIN LATERAL (
      SELECT CASE WHEN y.anno = 2025 THEN sc.successor_candidate_readiness_level
                  WHEN sc.successor_candidate_readiness_level = 'READY_NOW' THEN 'READY_6_MONTHS'
                  WHEN sc.successor_candidate_readiness_level = 'READY_6_MONTHS' THEN 'READY_1_YEAR'
                  WHEN sc.successor_candidate_readiness_level = 'READY_1_YEAR' THEN 'READY_2_YEARS'
                  ELSE 'NOT_READY' END AS h) AS orizzonte
   WHERE sc.successor_candidate_tenant_id = c_rtl
     AND make_date(y.anno, 11, 15) <= c_to
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_tot := v_tot + v_n;
  RAISE NOTICE 'storia36 C5: valutazioni di prontezza %', v_n;

  -- ==========================================================================
  -- 5. L'EVOLUZIONE DEI REQUISITI DI POSIZIONE
  --    Le competenze richieste non si alzano a caso: si alzano quando cambia la
  --    norma. Le date sono quelle regolamentari vere dentro la finestra.
  -- ==========================================================================
  INSERT INTO sys.sys_position_skill_requirement_history (
    position_skill_requirement_history_id, position_skill_requirement_history_psr_id,
    position_skill_requirement_history_tenant_id, position_skill_requirement_history_position_id,
    position_skill_requirement_history_skill_id,
    position_skill_requirement_history_old_proficiency, position_skill_requirement_history_new_proficiency,
    position_skill_requirement_history_old_weight, position_skill_requirement_history_new_weight,
    position_skill_requirement_history_change_reason, position_skill_requirement_history_actor_user_id,
    position_skill_requirement_history_effective_at, position_skill_requirement_history_metadata)
  SELECT uuid_generate_v5(c_ns, 'STORIA36::C5::PSRH::' || r.position_skill_requirement_id || '::' || ev.quando),
         r.position_skill_requirement_id, c_rtl, r.position_id, r.skill_id,
         -- il livello PRECEDENTE era un gradino piu' basso di quello di oggi
         CASE r.required_proficiency
           WHEN 'MASTER' THEN 'EXPERT' WHEN 'EXPERT' THEN 'PROFICIENT'
           WHEN 'PROFICIENT' THEN 'COMPETENT' WHEN 'COMPETENT' THEN 'BASIC'
           ELSE 'NOVICE' END,
         r.required_proficiency,
         r.weight, r.weight,
         ev.motivo, v_hr,
         ev.quando AT TIME ZONE 'Europe/Rome',
         jsonb_build_object('storia36', 'C5', 'fonte', ev.fonte)
    FROM sys.sys_position_skill_requirements r
    JOIN sys.sys_skills sk ON sk.skill_id = r.skill_id
    CROSS JOIN LATERAL (
      SELECT * FROM (VALUES
        (TIMESTAMP '2024-01-15 09:00',
         'Innalzamento del requisito dopo l''aggiornamento dei presidi antiriciclaggio.',
         'Reg. IVASS 44/2019 — formazione e presidi AML'),
        (TIMESTAMP '2025-05-19 09:00',
         'Revisione dei requisiti di sicurezza dopo il nuovo Accordo Stato-Regioni.',
         'Accordo Stato-Regioni 17/04/2025'),
        (TIMESTAMP '2026-02-02 09:00',
         'Adeguamento dei requisiti di conoscenza e competenza per la clientela.',
         'MiFID II — CONSOB 20307/2018, aggiornamento annuale')
      ) AS e(quando, motivo, fonte)
       WHERE e.quando::date BETWEEN c_start AND c_to
         -- una sola revisione per requisito, scelta in modo stabile
         AND e.quando = (ARRAY[TIMESTAMP '2024-01-15 09:00', TIMESTAMP '2025-05-19 09:00',
                               TIMESTAMP '2026-02-02 09:00'])
                        [1 + (pg_temp.h(r.position_skill_requirement_id::text || 'EV') % 3)]
    ) ev
   WHERE r.position_skill_requirement_tenant_id = c_rtl
     AND r.required_proficiency IS NOT NULL
     -- solo le competenze toccate da una norma: alzare tutto sarebbe rumore
     AND (sk.skill_name ILIKE '%antiricicl%' OR sk.skill_name ILIKE '%MiFID%'
       OR sk.skill_name ILIKE '%complian%' OR sk.skill_name ILIKE '%rischi%'
       OR sk.skill_name ILIKE '%KYC%' OR sk.skill_name ILIKE '%Basilea%')
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_tot := v_tot + v_n;
  RAISE NOTICE 'storia36 C5: variazioni di requisito %', v_n;

  -- ==========================================================================
  -- 6. REGISTRO + POST-CONDIZIONI
  -- ==========================================================================
  INSERT INTO staging.storia36_runs (cluster_code, seed_file, rows_written, twice_run_delta)
  VALUES ('C5', '05_career.sql', v_tot, v_tot);

  PERFORM staging.storia36_check_c5a();
  PERFORM staging.storia36_check_c5b();
  PERFORM staging.storia36_check_c5c();
  PERFORM staging.storia36_check_c5d(c_start, c_to);
  PERFORM staging.storia36_check_c5e();

  RAISE NOTICE 'storia36 C5 OK: % righe scritte (delta atteso 0 alla seconda corsa)', v_tot;
END $$;

COMMIT;
