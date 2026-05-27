-- SDBI Feedback pilot — Phase 3 seed. Run via psql -v ON_ERROR_STOP=1.
BEGIN;
DO $$ DECLARE v uuid := gen_random_uuid(); BEGIN
  INSERT INTO brownfield.import_runs (import_run_id, import_run_export_id, import_run_status, import_run_started_at, import_run_metadata)
  VALUES (v,(SELECT source_export_id FROM brownfield.source_exports ORDER BY 1 LIMIT 1),'RUNNING',now(),
    jsonb_build_object('workflow','SDBI_PHASE_3','pilot','feedback','mapping_card','FEEDBACK-MAP-01','source','heuresys_platform_0507'));
  PERFORM set_config('sdbi.run_id', v::text, true);
END $$;

INSERT INTO temp_sdbi.feedback_360 (_legacy_source_id,_legacy_review_cycle_id,_legacy_performance_review_id,_import_run_id,
  feedback_tenant_id,feedback_natural_key,feedback_relationship_type,feedback_overall_rating,feedback_strengths,
  feedback_areas_for_improvement,feedback_is_anonymous,feedback_status,feedback_legacy_questionnaire_id,
  feedback_legacy_request_id,feedback_question_responses,feedback_sentiment_score,feedback_submission_time_seconds,
  feedback_completed_at,feedback_metadata,created_at,updated_at)
SELECT src.id,src.review_cycle_id,src.performance_review_id,current_setting('sdbi.run_id')::uuid,tm.canonical_tenant_id,
  'FEEDBACK_360::'||tm.canonical_tenant_id::text||'::'||src.id::text,UPPER(src.relationship_type),src.overall_rating,
  src.strengths,src.areas_for_improvement,src.is_anonymous,UPPER(src.status),src.questionnaire_id,src.request_id,
  src.question_responses,src.sentiment_score,src.submission_time_seconds,src.completed_at AT TIME ZONE 'UTC',
  jsonb_build_object('legacy_id',src.id::text,'legacy_table','public.feedback_360','legacy_target_employee_id',src.target_employee_id::text,
    'legacy_reviewer_employee_id',src.reviewer_employee_id::text),
  src.created_at AT TIME ZONE 'UTC', src.created_at AT TIME ZONE 'UTC'
FROM legacy_mirror.feedback_360 src JOIN brownfield.tenant_id_mappings tm ON tm.legacy_id=src.tenant_id::text
ON CONFLICT (_legacy_source_id) DO NOTHING;

INSERT INTO temp_sdbi.continuous_feedback (_legacy_source_id,_legacy_goal_id,_legacy_performance_review_id,_import_run_id,
  cf_tenant_id,cf_natural_key,cf_feedback_type,cf_message,cf_is_private,cf_legacy_competency_id,cf_sentiment_score,
  cf_acknowledged,cf_acknowledged_at,cf_visibility,cf_tags,cf_category,cf_metadata,created_at,updated_at)
SELECT src.id,src.related_goal_id,src.performance_review_id,current_setting('sdbi.run_id')::uuid,tm.canonical_tenant_id,
  'CONT_FEEDBACK::'||tm.canonical_tenant_id::text||'::'||src.id::text,UPPER(src.feedback_type),src.message,src.is_private,
  src.competency_id,src.sentiment_score,src.acknowledged,src.acknowledged_at,UPPER(src.visibility),to_jsonb(src.tags),
  src.category,jsonb_build_object('legacy_id',src.id::text,'legacy_from_employee_id',src.from_employee_id::text,
    'legacy_to_employee_id',src.to_employee_id::text),
  src.created_at AT TIME ZONE 'UTC', src.created_at AT TIME ZONE 'UTC'
FROM legacy_mirror.continuous_feedback src JOIN brownfield.tenant_id_mappings tm ON tm.legacy_id=src.tenant_id::text
ON CONFLICT (_legacy_source_id) DO NOTHING;

INSERT INTO temp_sdbi.feedback_requests (_legacy_source_id,_legacy_review_cycle_id,_legacy_performance_review_id,_import_run_id,
  request_tenant_id,request_natural_key,request_feedback_type,request_status,request_due_date,request_completed_at,
  request_is_anonymous,request_legacy_questionnaire_id,request_relationship_type,request_reminder_sent_at,
  request_legacy_feedback_360_id,request_metadata,created_at,updated_at)
SELECT src.id,src.review_cycle_id,src.performance_review_id,current_setting('sdbi.run_id')::uuid,tm.canonical_tenant_id,
  'FEEDBACK_REQUEST::'||tm.canonical_tenant_id::text||'::'||src.id::text,UPPER(src.feedback_type),UPPER(src.status),
  src.due_date,src.completed_at,src.is_anonymous,src.questionnaire_id,UPPER(src.relationship_type),src.reminder_sent_at,
  src.feedback_360_id,jsonb_build_object('legacy_id',src.id::text,'legacy_requestee_id',src.requestee_id::text,
    'legacy_reviewer_id',src.reviewer_id::text),
  src.created_at, src.created_at
FROM legacy_mirror.feedback_requests src JOIN brownfield.tenant_id_mappings tm ON tm.legacy_id=src.tenant_id::text
ON CONFLICT (_legacy_source_id) DO NOTHING;

-- responses: no tenant_id → inherit from parent request
INSERT INTO temp_sdbi.feedback_responses (_legacy_source_id,_legacy_request_id,_import_run_id,response_tenant_id,
  response_natural_key,response_overall_rating,response_strengths,response_areas_for_improvement,
  response_additional_comments,response_competency_ratings,response_metadata,created_at,updated_at)
SELECT src.id,src.request_id,current_setting('sdbi.run_id')::uuid,tm.canonical_tenant_id,
  'FEEDBACK_RESPONSE::'||tm.canonical_tenant_id::text||'::'||src.id::text,src.overall_rating,src.strengths,
  src.areas_for_improvement,src.additional_comments,src.competency_ratings,
  jsonb_build_object('legacy_id',src.id::text,'legacy_request_id',src.request_id::text),
  src.created_at, src.created_at
FROM legacy_mirror.feedback_responses src
JOIN legacy_mirror.feedback_requests r ON r.id=src.request_id
JOIN brownfield.tenant_id_mappings tm ON tm.legacy_id=r.tenant_id::text
ON CONFLICT (_legacy_source_id) DO NOTHING;

UPDATE brownfield.import_runs SET import_run_status='COMPLETED', import_run_finished_at=now() WHERE import_run_id=current_setting('sdbi.run_id')::uuid;
COMMIT;
SELECT 'feedback_360' t,count(*) FROM temp_sdbi.feedback_360 UNION ALL SELECT 'continuous_feedback',count(*) FROM temp_sdbi.continuous_feedback
UNION ALL SELECT 'feedback_requests',count(*) FROM temp_sdbi.feedback_requests UNION ALL SELECT 'feedback_responses',count(*) FROM temp_sdbi.feedback_responses ORDER BY 1;
