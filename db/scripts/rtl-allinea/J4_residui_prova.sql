-- J4 (mandato RTL 2026-11-15): toglie dal tenant RTL Bank SOLO tre residui di prova. Idempotente.
--   sys_candidates       e3682d7e-8f93-484c-abf5-79a093774aff  candidato «Prova»
--   sys_surveys          b8a03008-7883-4171-81f2-5ef752305031  indagine «test»
--   sys_continuous_feedback 664d3c67-a4a6-4f0f-8b5b-b5b95f90a75b  riscontro «QA test»
-- NON tocca le 26 richieste e le 27 notifiche «Fascicolo di prova» del tenant Heuresys System (8bc5bc59-...): sono di piattaforma, solo segnalate nel censimento.
-- Guardia: il tenant dichiarato nella riga e' RTL, il testo e' quello atteso, nessuna riga dipendente (chiavi esterne entranti a zero). Se una condizione non regge, si ferma.
-- Giornale: staging.rtl_residui_prova_undo (la riga intera in jsonb). Rollback: INSERT INTO sys.<tabella> SELECT * FROM jsonb_populate_record(NULL::sys.<tabella>, riga) per ogni voce del giornale non ancora ripristinata.
\set ON_ERROR_STOP on
BEGIN;
CREATE TABLE IF NOT EXISTS staging.rtl_residui_prova_undo (salvato_il timestamptz NOT NULL DEFAULT now(), tabella text NOT NULL, chiave uuid NOT NULL, riga jsonb NOT NULL, PRIMARY KEY (tabella, chiave));
-- Misura prima
SELECT 'J4 prima' fase,
  (SELECT count(*) FROM sys.sys_candidates WHERE candidate_id = 'e3682d7e-8f93-484c-abf5-79a093774aff') candidati,
  (SELECT count(*) FROM sys.sys_surveys WHERE survey_id = 'b8a03008-7883-4171-81f2-5ef752305031') indagini,
  (SELECT count(*) FROM sys.sys_continuous_feedback WHERE feedback_id = '664d3c67-a4a6-4f0f-8b5b-b5b95f90a75b') riscontri,
  (SELECT count(*) FROM sys.sys_candidates WHERE candidate_tenant_id = '86ba7a65-217f-48ba-8ce5-5c09b40a66b0') candidati_rtl,
  (SELECT count(*) FROM sys.sys_surveys WHERE survey_tenant_id = '86ba7a65-217f-48ba-8ce5-5c09b40a66b0') indagini_rtl,
  (SELECT count(*) FROM sys.sys_continuous_feedback WHERE feedback_tenant_id = '86ba7a65-217f-48ba-8ce5-5c09b40a66b0') riscontri_rtl;
CREATE TEMP TABLE prima ON COMMIT DROP AS SELECT
  (SELECT count(*) FROM sys.sys_candidates WHERE candidate_tenant_id = '86ba7a65-217f-48ba-8ce5-5c09b40a66b0') c,
  (SELECT count(*) FROM sys.sys_surveys WHERE survey_tenant_id = '86ba7a65-217f-48ba-8ce5-5c09b40a66b0') s,
  (SELECT count(*) FROM sys.sys_continuous_feedback WHERE feedback_tenant_id = '86ba7a65-217f-48ba-8ce5-5c09b40a66b0') f,
  (SELECT count(*) FROM sys.sys_candidate_applications) ap,
  (SELECT count(*) FROM sys.sys_survey_assignments) sa, (SELECT count(*) FROM sys.sys_survey_questions) sq, (SELECT count(*) FROM sys.sys_survey_responses) sr;
