-- ============================================================================
-- storia36 C8 — ENGAGEMENT: i cicli di ascolto, il clima, le azioni
--
-- Piano: docs/superpowers/plans/2026-07-27-rtl-storia-36-mesi.md (Task C8)
--
-- Quello che c'era, misurato prima di toccarlo:
--   · 8 cicli in `sys_surveys`, ma solo 3 con risposte. Gli altri quattro sono
--     GUSCI: stato «chiuso», 156 inviti dichiarati, ZERO domande e ZERO
--     risposte. Un questionario senza domande non è un questionario.
--   · due cicli fermi in stato «attivo» da novembre 2025 — otto mesi — e una
--     «QA Survey» in bozza, senza date: residuo di collaudo rimasto in mezzo.
--   · copertura temporale: niente 2023, niente primo semestre 2024, niente
--     2026. E soprattutto NIENTE attorno al marzo 2025, cioè attorno alla
--     riorganizzazione: il momento in cui il clima si misura davvero.
--   · nell'altra famiglia (`sys_engagement_surveys`) il tasso di risposta è
--     del 92-96%: nessuna azienda lo ottiene, il riferimento di settore sta
--     fra il 60 e l'85%.
--
-- COSA SCRIVE QUESTO SEED:
--
--  1. RIPARA ciò che è incoerente: i quattro gusci diventano «archiviati» (uno
--     stato che dice la verità: il ciclo non si è svolto), i cicli rimasti
--     aperti si chiudono alla loro data di fine, la survey di collaudo esce di
--     mezzo. Nessuna riga viene cancellata.
--  2. AGGIUNGE i cinque cicli mancanti, con le loro domande e le risposte
--     delle persone, portando la copertura su tutti i 36 mesi.
--  3. RACCONTA il clima invece di sorteggiarlo. La curva non è casuale ed è
--     l'unica parte che vale la pena leggere:
--        2023-H2  7,6   la linea di partenza
--        2024-H1  7,7   crescita moderata e stabile
--        2024-Q4  7,71  (ciclo già presente, non toccato)
--        2025-H1  6,9   ← il mese dopo la riorganizzazione del 2025-03
--        2025-H2  7,41  (ciclo già presente) — il recupero comincia
--        2025-Q4  7,39  (ciclo già presente)
--        2026-H1  7,6   risalita
--        2026-H2  7,75  sopra il punto di partenza
--     Una riorganizzazione costa circa mezzo punto di clima e il recupero
--     richiede due-quattro trimestri: è ciò che la letteratura HR osserva, ed
--     è la forma che questa curva ha.
--  4. FA SEGUIRE LE AZIONI ai risultati: il ciclo sotto soglia (2025-H1)
--     produce piani d'azione con un responsabile e una scadenza. Un clima che
--     scende e nessuno che fa niente sarebbe la cosa meno credibile di tutte.
--
-- Il tasso di risposta dei cicli nuovi sta fra il 62% e l'82%: chi non risponde
-- è parte del dato.
--
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
  c_to    date;
  v_hr    uuid;
  v_n     bigint := 0;
  v_tot   bigint := 0;
