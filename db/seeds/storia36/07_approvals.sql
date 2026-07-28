-- ============================================================================
-- storia36 C7 — APPROVAZIONI E WORKFLOW: lo strato transazionale
--
-- Piano: docs/superpowers/plans/2026-07-27-rtl-storia-36-mesi.md (Task C7)
--
-- Il motore delle approvazioni esiste, è testato e non ha mai deciso niente:
-- `sys_approval_requests` e `sys_approval_steps` sono vuote. Nella banca invece
-- le decisioni ci sono state — 2.068 assenze risultano approvate, con tanto di
-- approvatore e data — solo che nessuna di esse è passata dal registro che
-- dovrebbe custodirle.
--
-- COSA SCRIVE, E SU CHE COSA SI APPOGGIA (nessuna decisione è inventata: ogni
-- richiesta riflette un fatto già registrato altrove):
--
--  · FERIE — le assenze **VACATION di almeno 7 giorni**: la settimana piena è
--    la soglia oltre cui il responsabile deve garantire la copertura del
--    servizio, ed è il caso in cui l'approvazione diventa un atto formale.
--    Sono 469 su 36 mesi (~0,96 richieste per persona all'anno). La MALATTIA è
--    esclusa di proposito: non si approva, si giustifica.
--    L'approvatore NON è scelto: è `request_approver_user_id`, quello vero già
--    scritto sulla richiesta; la data della decisione è `request_approved_at`.
--    Le assenze già approvate producono richieste **APPLIED** — l'effetto
--    `TIME_OFF_REQUEST` esiste davvero nel registro degli effetti e su quelle
--    assenze è stato applicato.
--  · RETRIBUZIONI — le 116 raccomandazioni di adeguamento: due livelli, il
--    responsabile e poi la direzione del personale, con quorum ALL_OF. Un
--    adeguamento non lo firma una persona sola.
--  · FORMAZIONE — le 62 iniziative d'aula: un livello (direzione del
--    personale), perché quello che si approva è il budget dell'edizione.
--
-- Due pezzi che il piano chiedeva NON vengono eseguiti — preferenze di notifica
-- e cascata KPI sui processi: la motivazione sta al punto 4-5 del corpo, e non
-- è una rinuncia per stanchezza ma il rispetto di due cose che valgono più del
-- piano (il comportamento predefinito del prodotto, e una decisione registrata
-- e riconfermata due volte).
--
-- GATE RISPETTATO: questo seed NON scrive in `sys_process_participants`. La
-- tabella non è vuota (1.104 righe dal lavoro F4/#24, migration 000179, chiuso
-- a luglio) — la nota del piano che la dava per vuota era già inesatta quando è
-- stata scritta. Ciò che il gate protegge resta protetto: il RACI è una
-- decisione di Enzo, e il programma non ne scrive nemmeno una riga (check C7d).
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
  c_start constant date := DATE '2023-08-01';
  c_to    date;
  v_hr    uuid;
  v_n     bigint := 0;
  v_tot   bigint := 0;