DO $$ DECLARE n bigint; BEGIN
  -- candidato «Prova»
  IF EXISTS (SELECT 1 FROM sys.sys_candidates WHERE candidate_id = 'e3682d7e-8f93-484c-abf5-79a093774aff') THEN
    IF NOT EXISTS (SELECT 1 FROM sys.sys_candidates WHERE candidate_id = 'e3682d7e-8f93-484c-abf5-79a093774aff' AND candidate_tenant_id = '86ba7a65-217f-48ba-8ce5-5c09b40a66b0' AND candidate_first_name = 'Prova') THEN RAISE EXCEPTION 'J4: il candidato non e'' piu'' quello atteso del tenant RTL'; END IF;
    SELECT count(*) INTO n FROM sys.sys_candidate_applications WHERE application_candidate_id = 'e3682d7e-8f93-484c-abf5-79a093774aff';
    IF n > 0 THEN RAISE EXCEPTION 'J4: il candidato ha % candidature, si ferma', n; END IF;
    INSERT INTO staging.rtl_residui_prova_undo (tabella, chiave, riga) SELECT 'sys_candidates', candidate_id, to_jsonb(c) FROM sys.sys_candidates c WHERE candidate_id = 'e3682d7e-8f93-484c-abf5-79a093774aff' ON CONFLICT DO NOTHING;
    DELETE FROM sys.sys_candidates WHERE candidate_id = 'e3682d7e-8f93-484c-abf5-79a093774aff' AND candidate_tenant_id = '86ba7a65-217f-48ba-8ce5-5c09b40a66b0';
  END IF;
  -- indagine «test»
  IF EXISTS (SELECT 1 FROM sys.sys_surveys WHERE survey_id = 'b8a03008-7883-4171-81f2-5ef752305031') THEN
    IF NOT EXISTS (SELECT 1 FROM sys.sys_surveys WHERE survey_id = 'b8a03008-7883-4171-81f2-5ef752305031' AND survey_tenant_id = '86ba7a65-217f-48ba-8ce5-5c09b40a66b0' AND survey_description = 'test') THEN RAISE EXCEPTION 'J4: l''indagine non e'' piu'' quella attesa del tenant RTL'; END IF;
    SELECT (SELECT count(*) FROM sys.sys_survey_assignments WHERE survey_assignment_survey_id = 'b8a03008-7883-4171-81f2-5ef752305031')
         + (SELECT count(*) FROM sys.sys_survey_questions WHERE survey_question_survey_id = 'b8a03008-7883-4171-81f2-5ef752305031')
         + (SELECT count(*) FROM sys.sys_survey_responses WHERE survey_response_survey_id = 'b8a03008-7883-4171-81f2-5ef752305031') INTO n;
    IF n > 0 THEN RAISE EXCEPTION 'J4: l''indagine ha % righe dipendenti, si ferma', n; END IF;
    INSERT INTO staging.rtl_residui_prova_undo (tabella, chiave, riga) SELECT 'sys_surveys', survey_id, to_jsonb(s) FROM sys.sys_surveys s WHERE survey_id = 'b8a03008-7883-4171-81f2-5ef752305031' ON CONFLICT DO NOTHING;
    DELETE FROM sys.sys_surveys WHERE survey_id = 'b8a03008-7883-4171-81f2-5ef752305031' AND survey_tenant_id = '86ba7a65-217f-48ba-8ce5-5c09b40a66b0';
  END IF;
  -- riscontro «QA test»
  IF EXISTS (SELECT 1 FROM sys.sys_continuous_feedback WHERE feedback_id = '664d3c67-a4a6-4f0f-8b5b-b5b95f90a75b') THEN
    IF NOT EXISTS (SELECT 1 FROM sys.sys_continuous_feedback WHERE feedback_id = '664d3c67-a4a6-4f0f-8b5b-b5b95f90a75b' AND feedback_tenant_id = '86ba7a65-217f-48ba-8ce5-5c09b40a66b0' AND feedback_message = 'QA test') THEN RAISE EXCEPTION 'J4: il riscontro non e'' piu'' quello atteso del tenant RTL'; END IF;
    INSERT INTO staging.rtl_residui_prova_undo (tabella, chiave, riga) SELECT 'sys_continuous_feedback', feedback_id, to_jsonb(f) FROM sys.sys_continuous_feedback f WHERE feedback_id = '664d3c67-a4a6-4f0f-8b5b-b5b95f90a75b' ON CONFLICT DO NOTHING;
    DELETE FROM sys.sys_continuous_feedback WHERE feedback_id = '664d3c67-a4a6-4f0f-8b5b-b5b95f90a75b' AND feedback_tenant_id = '86ba7a65-217f-48ba-8ce5-5c09b40a66b0';
  END IF;