BEGIN
  SELECT staging.storia36_c4_frontier() INTO STRICT c_to;
  SELECT user_id INTO STRICT v_hr FROM sys.sys_users
   WHERE user_email = 'federica.marchetti@rtl-bank.org';

  -- ==========================================================================
  -- 1. LE RIPARAZIONI — dire la verità su ciò che non si è svolto
  -- ==========================================================================
  -- un ciclo chiuso senza una sola domanda non si è svolto: «archiviato» è lo
  -- stato che lo descrive. Gli inviti dichiarati scendono a zero, perché
  -- nessuno è mai stato invitato a rispondere a niente.
  UPDATE sys.sys_surveys s
     SET survey_status = 'archived',
         survey_total_invitations = 0,
         survey_metadata = COALESCE(s.survey_metadata, '{}'::jsonb)
           || jsonb_build_object('storia36_riparazione', 'C8', 'motivo',
                'ciclo mai svolto: nessuna domanda, nessuna risposta'),
         updated_at = now()
   WHERE s.survey_tenant_id = c_rtl
     AND s.survey_status IN ('closed', 'active')
     AND NOT EXISTS (SELECT 1 FROM sys.sys_survey_questions q
                      WHERE q.survey_question_survey_id = s.survey_id)
     AND NOT EXISTS (SELECT 1 FROM sys.sys_survey_responses r
                      WHERE r.survey_response_survey_id = s.survey_id);
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RAISE NOTICE 'storia36 C8: cicli guscio archiviati %', v_n;

  -- un ciclo «attivo» la cui finestra è chiusa da mesi è finito: si chiude
  UPDATE sys.sys_surveys s
     SET survey_status = 'closed',
         survey_metadata = COALESCE(s.survey_metadata, '{}'::jsonb)
           || jsonb_build_object('storia36_riparazione', 'C8', 'motivo',
                'ciclo rimasto aperto oltre la propria finestra'),
         updated_at = now()
   WHERE s.survey_tenant_id = c_rtl
     AND s.survey_status = 'active'
     AND s.survey_end_date IS NOT NULL
     AND s.survey_end_date::date < c_to - 30;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RAISE NOTICE 'storia36 C8: cicli rimasti aperti, chiusi alla loro scadenza %', v_n;

  -- la stessa cosa nell'altra famiglia, dove un ciclo è aperto da 18 mesi
  UPDATE sys.sys_engagement_surveys s
     SET survey_status = 'closed',
         survey_metadata = COALESCE(s.survey_metadata, '{}'::jsonb)
           || jsonb_build_object('storia36_riparazione', 'C8', 'motivo',
                'ciclo rimasto aperto oltre la propria finestra'),
         updated_at = now()
   WHERE s.survey_tenant_id = c_rtl
     AND s.survey_status = 'active'
     AND s.survey_end_date IS NOT NULL
     AND s.survey_end_date::date < c_to - 30;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RAISE NOTICE 'storia36 C8: cicli di ascolto chiusi nell''altra famiglia %', v_n;

  -- un ciclo non può avere più rispondenti che invitati: «Annual Engagement
  -- Survey 2025» dichiarava 150 inviti e raccoglieva 156 risposte — il 104%.
  -- Gli inviti diventano il numero di persone in forza alla data di apertura,
  -- che è un dato derivabile e non un numero scritto a mano.
  UPDATE sys.sys_surveys s
     SET survey_total_invitations = GREATEST(
           (SELECT count(*) FROM sys.sys_users u
             JOIN sys.sys_user_employment e ON e.user_employment_user_id = u.user_id
            WHERE u.user_tenant_id = c_rtl AND u.user_status = 'ACTIVE'
              AND e.user_employment_hire_date <= s.survey_start_date::date),
           (SELECT count(DISTINCT r.survey_response_subject_user_id)
              FROM sys.sys_survey_responses r
             WHERE r.survey_response_survey_id = s.survey_id)),
         survey_metadata = COALESCE(s.survey_metadata, '{}'::jsonb)
           || jsonb_build_object('storia36_riparazione', 'C8', 'motivo',
                'invitati inferiori ai rispondenti'),
         updated_at = now()
   WHERE s.survey_tenant_id = c_rtl
     AND s.survey_start_date IS NOT NULL
     AND s.survey_total_invitations < (
           SELECT count(DISTINCT r.survey_response_subject_user_id)
             FROM sys.sys_survey_responses r
            WHERE r.survey_response_survey_id = s.survey_id);
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RAISE NOTICE 'storia36 C8: cicli con più risposte che inviti, riparati %', v_n;

  -- la survey di collaudo esce di mezzo
  UPDATE sys.sys_surveys s
     SET survey_status = 'archived',
         survey_metadata = COALESCE(s.survey_metadata, '{}'::jsonb)
           || jsonb_build_object('storia36_riparazione', 'C8', 'motivo', 'residuo di collaudo'),
         updated_at = now()
   WHERE s.survey_tenant_id = c_rtl
     AND s.survey_status = 'draft'
     AND s.survey_start_date IS NULL;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RAISE NOTICE 'storia36 C8: residui di collaudo archiviati %', v_n;

  -- ==========================================================================
  -- 2. I CICLI MANCANTI — con la curva del clima
  -- ==========================================================================
  CREATE TEMP TABLE _cicli ON COMMIT DROP AS
  SELECT * FROM (VALUES
    ('2023-H2', DATE '2023-10-09', DATE '2023-10-27', 7.60, 0.74),
    ('2024-H1', DATE '2024-04-08', DATE '2024-04-26', 7.70, 0.72),
    -- il mese dopo la riorganizzazione del 2025-03: è qui che si misura
    ('2025-H1', DATE '2025-04-07', DATE '2025-04-24', 6.90, 0.95),
    ('2026-H1', DATE '2026-03-09', DATE '2026-03-27', 7.60, 0.78),
    ('2026-H2', DATE '2026-06-08', DATE '2026-06-26', 7.75, 0.70)
  ) AS c(periodo, dal, al, media, dispersione)
   WHERE c.al <= c_to;

  INSERT INTO sys.sys_surveys (
    survey_id, survey_tenant_id, survey_natural_key, survey_title, survey_description,
    survey_type, survey_status, survey_start_date, survey_end_date,
    survey_is_anonymous, survey_total_invitations, survey_metadata, created_at, updated_at)
  SELECT uuid_generate_v5(c_ns, 'STORIA36::C8::SURVEY::' || c.periodo),
         c_rtl, 'STORIA36-ENG-' || c.periodo,
         'Rilevazione di clima ' || c.periodo,
         'Rilevazione semestrale sul clima interno: coinvolgimento, crescita, riconoscimento, carico di lavoro.',
         'engagement', 'closed', c.dal, c.al,
         true,
         (SELECT count(*) FROM sys.sys_users u
           JOIN sys.sys_user_employment e ON e.user_employment_user_id = u.user_id
          WHERE u.user_tenant_id = c_rtl AND u.user_status = 'ACTIVE'
            AND e.user_employment_hire_date <= c.dal),
         jsonb_build_object('storia36', 'C8', 'periodo', c.periodo, 'media_attesa', c.media),
         c.dal::timestamptz, c.al::timestamptz
    FROM _cicli c
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_tot := v_tot + v_n;
  RAISE NOTICE 'storia36 C8: cicli di rilevazione aggiunti %', v_n;

  -- le domande: le stesse otto in ogni ciclo, così i periodi si confrontano
  INSERT INTO sys.sys_survey_questions (
    survey_question_id, survey_question_survey_id, survey_question_tenant_id,
    survey_question_natural_key, survey_question_text, survey_question_type,
    survey_question_category, survey_question_display_order, survey_question_is_required)
  SELECT uuid_generate_v5(c_ns, 'STORIA36::C8::Q::' || c.periodo || '::' || d.ordine),
         uuid_generate_v5(c_ns, 'STORIA36::C8::SURVEY::' || c.periodo),
         c_rtl,
         'STORIA36-ENG-' || c.periodo || '-Q' || d.ordine,
         d.testo, 'rating', d.categoria, d.ordine, true
    FROM _cicli c
    CROSS JOIN (VALUES
      (1, 'Consiglierei questa banca come posto di lavoro.', 'appartenenza'),
      (2, 'Il mio lavoro mi dà soddisfazione.', 'coinvolgimento'),
      (3, 'Ho occasioni concrete di crescere professionalmente.', 'crescita'),
      (4, 'Il mio contributo viene riconosciuto.', 'riconoscimento'),
      (5, 'Il carico di lavoro è sostenibile.', 'carico di lavoro'),
      (6, 'Il mio responsabile mi sostiene quando serve.', 'responsabile'),
      (7, 'Le informazioni che mi servono arrivano in tempo.', 'comunicazione'),
      (8, 'So dove sta andando la banca e che parte ho io.', 'direzione')
    ) AS d(ordine, testo, categoria)
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_tot := v_tot + v_n;
  RAISE NOTICE 'storia36 C8: domande dei cicli %', v_n;

  -- le risposte: chi c'era già in azienda, e non tutti — il tasso sta fra il
  -- 62% e l'82%, chi non risponde è parte del dato
  INSERT INTO sys.sys_survey_responses (
    survey_response_id, survey_response_survey_id, survey_response_question_id,
    survey_response_tenant_id, survey_response_subject_user_id, survey_response_natural_key,
    survey_response_rating_value, survey_response_metadata, created_at)
  SELECT uuid_generate_v5(c_ns, 'STORIA36::C8::R::' || c.periodo || '::' || u.user_id || '::' || d.ordine),
         uuid_generate_v5(c_ns, 'STORIA36::C8::SURVEY::' || c.periodo),
         uuid_generate_v5(c_ns, 'STORIA36::C8::Q::' || c.periodo || '::' || d.ordine),
         c_rtl, u.user_id,
         'STORIA36-ENG-' || c.periodo || '-' || left(u.user_id::text, 8) || '-Q' || d.ordine,
         -- il voto oscilla attorno alla media del periodo: la dispersione si
         -- allarga quando il clima peggiora, perché è lì che le opinioni si
         -- dividono
         GREATEST(1, LEAST(10, round(
           c.media
           + c.dispersione * (((pg_temp.h(u.user_id::text || c.periodo || d.ordine || 'V') % 100) - 50) / 33.0)
           -- le domande su riconoscimento e carico pesano sempre un po' meno
           - CASE WHEN d.ordine IN (4, 5) THEN 0.45 ELSE 0 END
         )))::int,
         jsonb_build_object('storia36', 'C8', 'periodo', c.periodo),
         (c.dal + (pg_temp.h(u.user_id::text || c.periodo || 'GG') % GREATEST(1, (c.al - c.dal))))::timestamptz
    FROM _cicli c
    CROSS JOIN LATERAL (
      SELECT u2.user_id
        FROM sys.sys_users u2
        JOIN sys.sys_user_employment e2 ON e2.user_employment_user_id = u2.user_id
       WHERE u2.user_tenant_id = c_rtl AND u2.user_status = 'ACTIVE'
         AND e2.user_employment_hire_date <= c.dal
         -- chi risponde: fra il 62% e l'82%, deciso per persona e per ciclo
         AND (pg_temp.h(u2.user_id::text || c.periodo || 'RISP') % 100)
             < (62 + pg_temp.h(c.periodo || 'RATE') % 21)
    ) u
    CROSS JOIN (VALUES (1),(2),(3),(4),(5),(6),(7),(8)) AS d(ordine)
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_tot := v_tot + v_n;
  RAISE NOTICE 'storia36 C8: risposte alle rilevazioni %', v_n;

  -- il ciclo APERTO ADESSO. Non è un dettaglio: una banca ha sempre un ascolto
  -- in corso, e senza di esso il portale del dipendente non ha nulla da
  -- compilare — la riparazione che ha chiuso i cicli scaduti aveva lasciato
  -- l'ESS a mani vuote. Appena aperto: le domande ci sono, le risposte no.
  INSERT INTO sys.sys_surveys (
    survey_id, survey_tenant_id, survey_natural_key, survey_title, survey_description,
    survey_type, survey_status, survey_start_date, survey_end_date,
    survey_is_anonymous, survey_total_invitations, survey_metadata, created_at, updated_at)
  SELECT uuid_generate_v5(c_ns, 'STORIA36::C8::SURVEY::IN-CORSO'),
         c_rtl, 'STORIA36-ENG-IN-CORSO',
         'Rilevazione di clima in corso',
         'Rilevazione semestrale sul clima interno: la finestra di risposta è aperta.',
         'engagement', 'active', (c_to - 6)::timestamptz, (c_to + 14)::timestamptz,
         true,
         (SELECT count(*) FROM sys.sys_users u WHERE u.user_tenant_id = c_rtl AND u.user_status = 'ACTIVE'),
         jsonb_build_object('storia36', 'C8', 'periodo', 'in-corso'),
         (c_to - 6)::timestamptz, (c_to - 6)::timestamptz
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_tot := v_tot + v_n;
  RAISE NOTICE 'storia36 C8: rilevazione in corso %', v_n;

  INSERT INTO sys.sys_survey_questions (
    survey_question_id, survey_question_survey_id, survey_question_tenant_id,
    survey_question_natural_key, survey_question_text, survey_question_type,
    survey_question_category, survey_question_display_order, survey_question_is_required)
  SELECT uuid_generate_v5(c_ns, 'STORIA36::C8::Q::IN-CORSO::' || d.ordine),
         uuid_generate_v5(c_ns, 'STORIA36::C8::SURVEY::IN-CORSO'), c_rtl,
         'STORIA36-ENG-IN-CORSO-Q' || d.ordine,
         d.testo, 'rating', d.categoria, d.ordine, true
    FROM (VALUES
      (1, 'Consiglierei questa banca come posto di lavoro.', 'appartenenza'),
      (2, 'Il mio lavoro mi dà soddisfazione.', 'coinvolgimento'),
      (3, 'Ho occasioni concrete di crescere professionalmente.', 'crescita'),
      (4, 'Il mio contributo viene riconosciuto.', 'riconoscimento'),
      (5, 'Il carico di lavoro è sostenibile.', 'carico di lavoro'),
      (6, 'Il mio responsabile mi sostiene quando serve.', 'responsabile'),
      (7, 'Le informazioni che mi servono arrivano in tempo.', 'comunicazione'),
      (8, 'So dove sta andando la banca e che parte ho io.', 'direzione')
    ) AS d(ordine, testo, categoria)
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_tot := v_tot + v_n;
  RAISE NOTICE 'storia36 C8: domande della rilevazione in corso %', v_n;

  -- l'invito è l'assegnazione: chi risulta invitato deve avere la sua riga,
  -- altrimenti «total_invitations» è un numero che non corrisponde a nessuno
  INSERT INTO sys.sys_survey_assignments (
    survey_assignment_id, survey_assignment_survey_id, survey_assignment_user_id,
    survey_assignment_tenant_id, survey_assignment_assigned_at,
    survey_assignment_completed_at, survey_assignment_metadata)
  SELECT uuid_generate_v5(c_ns, 'STORIA36::C8::ASG::IN-CORSO::' || u.user_id),
         uuid_generate_v5(c_ns, 'STORIA36::C8::SURVEY::IN-CORSO'), u.user_id, c_rtl,
         (c_to - 6)::timestamptz, NULL,
         jsonb_build_object('storia36', 'C8')
    FROM sys.sys_users u
   WHERE u.user_tenant_id = c_rtl AND u.user_status = 'ACTIVE'
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_tot := v_tot + v_n;
  RAISE NOTICE 'storia36 C8: inviti alla rilevazione in corso %', v_n;

  -- e per i cicli conclusi: l'assegnazione di chi era invitato, con la data di
  -- compilazione per chi ha risposto davvero
  INSERT INTO sys.sys_survey_assignments (
    survey_assignment_id, survey_assignment_survey_id, survey_assignment_user_id,
    survey_assignment_tenant_id, survey_assignment_assigned_at,
    survey_assignment_completed_at, survey_assignment_metadata)
  SELECT uuid_generate_v5(c_ns, 'STORIA36::C8::ASG::' || c.periodo || '::' || u.user_id),
         uuid_generate_v5(c_ns, 'STORIA36::C8::SURVEY::' || c.periodo), u.user_id, c_rtl,
         c.dal::timestamptz,
         (SELECT max(r.created_at) FROM sys.sys_survey_responses r
           WHERE r.survey_response_survey_id = uuid_generate_v5(c_ns, 'STORIA36::C8::SURVEY::' || c.periodo)
             AND r.survey_response_subject_user_id = u.user_id),
         jsonb_build_object('storia36', 'C8')
    FROM _cicli c
    CROSS JOIN LATERAL (
      SELECT u2.user_id FROM sys.sys_users u2
        JOIN sys.sys_user_employment e2 ON e2.user_employment_user_id = u2.user_id
       WHERE u2.user_tenant_id = c_rtl AND u2.user_status = 'ACTIVE'
         AND e2.user_employment_hire_date <= c.dal
    ) u
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_tot := v_tot + v_n;
  RAISE NOTICE 'storia36 C8: inviti ai cicli conclusi %', v_n;

  -- ==========================================================================
  -- 3. LE AZIONI CONSEGUENTI — un clima che scende e nessuno che fa niente
  --    sarebbe la cosa meno credibile di tutte
  -- ==========================================================================
  INSERT INTO sys.sys_engagement_action_plans (
    action_plan_id, action_plan_tenant_id, action_plan_natural_key,
    action_plan_source_type, action_plan_source_id, action_plan_title,
    action_plan_description, action_plan_owner_user_id, action_plan_status,
    action_plan_priority, action_plan_due_date, action_plan_completed_at,
    action_plan_created_by_user_id, action_plan_metadata, created_at, updated_at)
  SELECT uuid_generate_v5(c_ns, 'STORIA36::C8::AP::' || c.periodo || '::' || a.n),
         c_rtl, 'STORIA36-AP-' || c.periodo || '-' || a.n,
         'survey', uuid_generate_v5(c_ns, 'STORIA36::C8::SURVEY::' || c.periodo),
         a.titolo, a.descrizione, v_hr,
         CASE WHEN (c.al + 150) <= c_to THEN 'completed' ELSE 'in_progress' END,
         'high', (c.al + 120)::date,
         CASE WHEN (c.al + 150) <= c_to THEN (c.al + 140)::timestamptz END,
         v_hr,
         jsonb_build_object('storia36', 'C8', 'periodo', c.periodo,
                            'media_rilevata', c.media),
         (c.al + 14)::timestamptz, (c.al + 14)::timestamptz
    FROM _cicli c
    CROSS JOIN (VALUES
      (1, 'Incontri di riallineamento dopo il riordino',
          'Ciclo di incontri per divisione: che cosa è cambiato, chi fa cosa, dove ci si rivolge. La rilevazione ha mostrato un calo netto sulla domanda relativa alla direzione.'),
      (2, 'Revisione dei carichi nelle strutture accorpate',
          'Ricognizione dei carichi di lavoro dove il riordino ha unito strutture, con redistribuzione dove la sostenibilità è risultata sotto la media.')
    ) AS a(n, titolo, descrizione)
   -- solo i cicli sotto la soglia di attenzione
   WHERE c.media < 7.2
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_tot := v_tot + v_n;
  RAISE NOTICE 'storia36 C8: piani d''azione conseguenti %', v_n;

  -- ==========================================================================
  -- 4. REGISTRO + POST-CONDIZIONI
  -- ==========================================================================
  INSERT INTO staging.storia36_runs (cluster_code, seed_file, rows_written, twice_run_delta)
  VALUES ('C8', '08_engagement.sql', v_tot, v_tot);

  PERFORM staging.storia36_check_c8a(c_to);
  PERFORM staging.storia36_check_c8b();
  PERFORM staging.storia36_check_c8c();

  RAISE NOTICE 'storia36 C8 OK: % righe scritte (delta atteso 0 alla seconda corsa)', v_tot;
END $$;

COMMIT;