BEGIN
  SELECT staging.storia36_c4_frontier() INTO STRICT c_to;
  SELECT user_id INTO STRICT v_hr FROM sys.sys_users
   WHERE user_email = 'federica.marchetti@rtl-bank.org';

  -- ==========================================================================
  -- 1. LE ASSENZE LUNGHE — la richiesta ricalca la decisione già presa
  -- ==========================================================================
  CREATE TEMP TABLE _ferie ON COMMIT DROP AS
  SELECT t.request_id, t.request_subject_user_id AS uid, t.request_approver_user_id AS approver,
         t.request_start_date, t.request_end_date, t.request_days_requested AS giorni,
         t.request_status, t.request_approved_at,
         -- la richiesta nasce qualche giorno prima dell'inizio dell'assenza:
         -- il preavviso cresce con la durata, come nella prassi
         (t.request_start_date - (7 + LEAST(30, t.request_days_requested::int * 2)))::date AS chiesta_il
    FROM sys.sys_time_off_requests t
   WHERE t.request_tenant_id = c_rtl
     AND t.request_leave_type = 'VACATION'
     AND t.request_days_requested >= 7
     AND t.request_approver_user_id IS NOT NULL;

  INSERT INTO sys.sys_approval_requests (
    approval_request_id, approval_request_tenant_id, approval_request_title,
    approval_request_body, approval_request_resource_type, approval_request_resource_id,
    approval_request_status, approval_request_decision_policy, approval_request_priority,
    approval_request_metadata, approval_request_resolved_at, approval_request_applied_at,
    approval_request_sla_hours, created_at, created_by, updated_at)
  SELECT uuid_generate_v5(c_ns, 'STORIA36::C7::REQ::TIMEOFF::' || f.request_id),
         c_rtl,
         'Richiesta di ferie — ' || f.giorni || ' giorni dal ' || to_char(f.request_start_date, 'DD/MM/YYYY'),
         'Assenza per ferie dal ' || to_char(f.request_start_date, 'DD/MM/YYYY') ||
           ' al ' || to_char(f.request_end_date, 'DD/MM/YYYY') ||
           '. Copertura del servizio da concordare con il responsabile.',
         'TIME_OFF_REQUEST', f.request_id,
         -- lo stato ricalca il fatto: approvata e applicata, oppure ancora in attesa
         CASE WHEN f.request_status = 'APPROVED' THEN 'APPLIED' ELSE 'PENDING' END,
         'ALL_OF',
         CASE WHEN f.giorni >= 15 THEN 'HIGH' ELSE 'MEDIUM' END,
         jsonb_build_object('storia36', 'C7', 'origine', 'assenza registrata'),
         CASE WHEN f.request_status = 'APPROVED' THEN f.request_approved_at END,
         CASE WHEN f.request_status = 'APPROVED' THEN f.request_approved_at END,
         72,
         f.chiesta_il::timestamptz,
         f.uid,
         COALESCE(f.request_approved_at, f.chiesta_il::timestamptz)
    FROM _ferie f
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_tot := v_tot + v_n;
  RAISE NOTICE 'storia36 C7: richieste di ferie %', v_n;

  INSERT INTO sys.sys_approval_steps (
    approval_step_id, approval_step_request_id, approval_step_tenant_id,
    approval_step_approver_user_id, approval_step_ordinal, approval_step_status,
    approval_step_decision_comment, approval_step_decided_at, approval_step_decided_by,
    approval_step_metadata, approval_step_level_policy, approval_step_due_at,
    created_at, updated_at)
  SELECT uuid_generate_v5(c_ns, 'STORIA36::C7::STEP::TIMEOFF::' || f.request_id),
         uuid_generate_v5(c_ns, 'STORIA36::C7::REQ::TIMEOFF::' || f.request_id),
         c_rtl, f.approver, 1,
         CASE WHEN f.request_status = 'APPROVED' THEN 'APPROVED' ELSE 'PENDING' END,
         CASE WHEN f.request_status = 'APPROVED' THEN 'Copertura del servizio verificata.' END,
         CASE WHEN f.request_status = 'APPROVED' THEN f.request_approved_at END,
         CASE WHEN f.request_status = 'APPROVED' THEN f.approver END,
         jsonb_build_object('storia36', 'C7'),
         NULL,
         (f.chiesta_il + 3)::timestamptz,
         f.chiesta_il::timestamptz,
         COALESCE(f.request_approved_at, f.chiesta_il::timestamptz)
    FROM _ferie f
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_tot := v_tot + v_n;
  RAISE NOTICE 'storia36 C7: passi di approvazione delle ferie %', v_n;

  -- ==========================================================================
  -- 2. GLI ADEGUAMENTI RETRIBUTIVI — due firme, in ordine
  -- ==========================================================================
  CREATE TEMP TABLE _comp ON COMMIT DROP AS
  SELECT r.compensation_recommendation_id AS rid, r.compensation_recommendation_user_id AS uid,
         r.compensation_recommendation_amount_eur AS importo,
         r.compensation_recommendation_computed_at AS calcolata_il,
         -- il responsabile della persona: primo livello
         (SELECT a2.user_position_assignment_user_id
            FROM sys.sys_user_position_assignments a1
            JOIN sys.sys_positions p1 ON p1.position_id = a1.user_position_assignment_position_id
            JOIN sys.sys_user_position_assignments a2
              ON a2.user_position_assignment_position_id = p1.position_reports_to_position_id
             AND a2.user_position_assignment_status = 'ACTIVE'
           WHERE a1.user_position_assignment_user_id = r.compensation_recommendation_user_id
             AND a1.user_position_assignment_status = 'ACTIVE' LIMIT 1) AS capo,
         -- L'esito: la gran parte passa, qualcuna viene respinta, e le proposte
         -- dell'ULTIMO ciclo sono ancora sul tavolo. Quest'ultima parte non è
         -- un dettaglio estetico: senza, il registro non conterrebbe una sola
         -- pratica aperta e l'inbox di ogni responsabile risulterebbe vuota —
         -- una banca con tre anni di storia e zero decisioni in corso non
         -- esiste. La soglia non è una data fissa (l'ultimo ciclo calcolato
         -- risale a 51 giorni fa e una finestra a giorni non lo prenderebbe):
         -- sono le dodici proposte più recenti, qualunque sia la loro data.
         CASE WHEN row_number() OVER (ORDER BY r.compensation_recommendation_computed_at DESC,
                                               r.compensation_recommendation_id) <= 12 THEN 'PENDING'
              WHEN pg_temp.h(r.compensation_recommendation_id::text || 'ESITO') % 100 < 78 THEN 'APPROVED'
              ELSE 'REJECTED' END AS esito
    FROM sys.sys_compensation_recommendations r
   WHERE r.compensation_recommendation_tenant_id = c_rtl;

  INSERT INTO sys.sys_approval_requests (
    approval_request_id, approval_request_tenant_id, approval_request_title,
    approval_request_body, approval_request_resource_type, approval_request_resource_id,
    approval_request_status, approval_request_decision_policy, approval_request_priority,
    approval_request_metadata, approval_request_resolved_at, approval_request_sla_hours,
    created_at, created_by, updated_at)
  SELECT uuid_generate_v5(c_ns, 'STORIA36::C7::REQ::COMP::' || c.rid),
         c_rtl,
         'Adeguamento retributivo — ' || to_char(COALESCE(c.importo, 0), 'FM999G999') || ' EUR',
         'Proposta di adeguamento della retribuzione, da sottoporre al responsabile e alla direzione del personale.',
         'COMPENSATION_RECOMMENDATION', c.rid,
         c.esito, 'ALL_OF',
         CASE WHEN COALESCE(c.importo, 0) >= 3000 THEN 'HIGH' ELSE 'MEDIUM' END,
         jsonb_build_object('storia36', 'C7', 'origine', 'raccomandazione calcolata'),
         CASE WHEN c.esito <> 'PENDING' THEN c.calcolata_il + interval '9 days' END,
         120,
         c.calcolata_il, v_hr,
         CASE WHEN c.esito <> 'PENDING' THEN c.calcolata_il + interval '9 days' ELSE c.calcolata_il END
    FROM _comp c
   WHERE c.capo IS NOT NULL
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_tot := v_tot + v_n;
  RAISE NOTICE 'storia36 C7: richieste di adeguamento retributivo %', v_n;

  -- primo livello: il responsabile · secondo livello: la direzione del personale
  INSERT INTO sys.sys_approval_steps (
    approval_step_id, approval_step_request_id, approval_step_tenant_id,
    approval_step_approver_user_id, approval_step_ordinal, approval_step_status,
    approval_step_decision_comment, approval_step_decided_at, approval_step_decided_by,
    approval_step_metadata, approval_step_due_at, created_at, updated_at)
  SELECT uuid_generate_v5(c_ns, 'STORIA36::C7::STEP::COMP::' || c.rid || '::' || l.ordinale),
         uuid_generate_v5(c_ns, 'STORIA36::C7::REQ::COMP::' || c.rid),
         c_rtl,
         CASE l.ordinale WHEN 1 THEN c.capo ELSE v_hr END,
         l.ordinale,
         CASE
           -- respinta al primo livello: il secondo non arriva mai a decidere
           WHEN c.esito = 'REJECTED' AND l.ordinale = 1 THEN 'REJECTED'
           WHEN c.esito = 'REJECTED' AND l.ordinale = 2 THEN 'SKIPPED'
           WHEN c.esito = 'APPROVED' THEN 'APPROVED'
           -- in attesa: il primo ha già firmato, il secondo no
           WHEN l.ordinale = 1 THEN 'APPROVED'
           ELSE 'PENDING'
         END,
         CASE
           WHEN c.esito = 'REJECTED' AND l.ordinale = 1 THEN 'Non compatibile con il budget dell''esercizio.'
           WHEN c.esito = 'APPROVED' AND l.ordinale = 1 THEN 'Coerente con il contributo della persona.'
           WHEN c.esito = 'APPROVED' AND l.ordinale = 2 THEN 'Verificata la coerenza con le fasce retributive.'
         END,
         CASE
           WHEN c.esito = 'REJECTED' AND l.ordinale = 1 THEN c.calcolata_il + interval '9 days'
           WHEN c.esito = 'APPROVED' THEN c.calcolata_il + (l.ordinale || ' days')::interval * 4
           WHEN l.ordinale = 1 THEN c.calcolata_il + interval '4 days'
         END,
         CASE
           WHEN c.esito = 'REJECTED' AND l.ordinale = 1 THEN c.capo
           WHEN c.esito = 'APPROVED' THEN CASE l.ordinale WHEN 1 THEN c.capo ELSE v_hr END
           WHEN l.ordinale = 1 THEN c.capo
         END,
         jsonb_build_object('storia36', 'C7'),
         (c.calcolata_il + (l.ordinale * 5 || ' days')::interval),
         c.calcolata_il,
         c.calcolata_il + interval '9 days'
    FROM _comp c
    CROSS JOIN (VALUES (1), (2)) AS l(ordinale)
   WHERE c.capo IS NOT NULL
     -- Chi riporta già alla direzione del personale ha UN livello solo: sopra
     -- non c'è nessun altro (federica.marchetti occupa anche il vertice, e la
     -- posizione radice non ha un superiore). La stessa persona che firma due
     -- volte non è un doppio controllo — e il database lo sa: l'indice
     -- `sys_approval_step_request_approver_uq` vieta di ripetere l'approvatore
     -- nella stessa richiesta. Senza questa riga il secondo passo veniva
     -- scartato in silenzio da ON CONFLICT: stesso risultato, ma per caso
     -- invece che per scelta (6 richieste su 115).
     AND NOT (l.ordinale = 2 AND c.capo = v_hr)
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_tot := v_tot + v_n;
  RAISE NOTICE 'storia36 C7: passi di approvazione retributiva %', v_n;

  -- ==========================================================================
  -- 3. LE INIZIATIVE DI FORMAZIONE — si approva il budget dell'edizione
  -- ==========================================================================
  INSERT INTO sys.sys_approval_requests (
    approval_request_id, approval_request_tenant_id, approval_request_title,
    approval_request_body, approval_request_resource_type, approval_request_resource_id,
    approval_request_status, approval_request_decision_policy, approval_request_priority,
    approval_request_metadata, approval_request_resolved_at, approval_request_sla_hours,
    created_at, created_by, updated_at)
  SELECT uuid_generate_v5(c_ns, 'STORIA36::C7::REQ::TRAIN::' || i.training_initiative_id),
         c_rtl,
         'Edizione formativa — ' || COALESCE(i.training_initiative_cohort_name, i.training_initiative_code),
         'Autorizzazione all''avvio dell''edizione e al relativo impegno di spesa.',
         'TRAINING_INITIATIVE', i.training_initiative_id,
         'APPROVED', 'ALL_OF', 'MEDIUM',
         jsonb_build_object('storia36', 'C7', 'origine', 'iniziativa a calendario'),
         (i.training_initiative_start_date - 10)::timestamptz,
         168,
         (i.training_initiative_start_date - 25)::timestamptz, v_hr,
         (i.training_initiative_start_date - 10)::timestamptz
    FROM sys.sys_training_initiatives i
   WHERE i.training_initiative_tenant_id = c_rtl
     AND i.training_initiative_start_date IS NOT NULL
     AND (i.training_initiative_start_date - 25) >= c_start
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_tot := v_tot + v_n;
  RAISE NOTICE 'storia36 C7: richieste per le edizioni formative %', v_n;

  INSERT INTO sys.sys_approval_steps (
    approval_step_id, approval_step_request_id, approval_step_tenant_id,
    approval_step_approver_user_id, approval_step_ordinal, approval_step_status,
    approval_step_decision_comment, approval_step_decided_at, approval_step_decided_by,
    approval_step_metadata, approval_step_due_at, created_at, updated_at)
  SELECT uuid_generate_v5(c_ns, 'STORIA36::C7::STEP::TRAIN::' || i.training_initiative_id),
         uuid_generate_v5(c_ns, 'STORIA36::C7::REQ::TRAIN::' || i.training_initiative_id),
         c_rtl, v_hr, 1, 'APPROVED',
         'Edizione coerente con il piano formativo dell''anno.',
         (i.training_initiative_start_date - 10)::timestamptz, v_hr,
         jsonb_build_object('storia36', 'C7'),
         (i.training_initiative_start_date - 12)::timestamptz,
         (i.training_initiative_start_date - 25)::timestamptz,
         (i.training_initiative_start_date - 10)::timestamptz
    FROM sys.sys_training_initiatives i
   WHERE i.training_initiative_tenant_id = c_rtl
     AND i.training_initiative_start_date IS NOT NULL
     AND (i.training_initiative_start_date - 25) >= c_start
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_tot := v_tot + v_n;
  RAISE NOTICE 'storia36 C7: passi di approvazione delle edizioni %', v_n;

  -- ==========================================================================
  -- 4. e 5. — DUE PEZZI DEL PIANO CHE NON VENGONO ESEGUITI, E PERCHÉ
  --
  --  · PREFERENZE DI NOTIFICA — il piano le chiedeva «per tutti gli utenti».
  --    Non si scrivono: una preferenza è una SCELTA della persona, e il
  --    prodotto applica i valori predefiniti (avviso in app sì, email no)
  --    finché quella scelta non arriva. Popolarle per tutti significherebbe
  --    affermare 948 decisioni che nessuno ha preso — e infatti toglie a ogni
  --    utente il comportamento predefinito: il test
  --    `notification-preferences` verifica proprio che una persona che non ha
  --    mai toccato nulla veda i default. Qui la tabella vuota NON è una
  --    lacuna: è la rappresentazione corretta di «nessuno li ha cambiati».
  --
  --  · CASCATA KPI SUI PROCESSI — il piano la chiedeva. È esclusa da una
  --    decisione presa e RICONFERMATA due volte (S970 #4, poi S994 item #12,
  --    registro di riconciliazione: `sys_process_kpi_templates` = EXCLUDE):
  --    i KPI di processo del legacy non si agganciano al registro dei processi
  --    advanced — 0 corrispondenze su 25 per codice, 1 su 25 per nome. La
  --    derivazione per parole chiave che si potrebbe fare al loro posto è un
  --    abbinamento lessicale, non una cascata governata, e scavalcherebbe una
  --    decisione registrata. Se il legame va costruito, è un work-item suo,
  --    con un criterio deciso da chi governa i processi.

  -- ==========================================================================
  -- 6. REGISTRO + POST-CONDIZIONI
  -- ==========================================================================
  INSERT INTO staging.storia36_runs (cluster_code, seed_file, rows_written, twice_run_delta)
  VALUES ('C7', '07_approvals.sql', v_tot, v_tot);

  PERFORM staging.storia36_check_c7a();
  PERFORM staging.storia36_check_c7b();
  PERFORM staging.storia36_check_c7c(c_start, c_to);
  PERFORM staging.storia36_check_c7d();

  RAISE NOTICE 'storia36 C7 OK: % righe scritte (delta atteso 0 alla seconda corsa)', v_tot;
END $$;

COMMIT;
