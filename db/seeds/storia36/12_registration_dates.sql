-- ============================================================================
-- storia36 C12 — LA DATA DI REGISTRAZIONE SEGUE IL FATTO REGISTRATO
--
-- Piano: docs/superpowers/plans/2026-07-27-rtl-storia-36-mesi.md (Task C12, Step 12.2)
-- Origine: audit semantico `db/scripts/audit-storia36-semantic.py`, regola C1
--          (artefatto di calendario) — il verbale in docs/kb/storia36/AUDIT_FINALE.md.
--
-- QUELLO CHE L'AUDIT HA TROVATO. Otto tabelle registravano fatti distribuiti su
-- anni diversi con un timestamp di registrazione IDENTICO per tutte le righe —
-- il giorno in cui il seed le ha scritte. Misure KPI del 2024 e del 2025
-- "registrate" lo stesso 3 giugno; 1.560 risultati di valutazione tutti il 30
-- maggio; 178 richieste di straordinario sparse su tre mesi tutte "richieste"
-- il 12 dicembre; 237 auto-valutazioni tutte lo stesso giorno.
--
-- PERCHE' E' UN DIFETTO E NON UN DETTAGLIO. Un sistema che gestisce dati da
-- tempo mostra QUANDO una cosa è stata registrata, e quel quando è distribuito
-- come lo sono i fatti. Un'unica data di registrazione è la firma del
-- popolamento massivo: si vede nella scheda della persona ("ultimo
-- aggiornamento: 3 giugno" su tutto), nei filtri per data, negli ordinamenti
-- per recente. E' esattamente ciò che il programma storia36 esiste per evitare.
--
-- LA REGOLA APPLICATA, una per tabella, tutte della stessa forma: la
-- registrazione segue il fatto, con un ritardo plausibile per il tipo di atto,
-- e cade in un giorno lavorativo a un'ora d'ufficio.
--   · misure e consuntivi di periodo  → fine del periodo + ritardo di chiusura
--   · risultati di una valutazione    → fine del periodo valutato + ritardo
--   · richiesta di straordinario      → PRIMA del giorno di straordinario
--                                       (l'autorizzazione è preventiva)
--   · auto-valutazioni e lacune       → distribuite sulla finestra, ancorate
--                                       alla persona (non hanno un periodo proprio)
--
-- ESCLUSA DI PROPOSITO: `sys_capability_scores`. Ha 317 righe per 317 soggetti
-- distinti — è un'ISTANTANEA dello stato corrente, non la storia dei calcoli:
-- che l'ultimo ricalcolo sia avvenuto tutto insieme è corretto, non artefatto.
-- Stessa logica per i delimitatori di periodo (`*_period_start` al 1° gennaio):
-- quello è il calendario, non un difetto.
--
-- DETERMINISTICO: lo scarto deriva da un hash della chiave della riga, mai da
-- random() — due esecuzioni producono lo stesso istante.
-- IDEMPOTENTE: ogni UPDATE ha `IS DISTINCT FROM` sul valore calcolato, quindi
-- la seconda corsa tocca 0 righe.
-- ============================================================================

\set ON_ERROR_STOP on

BEGIN;

-- ----------------------------------------------------------------------------
-- Helper: un istante deterministico derivato da una chiave, in giorno feriale.
--
--   p_seed  chiave della riga (rende lo scarto stabile e diverso riga per riga)
--   p_base  il fatto a cui la registrazione si riferisce
--   p_min/p_max  finestra del ritardo in giorni (può essere negativa: l'atto
--                che PRECEDE il fatto, come l'autorizzazione allo straordinario)
--
-- Lo snap al giorno lavorativo usa `staging.storia36_calendar` (festività
-- italiane incluse) quando la data è nel suo perimetro, altrimenti ricade sul
-- giorno della settimana. Il risultato non supera mai la fine del mese corrente:
-- il database è produzione viva, ma una registrazione nel futuro non esiste.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION staging.storia36_stamp(
  p_seed text, p_base timestamptz, p_min int, p_max int)
RETURNS timestamptz LANGUAGE plpgsql IMMUTABLE AS $fn$
DECLARE
  v_h      bigint;
  v_span   int := greatest(p_max - p_min + 1, 1);
  v_delta  int;
  v_day    date;
  v_guard  int := 0;
  v_limit  timestamptz := (date_trunc('month', now()) + interval '1 month' - interval '6 hours');
  v_out    timestamptz;
BEGIN
  IF p_base IS NULL THEN
    RETURN NULL;
  END IF;
  -- hash stabile della chiave: 8 esadecimali → intero senza segno
  v_h := ('x' || substr(md5(p_seed), 1, 8))::bit(32)::bigint & 2147483647;
  v_delta := p_min + (v_h % v_span)::int;
  v_day := (p_base + make_interval(days => v_delta))::date;

  -- snap in avanti al primo giorno lavorativo (max 10 tentativi: copre le feste lunghe)
  WHILE v_guard < 10 LOOP
    EXIT WHEN COALESCE(
      (SELECT c.is_workday FROM staging.storia36_calendar c WHERE c.cal_date = v_day),
      extract(isodow FROM v_day) < 6);
    v_day := v_day + 1;
    v_guard := v_guard + 1;
  END LOOP;

  -- ora d'ufficio deterministica: 9:00–17:59
  v_out := v_day::timestamptz
           + make_interval(hours  => 9 + ((v_h / 7) % 9)::int,
                           mins   => ((v_h / 13) % 60)::int);
  RETURN least(v_out, v_limit);
END $fn$;

COMMENT ON FUNCTION staging.storia36_stamp(text, timestamptz, int, int) IS
  'storia36 C12: istante di registrazione deterministico, in giorno lavorativo, '
  'derivato dal fatto registrato. Mai oltre la fine del mese corrente.';

DO $$
DECLARE
  c_rtl constant uuid := '86ba7a65-217f-48ba-8ce5-5c09b40a66b0';
  v_n   bigint;
  v_tot bigint := 0;
BEGIN
  -- ==========================================================================
  -- 1. MISURE KPI — il consuntivo si registra dopo la chiusura del periodo
  -- ==========================================================================
  UPDATE sys.sys_kpi_measurements m
     SET kpi_measurement_recorded_at = staging.storia36_stamp(
           'KPIM::' || m.kpi_measurement_id::text,
           m.kpi_measurement_period_end::timestamptz, 3, 12)
   WHERE m.kpi_measurement_tenant_id = c_rtl
     AND m.kpi_measurement_period_end IS NOT NULL
     AND m.kpi_measurement_recorded_at IS DISTINCT FROM staging.storia36_stamp(
           'KPIM::' || m.kpi_measurement_id::text,
           m.kpi_measurement_period_end::timestamptz, 3, 12);
  GET DIAGNOSTICS v_n = ROW_COUNT; v_tot := v_tot + v_n;
  RAISE NOTICE 'storia36 C12: misure KPI ridatate %', v_n;

  -- ==========================================================================
  -- 2. EVIDENZE KPI DELLA PERSONA — stesso atto, ritardo leggermente minore
  -- ==========================================================================
  UPDATE sys.sys_user_kpi_evidence e
     SET user_kpi_evidence_recorded_at = staging.storia36_stamp(
           'UKPIE::' || e.user_kpi_evidence_id::text,
           e.user_kpi_evidence_period_end::timestamptz, 2, 10)
   WHERE e.user_kpi_evidence_tenant_id = c_rtl
     AND e.user_kpi_evidence_period_end IS NOT NULL
     AND e.user_kpi_evidence_recorded_at IS DISTINCT FROM staging.storia36_stamp(
           'UKPIE::' || e.user_kpi_evidence_id::text,
           e.user_kpi_evidence_period_end::timestamptz, 2, 10);
  GET DIAGNOSTICS v_n = ROW_COUNT; v_tot := v_tot + v_n;
  RAISE NOTICE 'storia36 C12: evidenze KPI ridatate %', v_n;

  -- ==========================================================================
  -- 3. ESITI DI VALUTAZIONE KPI — il calcolo chiude dopo il consuntivo
  -- ==========================================================================
  UPDATE sys.sys_kpi_assessment_results r
     SET kpi_assessment_result_computed_at = staging.storia36_stamp(
           'KPIAR::' || r.kpi_assessment_result_id::text,
           r.kpi_assessment_result_period_end::timestamptz, 5, 20)
   WHERE r.kpi_assessment_result_tenant_id = c_rtl
     AND r.kpi_assessment_result_period_end IS NOT NULL
     AND r.kpi_assessment_result_computed_at IS DISTINCT FROM staging.storia36_stamp(
           'KPIAR::' || r.kpi_assessment_result_id::text,
           r.kpi_assessment_result_period_end::timestamptz, 5, 20);
  GET DIAGNOSTICS v_n = ROW_COUNT; v_tot := v_tot + v_n;
  RAISE NOTICE 'storia36 C12: esiti KPI ridatati %', v_n;

  -- ==========================================================================
  -- 4. RACCOMANDAZIONI RETRIBUTIVE — istruttoria dopo la chiusura del periodo
  -- ==========================================================================
  UPDATE sys.sys_compensation_recommendations c
     SET compensation_recommendation_computed_at = staging.storia36_stamp(
           'COMPREC::' || c.compensation_recommendation_id::text,
           c.compensation_recommendation_period_end::timestamptz, 5, 15)
   WHERE c.compensation_recommendation_tenant_id = c_rtl
     AND c.compensation_recommendation_period_end IS NOT NULL
     AND c.compensation_recommendation_computed_at IS DISTINCT FROM staging.storia36_stamp(
           'COMPREC::' || c.compensation_recommendation_id::text,
           c.compensation_recommendation_period_end::timestamptz, 5, 15);
  GET DIAGNOSTICS v_n = ROW_COUNT; v_tot := v_tot + v_n;
  RAISE NOTICE 'storia36 C12: raccomandazioni retributive ridatate %', v_n;

  -- ==========================================================================
  -- 5. PREMIO VARIABILE — il calcolo chiude dopo l'esercizio che remunera
  -- ==========================================================================
  UPDATE sys.sys_variable_pay_calculations v
     SET variable_pay_calculation_computed_at = staging.storia36_stamp(
           'VPCALC::' || v.variable_pay_calculation_id::text,
           v.variable_pay_calculation_period_end::timestamptz, 10, 25)
   WHERE v.variable_pay_calculation_tenant_id = c_rtl
     AND v.variable_pay_calculation_period_end IS NOT NULL
     AND v.variable_pay_calculation_computed_at IS DISTINCT FROM staging.storia36_stamp(
           'VPCALC::' || v.variable_pay_calculation_id::text,
           v.variable_pay_calculation_period_end::timestamptz, 10, 25);
  GET DIAGNOSTICS v_n = ROW_COUNT; v_tot := v_tot + v_n;
  RAISE NOTICE 'storia36 C12: calcoli del premio variabile ridatati %', v_n;

  -- ==========================================================================
  -- 5b. RISULTATI ED EVIDENZE DI ASSESSMENT.
  --
  --   Qui l'audit ha trovato un SECONDO difetto mentre cercava il primo: gli
  --   assessment padre hanno `assessment_period_end` NULL su tutte e 1.560 le
  --   righe — non c'e' un periodo da seguire. E' un dato mancante, registrato
  --   a parte; qui si ripara cio' che si puo' riparare, la datazione.
  --
  --   L'ancora e' l'ASSESSMENT, non la singola riga: i risultati di una stessa
  --   valutazione devono cadere nello stesso momento, perche' una valutazione
  --   si chiude in un atto solo. Stesso seed → stessa data per tutte le sue righe.
  -- ==========================================================================
  UPDATE sys.sys_assessment_results ar
     SET assessment_result_recorded_at = staging.storia36_stamp(
           'ASSESS::' || ar.assessment_result_assessment_id::text,
           (date_trunc('month', now()) - interval '24 months')::timestamptz, 0, 690)
   WHERE ar.assessment_result_tenant_id = c_rtl
     AND ar.assessment_result_recorded_at IS DISTINCT FROM staging.storia36_stamp(
           'ASSESS::' || ar.assessment_result_assessment_id::text,
           (date_trunc('month', now()) - interval '24 months')::timestamptz, 0, 690);
  GET DIAGNOSTICS v_n = ROW_COUNT; v_tot := v_tot + v_n;
  RAISE NOTICE 'storia36 C12: risultati di assessment ridatati %', v_n;

  UPDATE sys.sys_user_assessment_evidence ue
     SET user_assessment_evidence_recorded_at = staging.storia36_stamp(
           'ASSESS::' || ue.user_assessment_evidence_assessment_id::text,
           (date_trunc('month', now()) - interval '24 months')::timestamptz, 0, 690)
   WHERE ue.user_assessment_evidence_tenant_id = c_rtl
     AND ue.user_assessment_evidence_recorded_at IS DISTINCT FROM staging.storia36_stamp(
           'ASSESS::' || ue.user_assessment_evidence_assessment_id::text,
           (date_trunc('month', now()) - interval '24 months')::timestamptz, 0, 690);
  GET DIAGNOSTICS v_n = ROW_COUNT; v_tot := v_tot + v_n;
  RAISE NOTICE 'storia36 C12: evidenze di assessment ridatate %', v_n;

  -- ==========================================================================
  -- 6. STRAORDINARI — la richiesta PRECEDE il giorno, l'approvazione lo segue
  --    (scarto negativo: è l'unico atto del gruppo che sta prima del fatto)
  -- ==========================================================================
  UPDATE sys.sys_overtime o
     SET overtime_requested_at = staging.storia36_stamp(
           'OTREQ::' || o.overtime_id::text, o.overtime_date::timestamptz, -3, -1)
   WHERE o.overtime_tenant_id = c_rtl
     AND o.overtime_date IS NOT NULL
     AND o.overtime_requested_at IS DISTINCT FROM staging.storia36_stamp(
           'OTREQ::' || o.overtime_id::text, o.overtime_date::timestamptz, -3, -1);
  GET DIAGNOSTICS v_n = ROW_COUNT; v_tot := v_tot + v_n;
  RAISE NOTICE 'storia36 C12: richieste di straordinario ridatate %', v_n;

  UPDATE sys.sys_overtime o
     SET overtime_approved_at = staging.storia36_stamp(
           'OTAPP::' || o.overtime_id::text, o.overtime_date::timestamptz, 1, 6)
   WHERE o.overtime_tenant_id = c_rtl
     AND o.overtime_date IS NOT NULL
     AND o.overtime_approved_at IS NOT NULL
     AND o.overtime_approved_at IS DISTINCT FROM staging.storia36_stamp(
           'OTAPP::' || o.overtime_id::text, o.overtime_date::timestamptz, 1, 6);
  GET DIAGNOSTICS v_n = ROW_COUNT; v_tot := v_tot + v_n;
  RAISE NOTICE 'storia36 C12: approvazioni di straordinario ridatate %', v_n;

  -- ==========================================================================
  -- 7. AUTO-VALUTAZIONI — non hanno un periodo proprio: si distribuiscono
  --    sull'ultimo anno di storia, ancorate alla persona (chi si auto-valuta
  --    lo fa in un momento suo, non insieme a tutti gli altri).
  -- ==========================================================================
  UPDATE sys.sys_person_evidence_records p
     SET person_evidence_recorded_at = staging.storia36_stamp(
           'PEVID::' || p.person_evidence_record_id::text,
           (date_trunc('month', now()) - interval '12 months')::timestamptz, 0, 330)
   WHERE p.person_evidence_record_tenant_id = c_rtl
     AND p.person_evidence_recorded_at IS DISTINCT FROM staging.storia36_stamp(
           'PEVID::' || p.person_evidence_record_id::text,
           (date_trunc('month', now()) - interval '12 months')::timestamptz, 0, 330);
  GET DIAGNOSTICS v_n = ROW_COUNT; v_tot := v_tot + v_n;
  RAISE NOTICE 'storia36 C12: auto-valutazioni ridatate %', v_n;

  -- ==========================================================================
  -- 8. LACUNE FORMATIVE — si rilevano quando cambia il requisito o arriva una
  --    valutazione: distribuite sugli ultimi 18 mesi, ancorate a persona+abilità
  -- ==========================================================================
  UPDATE sys.sys_learning_gaps g
     SET learning_gap_detected_at = staging.storia36_stamp(
           'LGAP::' || g.learning_gap_id::text,
           (date_trunc('month', now()) - interval '18 months')::timestamptz, 0, 520)
   WHERE g.learning_gap_tenant_id = c_rtl
     AND g.learning_gap_detected_at IS DISTINCT FROM staging.storia36_stamp(
           'LGAP::' || g.learning_gap_id::text,
           (date_trunc('month', now()) - interval '18 months')::timestamptz, 0, 520);
  GET DIAGNOSTICS v_n = ROW_COUNT; v_tot := v_tot + v_n;
  RAISE NOTICE 'storia36 C12: lacune formative ridatate %', v_n;

  -- ==========================================================================
  -- 9. STRAORDINARI: CHIUDERE IL CICLO.
  --
  -- Secondo difetto emerso dall'audit mentre si guardavano le date: TUTTI i 178
  -- straordinari sono in stato «in attesa», e il piu' recente e' del 12 dicembre
  -- 2025 — sette mesi di coda ferma. In una banca lo straordinario si autorizza
  -- e si liquida in busta, o si respinge: una richiesta di sette mesi fa non
  -- resta pendente. E si vedrebbe nella dimostrazione, proprio nella coda delle
  -- approvazioni.
  --
  -- Esito deterministico dall'hash della riga: 8% respinti (tasso plausibile per
  -- straordinario non preventivamente autorizzato), il resto autorizzato e
  -- liquidato. Chi autorizza e' il MANAGER GERARCHICO REALE (via reports_to),
  -- mai la persona stessa; al vertice il fallback e' l'amministratore, come in
  -- tutti gli altri cluster.
  -- ==========================================================================
  WITH gerarchia AS (
    SELECT o.overtime_id,
           COALESCE(mgr.mgr_user_id,
                    (SELECT u.user_id FROM sys.sys_users u
                        JOIN sys.sys_user_auth_roles ur ON ur.user_auth_role_user_id = u.user_id
                         AND ur.user_auth_role_revoked_at IS NULL
                        JOIN sys.sys_auth_roles r ON r.auth_role_id = ur.user_auth_role_role_id
                       WHERE r.auth_role_code = 'PLATFORM_ADMIN' AND u.user_status = 'ACTIVE'
                       ORDER BY u.user_email LIMIT 1)) AS approver
    FROM sys.sys_overtime o
    LEFT JOIN LATERAL (
      SELECT a2.user_position_assignment_user_id AS mgr_user_id
      FROM sys.sys_user_position_assignments a1
      JOIN sys.sys_positions p1 ON p1.position_id = a1.user_position_assignment_position_id
      JOIN sys.sys_user_position_assignments a2
           ON a2.user_position_assignment_position_id = p1.position_reports_to_position_id
          AND a2.user_position_assignment_kind = 'PRIMARY'
          AND a2.user_position_assignment_status = 'ACTIVE'
      WHERE a1.user_position_assignment_user_id = o.overtime_subject_user_id
        AND a1.user_position_assignment_kind = 'PRIMARY'
        AND a1.user_position_assignment_status = 'ACTIVE'
        AND a2.user_position_assignment_user_id <> o.overtime_subject_user_id
      LIMIT 1
    ) mgr ON true
    WHERE o.overtime_tenant_id = c_rtl
  )
  UPDATE sys.sys_overtime o
     SET overtime_status = CASE WHEN (('x' || substr(md5('OTESITO::' || o.overtime_id::text), 1, 8))::bit(32)::bigint & 2147483647) % 100 < 8
                                THEN 'REJECTED' ELSE 'PAID' END,
         overtime_approved_by_user_id = CASE WHEN (('x' || substr(md5('OTESITO::' || o.overtime_id::text), 1, 8))::bit(32)::bigint & 2147483647) % 100 < 8
                                THEN NULL ELSE g.approver END,
         overtime_approved_at = CASE WHEN (('x' || substr(md5('OTESITO::' || o.overtime_id::text), 1, 8))::bit(32)::bigint & 2147483647) % 100 < 8
                                THEN NULL
                                ELSE staging.storia36_stamp('OTAPP::' || o.overtime_id::text,
                                                            o.overtime_date::timestamptz, 1, 6) END,
         overtime_rejection_reason = CASE WHEN (('x' || substr(md5('OTESITO::' || o.overtime_id::text), 1, 8))::bit(32)::bigint & 2147483647) % 100 < 8
                                THEN 'Prestazione non autorizzata preventivamente dal responsabile.'
                                ELSE NULL END,
         overtime_exported_at = CASE WHEN (('x' || substr(md5('OTESITO::' || o.overtime_id::text), 1, 8))::bit(32)::bigint & 2147483647) % 100 < 8
                                THEN NULL
                                ELSE staging.storia36_stamp('OTEXP::' || o.overtime_id::text,
                                                            o.overtime_date::timestamptz, 20, 40) END,
         updated_at = now()
    FROM gerarchia g
   WHERE g.overtime_id = o.overtime_id
     AND o.overtime_status = 'PENDING'
     AND o.overtime_date < (current_date - 60);
  GET DIAGNOSTICS v_n = ROW_COUNT; v_tot := v_tot + v_n;
  RAISE NOTICE 'storia36 C12: cicli di straordinario chiusi %', v_n;

  -- ==========================================================================
  -- 10. LE LACUNE INVECCHIANO, E CON LORO LA LORO PRESA IN CARICO.
  --
  -- Conseguenza diretta del punto 8: dare una storia alle lacune formative le
  -- rende MATURE, e il check C4f (preesistente, del cluster C4) lo ha
  -- intercettato subito — 302 azioni ancora «proposte» su lacune di oltre
  -- novanta giorni. Il check ha ragione: se una lacuna e' vecchia, o qualcuno
  -- l'ha presa in carico o e' un buco nel processo.
  --
  -- Non si aggira il check restringendo le date: si porta a coerenza il fatto.
  -- Chi ha gia' seguito la formazione dopo che la lacuna e' emersa chiude
  -- l'azione; gli altri l'hanno avviata. In entrambi i casi l'azione ha un
  -- responsabile e una scadenza, come impone C4f(iii), e il responsabile e' il
  -- manager gerarchico — mai la persona interessata (convenzione gia' in vigore
  -- sulle 115 azioni avanzate: zero casi di auto-assegnazione).
  -- ==========================================================================
  WITH resp AS (
    SELECT a.gap_closure_action_id,
           g.learning_gap_detected_at,
           EXISTS (SELECT 1 FROM sys.sys_user_learning_evidence e
                    WHERE e.user_learning_evidence_user_id = g.learning_gap_user_id
                      AND e.user_learning_evidence_completed_at > g.learning_gap_detected_at) AS ha_formazione,
           COALESCE(mgr.mgr_user_id,
                    (SELECT u.user_id FROM sys.sys_users u
                        JOIN sys.sys_user_auth_roles ur ON ur.user_auth_role_user_id = u.user_id
                         AND ur.user_auth_role_revoked_at IS NULL
                        JOIN sys.sys_auth_roles r ON r.auth_role_id = ur.user_auth_role_role_id
                       WHERE r.auth_role_code = 'PLATFORM_ADMIN' AND u.user_status = 'ACTIVE'
                       ORDER BY u.user_email LIMIT 1)) AS owner_id
    FROM sys.sys_gap_closure_actions a
    JOIN sys.sys_learning_gaps g ON g.learning_gap_id = a.gap_closure_action_gap_id
    LEFT JOIN LATERAL (
      SELECT a2.user_position_assignment_user_id AS mgr_user_id
      FROM sys.sys_user_position_assignments a1
      JOIN sys.sys_positions p1 ON p1.position_id = a1.user_position_assignment_position_id
      JOIN sys.sys_user_position_assignments a2
           ON a2.user_position_assignment_position_id = p1.position_reports_to_position_id
          AND a2.user_position_assignment_kind = 'PRIMARY'
          AND a2.user_position_assignment_status = 'ACTIVE'
      WHERE a1.user_position_assignment_user_id = g.learning_gap_user_id
        AND a1.user_position_assignment_kind = 'PRIMARY'
        AND a1.user_position_assignment_status = 'ACTIVE'
        AND a2.user_position_assignment_user_id <> g.learning_gap_user_id
      LIMIT 1
    ) mgr ON true
    WHERE a.gap_closure_action_tenant_id = c_rtl
      AND a.gap_closure_action_status = 'PROPOSED'
      AND g.learning_gap_detected_at::date <= current_date - 90
  )
  UPDATE sys.sys_gap_closure_actions a
     SET gap_closure_action_status = CASE WHEN r.ha_formazione THEN 'COMPLETED' ELSE 'IN_PROGRESS' END,
         gap_closure_action_owner_user_id = r.owner_id,
         gap_closure_action_due_date = (r.learning_gap_detected_at
                                        + make_interval(days => 90 +
                                            (('x' || substr(md5('GAPDUE::' || a.gap_closure_action_id::text), 1, 8))::bit(32)::bigint & 2147483647)::int % 60))::date,
         updated_at = now()
    FROM resp r
   WHERE r.gap_closure_action_id = a.gap_closure_action_id;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_tot := v_tot + v_n;
  RAISE NOTICE 'storia36 C12: azioni su lacune mature prese in carico %', v_n;

  -- ==========================================================================
  -- 11. VALUTAZIONE DELLE COMPETENZE: 902 giudizi non si danno tutti lo stesso
  --     giorno. Le evidenze di competenza risultavano «valutate» tutte il 30
  --     maggio, e 356 competenze «verificate» tutte il giorno 22. La
  --     valutazione di una competenza e' un atto che segue un fatto — un corso,
  --     un assessment, un colloquio — e quei fatti sono distribuiti.
  -- ==========================================================================
  UPDATE sys.sys_user_skill_evidence ev
     SET user_skill_evidence_assessed_at = staging.storia36_stamp(
           'SKEV::' || ev.user_skill_evidence_id::text,
           (date_trunc('month', now()) - interval '30 months')::timestamptz, 0, 860)
   WHERE ev.user_skill_evidence_tenant_id = c_rtl
     AND ev.user_skill_evidence_assessed_at IS DISTINCT FROM staging.storia36_stamp(
           'SKEV::' || ev.user_skill_evidence_id::text,
           (date_trunc('month', now()) - interval '30 months')::timestamptz, 0, 860);
  GET DIAGNOSTICS v_n = ROW_COUNT; v_tot := v_tot + v_n;
  RAISE NOTICE 'storia36 C12: valutazioni di competenza ridatate %', v_n;

  UPDATE sys.sys_user_skills us
     SET user_skill_verified_at = staging.storia36_stamp(
           'SKVER::' || us.user_skill_id::text,
           (date_trunc('month', now()) - interval '30 months')::timestamptz, 0, 860)
   WHERE us.user_skill_tenant_id = c_rtl
     AND us.user_skill_verified_at IS NOT NULL
     AND us.user_skill_verified_at IS DISTINCT FROM staging.storia36_stamp(
           'SKVER::' || us.user_skill_id::text,
           (date_trunc('month', now()) - interval '30 months')::timestamptz, 0, 860);
  GET DIAGNOSTICS v_n = ROW_COUNT; v_tot := v_tot + v_n;
  RAISE NOTICE 'storia36 C12: competenze verificate ridatate %', v_n;

  -- ==========================================================================
  -- 12. GLI STUDI SEGUONO L'ANNO ACCADEMICO, NON L'ANNO SOLARE.
  --
  -- 114 percorsi di studio su 159 iniziavano a GENNAIO. In Italia un corso di
  -- studi comincia a settembre/ottobre e si chiude con una sessione di laurea
  -- (marzo, luglio, ottobre/dicembre). Gennaio non e' un mese d'inizio: e' il
  -- residuo di una data generata senza guardare il dominio.
  --
  -- Si sposta SOLO IL MESE, mantenendo l'ANNO: l'eta' all'iscrizione, la durata
  -- del percorso e la coerenza con anzianita' e ruolo — tutte gia' verificate
  -- nei cluster precedenti (#72) — restano quelle. Cambia il calendario, non
  -- la biografia.
  -- ==========================================================================
  UPDATE sys.sys_user_education_records er
     SET user_education_start_date = make_date(
           extract(year FROM er.user_education_start_date)::int,
           CASE WHEN (('x' || substr(md5('EDUS::' || er.user_education_record_id::text), 1, 8))::bit(32)::bigint & 2147483647) % 3 = 0
                THEN 9 ELSE 10 END,
           1 + (('x' || substr(md5('EDUD::' || er.user_education_record_id::text), 1, 8))::bit(32)::bigint & 2147483647)::int % 25),
         updated_at = now()
   WHERE er.user_education_record_tenant_id = c_rtl
     AND er.user_education_start_date IS NOT NULL
     AND extract(month FROM er.user_education_start_date) NOT IN (9, 10);
  GET DIAGNOSTICS v_n = ROW_COUNT; v_tot := v_tot + v_n;
  RAISE NOTICE 'storia36 C12: inizi di percorso di studio riportati all''anno accademico %', v_n;

  -- La conclusione cade in una SESSIONE DI LAUREA (marzo, luglio, dicembre), ma
  -- non puo' essere spostata liberamente: il check C5a (cluster C5) deriva
  -- l'inizio della carriera dalla fine degli studi, e portare una laurea a
  -- luglio quando la persona lavorava gia' da marzo creerebbe una biografia
  -- impossibile — e' successo davvero, al primo tentativo, su 71 esperienze.
  --
  -- Quindi: fra le tre sessioni si sceglie LA PIU' TARDA CHE NON SUPERI la
  -- prima esperienza professionale della persona. Se nessuna e' compatibile, la
  -- data resta com'e': meglio un mese anomalo di una storia che si contraddice.
  WITH limiti AS (
    SELECT er.user_education_record_id AS rec_id,
           er.user_education_start_date AS inizio,
           (SELECT min(x.user_prof_exp_start_date)
              FROM sys.sys_user_professional_experiences x
             WHERE x.user_prof_exp_user_id = er.user_education_record_user_id) AS tetto,
           extract(year FROM er.user_education_end_date)::int AS anno,
           er.user_education_end_date AS attuale,
           1 + (('x' || substr(md5('EDUF::' || er.user_education_record_id::text), 1, 8))::bit(32)::bigint & 2147483647)::int % 25 AS giorno
      FROM sys.sys_user_education_records er
     WHERE er.user_education_record_tenant_id = c_rtl
       AND er.user_education_end_date IS NOT NULL
  ), scelta AS (
    SELECT l.rec_id, l.attuale,
           COALESCE(
             -- la sessione piu' tarda compatibile con la prima esperienza
             (SELECT max(cand.d) FROM (
                SELECT make_date(l.anno, m, l.giorno) AS d
                  FROM unnest(ARRAY[3, 7, 12]) m) cand
               WHERE cand.d > l.inizio
                 AND (l.tetto IS NULL OR cand.d <= l.tetto)),
             -- nessuna compatibile: VINCE LA BIOGRAFIA. La conclusione si
             -- colloca subito prima dell'inizio del lavoro, anche se cade fuori
             -- da una sessione tipica. Una data insolita e' un dettaglio; una
             -- persona che lavora prima di essersi diplomata e' una contraddizione.
             (CASE WHEN l.tetto IS NOT NULL AND (l.tetto - 1) > l.inizio
                   THEN (l.tetto - 1) END)) AS nuova
      FROM limiti l
  )
  UPDATE sys.sys_user_education_records er
     SET user_education_end_date = s.nuova,
         updated_at = now()
    FROM scelta s
   WHERE s.rec_id = er.user_education_record_id
     AND s.nuova IS NOT NULL
     AND s.nuova IS DISTINCT FROM s.attuale;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_tot := v_tot + v_n;
  RAISE NOTICE 'storia36 C12: conclusioni di studio portate in sessione di laurea %', v_n;

  -- ==========================================================================
  -- 13. REGISTRO + POST-CONDIZIONI
  -- ==========================================================================
  INSERT INTO staging.storia36_runs (cluster_code, seed_file, rows_written, twice_run_delta)
  VALUES ('C12', '12_registration_dates.sql', v_tot, v_tot);

  PERFORM staging.storia36_check_c12a();
  PERFORM staging.storia36_check_c12b();

  RAISE NOTICE 'storia36 C12 (datazione) OK: % righe (delta atteso 0 alla seconda corsa)', v_tot;
END $$;

COMMIT;
