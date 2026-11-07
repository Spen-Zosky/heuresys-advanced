-- ============================================================================
-- storia36 C13 — le selezioni IN CORSO scritte il 2026-11-07 alle 01:43 UTC
--
-- Tre rilievi misurati sulla produzione dopo la prima scrittura di
-- 14_selezione.sql (39decdaf). Scelta di Enzo del 2026-11-07: «Sì, correggi
-- entrambe»; il terzo rilievo è nato dalla prova della correzione.
--
--  A  OFFERTE SENZA RAL: le 2 offerte in attesa (SENT) sui posti nuovi di
--     potenziamento non avevano RAL né tipo di contratto, perché quei posti non
--     hanno mai avuto un titolare. Si prende il contratto di chi occupa il
--     posto modello da cui il posto nuovo è stato copiato.
--  B  FINALE SCHIACCIATO SUL TECNICO: vicino alla frontiera il ritorno al
--     giorno lavorativo riportava al 2026-11-05 date che cadevano dopo; in
--     REQ-2610-10E87 il finale era alle 12:00 e il tecnico alle 14:30 dello
--     stesso giorno. Il seed corretto non genera un finale lo stesso giorno del
--     tecnico; qui si tolgono i finali che quel seed non avrebbe scritto, con
--     le loro valutazioni, e si conservano nel giornale per il ritorno.
--  C  NESSUN COLLOQUIO IN AGENDA nelle selezioni aperte: chi è in colloquio e
--     non ha fatto il finale ha il successivo fissato da 2 a 7 giorni dopo la
--     frontiera, in un giorno feriale (G1 e C13b(ii) ammettono i soli SCHEDULED
--     oltre la frontiera, entro 30 giorni).
--
-- PERCHÉ UN FILE A PARTE e non una nuova corsa di 14_selezione.sql: quel seed
-- ricava le selezioni aperte dalla frontiera, che di notte avanza; rieseguito
-- con un'altra frontiera calcolerebbe date diverse per le righe già scritte.
-- Questo file guarda solo ciò che c'è nel database.
--
-- USO
--   misura (nessuna scrittura, ROLLBACK):   psql -f <questo file>
--   scrittura, dopo aver letto la misura:   psql -v atteso=<N> -f <questo file>
--   dove N è il numero di finali da togliere che la misura ha stampato: se al
--   momento della scrittura non coincide, il file si ferma senza scrivere.
-- RITORNO: staging.storia36_c13_riparazione_undo conserva le righe tolte e i
-- valori delle offerte prima della modifica; i colloqui in agenda portano
-- metadata agenda e si riconoscono per id (STORIA36::C13::INT::<app>::<tipo>).
-- Idempotente: alla seconda corsa A, B e C trovano 0 righe.
-- ============================================================================

\set ON_ERROR_STOP on
SET client_encoding = 'UTF8';

\if :{?atteso}
  \set scrive true
\else
  \set atteso -1
  \set scrive false
\endif
SELECT set_config('storia36.c13_atteso', :'atteso', false);

BEGIN;

CREATE OR REPLACE FUNCTION pg_temp.h(t text) RETURNS int LANGUAGE sql IMMUTABLE AS
$fn$ SELECT ('x'||substr(md5(t),1,8))::bit(32)::int & 2147483647 $fn$;

CREATE TABLE IF NOT EXISTS staging.storia36_c13_riparazione_undo (
  undo_id     bigserial PRIMARY KEY,
  undo_at     timestamptz NOT NULL DEFAULT now(),
  undo_file   text NOT NULL,
  undo_table  text NOT NULL,
  undo_action varchar(16) NOT NULL CHECK (undo_action IN ('DELETE','UPDATE')),
  undo_row    jsonb NOT NULL
);

