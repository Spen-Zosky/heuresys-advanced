-- SDBI Feedback pilot — Phase 5 consolidation. Cross-cluster FK via sys.* natural_key/metadata.
-- Run via psql -v ON_ERROR_STOP=1.
BEGIN;
SELECT set_config('sdbi.run_id',(SELECT import_run_id::text FROM brownfield.import_runs
  WHERE import_run_metadata->>'pilot'='feedback' ORDER BY import_run_started_at DESC LIMIT 1), false);

INSERT INTO sys.sys_feedback_360 (feedback_id,feedback_tenant_id,feedback_natural_key,feedback_target_user_id,
  feedback_reviewer_user_id,feedback_review_cycle_id,feedback_performance_review_id,feedback_relationship_type,
  feedback_overall_rating,feedback_strengths,feedback_areas_for_improvement,feedback_is_anonymous,feedback_status,
  feedback_legacy_questionnaire_id,feedback_legacy_request_id,feedback_question_responses,feedback_sentiment_score,
  feedback_submission_time_seconds,feedback_completed_at,feedback_metadata,created_at,updated_at)
SELECT f.feedback_id,f.feedback_tenant_id,f.feedback_natural_key,NULL::uuid,NULL::uuid,
  (SELECT cycle_id FROM sys.sys_review_cycles rc WHERE rc.cycle_tenant_id=f.feedback_tenant_id
     AND rc.cycle_natural_key='REVIEW_CYCLE::'||f.feedback_tenant_id::text||'::'||f._legacy_review_cycle_id::text),
  (SELECT review_id FROM sys.sys_performance_reviews pr WHERE pr.review_tenant_id=f.feedback_tenant_id
     AND pr.review_natural_key='PERF_REVIEW::'||f.feedback_tenant_id::text||'::'||f._legacy_performance_review_id::text),
  f.feedback_relationship_type,f.feedback_overall_rating,f.feedback_strengths,f.feedback_areas_for_improvement,
  f.feedback_is_anonymous,f.feedback_status,f.feedback_legacy_questionnaire_id,f.feedback_legacy_request_id,
  f.feedback_question_responses,f.feedback_sentiment_score,f.feedback_submission_time_seconds,f.feedback_completed_at,
  f.feedback_metadata,f.created_at,f.updated_at
FROM temp_sdbi.feedback_360 f ON CONFLICT (feedback_tenant_id,feedback_natural_key) DO NOTHING;

INSERT INTO sys.sys_continuous_feedback (cf_id,cf_tenant_id,cf_natural_key,cf_from_user_id,cf_to_user_id,cf_feedback_type,
  cf_message,cf_is_private,cf_related_goal_id,cf_legacy_competency_id,cf_sentiment_score,cf_acknowledged,cf_acknowledged_at,
  cf_visibility,cf_tags,cf_category,cf_performance_review_id,cf_metadata,created_at,updated_at)
SELECT c.cf_id,c.cf_tenant_id,c.cf_natural_key,NULL::uuid,NULL::uuid,c.cf_feedback_type,c.cf_message,c.cf_is_private,
  (SELECT goal_id FROM sys.sys_goals sg WHERE sg.goal_metadata->>'legacy_id'=c._legacy_goal_id::text),
  c.cf_legacy_competency_id,c.cf_sentiment_score,c.cf_acknowledged,c.cf_acknowledged_at,c.cf_visibility,c.cf_tags,c.cf_category,
  (SELECT review_id FROM sys.sys_performance_reviews pr WHERE pr.review_tenant_id=c.cf_tenant_id
     AND pr.review_natural_key='PERF_REVIEW::'||c.cf_tenant_id::text||'::'||c._legacy_performance_review_id::text),
  c.cf_metadata,c.created_at,c.updated_at
FROM temp_sdbi.continuous_feedback c ON CONFLICT (cf_tenant_id,cf_natural_key) DO NOTHING;

INSERT INTO sys.sys_feedback_requests (request_id,request_tenant_id,request_natural_key,request_requestee_user_id,
  request_reviewer_user_id,request_feedback_type,request_status,request_due_date,request_completed_at,request_is_anonymous,
  request_review_cycle_id,request_performance_review_id,request_legacy_questionnaire_id,request_relationship_type,
  request_reminder_sent_at,request_legacy_feedback_360_id,request_metadata,created_at,updated_at)
