-- ============================================================================
-- storia36 C13 — LE SELEZIONI IN CORSO AVANZANO CON LA STORIA.
--
-- Decisione di Enzo del 2026-11-07 («Ti consiglio di far avanzare ogni notte
-- anche le selezioni aperte [...] Sì»). Fino a oggi `14_selezione.sql`
-- scriveva le selezioni aperte una volta sola, ferme alla frontiera del giorno
-- in cui girava, con il colloquio successivo in agenda da due a sette giorni
-- dopo. L'avanzamento notturno sposta la frontiera ma non rilegge il seed 14,
-- quindi dopo una settimana i colloqui «in agenda» sarebbero rimasti nel
-- passato, mai svolti.
--
-- Questo file lo lancia `db/scripts/storia36.sh avanzamento`, dopo
-- `13_avanzamento.sql` (che estende il calendario e sposta la frontiera), e
-- lo lancia DUE volte: la seconda corsa deve scrivere 0 righe, ed è la prova
-- di idempotenza che G6 pretende. Non fa parte della costruzione: sta in una
-- sottocartella, e `run_seeds` legge solo `db/seeds/storia36/*.sql`.
--
-- Il ciclo, rispetto alla frontiera F (`staging.storia36_c4_frontier()`) e
-- alle sole requisizioni OPEN della storia (metadata storia36 = C13). Una
-- candidatura è «in gara» se è APPLIED, SCREENING, INTERVIEWING o OFFER; in
-- ogni selezione la più forte in gara (una funzione deterministica della
-- candidatura) non viene mai scartata, così una selezione non si svuota da sé.
--
--  1. Un colloquio in agenda in un giorno non lavorativo si sposta al primo
--     giorno lavorativo dopo, alla stessa ora: le festività calcolate
--     (`staging.storia36_holiday_it`) valgono anche oltre il calendario.
--  2. Un colloquio in agenda con la data (ora di Roma) entro F è SVOLTO: passa
--     a COMPLETED e riceve le valutazioni di chi lo conduce, come nel seed 14
--     (primo colloquio: chi ha il ruolo RECRUITER; tecnico: il responsabile
--     della selezione; finale: il responsabile e chi guida le risorse umane).
--     Mai il candidato stesso. Un primo colloquio o un tecnico su tre non è
--     superato.
--  3. Chi non supera un colloquio è REJECTED lo stesso giorno, con il motivo;
--     chi supera il primo colloquio passa in colloquio (INTERVIEWING).
--  4. Una candidatura APPLIED senza colloqui, dopo sette giorni, è scartata
--     sul curriculum (una su tre) oppure riceve il primo colloquio in agenda.
--  5. Chi è in colloquio e non ha né un colloquio in agenda né un finale svolto
--     riceve il successivo (tecnico, poi finale) da due a sette giorni dopo F.
--  6. Un'offerta inviata da dieci giorni senza risposta SCADE (EXPIRED) e la
--     candidatura è ritirata (WITHDRAWN).
--  7. Tre giorni dopo l'ultimo finale, se la selezione non ha un'offerta in
--     corso, parte l'offerta al finalista con la valutazione media più alta fra
--     quelli che un'offerta non l'hanno ancora avuta: SENT, con la RAL e il tipo
--     di contratto di chi occupa il posto (o il posto modello, per i posti nuovi
--     di potenziamento), come nel seed 14. Gli altri finalisti restano di
--     riserva.
--  8. Una selezione senza più nessuno in gara riceve tre candidature nuove
--     (nomi di fantasia su `candidati.example`, come nel seed 14), e se il suo
--     annuncio è scaduto viene ripubblicato per altri 90 giorni.
--  9. Due colloqui in agenda alla stessa ora si separano: chi li conduce è
--     spesso la stessa persona.
--
-- CONFINE DICHIARATO: nessuno viene assunto. Un'offerta accettata vorrebbe
-- dire creare una persona nuova di RTL con incarico e contratto, e quella è
-- una decisione a parte di Enzo (scheda del 2026-11-08), non una regola
-- notturna.
--
-- Idempotente: id uuid_generate_v5 su chiavi naturali, ON CONFLICT DO
-- NOTHING, e aggiornamenti che riguardano solo righe nello stato di partenza.
-- Post-condizioni: staging.storia36_check_c13b, _c13c e _c13d.
-- ============================================================================

\set ON_ERROR_STOP on
SET client_encoding = 'UTF8';

BEGIN;

CREATE OR REPLACE FUNCTION pg_temp.h(t text) RETURNS int LANGUAGE sql IMMUTABLE AS
$fn$ SELECT ('x'||substr(md5(t),1,8))::bit(32)::int & 2147483647 $fn$;

-- L'ora di un colloquio, a Roma: la stessa funzione del seed 14.
CREATE OR REPLACE FUNCTION pg_temp.slot(d date, k text) RETURNS timestamptz LANGUAGE sql IMMUTABLE AS
$fn$
  SELECT ((d + CASE WHEN pg_temp.h(k) % 16 < 8
                    THEN time '09:00' + (pg_temp.h(k) % 8) * interval '30 minutes'
                    ELSE time '14:00' + (pg_temp.h(k) % 8) * interval '30 minutes' END)
          AT TIME ZONE 'Europe/Rome')
