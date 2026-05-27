-- SDBI Surveys/Engagement pilot — Phase 5 consolidation. FK via sys.* natural_key. ON_ERROR_STOP=1.
BEGIN;
SELECT set_config('sdbi.run_id',(SELECT import_run_id::text FROM brownfield.import_runs
  WHERE import_run_metadata->>'pilot'='surveys' ORDER BY import_run_started_at DESC LIMIT 1), false);

INSERT INTO sys.sys_surveys (survey_id,survey_tenant_id,survey_natural_key,survey_title,survey_description,survey_type,
  survey_status,survey_start_date,survey_end_date,survey_is_anonymous,survey_is_active,survey_questions,
  survey_total_invitations,survey_deleted_at,survey_metadata,created_at,updated_at)
SELECT survey_id,survey_tenant_id,survey_natural_key,survey_title,survey_description,survey_type,survey_status,
  survey_start_date,survey_end_date,survey_is_anonymous,survey_is_active,survey_questions,survey_total_invitations,
  survey_deleted_at,survey_metadata,created_at,updated_at
FROM temp_sdbi.surveys ON CONFLICT (survey_tenant_id,survey_natural_key) DO NOTHING;

INSERT INTO sys.sys_survey_responses (response_id,response_tenant_id,response_natural_key,response_survey_id,
  response_legacy_question_id,response_respondent_user_id,response_rating_value,response_text_value,response_choice_value,
  response_metadata,created_at,updated_at)
SELECT r.response_id,r.response_tenant_id,r.response_natural_key,
  (SELECT survey_id FROM sys.sys_surveys s WHERE s.survey_tenant_id=r.response_tenant_id
     AND s.survey_natural_key='SURVEY::'||r.response_tenant_id::text||'::'||r._legacy_survey_id::text),
  r.response_legacy_question_id,NULL::uuid,r.response_rating_value,r.response_text_value,r.response_choice_value,
  r.response_metadata,r.created_at,r.updated_at
FROM temp_sdbi.survey_responses r ON CONFLICT (response_tenant_id,response_natural_key) DO NOTHING;

INSERT INTO sys.sys_engagement_surveys (esurvey_id,esurvey_tenant_id,esurvey_natural_key,esurvey_legacy_template_id,
  esurvey_title,esurvey_description,esurvey_questions,esurvey_is_anonymous,esurvey_status,esurvey_audience_type,
  esurvey_audience_ids,esurvey_start_date,esurvey_end_date,esurvey_reminder_days,esurvey_total_invitations,
  esurvey_total_responses,esurvey_created_by_user_id,esurvey_metadata,created_at,updated_at)
SELECT esurvey_id,esurvey_tenant_id,esurvey_natural_key,esurvey_legacy_template_id,esurvey_title,esurvey_description,
  esurvey_questions,esurvey_is_anonymous,esurvey_status,esurvey_audience_type,esurvey_audience_ids,esurvey_start_date,
  esurvey_end_date,esurvey_reminder_days,esurvey_total_invitations,esurvey_total_responses,NULL::uuid,esurvey_metadata,created_at,updated_at
FROM temp_sdbi.engagement_surveys ON CONFLICT (esurvey_tenant_id,esurvey_natural_key) DO NOTHING;

INSERT INTO sys.sys_engagement_survey_responses (eresponse_id,eresponse_tenant_id,eresponse_natural_key,eresponse_survey_id,
  eresponse_respondent_user_id,eresponse_anonymous_token,eresponse_answers,eresponse_started_at,eresponse_completed_at,
  eresponse_is_complete,eresponse_metadata,created_at,updated_at)
SELECT e.eresponse_id,e.eresponse_tenant_id,e.eresponse_natural_key,
  (SELECT esurvey_id FROM sys.sys_engagement_surveys es WHERE es.esurvey_tenant_id=e.eresponse_tenant_id
     AND es.esurvey_natural_key='ENG_SURVEY::'||e.eresponse_tenant_id::text||'::'||e._legacy_survey_id::text),
  NULL::uuid,e.eresponse_anonymous_token,e.eresponse_answers,e.eresponse_started_at,e.eresponse_completed_at,
  e.eresponse_is_complete,e.eresponse_metadata,e.created_at,e.updated_at
FROM temp_sdbi.engagement_survey_responses e ON CONFLICT (eresponse_tenant_id,eresponse_natural_key) DO NOTHING;

INSERT INTO sys.sys_source_lineage_records (source_lineage_tenant_id,source_lineage_source_system,source_lineage_source_table,
  source_lineage_source_record_id,source_lineage_source_natural_key,source_lineage_import_run_id,source_lineage_target_table_name,
  source_lineage_target_record_id,source_lineage_mapping_confidence,source_lineage_validation_status,source_lineage_metadata,
  source_lineage_sdbi_mapping_card_id,source_lineage_sdbi_confidence,source_lineage_sdbi_ai_model_id,source_lineage_sdbi_human_approver)
SELECT x.tenant,'heuresys_platform',x.src,x.sid::text,'OLDDB::'||x.src||'::'||x.sid::text,current_setting('sdbi.run_id')::uuid,
  x.tgt,x.tid,0.85,'VALID',jsonb_build_object('sdbi_pilot','surveys'),'SURVEYS-MAP-01',0.85,'cli-claude-opus-4.7','enzo.spenuso@outlook.com'
FROM (
  SELECT survey_tenant_id tenant,'surveys' src,_legacy_source_id sid,'sys_surveys' tgt,survey_id tid FROM temp_sdbi.surveys
  UNION ALL SELECT response_tenant_id,'survey_responses',_legacy_source_id,'sys_survey_responses',response_id FROM temp_sdbi.survey_responses
  UNION ALL SELECT esurvey_tenant_id,'engagement_surveys',_legacy_source_id,'sys_engagement_surveys',esurvey_id FROM temp_sdbi.engagement_surveys
  UNION ALL SELECT eresponse_tenant_id,'engagement_survey_responses',_legacy_source_id,'sys_engagement_survey_responses',eresponse_id FROM temp_sdbi.engagement_survey_responses
) x ON CONFLICT (source_lineage_source_system,source_lineage_source_table,source_lineage_source_record_id,source_lineage_target_table_name) DO NOTHING;

INSERT INTO audit.import_validation_results (import_validation_result_run_id,import_validation_result_rule_code,
  import_validation_result_status,import_validation_result_message,import_validation_result_payload)
SELECT current_setting('sdbi.run_id')::uuid,'SDBI_CONSOLIDATION_COMPLETE_V1','PASSED','SDBI Surveys pilot — '||tgt,
  jsonb_build_object('mapping_card','SURVEYS-MAP-01','target_table',tgt)
FROM (VALUES ('sys_surveys'),('sys_survey_responses'),('sys_engagement_surveys'),('sys_engagement_survey_responses')) v(tgt);
COMMIT;
SELECT 'sys_surveys' t,count(*) FROM sys.sys_surveys UNION ALL SELECT 'sys_survey_responses',count(*) FROM sys.sys_survey_responses
UNION ALL SELECT 'sys_engagement_surveys',count(*) FROM sys.sys_engagement_surveys UNION ALL SELECT 'sys_engagement_survey_responses',count(*) FROM sys.sys_engagement_survey_responses ORDER BY 1;
