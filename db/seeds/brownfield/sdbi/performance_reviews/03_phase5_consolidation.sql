-- db/seeds/brownfield/sdbi/performance_reviews/03_phase5_consolidation.sql
-- SDBI PerformanceReviews pilot — Phase 5: consolidate temp_sdbi.* → sys.* (+ lineage + audit).
-- Intra-cluster FKs resolved via sys.* natural_key (deterministic → re-run idempotent,
--   independent of temp_sdbi regenerated ids). goal FK via sys_goals legacy_id metadata.
-- User FKs left NULL (legacy ids preserved in *_metadata; goals-pilot precedent).
-- Lineage uses SDBI provenance columns (migration 000045); audit emits
--   SDBI_CONSOLIDATION_COMPLETE_V1 (unblocked by nullable source_table_id, migration 000039).
-- Run via psql -v ON_ERROR_STOP=1.

BEGIN;

SELECT set_config('sdbi.run_id',
  (SELECT import_run_id::text FROM brownfield.import_runs
    WHERE import_run_metadata->>'pilot'='performance_reviews'
    ORDER BY import_run_started_at DESC LIMIT 1), false);

-- 1. templates
INSERT INTO sys.sys_performance_review_templates (
  template_id, template_tenant_id, template_natural_key, template_name, template_description,
  template_type, template_rating_scale_type, template_rating_scale_config, template_sections,
  template_competencies, template_include_goals, template_include_development_plan, template_is_default,
  template_is_active, template_deleted_at, template_metadata, created_at, updated_at)
SELECT template_id, template_tenant_id, template_natural_key, template_name, template_description,
  template_type, template_rating_scale_type, template_rating_scale_config,
  COALESCE(template_sections,'[]'::jsonb), template_competencies, template_include_goals,
  template_include_development_plan, COALESCE(template_is_default,false), COALESCE(template_is_active,true),
  template_deleted_at, template_metadata, created_at, updated_at
FROM temp_sdbi.performance_review_templates
ON CONFLICT (template_tenant_id, template_natural_key) DO NOTHING;

-- 2. cycles (resolve cycle_review_template_id via templates natural_key)
INSERT INTO sys.sys_review_cycles (
  cycle_id, cycle_tenant_id, cycle_natural_key, cycle_name, cycle_description, cycle_type, cycle_status,
  cycle_start_date, cycle_end_date, cycle_self_review_deadline, cycle_manager_review_deadline,
  cycle_calibration_deadline, cycle_feedback_deadline, cycle_acknowledgment_deadline,
  cycle_finalization_deadline, cycle_feedback_360_deadline, cycle_include_self_review,
  cycle_include_peer_review, cycle_include_upward_review, cycle_include_360_feedback,
  cycle_require_goal_assessment, cycle_require_competency_rating, cycle_feedback_360_anonymous,
  cycle_feedback_360_min_responses, cycle_review_template_id, cycle_competency_framework_id,
  cycle_rating_scale_id, cycle_rating_scale_type, cycle_rating_scale_config, cycle_eligible_employees_filter,
  cycle_launched_at, cycle_completed_at, cycle_metadata, created_at, updated_at)
SELECT c.cycle_id, c.cycle_tenant_id, c.cycle_natural_key, c.cycle_name, c.cycle_description, c.cycle_type,
  c.cycle_status, c.cycle_start_date, c.cycle_end_date, c.cycle_self_review_deadline,
  c.cycle_manager_review_deadline, c.cycle_calibration_deadline, c.cycle_feedback_deadline,
  c.cycle_acknowledgment_deadline, c.cycle_finalization_deadline, c.cycle_feedback_360_deadline,
  c.cycle_include_self_review, c.cycle_include_peer_review, c.cycle_include_upward_review,
  c.cycle_include_360_feedback, c.cycle_require_goal_assessment, c.cycle_require_competency_rating,
  c.cycle_feedback_360_anonymous, c.cycle_feedback_360_min_responses,
  (SELECT template_id FROM sys.sys_performance_review_templates t
     WHERE t.template_tenant_id=c.cycle_tenant_id
       AND t.template_natural_key='PERF_TEMPLATE::'||c.cycle_tenant_id::text||'::'||c._legacy_source_template_id::text),
  c.cycle_competency_framework_id, c.cycle_rating_scale_id, c.cycle_rating_scale_type,
  c.cycle_rating_scale_config, c.cycle_eligible_employees_filter, c.cycle_launched_at, c.cycle_completed_at,
  c.cycle_metadata, c.created_at, c.updated_at
