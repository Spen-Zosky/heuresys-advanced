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
--    su un percorso di carriera che passa per quella attuale ed è più in alto
--    NELL'ORGANIGRAMMA (profondità della catena reports-to), ha un titolo diverso
--    dal proprio e qualcuno che ci lavora. La v1 misurava la verticalità dalla
--    rarità della posizione e degenerava in «scrivania vuota»: 150 obiettivi su
--    150 puntavano a un posto senza titolari.
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
         -- Lo sfasamento stacca l'inizio della carriera dalla fine degli studi.
         -- Senza, la prima esperienza cominciava il giorno esatto della laurea:
         -- 85 date su 255 cadevano il giorno 1 del mese e 104 a gennaio, che è
         -- il calendario dei titoli di studio, non quello delle assunzioni
         -- (rilievo #13/#20). Il cap a un quarto dell'intervallo tiene fermo il
         -- vincolo: nessuno inizia prima di poter lavorare.
         (pg_temp.h(s.user_id::text || 'OFF') % (1 + LEAST(270, (s.hire - s.inizio) / 4))) AS off,
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
         -- Datori di fantasia, dichiarati come tali — ma il datore si sceglie
         -- DENTRO il settore, non accanto: la v2 sorteggiava i due campi
         -- separatamente e la stessa «Banca Popolare del Verbano» risultava
         -- insieme banca, assicurazione e società di consulenza ICT, su 9 datori
         -- su 9 (rilievo #30/#33). La distribuzione fra settori resta 70/20/10.
         sett.datori[1 + (pg_temp.h(t.user_id::text || g.i || 'EMP') % array_length(sett.datori, 1))],
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
         sett.settore,
         -- tratto i-esimo dell'intervallo, con qualche settimana di stacco alla
         -- fine; l'intervallo parte dallo sfasamento, non dalla fine degli studi
         ((t.inizio + t.off) + ((g.i - 1) * (t.giorni - t.off) / t.n_tratti))::date,
         ((t.inizio + t.off) + (g.i * (t.giorni - t.off) / t.n_tratti)
                   - (7 + pg_temp.h(t.user_id::text || g.i || 'GAP') % 80))::date,
         'Esperienza precedente all''ingresso in RTL Bank.',
         jsonb_build_object('storia36', 'C5', 'tratto', g.i, 'su', t.n_tratti,
                            'datore', 'nome di fantasia — il dato non porta il datore reale')
    FROM _tratti t
    CROSS JOIN LATERAL generate_series(1, t.n_tratti) AS g(i)
    CROSS JOIN LATERAL (
      SELECT CASE WHEN pg_temp.h(t.user_id::text || g.i || 'IND') % 10 < 7 THEN 'Banche e servizi finanziari'
                  WHEN pg_temp.h(t.user_id::text || g.i || 'IND') % 10 < 9 THEN 'Assicurazioni'
                  ELSE 'Consulenza e servizi ICT' END AS settore,
             CASE WHEN pg_temp.h(t.user_id::text || g.i || 'IND') % 10 < 7
                    THEN ARRAY['Banca Popolare del Verbano','Credito Lombardo SpA',
                               'Istituto di Credito Adriatico','Banca di Credito Cooperativo Brianza',
                               'Nuova Cassa di Risparmio Padana','Mediocredito Insubria']
                  WHEN pg_temp.h(t.user_id::text || g.i || 'IND') % 10 < 9
                    THEN ARRAY['Assicurazioni Riunite del Nord','Compagnia Assicurativa Lariana',
                               'Mutua Assicuratrice Padana']
                  ELSE ARRAY['Consorzio Servizi Bancari Italia','Sistemi Informativi Bancari Srl',
                             'Finanziaria Ticinese SpA'] END AS datori) sett
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_tot := v_tot + v_n;
  RAISE NOTICE 'storia36 C5: esperienze precedenti inserite %', v_n;

  -- ==========================================================================
  -- 2. GLI OBIETTIVI DI CARRIERA
  --    La posizione obiettivo sta sullo stesso percorso di quella attuale ed è
  --    piu' in alto: nel dato l'unica misura di verticalita' disponibile e' la
  --    rarita' (quante persone occupano quella posizione).
  -- ==========================================================================
  -- La v1 misurava la verticalita' dalla RARITA' della posizione (meno titolari
  -- = piu' in alto): degenerava sistematicamente in "nessuno ci lavora", perche'
  -- il minimo di titolari e' zero. Risultato: 150 obiettivi su 150 puntavano a
  -- una scrivania vuota, 22 direttori di filiale avevano come obiettivo di
  -- crescita diventare cassieri, e il vertice aveva approvato di diventare
  -- cassiere. La verticalita' vera e' nell'organigramma, ed era li' inutilizzata.
  CREATE TEMP TABLE _profondita ON COMMIT DROP AS
  WITH RECURSIVE disc AS (
    SELECT p.position_id, 0 AS livello
      FROM sys.sys_positions p
     WHERE p.position_tenant_id = c_rtl AND p.position_reports_to_position_id IS NULL
    UNION ALL
    SELECT p.position_id, d.livello + 1
      FROM sys.sys_positions p
      JOIN disc d ON d.position_id = p.position_reports_to_position_id
     WHERE p.position_tenant_id = c_rtl
  )
  SELECT position_id, min(livello) AS livello FROM disc GROUP BY 1;

  CREATE TEMP TABLE _obiettivo ON COMMIT DROP AS
  WITH candidate AS (
    SELECT s.user_id, s.pos, pcp_meta.position_id AS target,
           row_number() OVER (
             PARTITION BY s.user_id
             -- il gradino IMMEDIATAMENTE superiore, non il vertice: un cassiere
             -- non aspira all'amministratore delegato
             ORDER BY lm.livello DESC,
                      pg_temp.h(s.user_id::text || pcp_meta.position_id::text)) AS rango
      FROM _scope s
      JOIN _profondita l_ora ON l_ora.position_id = s.pos
      JOIN sys.sys_position_career_paths pcp_ora
        ON pcp_ora.position_id = s.pos
       AND pcp_ora.position_career_path_metadata->>'storia36' = 'C5'
      JOIN sys.sys_position_career_paths pcp_meta
        ON pcp_meta.career_path_id = pcp_ora.career_path_id
       AND pcp_meta.position_id <> s.pos
       AND pcp_meta.position_career_path_metadata->>'storia36' = 'C5'
      JOIN _profondita lm ON lm.position_id = pcp_meta.position_id
      JOIN sys.sys_positions p_meta ON p_meta.position_id = pcp_meta.position_id
      JOIN sys.sys_positions p_ora ON p_ora.position_id = s.pos
     WHERE lm.livello < l_ora.livello                     -- piu' in alto DAVVERO
       AND p_meta.position_title <> p_ora.position_title  -- non lo stesso mestiere
       AND EXISTS (SELECT 1 FROM sys.sys_user_position_assignments a  -- qualcuno ci lavora
                    WHERE a.user_position_assignment_position_id = pcp_meta.position_id
                      AND a.user_position_assignment_status = 'ACTIVE')
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
      -- I successori delle posizioni critiche. Queste posizioni NON stanno su un
      -- percorso di carriera (verificato), quindi i candidati si cercano dove la
      -- successione avviene davvero: fra chi RIPORTA a quella posizione — il
      -- successore naturale — e fra chi ricopre lo STESSO ruolo altrove, che il
      -- mestiere lo fa gia'.
      -- La v2 si fermava ai bacini «senza NESSUN candidato», e così i bacini che
      -- ne avevano già uno qualsiasi restavano com'erano: su 49 candidati, 22 non
      -- soddisfacevano nessuno dei due criteri — erano nomi (rilievo #4/#5). Ora
      -- il criterio vale per tutti i bacini critici; i primi tre per rango sono
      -- deterministici, quindi la seconda corsa non aggiunge nulla.
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
      -- una traiettoria, non due anni identici: ogni anno che passa avvicina di un
      -- gradino il livello dichiarato oggi
      SELECT (ARRAY['NOT_READY','READY_2_YEARS','READY_1_YEAR','READY_6_MONTHS','READY_NOW'])[
               GREATEST(1,
                 COALESCE(array_position(
                   ARRAY['NOT_READY','READY_2_YEARS','READY_1_YEAR','READY_6_MONTHS','READY_NOW'],
                   sc.successor_candidate_readiness_level), 1) - (2025 - y.anno))] AS h) AS orizzonte
   WHERE sc.successor_candidate_tenant_id = c_rtl
     AND make_date(y.anno, 11, 15) <= c_to
     -- nessuno viene valutato come successore prima di essere stato assunto
     AND make_date(y.anno, 11, 15) >= (
           SELECT min(em.user_employment_hire_date) FROM sys.sys_user_employment em
            WHERE em.user_employment_user_id = sc.successor_candidate_user_id)
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_tot := v_tot + v_n;
  RAISE NOTICE 'storia36 C5: valutazioni di prontezza %', v_n;

  -- L'orizzonte di copertura della posizione non è un'etichetta libera: è quello
  -- del candidato più pronto del suo bacino. Era NULL su tutte e nove le righe
  -- di rilevanza — il campo esisteva, con tanto di vocabolario, e non lo
  -- riempiva nessuno. Sta qui e non nella riparazione perché è un DERIVATO dei
  -- successori: va ricalcolato ogni volta che il bacino cambia.
  UPDATE sys.sys_position_succession_relevance r
     SET readiness_horizon = migliore.h, updated_at = now()
    FROM (
      SELECT sp.succession_pool_position_id AS position_id,
             (ARRAY['READY_NOW','READY_6_MONTHS','READY_1_YEAR','READY_2_YEARS','NOT_READY'])[
               min(array_position(
                 ARRAY['READY_NOW','READY_6_MONTHS','READY_1_YEAR','READY_2_YEARS','NOT_READY'],
                 sc.successor_candidate_readiness_level))] AS h
        FROM sys.sys_succession_pools sp
        JOIN sys.sys_successor_candidates sc
          ON sc.successor_candidate_pool_id = sp.succession_pool_id
       WHERE sp.succession_pool_tenant_id = c_rtl
       GROUP BY 1) migliore
   WHERE migliore.position_id = r.position_id
     AND r.position_succession_relevance_tenant_id = c_rtl
     AND migliore.h IS NOT NULL
     AND r.readiness_horizon IS DISTINCT FROM migliore.h;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RAISE NOTICE 'storia36 C5: orizzonti di copertura derivati dal bacino %', v_n;

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
    -- La v1 sorteggiava la norma con un hash, slegata dalla competenza: 240 righe
    -- su 289 citavano una fonte estranea — "Conformita' MiFID II" innalzata per
    -- l'Accordo Stato-Regioni, che disciplina la sicurezza sul lavoro. Qui la
    -- fonte DERIVA dalla materia, che e' l'unico modo perche' la motivazione
    -- significhi qualcosa. E la data si disperde nei 90 giorni di attuazione:
    -- una banca non riscrive tutti i profili di ruolo lo stesso giorno.
    CROSS JOIN LATERAL (
      SELECT (m.base
              + ((pg_temp.h(r.position_skill_requirement_id::text || 'GG') % 90) || ' days')::interval
              + ((9 + pg_temp.h(r.position_skill_requirement_id::text || 'HH') % 8) || ' hours')::interval) AS quando,
             m.motivo, m.fonte
        FROM (SELECT
          CASE WHEN sk.skill_name ILIKE '%antiricicl%' OR sk.skill_name ILIKE '%KYC%'
                 THEN TIMESTAMP '2024-01-15 00:00'
               WHEN sk.skill_name ILIKE '%MiFID%' OR sk.skill_name ILIKE '%complian%'
                 THEN TIMESTAMP '2026-02-02 00:00'
               ELSE TIMESTAMP '2025-01-09 00:00' END AS base,
          CASE WHEN sk.skill_name ILIKE '%antiricicl%' OR sk.skill_name ILIKE '%KYC%'
                 THEN 'Innalzamento del presidio antiriciclaggio richiesto al ruolo.'
               WHEN sk.skill_name ILIKE '%MiFID%' OR sk.skill_name ILIKE '%complian%'
                 THEN 'Adeguamento dei requisiti di conoscenza e competenza verso la clientela.'
               ELSE 'Revisione del profilo di rischio richiesto al ruolo.' END AS motivo,
          CASE WHEN sk.skill_name ILIKE '%antiricicl%' OR sk.skill_name ILIKE '%KYC%'
                 THEN 'D.Lgs 231/2007 e Provvedimento Banca d''Italia sull''adeguata verifica'
               WHEN sk.skill_name ILIKE '%MiFID%' OR sk.skill_name ILIKE '%complian%'
                 THEN 'MiFID II — Delibera CONSOB 20307/2018, conoscenza e competenza'
               ELSE 'Circolare Banca d''Italia 285 — vigilanza prudenziale' END AS fonte
        ) AS m
       WHERE (m.base + ((pg_temp.h(r.position_skill_requirement_id::text || 'GG') % 90) || ' days')::interval)::date
             BETWEEN c_start AND c_to
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
  -- 6. LA MOBILITÀ INTERNA
  --    In 36 mesi 162 persone e cinque soli cambi di posizione: la banca
  --    risultava un posto dove non ci si muove mai, e ogni carriera cominciava
  --    e finiva sulla stessa scrivania (rilievo #23). Chi oggi ha una
  --    responsabilità ci è arrivato: la provenienza è un riporto diretto della
  --    posizione attuale — una promozione — o una posizione sorella sotto lo
  --    stesso capo — un movimento laterale.
  --    Il PRESENTE non si tocca: posizione e stato di oggi restano identici,
  --    cambia solo da quando la persona la occupa.
  -- ==========================================================================
  CREATE TEMP TABLE _mobilita ON COMMIT DROP AS
  SELECT s.user_id, s.hire, s.pos AS pos_oggi, q.position_id AS pos_prima, q.genere,
         -- il movimento cade fra il primo anno di anzianità e tre mesi fa
         (s.hire + 365
            + (pg_temp.h(s.user_id::text || 'MOV')
               % GREATEST(1, (c_to - 90 - (s.hire + 365)))))::date AS quando
    FROM _scope s
    CROSS JOIN LATERAL (
      SELECT p2.position_id, 'promozione' AS genere, 1 AS priorita
        FROM sys.sys_positions p2
       WHERE p2.position_reports_to_position_id = s.pos
         AND p2.position_tenant_id = c_rtl
      UNION ALL
      SELECT p3.position_id, 'movimento laterale', 2
        FROM sys.sys_positions p3
        JOIN sys.sys_positions p_ora ON p_ora.position_id = s.pos
       WHERE p3.position_reports_to_position_id = p_ora.position_reports_to_position_id
         AND p3.position_id <> s.pos
         AND p3.position_title <> p_ora.position_title
         AND p3.position_tenant_id = c_rtl
       ORDER BY priorita, 1 LIMIT 1) q
   WHERE s.pos IS NOT NULL
     -- una persona su sei circa, e solo con almeno due anni di anzianità:
     -- ~6% di mobilità l'anno, che per una banca di questa taglia è la norma
     AND pg_temp.h(s.user_id::text || 'MOB') % 100 < 18
     AND s.hire <= c_to - 730;

  -- il tratto precedente: la posizione da cui si è arrivati, chiusa il giorno prima
  INSERT INTO sys.sys_user_position_assignments (
    user_position_assignment_id, user_position_assignment_tenant_id,
    user_position_assignment_user_id, user_position_assignment_position_id,
    user_position_assignment_kind, user_position_assignment_fte,
    user_position_assignment_start_date, user_position_assignment_end_date,
    user_position_assignment_status, user_position_assignment_notes,
    user_position_assignment_metadata)
  SELECT uuid_generate_v5(c_ns, 'STORIA36::C5::MOB::' || m.user_id || '::' || m.pos_prima),
         c_rtl, m.user_id, m.pos_prima, 'PRIMARY', 1.0,
         m.hire, (m.quando - 1), 'ENDED',
         CASE m.genere WHEN 'promozione' THEN 'Incarico precedente, chiuso con la promozione.'
                       ELSE 'Incarico precedente, chiuso con il passaggio ad altra funzione.' END,
         jsonb_build_object('storia36', 'C5', 'genere', m.genere)
    FROM _mobilita m
   WHERE m.quando - 1 >= m.hire
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_tot := v_tot + v_n;
  RAISE NOTICE 'storia36 C5: incarichi precedenti (mobilità interna) %', v_n;

  -- e l'incarico di oggi comincia il giorno del movimento, non dell'assunzione
  UPDATE sys.sys_user_position_assignments a
     SET user_position_assignment_start_date = m.quando, updated_at = now()
    FROM _mobilita m
   WHERE a.user_position_assignment_user_id = m.user_id
     AND a.user_position_assignment_position_id = m.pos_oggi
     AND a.user_position_assignment_status = 'ACTIVE'
     AND a.user_position_assignment_start_date IS DISTINCT FROM m.quando
     AND m.quando - 1 >= m.hire;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RAISE NOTICE 'storia36 C5: incarichi correnti ridatati al movimento %', v_n;

  -- ==========================================================================
  -- 7. REGISTRO + POST-CONDIZIONI
  -- ==========================================================================
  INSERT INTO staging.storia36_runs (cluster_code, seed_file, rows_written, twice_run_delta)
  VALUES ('C5', '05_career.sql', v_tot, v_tot);

  PERFORM staging.storia36_check_c5a();
  PERFORM staging.storia36_check_c5b();
  PERFORM staging.storia36_check_c5c();
  PERFORM staging.storia36_check_c5d(c_start, c_to);
  PERFORM staging.storia36_check_c5e();
  PERFORM staging.storia36_check_c5f();
  PERFORM staging.storia36_check_c5g();
  PERFORM staging.storia36_check_c5h();
  PERFORM staging.storia36_check_c5i();
  PERFORM staging.storia36_check_c5j();
  PERFORM staging.storia36_check_c5k();
  PERFORM staging.storia36_check_c5l();

  RAISE NOTICE 'storia36 C5 OK: % righe scritte (delta atteso 0 alla seconda corsa)', v_tot;
END $$;

COMMIT;