DO $$
DECLARE
  c_rtl    constant uuid := '86ba7a65-217f-48ba-8ce5-5c09b40a66b0';
  c_ns     constant uuid := '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
  c_file   constant text := '2026-11-07_c13_selezione_in_corso_oneshot.sql';
  c_to     date := staging.storia36_c4_frontier();
  v_atteso int  := current_setting('storia36.c13_atteso')::int;
  v_rec    uuid;
  v_n      int;
  v_tot    int := 0;
  v_fin    uuid[];
  r        record;
BEGIN
  SELECT ar.user_auth_role_user_id INTO v_rec
    FROM sys.sys_user_auth_roles ar
    JOIN sys.sys_auth_roles ro ON ro.auth_role_id = ar.user_auth_role_role_id
    JOIN sys.sys_users u ON u.user_id = ar.user_auth_role_user_id
   WHERE u.user_tenant_id = c_rtl AND u.user_status = 'ACTIVE' AND ro.auth_role_code = 'RECRUITER'
     AND ar.user_auth_role_revoked_at IS NULL AND u.user_email NOT LIKE '%.invalid'
   ORDER BY u.user_email LIMIT 1;
  IF v_rec IS NULL THEN RAISE EXCEPTION 'C13 riparazione: nessun RECRUITER in RTL'; END IF;

  -- ------------------------------------------------------------------ misura
  SELECT array_agg(f.interview_id ORDER BY f.interview_id) INTO v_fin
    FROM sys.sys_interviews f
    JOIN sys.sys_interviews t ON t.interview_application_id = f.interview_application_id
                             AND t.interview_kind = 'TECHNICAL'
   WHERE f.interview_tenant_id = c_rtl AND f.interview_metadata->>'storia36' = 'C13'
     AND f.interview_kind = 'FINAL' AND f.interview_status = 'COMPLETED'
     AND (f.interview_scheduled_at AT TIME ZONE 'Europe/Rome')::date
         <= (t.interview_scheduled_at AT TIME ZONE 'Europe/Rome')::date;
  RAISE NOTICE 'C13 riparazione, misura: frontiera %, finali da togliere % %',
    c_to, coalesce(cardinality(v_fin), 0), coalesce(v_fin::text, '{}');
  FOR r IN
    SELECT rq.requisition_code, rq.requisition_status, ap.application_stage,
           f.interview_scheduled_at AS fin, t.interview_scheduled_at AS tec
      FROM sys.sys_interviews f
      JOIN sys.sys_interviews t ON t.interview_application_id = f.interview_application_id
                               AND t.interview_kind = 'TECHNICAL'
      JOIN sys.sys_candidate_applications ap ON ap.application_id = f.interview_application_id
      JOIN sys.sys_job_postings jp ON jp.posting_id = ap.application_posting_id
      JOIN sys.sys_job_requisitions rq ON rq.requisition_id = jp.posting_requisition_id
     WHERE f.interview_id = ANY (coalesce(v_fin, '{}'))
  LOOP
    RAISE NOTICE '  % (%), candidatura %, finale %, tecnico %',
      r.requisition_code, r.requisition_status, r.application_stage, r.fin, r.tec;
    -- un finale tolto lascia la candidatura in colloquio: non deve esserci
    -- un'offerta o un esito che da quel finale dipende
    IF r.requisition_status <> 'OPEN' OR r.application_stage <> 'INTERVIEWING' THEN
      RAISE EXCEPTION 'C13 riparazione: il finale da togliere è in % / %, non in una selezione aperta in colloquio',
        r.requisition_status, r.application_stage;
    END IF;
  END LOOP;

  IF v_atteso < 0 THEN
    RAISE EXCEPTION 'C13_SOLO_MISURA';
  END IF;
  -- guardia: la precondizione si ricontrolla al momento della scrittura
  IF coalesce(cardinality(v_fin), 0) <> v_atteso THEN
    RAISE EXCEPTION 'C13 riparazione: attesi % finali da togliere, trovati %: nessuna scrittura',
      v_atteso, coalesce(cardinality(v_fin), 0);
  END IF;

  -- ------------------------------------------------- A. offerte senza RAL
  INSERT INTO staging.storia36_c13_riparazione_undo (undo_file, undo_table, undo_action, undo_row)
  SELECT c_file, 'sys.sys_job_offers', 'UPDATE', to_jsonb(o)
    FROM sys.sys_job_offers o
   WHERE o.offer_tenant_id = c_rtl AND o.offer_metadata->>'storia36' = 'C13'
     AND (o.offer_gross_annual_salary IS NULL OR o.offer_contract_type IS NULL);

  UPDATE sys.sys_job_offers o
     SET offer_gross_annual_salary = coalesce(o.offer_gross_annual_salary, m.sal),
         offer_contract_type = coalesce(o.offer_contract_type, m.tipo),
         offer_metadata = o.offer_metadata
                          || jsonb_build_object('ral_da', 'contratto di chi occupa il posto modello del potenziamento')
    FROM sys.sys_candidate_applications ap
    JOIN sys.sys_job_postings jp ON jp.posting_id = ap.application_posting_id
    JOIN sys.sys_job_requisitions rq ON rq.requisition_id = jp.posting_requisition_id
    JOIN sys.sys_positions p ON p.position_id = rq.requisition_position_id
                            AND p.position_metadata->>'storia36' = 'C13'
    CROSS JOIN LATERAL (
      SELECT c.user_contract_gross_annual_salary AS sal, c.user_contract_type AS tipo
        FROM sys.sys_user_position_assignments pa
        JOIN sys.sys_user_contracts c ON c.user_contract_user_id = pa.user_position_assignment_user_id
       WHERE pa.user_position_assignment_position_id = (p.position_metadata->>'modello_position_id')::uuid
         AND pa.user_position_assignment_kind = 'PRIMARY'
       ORDER BY pa.user_position_assignment_start_date DESC NULLS LAST, c.user_contract_start_date DESC
       LIMIT 1) m
   WHERE ap.application_id = o.offer_application_id
     AND o.offer_tenant_id = c_rtl AND o.offer_metadata->>'storia36' = 'C13'
     AND (o.offer_gross_annual_salary IS NULL OR o.offer_contract_type IS NULL)
     AND m.sal IS NOT NULL;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_tot := v_tot + v_n;
  RAISE NOTICE 'C13 riparazione A: offerte completate con la RAL del posto modello %', v_n;

  -- ------------------------------------- B. finali schiacciati sul tecnico
  INSERT INTO staging.storia36_c13_riparazione_undo (undo_file, undo_table, undo_action, undo_row)
  SELECT c_file, 'sys.sys_interview_feedback', 'DELETE', to_jsonb(fb)
    FROM sys.sys_interview_feedback fb WHERE fb.feedback_interview_id = ANY (coalesce(v_fin, '{}'));
  INSERT INTO staging.storia36_c13_riparazione_undo (undo_file, undo_table, undo_action, undo_row)
  SELECT c_file, 'sys.sys_interviews', 'DELETE', to_jsonb(i)
    FROM sys.sys_interviews i WHERE i.interview_id = ANY (coalesce(v_fin, '{}'));

  DELETE FROM sys.sys_interview_feedback WHERE feedback_interview_id = ANY (coalesce(v_fin, '{}'));
  GET DIAGNOSTICS v_n = ROW_COUNT; v_tot := v_tot + v_n;
  RAISE NOTICE 'C13 riparazione B: valutazioni dei finali tolte %', v_n;
  DELETE FROM sys.sys_interviews WHERE interview_id = ANY (coalesce(v_fin, '{}'));
  GET DIAGNOSTICS v_n = ROW_COUNT; v_tot := v_tot + v_n;
  RAISE NOTICE 'C13 riparazione B: finali tolti %', v_n;

  -- ---------------------------------------------- C. colloqui in agenda
  INSERT INTO sys.sys_interviews (
    interview_id, interview_tenant_id, interview_application_id, interview_kind, interview_status,
    interview_scheduled_at, interview_duration_min, interview_location, interview_metadata,
    created_at, created_by, updated_at, updated_by)
  SELECT uuid_generate_v5(c_ns, 'STORIA36::C13::INT::' || ap.application_id || '::' || n.kind),
         c_rtl, ap.application_id, n.kind, 'SCHEDULED', n.quando,
         CASE n.kind WHEN 'TECHNICAL' THEN 60 ELSE 45 END,
         'Sede di ' || coalesce(jp.posting_location, 'Milano'),
         jsonb_build_object('storia36', 'C13', 'agenda', 'colloquio fissato, non ancora svolto'),
         n.quando - interval '2 days', v_rec, n.quando - interval '2 days', v_rec
    FROM sys.sys_candidate_applications ap
    JOIN sys.sys_job_postings jp ON jp.posting_id = ap.application_posting_id
    JOIN sys.sys_job_requisitions rq ON rq.requisition_id = jp.posting_requisition_id
    CROSS JOIN LATERAL (
      SELECT CASE WHEN EXISTS (SELECT 1 FROM sys.sys_interviews t
                                WHERE t.interview_application_id = ap.application_id
                                  AND t.interview_kind = 'TECHNICAL' AND t.interview_status = 'COMPLETED')
                  THEN 'FINAL' ELSE 'TECHNICAL' END AS kind,
             ((g.d + CASE extract(isodow FROM g.d) WHEN 6 THEN 2 WHEN 7 THEN 1 ELSE 0 END)
               + CASE WHEN pg_temp.h(ap.application_id || 'AGENDA') % 16 < 8
                      THEN time '09:00' + (pg_temp.h(ap.application_id || 'AGENDA') % 8) * interval '30 minutes'
                      ELSE time '14:00' + (pg_temp.h(ap.application_id || 'AGENDA') % 8) * interval '30 minutes' END)
               AT TIME ZONE 'Europe/Rome' AS quando
        FROM (SELECT c_to + 2 + pg_temp.h(ap.application_id || 'AGENDA-G') % 6 AS d) g) n
   WHERE ap.application_tenant_id = c_rtl AND rq.requisition_metadata->>'storia36' = 'C13'
     AND rq.requisition_status = 'OPEN' AND ap.application_stage = 'INTERVIEWING'
     AND NOT EXISTS (SELECT 1 FROM sys.sys_interviews s
                      WHERE s.interview_application_id = ap.application_id
                        AND s.interview_status = 'SCHEDULED')
     AND NOT EXISTS (SELECT 1 FROM sys.sys_interviews f
                      WHERE f.interview_application_id = ap.application_id
                        AND f.interview_kind = 'FINAL' AND f.interview_status = 'COMPLETED')
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_tot := v_tot + v_n;
  RAISE NOTICE 'C13 riparazione C: colloqui in agenda %', v_n;

  INSERT INTO staging.storia36_runs (cluster_code, seed_file, rows_written, twice_run_delta)
  VALUES ('C13', c_file, v_tot, v_tot);

  -- post-condizioni: le stesse del seed
  PERFORM staging.storia36_check_c13a();
  PERFORM staging.storia36_check_c13b(c_to);
  PERFORM staging.storia36_check_c13c(c_to);
  PERFORM staging.storia36_check_c13d();
  RAISE NOTICE 'C13 riparazione OK: % righe toccate (atteso 0 alla seconda corsa)', v_tot;
EXCEPTION WHEN OTHERS THEN
  IF SQLERRM = 'C13_SOLO_MISURA' THEN
    RAISE NOTICE 'C13 riparazione: solo misura, nessuna scrittura (passare -v atteso=N per scrivere)';
  ELSE
    RAISE;
  END IF;
END $$;

-- in sola misura anche il giornale appena creato se ne va
\if :scrive
COMMIT;
\else
ROLLBACK;
\endif