FROM temp_sdbi.review_cycles c
ON CONFLICT (cycle_tenant_id, cycle_natural_key) DO NOTHING;

-- 3. phases (resolve phase_cycle_id via cycles natural_key)
INSERT INTO sys.sys_review_cycle_phases (
  phase_id, phase_tenant_id, phase_cycle_id, phase_natural_key, phase_name, phase_order, phase_start_date,
  phase_end_date, phase_status, phase_instructions, phase_reminder_days_before, phase_escalation_days_after,
  phase_is_required, phase_metadata, created_at, updated_at)
SELECT p.phase_id, p.phase_tenant_id,
  (SELECT cycle_id FROM sys.sys_review_cycles rc WHERE rc.cycle_tenant_id=p.phase_tenant_id
     AND rc.cycle_natural_key='REVIEW_CYCLE::'||p.phase_tenant_id::text||'::'||p._legacy_source_cycle_id::text),
  p.phase_natural_key, p.phase_name, p.phase_order, p.phase_start_date, p.phase_end_date, p.phase_status,
  p.phase_instructions, p.phase_reminder_days_before, p.phase_escalation_days_after,
  COALESCE(p.phase_is_required,true), p.phase_metadata, p.created_at, p.updated_at
FROM temp_sdbi.review_cycle_phases p
ON CONFLICT (phase_tenant_id, phase_natural_key) DO NOTHING;

-- 4. participants (resolve participant_cycle_id via cycles natural_key)
INSERT INTO sys.sys_review_cycle_participants (
  participant_id, participant_tenant_id, participant_cycle_id, participant_natural_key,
  participant_employee_user_id, participant_manager_user_id, participant_status,
  participant_self_review_completed, participant_self_review_completed_at,
  participant_manager_review_completed, participant_manager_review_completed_at, participant_calibrated,
  participant_calibrated_at, participant_acknowledged, participant_acknowledged_at,
  participant_excluded_reason, participant_metadata, created_at, updated_at)
SELECT pa.participant_id, pa.participant_tenant_id,
  (SELECT cycle_id FROM sys.sys_review_cycles rc WHERE rc.cycle_tenant_id=pa.participant_tenant_id
     AND rc.cycle_natural_key='REVIEW_CYCLE::'||pa.participant_tenant_id::text||'::'||pa._legacy_source_cycle_id::text),
  pa.participant_natural_key, NULL::uuid, NULL::uuid, pa.participant_status,
  pa.participant_self_review_completed, pa.participant_self_review_completed_at,
  pa.participant_manager_review_completed, pa.participant_manager_review_completed_at, pa.participant_calibrated,
  pa.participant_calibrated_at, pa.participant_acknowledged, pa.participant_acknowledged_at,
  pa.participant_excluded_reason, pa.participant_metadata, pa.created_at, pa.updated_at
FROM temp_sdbi.review_cycle_participants pa
ON CONFLICT (participant_tenant_id, participant_natural_key) DO NOTHING;

-- 5. performance_reviews (resolve review_cycle_id + review_template_id via natural_key)
INSERT INTO sys.sys_performance_reviews (
  review_id, review_tenant_id, review_natural_key, review_cycle_id, review_template_id,
  review_employee_user_id, review_reviewer_user_id, review_period_start, review_period_end, review_type,
  review_status, review_overall_rating, review_goal_achievement_rating, review_competency_rating,
  review_potential_rating, review_performance_box, review_potential_box, review_pre_calibration_rating,
  review_calibrated_rating, review_calibrated_by_user_id, review_self_rating, review_strengths,
  review_areas_for_improvement, review_manager_comments, review_employee_comments, review_self_comments,
  review_development_plan, review_career_aspirations, review_calibration_notes, review_competency_ratings,
  review_goal_ratings, review_section_ratings, review_recommended_actions, review_goals_auto_populated,
  review_goals_count, review_competencies_count, review_self_assessment_status,
  review_self_assessment_started_at, review_self_submitted_at, review_manager_submitted_at,
  review_submitted_at, review_acknowledged_at, review_self_review_completed_at, review_calibrated_at,
  review_shared_at, review_finalized_at, review_finalized_by_user_id, review_metadata, created_at, updated_at)