$fn$;

-- Un giorno è lavorativo se il calendario della storia lo dice; oltre il
-- calendario, se non è sabato, domenica o una festività calcolata.
CREATE OR REPLACE FUNCTION pg_temp.lavorativo(d date) RETURNS boolean LANGUAGE sql STABLE AS
$fn$
  SELECT coalesce(
    (SELECT c.is_workday FROM staging.storia36_calendar c WHERE c.cal_date = d),
    extract(isodow FROM d) < 6 AND staging.storia36_holiday_it(d) IS NULL)
$fn$;

-- Il primo giorno lavorativo da d in avanti.
CREATE OR REPLACE FUNCTION pg_temp.wd_avanti(d date) RETURNS date LANGUAGE sql STABLE AS
$fn$
  SELECT min(g::date) FROM generate_series(d, d + 14, interval '1 day') g
   WHERE pg_temp.lavorativo(g::date)
$fn$;

-- L'ultimo giorno lavorativo fino a d.
CREATE OR REPLACE FUNCTION pg_temp.wd_indietro(d date) RETURNS date LANGUAGE sql STABLE AS
$fn$
  SELECT max(g::date) FROM generate_series(d - 14, d, interval '1 day') g
   WHERE pg_temp.lavorativo(g::date)
$fn$;

-- Il giorno di Roma di un istante.
CREATE OR REPLACE FUNCTION pg_temp.giorno(t timestamptz) RETURNS date LANGUAGE sql IMMUTABLE AS
$fn$ SELECT (t AT TIME ZONE 'Europe/Rome')::date $fn$;

DO $$
DECLARE
  c_rtl    constant uuid := '86ba7a65-217f-48ba-8ce5-5c09b40a66b0';
  c_ns     constant uuid := '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
  c_dom    constant text := 'candidati.example';
  c_to     date;
  v_oggi   date;   -- l'ultimo giorno lavorativo della storia, entro la frontiera
  v_rec    uuid;
  v_hrh    uuid;
  v_n      bigint := 0;
  v_tot    bigint := 0;
  v_giro   int;
  c_nomi   constant text[] := ARRAY[
    'Alessandro','Andrea','Antonio','Carlo','Claudio','Daniele','Davide','Emanuele',
    'Fabio','Federico','Filippo','Francesco','Gabriele','Giacomo','Giorgio','Giovanni',
    'Jacopo','Leonardo','Lorenzo','Luca','Marco','Matteo','Michele','Nicola','Pietro',
    'Riccardo','Roberto','Samuele','Simone','Stefano','Tommaso','Valerio',
    'Alessia','Alice','Anna','Arianna','Aurora','Beatrice','Camilla','Caterina',
    'Chiara','Elena','Eleonora','Elisa','Federica','Francesca','Gaia','Giorgia',
    'Giulia','Ilaria','Irene','Laura','Ludovica','Marta','Martina','Noemi','Paola',
    'Sara','Silvia','Sofia','Valentina','Veronica'];
  c_cogn   constant text[] := ARRAY[
    'Albanese','Amato','Bassi','Bellucci','Benedetti','Bernardi','Bianchi','Borghi',
    'Caputo','Carbone','Cattaneo','Cirillo','Colombi','Conte','Coppola','Corradi',
    'D''Angelo','De Luca','Donati','Esposito','Fabbri','Farina','Ferraro','Fiore',
    'Fontana','Galli','Gatti','Gentile','Giordano','Grasso','Greco','Guerra','Leone',
    'Lombardo','Longo','Mancini','Marino','Martini','Mazza','Messina','Monti',
    'Morelli','Moretti','Negri','Orlando','Pagano','Palumbo','Parisi','Pellegrini',
    'Piras','Ricci','Riva','Rizzo','Romano','Sala','Sanna','Serra','Testa','Valentini',
    'Villa','Vitale','Zanetti'];