END $$;
-- Post-condizione: spariti i tre, nient'altro e' cambiato (stesse righe nel tenant meno quelle tolte, stesse tabelle dipendenti)
DO $$ DECLARE p prima%ROWTYPE; tolte_c int; tolte_s int; tolte_f int; BEGIN
  SELECT * INTO p FROM prima;
  SELECT count(*) FILTER (WHERE tabella='sys_candidates'), count(*) FILTER (WHERE tabella='sys_surveys'), count(*) FILTER (WHERE tabella='sys_continuous_feedback') INTO tolte_c, tolte_s, tolte_f FROM staging.rtl_residui_prova_undo WHERE chiave IN ('e3682d7e-8f93-484c-abf5-79a093774aff','b8a03008-7883-4171-81f2-5ef752305031','664d3c67-a4a6-4f0f-8b5b-b5b95f90a75b');
  IF EXISTS (SELECT 1 FROM sys.sys_candidates WHERE candidate_id = 'e3682d7e-8f93-484c-abf5-79a093774aff') OR EXISTS (SELECT 1 FROM sys.sys_surveys WHERE survey_id = 'b8a03008-7883-4171-81f2-5ef752305031') OR EXISTS (SELECT 1 FROM sys.sys_continuous_feedback WHERE feedback_id = '664d3c67-a4a6-4f0f-8b5b-b5b95f90a75b') THEN RAISE EXCEPTION 'J4: un residuo e'' ancora presente'; END IF;
  IF (SELECT count(*) FROM sys.sys_candidates WHERE candidate_tenant_id = '86ba7a65-217f-48ba-8ce5-5c09b40a66b0') <> p.c - (SELECT count(*) FROM staging.rtl_residui_prova_undo WHERE tabella='sys_candidates' AND salvato_il = now()) THEN RAISE EXCEPTION 'J4: i candidati RTL non tornano'; END IF;
  IF (SELECT count(*) FROM sys.sys_surveys WHERE survey_tenant_id = '86ba7a65-217f-48ba-8ce5-5c09b40a66b0') <> p.s - (SELECT count(*) FROM staging.rtl_residui_prova_undo WHERE tabella='sys_surveys' AND salvato_il = now()) THEN RAISE EXCEPTION 'J4: le indagini RTL non tornano'; END IF;
  IF (SELECT count(*) FROM sys.sys_continuous_feedback WHERE feedback_tenant_id = '86ba7a65-217f-48ba-8ce5-5c09b40a66b0') <> p.f - (SELECT count(*) FROM staging.rtl_residui_prova_undo WHERE tabella='sys_continuous_feedback' AND salvato_il = now()) THEN RAISE EXCEPTION 'J4: i riscontri RTL non tornano'; END IF;
  IF (SELECT count(*) FROM sys.sys_candidate_applications) <> p.ap OR (SELECT count(*) FROM sys.sys_survey_assignments) <> p.sa OR (SELECT count(*) FROM sys.sys_survey_questions) <> p.sq OR (SELECT count(*) FROM sys.sys_survey_responses) <> p.sr THEN RAISE EXCEPTION 'J4: una tabella dipendente e'' cambiata'; END IF;
END $$;
COMMIT;
SELECT 'J4 ok' esito, (SELECT count(*) FROM staging.rtl_residui_prova_undo) voci_nel_giornale,
  (SELECT count(*) FROM sys.sys_candidates WHERE candidate_id = 'e3682d7e-8f93-484c-abf5-79a093774aff') + (SELECT count(*) FROM sys.sys_surveys WHERE survey_id = 'b8a03008-7883-4171-81f2-5ef752305031') + (SELECT count(*) FROM sys.sys_continuous_feedback WHERE feedback_id = '664d3c67-a4a6-4f0f-8b5b-b5b95f90a75b') residui_dopo;