SELECT r.review_id, r.review_tenant_id, r.review_natural_key,
  (SELECT cycle_id FROM sys.sys_review_cycles rc WHERE rc.cycle_tenant_id=r.review_tenant_id
     AND rc.cycle_natural_key='REVIEW_CYCLE::'||r.review_tenant_id::text||'::'||r._legacy_source_cycle_id::text),
  (SELECT template_id FROM sys.sys_performance_review_templates t WHERE t.template_tenant_id=r.review_tenant_id
     AND t.template_natural_key='PERF_TEMPLATE::'||r.review_tenant_id::text||'::'||r._legacy_source_template_id::text),
  NULL::uuid, NULL::uuid, r.review_period_start, r.review_period_end, r.review_type, r.review_status,
  r.review_overall_rating, r.review_goal_achievement_rating, r.review_competency_rating, r.review_potential_rating,
  r.review_performance_box, r.review_potential_box, r.review_pre_calibration_rating, r.review_calibrated_rating,
  NULL::uuid, r.review_self_rating, r.review_strengths, r.review_areas_for_improvement, r.review_manager_comments,
  r.review_employee_comments, r.review_self_comments, r.review_development_plan, r.review_career_aspirations,
  r.review_calibration_notes, r.review_competency_ratings, r.review_goal_ratings, r.review_section_ratings,
  r.review_recommended_actions, r.review_goals_auto_populated, r.review_goals_count, r.review_competencies_count,
  r.review_self_assessment_status, r.review_self_assessment_started_at, r.review_self_submitted_at,
  r.review_manager_submitted_at, r.review_submitted_at, r.review_acknowledged_at, r.review_self_review_completed_at,
  r.review_calibrated_at, r.review_shared_at, r.review_finalized_at, NULL::uuid, r.review_metadata,
  r.created_at, r.updated_at
FROM temp_sdbi.performance_reviews r
ON CONFLICT (review_tenant_id, review_natural_key) DO NOTHING;

-- 6. self_reviews (resolve performance_review_id via reviews natural_key)
INSERT INTO sys.sys_self_reviews (
  self_review_id, self_review_tenant_id, self_review_natural_key, self_review_performance_review_id,
  self_review_employee_user_id, self_review_overall_rating, self_review_goal_rating, self_review_competency_rating,
  self_review_achievements, self_review_challenges, self_review_learnings, self_review_goals_for_next_period,
  self_review_feedback_for_manager, self_review_competency_self_ratings, self_review_goal_self_assessments,
  self_review_goal_ratings, self_review_ksaba_ratings, self_review_status, self_review_evidence_count,
  self_review_submitted_at, self_review_last_saved_at, self_review_metadata, created_at, updated_at)
SELECT s.self_review_id, s.self_review_tenant_id, s.self_review_natural_key,
  (SELECT review_id FROM sys.sys_performance_reviews pr WHERE pr.review_tenant_id=s.self_review_tenant_id
     AND pr.review_natural_key='PERF_REVIEW::'||s.self_review_tenant_id::text||'::'||s._legacy_source_review_id::text),
  NULL::uuid, s.self_review_overall_rating, s.self_review_goal_rating, s.self_review_competency_rating,
  s.self_review_achievements, s.self_review_challenges, s.self_review_learnings, s.self_review_goals_for_next_period,
  s.self_review_feedback_for_manager, s.self_review_competency_self_ratings, s.self_review_goal_self_assessments,
  s.self_review_goal_ratings, s.self_review_ksaba_ratings, s.self_review_status, s.self_review_evidence_count,
  s.self_review_submitted_at, s.self_review_last_saved_at, s.self_review_metadata, s.created_at, s.updated_at
FROM temp_sdbi.self_reviews s
WHERE EXISTS (SELECT 1 FROM sys.sys_performance_reviews pr WHERE pr.review_tenant_id=s.self_review_tenant_id
     AND pr.review_natural_key='PERF_REVIEW::'||s.self_review_tenant_id::text||'::'||s._legacy_source_review_id::text)
ON CONFLICT (self_review_tenant_id, self_review_natural_key) DO NOTHING;

