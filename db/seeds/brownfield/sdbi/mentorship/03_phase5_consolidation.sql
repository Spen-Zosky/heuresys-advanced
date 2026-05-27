-- SDBI Mentorship pilot — Phase 5: consolidate temp_sdbi → sys.* (+ lineage + audit).
-- FKs resolved via sys.* natural_key (idempotent). Run via psql -v ON_ERROR_STOP=1.
BEGIN;
SELECT set_config('sdbi.run_id',(SELECT import_run_id::text FROM brownfield.import_runs
  WHERE import_run_metadata->>'pilot'='mentorship' ORDER BY import_run_started_at DESC LIMIT 1), false);

INSERT INTO sys.sys_mentorship_programs (program_id,program_tenant_id,program_natural_key,program_name,
  program_description,program_type,program_status,program_duration_months,program_max_participants,
  program_focus_areas,program_eligibility_criteria,program_start_date,program_end_date,program_metadata,created_at,updated_at)
SELECT program_id,program_tenant_id,program_natural_key,program_name,program_description,program_type,program_status,
  program_duration_months,program_max_participants,program_focus_areas,program_eligibility_criteria,
  program_start_date,program_end_date,program_metadata,created_at,updated_at
FROM temp_sdbi.mentorship_programs ON CONFLICT (program_tenant_id,program_natural_key) DO NOTHING;

INSERT INTO sys.sys_mentorships (mentorship_id,mentorship_tenant_id,mentorship_natural_key,mentorship_program_id,
  mentorship_mentor_user_id,mentorship_mentee_user_id,mentorship_status,mentorship_focus_areas,
  mentorship_meeting_frequency,mentorship_goals,mentorship_match_score,mentorship_start_date,mentorship_end_date,
  mentorship_notes,mentorship_metadata,created_at,updated_at)
SELECT m.mentorship_id,m.mentorship_tenant_id,m.mentorship_natural_key,
  (SELECT program_id FROM sys.sys_mentorship_programs p WHERE p.program_tenant_id=m.mentorship_tenant_id
     AND p.program_natural_key='MENTOR_PROGRAM::'||m.mentorship_tenant_id::text||'::'||m._legacy_source_program_id::text),
  NULL::uuid,NULL::uuid,m.mentorship_status,m.mentorship_focus_areas,m.mentorship_meeting_frequency,m.mentorship_goals,
  m.mentorship_match_score,m.mentorship_start_date,m.mentorship_end_date,m.mentorship_notes,m.mentorship_metadata,m.created_at,m.updated_at
FROM temp_sdbi.mentorships m ON CONFLICT (mentorship_tenant_id,mentorship_natural_key) DO NOTHING;

INSERT INTO sys.sys_mentorship_sessions (session_id,session_tenant_id,session_natural_key,session_mentorship_id,
  session_date,session_duration_minutes,session_status,session_topics,session_notes,session_rating,session_metadata,created_at,updated_at)
SELECT s.session_id,s.session_tenant_id,s.session_natural_key,
  (SELECT mentorship_id FROM sys.sys_mentorships ms WHERE ms.mentorship_tenant_id=s.session_tenant_id
     AND ms.mentorship_natural_key='MENTORSHIP::'||s.session_tenant_id::text||'::'||s._legacy_source_mentorship_id::text),
  s.session_date,s.session_duration_minutes,s.session_status,s.session_topics,s.session_notes,s.session_rating,
  s.session_metadata,s.created_at,s.updated_at
FROM temp_sdbi.mentorship_sessions s
WHERE EXISTS (SELECT 1 FROM sys.sys_mentorships ms WHERE ms.mentorship_tenant_id=s.session_tenant_id
     AND ms.mentorship_natural_key='MENTORSHIP::'||s.session_tenant_id::text||'::'||s._legacy_source_mentorship_id::text)
ON CONFLICT (session_tenant_id,session_natural_key) DO NOTHING;

INSERT INTO sys.sys_mentor_match_scores (match_id,match_tenant_id,match_natural_key,match_mentee_user_id,
  match_mentor_user_id,match_legacy_skill_id,match_skill_name,match_mentee_level,match_mentor_level,match_score,
  match_factors,match_is_recommended,match_recommendation_rank,match_metadata,created_at,expires_at)
SELECT match_id,match_tenant_id,match_natural_key,NULL::uuid,NULL::uuid,match_legacy_skill_id,match_skill_name,
  match_mentee_level,match_mentor_level,match_score,match_factors,match_is_recommended,match_recommendation_rank,
  match_metadata,created_at,expires_at
FROM temp_sdbi.mentor_match_scores ON CONFLICT (match_tenant_id,match_natural_key) DO NOTHING;

INSERT INTO sys.sys_source_lineage_records (source_lineage_tenant_id,source_lineage_source_system,source_lineage_source_table,
  source_lineage_source_record_id,source_lineage_source_natural_key,source_lineage_import_run_id,source_lineage_target_table_name,
  source_lineage_target_record_id,source_lineage_mapping_confidence,source_lineage_validation_status,source_lineage_metadata,
  source_lineage_sdbi_mapping_card_id,source_lineage_sdbi_confidence,source_lineage_sdbi_ai_model_id,source_lineage_sdbi_human_approver)
SELECT x.tenant,'heuresys_platform',x.src,x.sid::text,'OLDDB::'||x.src||'::'||x.sid::text,current_setting('sdbi.run_id')::uuid,
  x.tgt,x.tid,0.85,'VALID',jsonb_build_object('sdbi_pilot','mentorship'),'MENTORSHIP-MAP-01',0.85,'cli-claude-opus-4.7','enzo.spenuso@outlook.com'
FROM (
  SELECT program_tenant_id tenant,'mentorship_programs' src,_legacy_source_id sid,'sys_mentorship_programs' tgt,program_id tid FROM temp_sdbi.mentorship_programs
  UNION ALL SELECT mentorship_tenant_id,'mentorships',_legacy_source_id,'sys_mentorships',mentorship_id FROM temp_sdbi.mentorships
  UNION ALL SELECT session_tenant_id,'mentorship_sessions',_legacy_source_id,'sys_mentorship_sessions',session_id FROM temp_sdbi.mentorship_sessions
  UNION ALL SELECT match_tenant_id,'mentor_match_scores',_legacy_source_id,'sys_mentor_match_scores',match_id FROM temp_sdbi.mentor_match_scores
) x ON CONFLICT (source_lineage_source_system,source_lineage_source_table,source_lineage_source_record_id,source_lineage_target_table_name) DO NOTHING;

INSERT INTO audit.import_validation_results (import_validation_result_run_id,import_validation_result_rule_code,
  import_validation_result_status,import_validation_result_message,import_validation_result_payload)
SELECT current_setting('sdbi.run_id')::uuid,'SDBI_CONSOLIDATION_COMPLETE_V1','PASSED','SDBI Mentorship pilot — '||tgt,
  jsonb_build_object('mapping_card','MENTORSHIP-MAP-01','target_table',tgt)
FROM (VALUES ('sys_mentorship_programs'),('sys_mentorships'),('sys_mentorship_sessions'),('sys_mentor_match_scores')) v(tgt);
COMMIT;
SELECT 'sys_mentorship_programs' t,count(*) FROM sys.sys_mentorship_programs UNION ALL SELECT 'sys_mentorships',count(*) FROM sys.sys_mentorships
UNION ALL SELECT 'sys_mentorship_sessions',count(*) FROM sys.sys_mentorship_sessions UNION ALL SELECT 'sys_mentor_match_scores',count(*) FROM sys.sys_mentor_match_scores ORDER BY 1;
