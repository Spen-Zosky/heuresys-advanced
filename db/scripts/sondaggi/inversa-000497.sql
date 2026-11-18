-- ============================================================================
-- 000497, INVERSA (fuori catena): toglie dal modello della pagina /engagement i sondaggi venuti
-- dal modello vecchio. NON è una migrazione: non gira al deploy.
--
--   psql -1 -v ON_ERROR_STOP=1 -f db/scripts/sondaggi/inversa-000497.sql
--
-- Cancella SOLO le righe elencate nel giornale staging.sondaggi_un_modello_undo, per chiave
-- naturale e tabella per tabella (prima le risposte, poi le domande, poi i sondaggi e i modelli).
-- Le tabelle d'origine (sys_engagement_*) non si toccano: i dati restano dove erano.
-- Vale insieme al ritiro del file 000497 (ADR-0035), altrimenti al deploy dopo tornano.
-- GUARDIA: si rifiuta se una risposta che NON è nel giornale punta a una domanda o a un sondaggio
-- che lo è (vorrebbe dire che qualcuno ha risposto a un sondaggio trasferito: decide Enzo).
-- Idempotente: con il giornale già applicato non cancella niente.
-- ============================================================================
DO $$
DECLARE n bigint;
BEGIN
  IF to_regclass('staging.sondaggi_un_modello_undo') IS NULL THEN
    RAISE NOTICE 'inversa-000497: nessun giornale, niente da togliere';
    RETURN;
  END IF;
  SELECT count(*) INTO n
    FROM sys.sys_survey_responses r
    JOIN sys.sys_surveys s ON s.survey_id = r.survey_response_survey_id
    JOIN staging.sondaggi_un_modello_undo j
      ON j.tabella = 'sys_surveys' AND j.tenant_id = s.survey_tenant_id AND j.natural_key = s.survey_natural_key
   WHERE NOT EXISTS (SELECT 1 FROM staging.sondaggi_un_modello_undo k
                      WHERE k.tabella = 'sys_survey_responses' AND k.tenant_id = r.survey_response_tenant_id
                        AND k.natural_key = r.survey_response_natural_key);
  IF n <> 0 THEN
    RAISE EXCEPTION 'inversa-000497: % risposte nuove su sondaggi trasferiti: mi fermo', n;
  END IF;

  DELETE FROM sys.sys_survey_responses r USING staging.sondaggi_un_modello_undo j
   WHERE j.tabella = 'sys_survey_responses' AND j.tenant_id = r.survey_response_tenant_id
     AND j.natural_key = r.survey_response_natural_key;
  GET DIAGNOSTICS n = ROW_COUNT; RAISE NOTICE 'inversa-000497: risposte tolte %', n;
  DELETE FROM sys.sys_survey_questions q USING staging.sondaggi_un_modello_undo j
   WHERE j.tabella = 'sys_survey_questions' AND j.tenant_id = q.survey_question_tenant_id
     AND j.natural_key = q.survey_question_natural_key;
  GET DIAGNOSTICS n = ROW_COUNT; RAISE NOTICE 'inversa-000497: domande tolte %', n;
  DELETE FROM sys.sys_surveys s USING staging.sondaggi_un_modello_undo j
   WHERE j.tabella = 'sys_surveys' AND j.tenant_id = s.survey_tenant_id
     AND j.natural_key = s.survey_natural_key;
  GET DIAGNOSTICS n = ROW_COUNT; RAISE NOTICE 'inversa-000497: sondaggi tolti %', n;
  DELETE FROM sys.sys_survey_templates t USING staging.sondaggi_un_modello_undo j
   WHERE j.tabella = 'sys_survey_templates' AND j.tenant_id = t.survey_template_tenant_id
     AND j.natural_key = t.survey_template_natural_key;
  GET DIAGNOSTICS n = ROW_COUNT; RAISE NOTICE 'inversa-000497: modelli tolti %', n;
END $$;