-- 7. goal_review_ratings (resolve review via natural_key + goal via sys_goals legacy_id)
INSERT INTO sys.sys_goal_review_ratings (
  goal_rating_id, goal_rating_tenant_id, goal_rating_natural_key, goal_rating_performance_review_id,
  goal_rating_goal_id, goal_rating_employee_user_id, goal_rating_self_rating, goal_rating_self_comment,
  goal_rating_achievement_description, goal_rating_manager_rating, goal_rating_manager_comment,
  goal_rating_weight, goal_rating_metadata, created_at, updated_at)
SELECT g.goal_rating_id, g.goal_rating_tenant_id, g.goal_rating_natural_key,
  (SELECT review_id FROM sys.sys_performance_reviews pr WHERE pr.review_tenant_id=g.goal_rating_tenant_id
     AND pr.review_natural_key='PERF_REVIEW::'||g.goal_rating_tenant_id::text||'::'||g._legacy_source_review_id::text),
  (SELECT goal_id FROM sys.sys_goals sg WHERE sg.goal_metadata->>'legacy_id'=g._legacy_source_goal_id::text),
  NULL::uuid, g.goal_rating_self_rating, g.goal_rating_self_comment, g.goal_rating_achievement_description,
  g.goal_rating_manager_rating, g.goal_rating_manager_comment, g.goal_rating_weight, g.goal_rating_metadata,
  g.created_at, g.updated_at
FROM temp_sdbi.goal_review_ratings g
WHERE EXISTS (SELECT 1 FROM sys.sys_performance_reviews pr WHERE pr.review_tenant_id=g.goal_rating_tenant_id
     AND pr.review_natural_key='PERF_REVIEW::'||g.goal_rating_tenant_id::text||'::'||g._legacy_source_review_id::text)
ON CONFLICT (goal_rating_tenant_id, goal_rating_natural_key) DO NOTHING;

-- 8. competency_review_ratings (resolve review via natural_key)
INSERT INTO sys.sys_competency_review_ratings (
  competency_rating_id, competency_rating_tenant_id, competency_rating_natural_key,
  competency_rating_performance_review_id, competency_rating_employee_user_id,
  competency_rating_legacy_competency_id, competency_rating_ksaba_dimension, competency_rating_competency_name,
  competency_rating_self_rating, competency_rating_self_comment, competency_rating_self_evidence,
  competency_rating_manager_rating, competency_rating_manager_comment, competency_rating_weight,
  competency_rating_metadata, created_at, updated_at)
SELECT c.competency_rating_id, c.competency_rating_tenant_id, c.competency_rating_natural_key,
  (SELECT review_id FROM sys.sys_performance_reviews pr WHERE pr.review_tenant_id=c.competency_rating_tenant_id
     AND pr.review_natural_key='PERF_REVIEW::'||c.competency_rating_tenant_id::text||'::'||c._legacy_source_review_id::text),
  NULL::uuid, c.competency_rating_legacy_competency_id, c.competency_rating_ksaba_dimension,
  c.competency_rating_competency_name, c.competency_rating_self_rating, c.competency_rating_self_comment,
  c.competency_rating_self_evidence, c.competency_rating_manager_rating, c.competency_rating_manager_comment,
  c.competency_rating_weight, c.competency_rating_metadata, c.created_at, c.updated_at
FROM temp_sdbi.competency_review_ratings c
WHERE EXISTS (SELECT 1 FROM sys.sys_performance_reviews pr WHERE pr.review_tenant_id=c.competency_rating_tenant_id
     AND pr.review_natural_key='PERF_REVIEW::'||c.competency_rating_tenant_id::text||'::'||c._legacy_source_review_id::text)
ON CONFLICT (competency_rating_tenant_id, competency_rating_natural_key) DO NOTHING;

-- ===== Lineage (SDBI provenance columns, migration 000045) =====
INSERT INTO sys.sys_source_lineage_records (
  source_lineage_tenant_id, source_lineage_source_system, source_lineage_source_table,
  source_lineage_source_record_id, source_lineage_source_natural_key, source_lineage_import_run_id,
  source_lineage_target_table_name, source_lineage_target_record_id, source_lineage_mapping_confidence,
  source_lineage_validation_status, source_lineage_metadata,
  source_lineage_sdbi_mapping_card_id, source_lineage_sdbi_confidence, source_lineage_sdbi_ai_model_id,
  source_lineage_sdbi_human_approver)