SELECT r.request_id,r.request_tenant_id,r.request_natural_key,NULL::uuid,NULL::uuid,r.request_feedback_type,r.request_status,
  r.request_due_date,r.request_completed_at,r.request_is_anonymous,
  (SELECT cycle_id FROM sys.sys_review_cycles rc WHERE rc.cycle_tenant_id=r.request_tenant_id
     AND rc.cycle_natural_key='REVIEW_CYCLE::'||r.request_tenant_id::text||'::'||r._legacy_review_cycle_id::text),
  (SELECT review_id FROM sys.sys_performance_reviews pr WHERE pr.review_tenant_id=r.request_tenant_id
     AND pr.review_natural_key='PERF_REVIEW::'||r.request_tenant_id::text||'::'||r._legacy_performance_review_id::text),
  r.request_legacy_questionnaire_id,r.request_relationship_type,r.request_reminder_sent_at,r.request_legacy_feedback_360_id,
  r.request_metadata,r.created_at,r.updated_at
FROM temp_sdbi.feedback_requests r ON CONFLICT (request_tenant_id,request_natural_key) DO NOTHING;

INSERT INTO sys.sys_feedback_responses (response_id,response_tenant_id,response_natural_key,response_request_id,
  response_overall_rating,response_strengths,response_areas_for_improvement,response_additional_comments,
  response_competency_ratings,response_metadata,created_at,updated_at)
SELECT rsp.response_id,rsp.response_tenant_id,rsp.response_natural_key,
  (SELECT request_id FROM sys.sys_feedback_requests fr WHERE fr.request_tenant_id=rsp.response_tenant_id
     AND fr.request_natural_key='FEEDBACK_REQUEST::'||rsp.response_tenant_id::text||'::'||rsp._legacy_request_id::text),
  rsp.response_overall_rating,rsp.response_strengths,rsp.response_areas_for_improvement,rsp.response_additional_comments,
  rsp.response_competency_ratings,rsp.response_metadata,rsp.created_at,rsp.updated_at
FROM temp_sdbi.feedback_responses rsp ON CONFLICT (response_tenant_id,response_natural_key) DO NOTHING;

INSERT INTO sys.sys_source_lineage_records (source_lineage_tenant_id,source_lineage_source_system,source_lineage_source_table,
  source_lineage_source_record_id,source_lineage_source_natural_key,source_lineage_import_run_id,source_lineage_target_table_name,
  source_lineage_target_record_id,source_lineage_mapping_confidence,source_lineage_validation_status,source_lineage_metadata,
  source_lineage_sdbi_mapping_card_id,source_lineage_sdbi_confidence,source_lineage_sdbi_ai_model_id,source_lineage_sdbi_human_approver)
SELECT x.tenant,'heuresys_platform',x.src,x.sid::text,'OLDDB::'||x.src||'::'||x.sid::text,current_setting('sdbi.run_id')::uuid,
  x.tgt,x.tid,0.85,'VALID',jsonb_build_object('sdbi_pilot','feedback'),'FEEDBACK-MAP-01',0.85,'cli-claude-opus-4.7','enzo.spenuso@outlook.com'
FROM (
  SELECT feedback_tenant_id tenant,'feedback_360' src,_legacy_source_id sid,'sys_feedback_360' tgt,feedback_id tid FROM temp_sdbi.feedback_360
  UNION ALL SELECT cf_tenant_id,'continuous_feedback',_legacy_source_id,'sys_continuous_feedback',cf_id FROM temp_sdbi.continuous_feedback
  UNION ALL SELECT request_tenant_id,'feedback_requests',_legacy_source_id,'sys_feedback_requests',request_id FROM temp_sdbi.feedback_requests
  UNION ALL SELECT response_tenant_id,'feedback_responses',_legacy_source_id,'sys_feedback_responses',response_id FROM temp_sdbi.feedback_responses
) x ON CONFLICT (source_lineage_source_system,source_lineage_source_table,source_lineage_source_record_id,source_lineage_target_table_name) DO NOTHING;

INSERT INTO audit.import_validation_results (import_validation_result_run_id,import_validation_result_rule_code,
  import_validation_result_status,import_validation_result_message,import_validation_result_payload)
SELECT current_setting('sdbi.run_id')::uuid,'SDBI_CONSOLIDATION_COMPLETE_V1','PASSED','SDBI Feedback pilot — '||tgt,
  jsonb_build_object('mapping_card','FEEDBACK-MAP-01','target_table',tgt)
FROM (VALUES ('sys_feedback_360'),('sys_continuous_feedback'),('sys_feedback_requests'),('sys_feedback_responses')) v(tgt);
COMMIT;
SELECT 'sys_feedback_360' t,count(*) FROM sys.sys_feedback_360 UNION ALL SELECT 'sys_continuous_feedback',count(*) FROM sys.sys_continuous_feedback
UNION ALL SELECT 'sys_feedback_requests',count(*) FROM sys.sys_feedback_requests UNION ALL SELECT 'sys_feedback_responses',count(*) FROM sys.sys_feedback_responses ORDER BY 1;
