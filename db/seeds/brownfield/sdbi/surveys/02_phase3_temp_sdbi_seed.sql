-- SDBI Surveys/Engagement pilot — Phase 3 seed. Run via psql -v ON_ERROR_STOP=1.
BEGIN;
DO $$ DECLARE v uuid := gen_random_uuid(); BEGIN
  INSERT INTO brownfield.import_runs (import_run_id, import_run_export_id, import_run_status, import_run_started_at, import_run_metadata)
  VALUES (v,(SELECT source_export_id FROM brownfield.source_exports ORDER BY 1 LIMIT 1),'RUNNING',now(),
    jsonb_build_object('workflow','SDBI_PHASE_3','pilot','surveys','mapping_card','SURVEYS-MAP-01','source','heuresys_platform_0507'));
  PERFORM set_config('sdbi.run_id', v::text, true);
END $$;

INSERT INTO temp_sdbi.surveys (_legacy_source_id,_import_run_id,survey_tenant_id,survey_natural_key,survey_title,
  survey_description,survey_type,survey_status,survey_start_date,survey_end_date,survey_is_anonymous,survey_is_active,
  survey_questions,survey_total_invitations,survey_deleted_at,survey_metadata,created_at,updated_at)
SELECT src.id,current_setting('sdbi.run_id')::uuid,tm.canonical_tenant_id,
  'SURVEY::'||tm.canonical_tenant_id::text||'::'||src.id::text,TRIM(src.title),src.description,UPPER(src.survey_type),
  UPPER(src.status),src.start_date,src.end_date,src.is_anonymous,src.is_active,src.questions,src.total_invitations,
  src.deleted_at,jsonb_build_object('legacy_id',src.id::text,'legacy_table','public.surveys'),
  src.created_at AT TIME ZONE 'UTC', src.updated_at AT TIME ZONE 'UTC'
FROM legacy_mirror.surveys src JOIN brownfield.tenant_id_mappings tm ON tm.legacy_id=src.tenant_id::text
ON CONFLICT (_legacy_source_id) DO NOTHING;

-- survey_responses: no tenant_id → inherit from parent survey
INSERT INTO temp_sdbi.survey_responses (_legacy_source_id,_legacy_survey_id,_import_run_id,response_tenant_id,
  response_natural_key,response_legacy_question_id,response_rating_value,response_text_value,response_choice_value,
  response_metadata,created_at,updated_at)
SELECT src.id,src.survey_id,current_setting('sdbi.run_id')::uuid,tm.canonical_tenant_id,
  'SURVEY_RESPONSE::'||tm.canonical_tenant_id::text||'::'||src.id::text,src.question_id,src.rating_value,src.text_value,
  src.choice_value,jsonb_build_object('legacy_id',src.id::text,'legacy_survey_id',src.survey_id::text,
    'legacy_question_id',src.question_id::text,'legacy_employee_id',src.employee_id::text),
  src.created_at AT TIME ZONE 'UTC', src.created_at AT TIME ZONE 'UTC'
FROM legacy_mirror.survey_responses src
JOIN legacy_mirror.surveys s ON s.id=src.survey_id
JOIN brownfield.tenant_id_mappings tm ON tm.legacy_id=s.tenant_id::text
ON CONFLICT (_legacy_source_id) DO NOTHING;

INSERT INTO temp_sdbi.engagement_surveys (_legacy_source_id,_import_run_id,esurvey_tenant_id,esurvey_natural_key,
  esurvey_legacy_template_id,esurvey_title,esurvey_description,esurvey_questions,esurvey_is_anonymous,esurvey_status,
  esurvey_audience_type,esurvey_audience_ids,esurvey_start_date,esurvey_end_date,esurvey_reminder_days,
  esurvey_total_invitations,esurvey_total_responses,esurvey_metadata,created_at,updated_at)
SELECT src.id,current_setting('sdbi.run_id')::uuid,tm.canonical_tenant_id,
  'ENG_SURVEY::'||tm.canonical_tenant_id::text||'::'||src.id::text,src.template_id,TRIM(src.title),src.description,
  src.questions,src.is_anonymous,UPPER(src.status),UPPER(src.audience_type),to_jsonb(src.audience_ids),
  src.start_date,src.end_date,to_jsonb(src.reminder_days),src.total_invitations,src.total_responses,
  jsonb_build_object('legacy_id',src.id::text,'legacy_table','public.engagement_surveys','legacy_created_by',src.created_by::text),
  src.created_at, src.updated_at
FROM legacy_mirror.engagement_surveys src JOIN brownfield.tenant_id_mappings tm ON tm.legacy_id=src.tenant_id::text
ON CONFLICT (_legacy_source_id) DO NOTHING;

INSERT INTO temp_sdbi.engagement_survey_responses (_legacy_source_id,_legacy_survey_id,_import_run_id,eresponse_tenant_id,
  eresponse_natural_key,eresponse_anonymous_token,eresponse_answers,eresponse_started_at,eresponse_completed_at,
  eresponse_is_complete,eresponse_metadata,created_at,updated_at)
SELECT src.id,src.survey_id,current_setting('sdbi.run_id')::uuid,tm.canonical_tenant_id,
  'ENG_SURVEY_RESPONSE::'||tm.canonical_tenant_id::text||'::'||src.id::text,src.anonymous_token,src.answers,
  src.started_at,src.completed_at,src.is_complete,
  jsonb_build_object('legacy_id',src.id::text,'legacy_survey_id',src.survey_id::text,'legacy_employee_id',src.employee_id::text),
  src.created_at, src.created_at
FROM legacy_mirror.engagement_survey_responses src JOIN brownfield.tenant_id_mappings tm ON tm.legacy_id=src.tenant_id::text
ON CONFLICT (_legacy_source_id) DO NOTHING;

UPDATE brownfield.import_runs SET import_run_status='COMPLETED', import_run_finished_at=now() WHERE import_run_id=current_setting('sdbi.run_id')::uuid;
COMMIT;
SELECT 'surveys' t,count(*) FROM temp_sdbi.surveys UNION ALL SELECT 'survey_responses',count(*) FROM temp_sdbi.survey_responses
UNION ALL SELECT 'engagement_surveys',count(*) FROM temp_sdbi.engagement_surveys UNION ALL SELECT 'engagement_survey_responses',count(*) FROM temp_sdbi.engagement_survey_responses ORDER BY 1;