SELECT x.tenant, 'heuresys_platform', x.src_tbl, x.src_id::text,
  'OLDDB::'||x.src_tbl||'::'||x.src_id::text, current_setting('sdbi.run_id')::uuid,
  x.tgt_tbl, x.tgt_id, 0.85, 'VALID',
  jsonb_build_object('sdbi_pilot','performance_reviews'),
  'PERFREV-MAP-01', 0.85, 'cli-claude-opus-4.7', 'enzo.spenuso@outlook.com'
FROM (
  SELECT template_tenant_id tenant,'performance_review_templates' src_tbl,_legacy_source_id src_id,'sys_performance_review_templates' tgt_tbl,template_id tgt_id FROM temp_sdbi.performance_review_templates
  UNION ALL SELECT cycle_tenant_id,'review_cycles',_legacy_source_id,'sys_review_cycles',cycle_id FROM temp_sdbi.review_cycles
  UNION ALL SELECT phase_tenant_id,'review_cycle_phases',_legacy_source_id,'sys_review_cycle_phases',phase_id FROM temp_sdbi.review_cycle_phases
  UNION ALL SELECT participant_tenant_id,'review_cycle_participants',_legacy_source_id,'sys_review_cycle_participants',participant_id FROM temp_sdbi.review_cycle_participants
  UNION ALL SELECT review_tenant_id,'performance_reviews',_legacy_source_id,'sys_performance_reviews',review_id FROM temp_sdbi.performance_reviews
  UNION ALL SELECT self_review_tenant_id,'self_reviews',_legacy_source_id,'sys_self_reviews',self_review_id FROM temp_sdbi.self_reviews
  UNION ALL SELECT goal_rating_tenant_id,'goal_review_ratings',_legacy_source_id,'sys_goal_review_ratings',goal_rating_id FROM temp_sdbi.goal_review_ratings
  UNION ALL SELECT competency_rating_tenant_id,'competency_review_ratings',_legacy_source_id,'sys_competency_review_ratings',competency_rating_id FROM temp_sdbi.competency_review_ratings
) x
ON CONFLICT (source_lineage_source_system, source_lineage_source_table, source_lineage_source_record_id, source_lineage_target_table_name) DO NOTHING;

-- ===== Audit: SDBI_CONSOLIDATION_COMPLETE_V1 per target (8 rows) =====
INSERT INTO audit.import_validation_results (
  import_validation_result_run_id, import_validation_result_source_table_id,
  import_validation_result_rule_code, import_validation_result_status, import_validation_result_message,
  import_validation_result_payload)
SELECT current_setting('sdbi.run_id')::uuid, NULL, 'SDBI_CONSOLIDATION_COMPLETE_V1', 'PASSED',
  'SDBI PerformanceReviews pilot consolidation — '||tgt,
  jsonb_build_object('mapping_card','PERFREV-MAP-01','target_table',tgt)
FROM (VALUES ('sys_performance_review_templates'),('sys_review_cycles'),('sys_review_cycle_phases'),
  ('sys_review_cycle_participants'),('sys_performance_reviews'),('sys_self_reviews'),
  ('sys_goal_review_ratings'),('sys_competency_review_ratings')) v(tgt);

COMMIT;

-- Verify
SELECT 'sys_performance_review_templates' t, count(*) FROM sys.sys_performance_review_templates
UNION ALL SELECT 'sys_review_cycles', count(*) FROM sys.sys_review_cycles
UNION ALL SELECT 'sys_review_cycle_phases', count(*) FROM sys.sys_review_cycle_phases
UNION ALL SELECT 'sys_review_cycle_participants', count(*) FROM sys.sys_review_cycle_participants
UNION ALL SELECT 'sys_performance_reviews', count(*) FROM sys.sys_performance_reviews
UNION ALL SELECT 'sys_self_reviews', count(*) FROM sys.sys_self_reviews
UNION ALL SELECT 'sys_goal_review_ratings', count(*) FROM sys.sys_goal_review_ratings
UNION ALL SELECT 'sys_competency_review_ratings', count(*) FROM sys.sys_competency_review_ratings
ORDER BY 1;