BEGIN
  SELECT staging.storia36_c4_frontier() INTO STRICT c_to;
  v_oggi := pg_temp.wd_indietro(c_to);

  -- Chi conduce: gli stessi ruoli di oggi che legge il seed 14.
  SELECT u.user_id INTO v_rec
    FROM sys.sys_user_auth_roles ur
    JOIN sys.sys_auth_roles r ON r.auth_role_id = ur.user_auth_role_role_id
    JOIN sys.sys_users u ON u.user_id = ur.user_auth_role_user_id
   WHERE u.user_tenant_id = c_rtl AND u.user_status = 'ACTIVE'
     AND u.user_email NOT LIKE '%.invalid'
     AND r.auth_role_code = 'RECRUITER' AND ur.user_auth_role_revoked_at IS NULL
   ORDER BY u.user_email LIMIT 1;
  SELECT u.user_id INTO v_hrh
    FROM sys.sys_user_auth_roles ur
    JOIN sys.sys_auth_roles r ON r.auth_role_id = ur.user_auth_role_role_id
    JOIN sys.sys_users u ON u.user_id = ur.user_auth_role_user_id
   WHERE u.user_tenant_id = c_rtl AND u.user_status = 'ACTIVE'
     AND u.user_email NOT LIKE '%.invalid'
     AND r.auth_role_code IN ('PEOPLE_MANAGER','HRMS_MANAGER') AND ur.user_auth_role_revoked_at IS NULL
   ORDER BY (r.auth_role_code = 'PEOPLE_MANAGER') DESC, u.user_email LIMIT 1;
  IF v_rec IS NULL OR v_hrh IS NULL THEN
    RAISE EXCEPTION 'storia36 C13 avanzamento: manca chi conduce la selezione (RECRUITER=% , vertice HR=%) — nessuna riga scritta', v_rec, v_hrh;
  END IF;

  CREATE TEMP TABLE _hire ON COMMIT DROP AS
  SELECT e.user_employment_user_id AS user_id, min(e.user_employment_hire_date) AS hire
    FROM sys.sys_user_employment e
    JOIN sys.sys_users u ON u.user_id = e.user_employment_user_id
   WHERE u.user_tenant_id = c_rtl AND e.user_employment_hire_date IS NOT NULL
   GROUP BY 1;

  -- Le candidature delle selezioni in corso, con ciò che serve alle regole.
  CREATE TEMP TABLE _ap ON COMMIT DROP AS
  SELECT ap.application_id AS app_id, ap.application_stage AS stage,
         ap.application_applied_on AS applied,
         rq.requisition_id AS req_id, rq.requisition_code AS req_code,
         rq.requisition_position_id AS pos,
         (rq.requisition_metadata->>'responsabile_selezione_user_id')::uuid AS hm,
         c.candidate_hired_user_id AS cand_user,
         jp.posting_id AS post_id, jp.posting_location AS sede,
         false AS protetta
    FROM sys.sys_job_requisitions rq
    JOIN sys.sys_job_postings jp ON jp.posting_requisition_id = rq.requisition_id
    JOIN sys.sys_candidate_applications ap ON ap.application_posting_id = jp.posting_id
    JOIN sys.sys_candidates c ON c.candidate_id = ap.application_candidate_id
   WHERE rq.requisition_tenant_id = c_rtl AND rq.requisition_status = 'OPEN'
     AND rq.requisition_metadata->>'storia36' = 'C13';
  -- la candidatura più forte in gara di ogni selezione non viene mai scartata
  UPDATE _ap a SET protetta = true
   WHERE a.app_id = (SELECT b.app_id FROM _ap b
                      WHERE b.req_id = a.req_id AND b.stage IN ('APPLIED','SCREENING','INTERVIEWING','OFFER')
                      ORDER BY pg_temp.h(b.app_id::text || 'FORZA') DESC LIMIT 1);

  -- ==========================================================================
  -- 1. L'agenda non cade nei giorni di festa.
  -- ==========================================================================
  UPDATE sys.sys_interviews i
     SET interview_scheduled_at = i.interview_scheduled_at
           + (pg_temp.wd_avanti(pg_temp.giorno(i.interview_scheduled_at))
              - pg_temp.giorno(i.interview_scheduled_at)) * interval '1 day',
         updated_by = v_rec
    FROM _ap a
   WHERE i.interview_application_id = a.app_id AND i.interview_status = 'SCHEDULED'
     AND i.interview_metadata->>'storia36' = 'C13'
     AND NOT pg_temp.lavorativo(pg_temp.giorno(i.interview_scheduled_at));
  GET DIAGNOSTICS v_n = ROW_COUNT; v_tot := v_tot + v_n;
  RAISE NOTICE 'storia36 C13 avanzamento: colloqui spostati dai giorni di festa %', v_n;

  -- ==========================================================================
  -- 2. I colloqui in agenda arrivati alla frontiera si svolgono.
  -- ==========================================================================
  CREATE TEMP TABLE _svolti ON COMMIT DROP AS
  SELECT i.interview_id AS int_id, i.interview_kind AS kind, i.interview_scheduled_at AS quando,
         pg_temp.giorno(i.interview_scheduled_at) AS giorno,
         a.app_id, a.hm, a.cand_user,
         (i.interview_kind IN ('SCREENING','TECHNICAL') AND NOT a.protetta
          AND pg_temp.h(a.app_id::text || 'ESITO-' || i.interview_kind) % 3 = 0) AS bocciato
    FROM sys.sys_interviews i
    JOIN _ap a ON a.app_id = i.interview_application_id
   WHERE i.interview_status = 'SCHEDULED' AND i.interview_metadata->>'storia36' = 'C13'
     AND pg_temp.giorno(i.interview_scheduled_at) <= c_to;

  INSERT INTO sys.sys_interview_feedback (
    feedback_id, feedback_tenant_id, feedback_interview_id, feedback_interviewer_user_id,
    feedback_recommendation, feedback_score, feedback_notes, feedback_submitted_on,
    feedback_metadata, created_at, created_by, updated_at, updated_by)
  SELECT uuid_generate_v5(c_ns, 'STORIA36::C13::FB::' || s.int_id || '::' || v.who),
         c_rtl, s.int_id, v.who,
         CASE WHEN s.bocciato THEN (ARRAY['NO','NO','STRONG_NO','NEUTRAL'])[1 + pg_temp.h(s.int_id::text || v.who) % 4]
              WHEN s.kind = 'FINAL' THEN (ARRAY['YES','YES','STRONG_YES'])[1 + pg_temp.h(s.int_id::text || v.who) % 3]
              ELSE (ARRAY['YES','YES','NEUTRAL'])[1 + pg_temp.h(s.int_id::text || v.who) % 3] END,
         round((CASE WHEN s.bocciato THEN 3.5 + (pg_temp.h(s.int_id::text || v.who || 'S') % 21) / 10.0
                     ELSE 6.3 + (pg_temp.h(s.int_id::text || v.who || 'S') % 30) / 10.0 END)::numeric, 1),
         CASE WHEN s.bocciato THEN 'Profilo non adeguato alla posizione in questa fase.'
              WHEN s.kind = 'FINAL' THEN 'Colloquio finale svolto: profilo valutato per la decisione.'
              ELSE 'Profilo coerente, procede alla tappa successiva.' END,
         s.giorno,
         jsonb_build_object('storia36', 'C13', 'avanzamento', 'colloquio svolto alla frontiera'),
         s.quando + interval '2 hours', v.who, s.quando + interval '2 hours', v.who
    FROM _svolti s
    CROSS JOIN LATERAL (
      -- primo colloquio: RECRUITER, poi vertice HR, poi responsabile (il primo
      -- che può); tecnico: il responsabile; finale: responsabile e vertice HR.
      -- Se per tecnico o finale nessuno può, chi ha il ruolo RECRUITER.
      WITH cand(ord, who) AS (
        SELECT * FROM (VALUES
          (1, CASE WHEN s.kind = 'SCREENING' THEN v_rec ELSE s.hm END),
          (2, CASE WHEN s.kind IN ('SCREENING','FINAL') THEN v_hrh END),
          (3, CASE WHEN s.kind = 'SCREENING' THEN s.hm END)) x(ord, who)),
      buoni AS (
        SELECT c.ord, c.who FROM cand c JOIN _hire h ON h.user_id = c.who
         WHERE h.hire <= s.giorno AND c.who IS DISTINCT FROM s.cand_user),
      scelti AS (
        SELECT b.who FROM buoni b WHERE s.kind <> 'SCREENING'
        UNION
        (SELECT b.who FROM buoni b WHERE s.kind = 'SCREENING' ORDER BY b.ord LIMIT 1))
      SELECT DISTINCT sc.who FROM scelti sc
      UNION ALL
      SELECT v_rec WHERE NOT EXISTS (SELECT 1 FROM scelti)
                     AND v_rec IS DISTINCT FROM s.cand_user) v
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_tot := v_tot + v_n;
  RAISE NOTICE 'storia36 C13 avanzamento: valutazioni %', v_n;

  UPDATE sys.sys_interviews i
     SET interview_status = 'COMPLETED',
         interview_metadata = (i.interview_metadata - 'agenda')
           || jsonb_build_object('avanzamento', 'svolto alla frontiera',
                                 'esito', CASE WHEN s.bocciato THEN 'non superato' ELSE 'superato' END),
         updated_at = s.quando + interval '1 hour', updated_by = v_rec
    FROM _svolti s
   WHERE i.interview_id = s.int_id AND i.interview_status = 'SCHEDULED';
  GET DIAGNOSTICS v_n = ROW_COUNT; v_tot := v_tot + v_n;
  RAISE NOTICE 'storia36 C13 avanzamento: colloqui svolti %', v_n;

  -- ==========================================================================
  -- 3. L'esito: chi non supera è fuori, chi supera il primo colloquio prosegue.
  --    Si legge dallo stato (l'esito scritto sul colloquio), non da questa
  --    corsa: così la regola vale anche per chi è stato valutato ieri.
  -- ==========================================================================
  UPDATE sys.sys_candidate_applications ap
     SET application_stage = 'REJECTED', application_closed_on = x.giorno,
         application_reject_reason = CASE x.kind WHEN 'SCREENING' THEN 'Esito del primo colloquio'
                                                 ELSE 'Esito del colloquio tecnico' END,
         updated_at = x.quando + interval '3 hours', updated_by = v_rec
    FROM (SELECT DISTINCT ON (i.interview_application_id)
                 i.interview_application_id AS app_id, i.interview_kind AS kind,
                 i.interview_scheduled_at AS quando, pg_temp.giorno(i.interview_scheduled_at) AS giorno
            FROM sys.sys_interviews i JOIN _ap a ON a.app_id = i.interview_application_id
           WHERE i.interview_status = 'COMPLETED' AND i.interview_metadata->>'esito' = 'non superato'
           ORDER BY i.interview_application_id, i.interview_scheduled_at DESC) x
   WHERE ap.application_id = x.app_id AND ap.application_stage IN ('SCREENING','INTERVIEWING');
  GET DIAGNOSTICS v_n = ROW_COUNT; v_tot := v_tot + v_n;
  RAISE NOTICE 'storia36 C13 avanzamento: candidature chiuse dopo un colloquio %', v_n;

  UPDATE sys.sys_candidate_applications ap
     SET application_stage = 'INTERVIEWING',
         updated_at = i.interview_scheduled_at + interval '3 hours', updated_by = v_rec
    FROM sys.sys_interviews i, _ap a
   WHERE a.app_id = ap.application_id AND i.interview_application_id = ap.application_id
     AND ap.application_stage = 'SCREENING'
     AND i.interview_kind = 'SCREENING' AND i.interview_status = 'COMPLETED'
     AND coalesce(i.interview_metadata->>'esito', 'superato') = 'superato';
  GET DIAGNOSTICS v_n = ROW_COUNT; v_tot := v_tot + v_n;
  RAISE NOTICE 'storia36 C13 avanzamento: candidature passate ai colloqui %', v_n;

  -- ==========================================================================
  -- 4. Le candidature in attesa da sette giorni: scartate sul curriculum, o
  --    con il primo colloquio in agenda.
  -- ==========================================================================
  UPDATE sys.sys_candidate_applications ap
     SET application_stage = 'REJECTED', application_closed_on = a.applied + 7,
         application_reject_reason = 'Profilo non in linea con i requisiti',
         updated_at = pg_temp.slot(a.applied + 7, a.app_id::text || 'CV'), updated_by = v_rec
    FROM _ap a
   WHERE ap.application_id = a.app_id AND ap.application_stage = 'APPLIED'
     AND a.applied + 7 <= c_to AND NOT a.protetta
     AND pg_temp.h(a.app_id::text || 'ESITO-CV') % 3 = 0
     AND NOT EXISTS (SELECT 1 FROM sys.sys_interviews i WHERE i.interview_application_id = a.app_id);
  GET DIAGNOSTICS v_n = ROW_COUNT; v_tot := v_tot + v_n;
  RAISE NOTICE 'storia36 C13 avanzamento: candidature scartate sul curriculum %', v_n;

  INSERT INTO sys.sys_interviews (
    interview_id, interview_tenant_id, interview_application_id, interview_kind, interview_status,
    interview_scheduled_at, interview_duration_min, interview_location, interview_metadata,
    created_at, created_by, updated_at, updated_by)
  SELECT uuid_generate_v5(c_ns, 'STORIA36::C13::INT::' || a.app_id || '::SCREENING'),
         c_rtl, a.app_id, 'SCREENING', 'SCHEDULED',
         pg_temp.slot(pg_temp.wd_avanti(c_to + 2 + pg_temp.h(a.app_id::text || 'SCREENING-AGENDA-G') % 6),
                      a.app_id::text || 'SCREENING-AGENDA'),
         30, 'Telefonico',
         jsonb_build_object('storia36', 'C13', 'agenda', 'colloquio fissato, non ancora svolto',
                            'avanzamento', 'fissato alla frontiera ' || c_to),
         ((c_to + time '17:00') AT TIME ZONE 'Europe/Rome'), v_rec,
         ((c_to + time '17:00') AT TIME ZONE 'Europe/Rome'), v_rec
    FROM _ap a
    JOIN sys.sys_candidate_applications ap ON ap.application_id = a.app_id
   WHERE ap.application_stage = 'APPLIED' AND a.applied + 7 <= c_to
     AND NOT EXISTS (SELECT 1 FROM sys.sys_interviews i WHERE i.interview_application_id = a.app_id)
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_tot := v_tot + v_n;
  RAISE NOTICE 'storia36 C13 avanzamento: primi colloqui messi in agenda %', v_n;

  UPDATE sys.sys_candidate_applications ap
     SET application_stage = 'SCREENING', updated_at = i.created_at, updated_by = v_rec
    FROM sys.sys_interviews i, _ap a
   WHERE a.app_id = ap.application_id AND i.interview_application_id = ap.application_id
     AND ap.application_stage = 'APPLIED'
     AND i.interview_kind = 'SCREENING' AND i.interview_status = 'SCHEDULED';
  GET DIAGNOSTICS v_n = ROW_COUNT; v_tot := v_tot + v_n;

  -- ==========================================================================
  -- 5. Chi è fra un colloquio e l'altro ha il successivo in agenda.
  -- ==========================================================================
  INSERT INTO sys.sys_interviews (
    interview_id, interview_tenant_id, interview_application_id, interview_kind, interview_status,
    interview_scheduled_at, interview_duration_min, interview_location, interview_metadata,
    created_at, created_by, updated_at, updated_by)
  SELECT uuid_generate_v5(c_ns, 'STORIA36::C13::INT::' || ap.application_id || '::' || n.kind),
         c_rtl, ap.application_id, n.kind, 'SCHEDULED', n.quando,
         CASE n.kind WHEN 'TECHNICAL' THEN 60 ELSE 45 END,
         'Sede di ' || coalesce(a.sede, 'Milano'),
         jsonb_build_object('storia36', 'C13', 'agenda', 'colloquio fissato, non ancora svolto',
                            'avanzamento', 'fissato alla frontiera ' || c_to),
         -- fissato il giorno della frontiera, dalle 17:00 di Roma: sempre prima
         -- del colloquio, che cade almeno due giorni dopo
         ((c_to + time '17:00') AT TIME ZONE 'Europe/Rome'), v_rec,
         ((c_to + time '17:00') AT TIME ZONE 'Europe/Rome'), v_rec
    FROM _ap a
    JOIN sys.sys_candidate_applications ap ON ap.application_id = a.app_id
    CROSS JOIN LATERAL (
      SELECT k.kind,
             pg_temp.slot(pg_temp.wd_avanti(c_to + 2 + pg_temp.h(a.app_id::text || k.kind || 'AGENDA-G') % 6),
                          a.app_id::text || k.kind || 'AGENDA') AS quando
        FROM (SELECT CASE WHEN EXISTS (SELECT 1 FROM sys.sys_interviews t
                                        WHERE t.interview_application_id = a.app_id
                                          AND t.interview_kind = 'TECHNICAL')
                          THEN 'FINAL' ELSE 'TECHNICAL' END AS kind) k) n
   WHERE ap.application_stage = 'INTERVIEWING'
     AND NOT EXISTS (SELECT 1 FROM sys.sys_interviews i
                      WHERE i.interview_application_id = a.app_id AND i.interview_status = 'SCHEDULED')
     AND NOT EXISTS (SELECT 1 FROM sys.sys_interviews i
                      WHERE i.interview_application_id = a.app_id
                        AND i.interview_kind = 'FINAL' AND i.interview_status = 'COMPLETED')
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_tot := v_tot + v_n;
  RAISE NOTICE 'storia36 C13 avanzamento: colloqui messi in agenda %', v_n;

  -- ==========================================================================
  -- 6. L'offerta senza risposta da dieci giorni scade.
  -- ==========================================================================
  UPDATE sys.sys_candidate_applications ap
     SET application_stage = 'WITHDRAWN', application_closed_on = jo.offer_sent_on + 10,
         application_metadata = ap.application_metadata
           || jsonb_build_object('motivo', 'Non ha risposto all''offerta entro dieci giorni'),
         updated_at = pg_temp.slot(jo.offer_sent_on + 10, ap.application_id::text || 'SCADE'), updated_by = v_rec
    FROM sys.sys_job_offers jo, _ap a
   WHERE a.app_id = ap.application_id AND jo.offer_application_id = ap.application_id
     AND jo.offer_status = 'SENT' AND jo.offer_sent_on + 10 <= c_to
     AND ap.application_stage = 'OFFER';
  GET DIAGNOSTICS v_n = ROW_COUNT; v_tot := v_tot + v_n;

  UPDATE sys.sys_job_offers jo
     SET offer_status = 'EXPIRED',
         offer_metadata = jo.offer_metadata || jsonb_build_object('scaduta_il', jo.offer_sent_on + 10),
         updated_at = pg_temp.slot(jo.offer_sent_on + 10, jo.offer_application_id::text || 'SCADE'), updated_by = v_rec
    FROM _ap a
   WHERE a.app_id = jo.offer_application_id
     AND jo.offer_status = 'SENT' AND jo.offer_sent_on + 10 <= c_to;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_tot := v_tot + v_n;
  RAISE NOTICE 'storia36 C13 avanzamento: offerte scadute %', v_n;

  -- ==========================================================================
  -- 7. Tre giorni dopo l'ultimo finale, l'offerta al migliore dei finalisti.
  -- ==========================================================================
  CREATE TEMP TABLE _off ON COMMIT DROP AS
  SELECT DISTINCT ON (w.req_id) w.req_id, w.app_id, w.pos, w.ultimo_finale, w.ultima_scadenza
    FROM (
      SELECT a.req_id, a.app_id, a.pos,
             max(pg_temp.giorno(f.interview_scheduled_at)) OVER (PARTITION BY a.req_id) AS ultimo_finale,
             (SELECT max(jo.offer_sent_on + 10) FROM _ap o JOIN sys.sys_job_offers jo
                ON jo.offer_application_id = o.app_id
               WHERE o.req_id = a.req_id AND jo.offer_status = 'EXPIRED') AS ultima_scadenza,
             (SELECT avg(fb.feedback_score) FROM sys.sys_interview_feedback fb
               WHERE fb.feedback_interview_id = f.interview_id) AS media
        FROM _ap a
        JOIN sys.sys_candidate_applications ap ON ap.application_id = a.app_id
        JOIN sys.sys_interviews f ON f.interview_application_id = a.app_id
       WHERE f.interview_kind = 'FINAL' AND f.interview_status = 'COMPLETED'
         AND ap.application_stage = 'INTERVIEWING'
         AND NOT EXISTS (SELECT 1 FROM sys.sys_job_offers jo WHERE jo.offer_application_id = a.app_id)) w
   WHERE w.ultimo_finale + 3 <= c_to
     -- chi è ancora in agenda per il finale fa parte della decisione: si aspetta
     AND NOT EXISTS (SELECT 1 FROM _ap o JOIN sys.sys_interviews i ON i.interview_application_id = o.app_id
                      WHERE o.req_id = w.req_id AND i.interview_kind = 'FINAL'
                        AND i.interview_status = 'SCHEDULED')
     AND NOT EXISTS (SELECT 1 FROM _ap o JOIN sys.sys_job_offers jo ON jo.offer_application_id = o.app_id
                      WHERE o.req_id = w.req_id AND jo.offer_status IN ('DRAFT','SENT','ACCEPTED'))
   ORDER BY w.req_id, w.media DESC NULLS LAST, pg_temp.h(w.app_id::text || 'OFFERTA') DESC;

  INSERT INTO sys.sys_job_offers (
    offer_id, offer_tenant_id, offer_application_id, offer_status, offer_gross_annual_salary,
    offer_contract_type, offer_start_date, offer_sent_on, offer_responded_on, offer_metadata,
    created_at, created_by, updated_at, updated_by)
  SELECT uuid_generate_v5(c_ns, 'STORIA36::C13::OFF::' || o.app_id),
         c_rtl, o.app_id, 'SENT', ref.sal, ref.tipo,
         pg_temp.wd_avanti(c_to + 30), s.inviata, NULL,
         jsonb_build_object('storia36', 'C13', 'avanzamento', 'offerta dopo il finale',
           'ral_da', CASE WHEN EXISTS (SELECT 1 FROM sys.sys_positions p
                                        WHERE p.position_id = o.pos AND p.position_metadata->>'storia36' = 'C13')
                          THEN 'contratto di chi occupa il posto modello del potenziamento'
                          ELSE 'contratto di chi occupava o occupa la posizione' END),
         pg_temp.slot(s.inviata, o.app_id::text || 'OC'), v_rec,
         pg_temp.slot(s.inviata, o.app_id::text || 'OU'), v_rec
    FROM _off o
    CROSS JOIN LATERAL (
      SELECT GREATEST(o.ultimo_finale + 3, coalesce(o.ultima_scadenza, o.ultimo_finale + 3), v_oggi) AS inviata) s
    -- la stessa RAL di riferimento del seed 14: chi ha il posto, o per un posto
    -- nuovo di potenziamento chi occupa il posto modello
    JOIN LATERAL (
      SELECT c.user_contract_gross_annual_salary AS sal, c.user_contract_type AS tipo
        FROM sys.sys_user_position_assignments pa
        JOIN sys.sys_user_contracts c ON c.user_contract_user_id = pa.user_position_assignment_user_id
       WHERE pa.user_position_assignment_position_id IN (
               o.pos,
               (SELECT (p.position_metadata->>'modello_position_id')::uuid
                  FROM sys.sys_positions p
                 WHERE p.position_id = o.pos AND p.position_metadata->>'storia36' = 'C13'))
         AND pa.user_position_assignment_kind = 'PRIMARY'
         AND c.user_contract_gross_annual_salary IS NOT NULL AND c.user_contract_type IS NOT NULL
       ORDER BY (pa.user_position_assignment_position_id = o.pos) DESC,
                pa.user_position_assignment_start_date DESC NULLS LAST, c.user_contract_start_date DESC
       LIMIT 1) ref ON true
   WHERE s.inviata <= c_to
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_tot := v_tot + v_n;
  RAISE NOTICE 'storia36 C13 avanzamento: offerte inviate %', v_n;

  UPDATE sys.sys_candidate_applications ap
     SET application_stage = 'OFFER', updated_at = jo.created_at, updated_by = v_rec
    FROM sys.sys_job_offers jo
    JOIN _ap a ON a.app_id = jo.offer_application_id
   WHERE ap.application_id = jo.offer_application_id
     AND jo.offer_status = 'SENT' AND ap.application_stage = 'INTERVIEWING';
  GET DIAGNOSTICS v_n = ROW_COUNT; v_tot := v_tot + v_n;
  RAISE NOTICE 'storia36 C13 avanzamento: candidature passate all''offerta %', v_n;

  -- ==========================================================================
  -- 8. Una selezione rimasta senza nessuno in gara riceve candidature nuove.
  -- ==========================================================================
  CREATE TEMP TABLE _vuote ON COMMIT DROP AS
  SELECT rq.requisition_id AS req_id, rq.requisition_code AS req_code, jp.posting_id AS post_id,
         jp.posting_expires_on AS scade
    FROM sys.sys_job_requisitions rq
    JOIN sys.sys_job_postings jp ON jp.posting_requisition_id = rq.requisition_id
   WHERE rq.requisition_tenant_id = c_rtl AND rq.requisition_status = 'OPEN'
     AND rq.requisition_metadata->>'storia36' = 'C13'
     AND NOT EXISTS (SELECT 1 FROM sys.sys_candidate_applications ap
                      WHERE ap.application_posting_id = jp.posting_id
                        AND ap.application_stage IN ('APPLIED','SCREENING','INTERVIEWING','OFFER'));

  UPDATE sys.sys_job_postings jp
     SET posting_expires_on = c_to + 90, posting_status = 'PUBLISHED',
         posting_metadata = jp.posting_metadata || jsonb_build_object('ripubblicato_il', v_oggi),
         updated_at = pg_temp.slot(v_oggi, jp.posting_id::text || 'RIPUB'), updated_by = v_rec
    FROM _vuote v
   WHERE jp.posting_id = v.post_id AND jp.posting_expires_on < c_to;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_tot := v_tot + v_n;
  RAISE NOTICE 'storia36 C13 avanzamento: annunci ripubblicati %', v_n;

  CREATE TEMP TABLE _nuovi ON COMMIT DROP AS
  SELECT v.req_code, v.post_id, x.nome, x.cognome, x.chiave,
         (ARRAY['JOB_BOARD','JOB_BOARD','JOB_BOARD','JOB_BOARD','DIRECT','DIRECT','REFERRAL','AGENCY','AGENCY','EVENT'])
           [1 + pg_temp.h(v.req_code || v_oggi || g.i || 'SRC') % 10] AS fonte
    FROM _vuote v
    CROSS JOIN LATERAL generate_series(1, 3) g(i)
    CROSS JOIN LATERAL (
      SELECT c_nomi[1 + pg_temp.h(v.req_code || v_oggi || g.i || 'N') % array_length(c_nomi, 1)] AS nome,
             c_cogn[1 + pg_temp.h(v.req_code || v_oggi || g.i || 'C') % array_length(c_cogn, 1)] AS cognome) n
    CROSS JOIN LATERAL (
      SELECT n.nome, n.cognome,
             lower(translate(replace(n.nome || '.' || n.cognome, '''', ''), ' ', '')) || '.'
               || substr(md5(v.req_code || v_oggi || g.i), 1, 4) || '@' || c_dom AS chiave) x
   -- un nome di fantasia non coincide con quello di una persona di RTL
   WHERE NOT EXISTS (SELECT 1 FROM sys.sys_users u
                      WHERE u.user_tenant_id = c_rtl
                        AND lower(u.user_first_name) = lower(n.nome) AND lower(u.user_last_name) = lower(n.cognome));

  INSERT INTO sys.sys_candidates (
    candidate_id, candidate_tenant_id, candidate_external_code, candidate_first_name,
    candidate_last_name, candidate_email, candidate_phone, candidate_source, candidate_status,
    candidate_consent_given_on, candidate_retention_until, candidate_hired_user_id,
    candidate_metadata, created_at, created_by, updated_at, updated_by)
  SELECT uuid_generate_v5(c_ns, 'STORIA36::C13::CAND::' || n.chiave), c_rtl,
         'CND-' || upper(substr(md5(n.chiave), 1, 8)), n.nome, n.cognome, n.chiave,
         NULL, n.fonte, 'ACTIVE', v_oggi, (v_oggi + interval '24 months')::date, NULL,
         jsonb_build_object('storia36', 'C13',
                            'persona', 'nome di fantasia: un candidato esterno non è una persona del tenant'),
         pg_temp.slot(v_oggi, n.chiave || 'CC'), v_rec, pg_temp.slot(v_oggi, n.chiave || 'CC'), v_rec
    FROM _nuovi n
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_tot := v_tot + v_n;

  INSERT INTO sys.sys_candidate_applications (
    application_id, application_tenant_id, application_candidate_id, application_posting_id,
    application_stage, application_applied_on, application_closed_on, application_reject_reason,
    application_metadata, created_at, created_by, updated_at, updated_by)
  SELECT uuid_generate_v5(c_ns, 'STORIA36::C13::APP::' || n.req_code || '::' || n.chiave),
         c_rtl, c.candidate_id, n.post_id, 'APPLIED', v_oggi, NULL, NULL,
         jsonb_build_object('storia36', 'C13', 'avanzamento', 'candidatura dopo la frontiera ' || c_to),
         pg_temp.slot(v_oggi, n.chiave || 'AC'), NULL, pg_temp.slot(v_oggi, n.chiave || 'AC'), v_rec
    FROM _nuovi n
    JOIN sys.sys_candidates c ON c.candidate_tenant_id = c_rtl AND c.candidate_email = n.chiave
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_tot := v_tot + v_n;
  RAISE NOTICE 'storia36 C13 avanzamento: candidature nuove %', v_n;

  -- ==========================================================================
  -- 9. Due colloqui in agenda alla stessa ora si separano (fino a tre giri):
  --    il più recente si sposta di novanta minuti, o prima se è tardi.
  -- ==========================================================================
  FOR v_giro IN 1..3 LOOP
    UPDATE sys.sys_interviews i
       SET interview_scheduled_at = i.interview_scheduled_at
             + CASE WHEN (i.interview_scheduled_at AT TIME ZONE 'Europe/Rome')::time >= time '16:00'
                    THEN interval '-150 minutes' ELSE interval '90 minutes' END,
           updated_by = v_rec
      FROM _ap a
     WHERE i.interview_application_id = a.app_id AND i.interview_status = 'SCHEDULED'
       AND EXISTS (SELECT 1 FROM sys.sys_interviews o JOIN _ap b ON b.app_id = o.interview_application_id
                    WHERE o.interview_status = 'SCHEDULED'
                      AND o.interview_scheduled_at = i.interview_scheduled_at
                      AND o.interview_id < i.interview_id);
    GET DIAGNOSTICS v_n = ROW_COUNT; v_tot := v_tot + v_n;
    EXIT WHEN v_n = 0;
  END LOOP;

  -- ==========================================================================
  -- 10. REGISTRO + POST-CONDIZIONI
  -- ==========================================================================
  INSERT INTO staging.storia36_runs (cluster_code, seed_file, rows_written, twice_run_delta)
  VALUES ('C13', 'avanzamento/selezioni_in_corso.sql', v_tot, v_tot);

  PERFORM staging.storia36_check_c13b(c_to);
  PERFORM staging.storia36_check_c13c(c_to);
  PERFORM staging.storia36_check_c13d();

  RAISE NOTICE 'storia36 C13 avanzamento OK alla frontiera %: % righe (0 alla seconda corsa)', c_to, v_tot;
END $$;

COMMIT;
