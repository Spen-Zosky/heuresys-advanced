-- db/seeds/brownfield/sdbi/performance_reviews/02_phase3_temp_sdbi_seed.sql
-- SDBI PerformanceReviews pilot — Phase 3: seed temp_sdbi.* from legacy_mirror.* (8 tables).
-- Source data restored from heuresys_platform 0507 dump → legacy_mirror (S940).
-- Transforms: tenant via brownfield.tenant_id_mappings; categoricals UPPERCASE;
--   timestamp-without-tz → timestamptz AT UTC; user FKs NULL (legacy id in metadata,
--   goals-pilot precedent — legacy_mirror has no employees_core); natural_key generated.
-- Idempotent: ON CONFLICT (_legacy_source_id) DO NOTHING. Run via psql -v ON_ERROR_STOP=1.

BEGIN;

DO $$
DECLARE v_run_id uuid := gen_random_uuid();
BEGIN
  INSERT INTO brownfield.import_runs (
    import_run_id, import_run_export_id, import_run_wave, import_run_status,
    import_run_started_at, import_run_metadata
  ) VALUES (
    v_run_id,
    (SELECT source_export_id FROM brownfield.source_exports ORDER BY 1 LIMIT 1),
    NULL, 'RUNNING', now(),
    jsonb_build_object('workflow','SDBI_PHASE_3','pilot','performance_reviews',
      'mapping_card','PERFREV-MAP-01','source','heuresys_platform_0507',
      'scope','8 tables → 8 sys.* targets','authored_by','cli_s940')
  );
  PERFORM set_config('sdbi.run_id', v_run_id::text, true);
END $$;

-- 1. performance_review_templates (4)
INSERT INTO temp_sdbi.performance_review_templates (
  _legacy_source_id, _import_run_id, template_tenant_id, template_natural_key, template_name,
  template_description, template_type, template_rating_scale_type, template_rating_scale_config,
  template_sections, template_competencies, template_include_goals, template_include_development_plan,
  template_is_default, template_is_active, template_deleted_at, template_metadata, created_at, updated_at)
SELECT src.id, current_setting('sdbi.run_id')::uuid, tm.canonical_tenant_id,
  'PERF_TEMPLATE::'||tm.canonical_tenant_id::text||'::'||src.id::text,
  TRIM(src.name), src.description, UPPER(src.template_type), UPPER(src.rating_scale_type),
  src.rating_scale_config, COALESCE(src.sections,'[]'::jsonb), src.competencies,
  src.include_goals, src.include_development_plan, COALESCE(src.is_default,false),
  COALESCE(src.is_active,true), src.deleted_at,
  jsonb_build_object('legacy_id',src.id::text,'legacy_table','public.performance_review_templates'),
  src.created_at, src.updated_at
FROM legacy_mirror.performance_review_templates src
JOIN brownfield.tenant_id_mappings tm ON tm.legacy_id = src.tenant_id::text
ON CONFLICT (_legacy_source_id) DO NOTHING;

-- 2. review_cycles (35)
INSERT INTO temp_sdbi.review_cycles (
  _legacy_source_id, _legacy_source_template_id, _import_run_id, cycle_tenant_id, cycle_natural_key,
  cycle_name, cycle_description, cycle_type, cycle_status, cycle_start_date, cycle_end_date,
  cycle_self_review_deadline, cycle_manager_review_deadline, cycle_calibration_deadline,
  cycle_feedback_deadline, cycle_acknowledgment_deadline, cycle_finalization_deadline,
  cycle_feedback_360_deadline, cycle_include_self_review, cycle_include_peer_review,
  cycle_include_upward_review, cycle_include_360_feedback, cycle_require_goal_assessment,
  cycle_require_competency_rating, cycle_feedback_360_anonymous, cycle_feedback_360_min_responses,
  cycle_competency_framework_id, cycle_rating_scale_id, cycle_rating_scale_type, cycle_rating_scale_config,
  cycle_eligible_employees_filter, cycle_launched_at, cycle_completed_at, cycle_metadata, created_at, updated_at)
SELECT src.id, COALESCE(src.review_template_id, src.template_id), current_setting('sdbi.run_id')::uuid,
  tm.canonical_tenant_id, 'REVIEW_CYCLE::'||tm.canonical_tenant_id::text||'::'||src.id::text,
  TRIM(src.name), src.description, UPPER(src.cycle_type), UPPER(src.status), src.start_date, src.end_date,
  src.self_review_deadline, src.manager_review_deadline, src.calibration_deadline, src.feedback_deadline,
  src.acknowledgment_deadline, src.finalization_deadline, src.feedback_360_deadline,
  src.include_self_review, src.include_peer_review, src.include_upward_review, src.include_360_feedback,
  src.require_goal_assessment, src.require_competency_rating, src.feedback_360_anonymous,
  src.feedback_360_min_responses, src.competency_framework_id, src.rating_scale_id,
  UPPER(src.rating_scale_type), src.rating_scale_config, src.eligible_employees_filter,
  src.launched_at, src.completed_at,
  jsonb_build_object('legacy_id',src.id::text,'legacy_table','public.review_cycles',
    'legacy_review_template_id',src.review_template_id::text,'legacy_template_id',src.template_id::text),
  src.created_at, src.updated_at
FROM legacy_mirror.review_cycles src
JOIN brownfield.tenant_id_mappings tm ON tm.legacy_id = src.tenant_id::text
ON CONFLICT (_legacy_source_id) DO NOTHING;

-- 3. review_cycle_phases (20)
INSERT INTO temp_sdbi.review_cycle_phases (
  _legacy_source_id, _legacy_source_cycle_id, _import_run_id, phase_tenant_id, phase_natural_key,
  phase_name, phase_order, phase_start_date, phase_end_date, phase_status, phase_instructions,
  phase_reminder_days_before, phase_escalation_days_after, phase_is_required, phase_metadata, created_at, updated_at)
SELECT src.id, src.review_cycle_id, current_setting('sdbi.run_id')::uuid, tm.canonical_tenant_id,
  'REVIEW_PHASE::'||tm.canonical_tenant_id::text||'::'||src.id::text,
  src.phase_name, src.phase_order, src.start_date, src.end_date, UPPER(src.status), src.instructions,
  src.reminder_days_before, src.escalation_days_after, COALESCE(src.is_required,true),
  jsonb_build_object('legacy_id',src.id::text,'legacy_cycle_id',src.review_cycle_id::text),
  src.created_at, src.updated_at
FROM legacy_mirror.review_cycle_phases src
JOIN brownfield.tenant_id_mappings tm ON tm.legacy_id = src.tenant_id::text
ON CONFLICT (_legacy_source_id) DO NOTHING;

-- 4. review_cycle_participants (250) — user FKs NULL, legacy ids in metadata
INSERT INTO temp_sdbi.review_cycle_participants (
  _legacy_source_id, _legacy_source_cycle_id, _import_run_id, participant_tenant_id, participant_natural_key,
  participant_status, participant_self_review_completed, participant_self_review_completed_at,
  participant_manager_review_completed, participant_manager_review_completed_at, participant_calibrated,
  participant_calibrated_at, participant_acknowledged, participant_acknowledged_at,
  participant_excluded_reason, participant_metadata, created_at, updated_at)
SELECT src.id, src.review_cycle_id, current_setting('sdbi.run_id')::uuid, tm.canonical_tenant_id,
  'REVIEW_PARTICIPANT::'||tm.canonical_tenant_id::text||'::'||src.id::text,
  UPPER(src.status), src.self_review_completed, src.self_review_completed_at,
  src.manager_review_completed, src.manager_review_completed_at, src.calibrated, src.calibrated_at,
  src.acknowledged, src.acknowledged_at, src.excluded_reason,
  jsonb_build_object('legacy_id',src.id::text,'legacy_cycle_id',src.review_cycle_id::text,
    'legacy_employee_id',src.employee_id::text,'legacy_manager_id',src.manager_id::text),
  src.created_at, src.updated_at
FROM legacy_mirror.review_cycle_participants src
JOIN brownfield.tenant_id_mappings tm ON tm.legacy_id = src.tenant_id::text
ON CONFLICT (_legacy_source_id) DO NOTHING;

-- 5. performance_reviews (292) — 4 audit cols are timestamp-without-tz → AT UTC
INSERT INTO temp_sdbi.performance_reviews (
  _legacy_source_id, _legacy_source_cycle_id, _legacy_source_template_id, _import_run_id,
  review_tenant_id, review_natural_key, review_period_start, review_period_end, review_type, review_status,
  review_overall_rating, review_goal_achievement_rating, review_competency_rating, review_potential_rating,
  review_performance_box, review_potential_box, review_pre_calibration_rating, review_calibrated_rating,
  review_self_rating, review_strengths, review_areas_for_improvement, review_manager_comments,
  review_employee_comments, review_self_comments, review_development_plan, review_career_aspirations,
  review_calibration_notes, review_competency_ratings, review_goal_ratings, review_section_ratings,
  review_recommended_actions, review_goals_auto_populated, review_goals_count, review_competencies_count,
  review_self_assessment_status, review_self_assessment_started_at, review_self_submitted_at,
  review_manager_submitted_at, review_submitted_at, review_acknowledged_at, review_self_review_completed_at,
  review_calibrated_at, review_shared_at, review_finalized_at, review_metadata, created_at, updated_at)
SELECT src.id, src.review_cycle_id, src.template_id, current_setting('sdbi.run_id')::uuid,
  tm.canonical_tenant_id, 'PERF_REVIEW::'||tm.canonical_tenant_id::text||'::'||src.id::text,
  src.review_period_start, src.review_period_end, UPPER(src.review_type), UPPER(src.status),
  src.overall_rating, src.goal_achievement_rating, src.competency_rating, UPPER(src.potential_rating),
  src.performance_box, src.potential_box, src.pre_calibration_rating, src.calibrated_rating, src.self_rating,
  src.strengths, src.areas_for_improvement, src.manager_comments, src.employee_comments, src.self_comments,
  src.development_plan, src.career_aspirations, src.calibration_notes, src.competency_ratings,
  src.goal_ratings, src.section_ratings, src.recommended_actions, src.goals_auto_populated,
  src.goals_count, src.competencies_count, UPPER(src.self_assessment_status),
  src.self_assessment_started_at, src.self_submitted_at, src.manager_submitted_at,
  src.submitted_at AT TIME ZONE 'UTC', src.acknowledged_at AT TIME ZONE 'UTC',
  src.self_review_completed_at, src.calibrated_at, src.shared_at, src.finalized_at,
  jsonb_build_object('legacy_id',src.id::text,'legacy_table','public.performance_reviews',
    'legacy_employee_id',src.employee_id::text,'legacy_reviewer_id',src.reviewer_id::text,
    'legacy_cycle_id',src.review_cycle_id::text,'legacy_template_id',src.template_id::text,
    'legacy_calibrated_by',src.calibrated_by::text,'legacy_finalized_by',src.finalized_by::text),
  src.created_at AT TIME ZONE 'UTC', src.updated_at AT TIME ZONE 'UTC'
FROM legacy_mirror.performance_reviews src
JOIN brownfield.tenant_id_mappings tm ON tm.legacy_id = src.tenant_id::text
ON CONFLICT (_legacy_source_id) DO NOTHING;

-- 6. self_reviews (30)
INSERT INTO temp_sdbi.self_reviews (
  _legacy_source_id, _legacy_source_review_id, _import_run_id, self_review_tenant_id, self_review_natural_key,
  self_review_overall_rating, self_review_goal_rating, self_review_competency_rating, self_review_achievements,
  self_review_challenges, self_review_learnings, self_review_goals_for_next_period, self_review_feedback_for_manager,
  self_review_competency_self_ratings, self_review_goal_self_assessments, self_review_goal_ratings,
  self_review_ksaba_ratings, self_review_status, self_review_evidence_count, self_review_submitted_at,
  self_review_last_saved_at, self_review_metadata, created_at, updated_at)
SELECT src.id, src.performance_review_id, current_setting('sdbi.run_id')::uuid, tm.canonical_tenant_id,
  'SELF_REVIEW::'||tm.canonical_tenant_id::text||'::'||src.id::text,
  src.self_overall_rating, src.self_goal_rating, src.self_competency_rating, src.achievements,
  src.challenges, src.learnings, src.goals_for_next_period, src.feedback_for_manager,
  src.competency_self_ratings, src.goal_self_assessments, src.goal_ratings, src.ksaba_ratings,
  UPPER(src.status), src.evidence_count, src.submitted_at, src.last_saved_at,
  jsonb_build_object('legacy_id',src.id::text,'legacy_review_id',src.performance_review_id::text,
    'legacy_employee_id',src.employee_id::text),
  src.created_at, src.updated_at
FROM legacy_mirror.self_reviews src
JOIN brownfield.tenant_id_mappings tm ON tm.legacy_id = src.tenant_id::text
ON CONFLICT (_legacy_source_id) DO NOTHING;

-- 7. goal_review_ratings (155)
INSERT INTO temp_sdbi.goal_review_ratings (
  _legacy_source_id, _legacy_source_review_id, _legacy_source_goal_id, _import_run_id,
  goal_rating_tenant_id, goal_rating_natural_key, goal_rating_self_rating, goal_rating_self_comment,
  goal_rating_achievement_description, goal_rating_manager_rating, goal_rating_manager_comment,
  goal_rating_weight, goal_rating_metadata, created_at, updated_at)
SELECT src.id, src.performance_review_id, src.goal_id, current_setting('sdbi.run_id')::uuid,
  tm.canonical_tenant_id, 'GOAL_REVIEW_RATING::'||tm.canonical_tenant_id::text||'::'||src.id::text,
  src.self_rating, src.self_comment, src.achievement_description, src.manager_rating, src.manager_comment,
  src.weight,
  jsonb_build_object('legacy_id',src.id::text,'legacy_review_id',src.performance_review_id::text,
    'legacy_goal_id',src.goal_id::text,'legacy_employee_id',src.employee_id::text),
  src.created_at, src.updated_at
FROM legacy_mirror.goal_review_ratings src
JOIN brownfield.tenant_id_mappings tm ON tm.legacy_id = src.tenant_id::text
ON CONFLICT (_legacy_source_id) DO NOTHING;

-- 8. competency_review_ratings (465) — self_evidence text[] → jsonb
INSERT INTO temp_sdbi.competency_review_ratings (
  _legacy_source_id, _legacy_source_review_id, _import_run_id, competency_rating_tenant_id,
  competency_rating_natural_key, competency_rating_legacy_competency_id, competency_rating_ksaba_dimension,
  competency_rating_competency_name, competency_rating_self_rating, competency_rating_self_comment,
  competency_rating_self_evidence, competency_rating_manager_rating, competency_rating_manager_comment,
  competency_rating_weight, competency_rating_metadata, created_at, updated_at)
SELECT src.id, src.performance_review_id, current_setting('sdbi.run_id')::uuid, tm.canonical_tenant_id,
  'COMPETENCY_REVIEW_RATING::'||tm.canonical_tenant_id::text||'::'||src.id::text,
  src.competency_id, UPPER(src.ksaba_dimension), src.competency_name, src.self_rating, src.self_comment,
  to_jsonb(src.self_evidence), src.manager_rating, src.manager_comment, src.weight,
  jsonb_build_object('legacy_id',src.id::text,'legacy_review_id',src.performance_review_id::text,
    'legacy_competency_id',src.competency_id::text,'legacy_employee_id',src.employee_id::text),
  src.created_at, src.updated_at
FROM legacy_mirror.competency_review_ratings src
JOIN brownfield.tenant_id_mappings tm ON tm.legacy_id = src.tenant_id::text
ON CONFLICT (_legacy_source_id) DO NOTHING;

UPDATE brownfield.import_runs SET import_run_status='COMPLETED', import_run_finished_at=now()
 WHERE import_run_id = current_setting('sdbi.run_id')::uuid;

COMMIT;

SELECT 'temp_sdbi.performance_review_templates' t, count(*) FROM temp_sdbi.performance_review_templates
UNION ALL SELECT 'temp_sdbi.review_cycles', count(*) FROM temp_sdbi.review_cycles
UNION ALL SELECT 'temp_sdbi.review_cycle_phases', count(*) FROM temp_sdbi.review_cycle_phases
UNION ALL SELECT 'temp_sdbi.review_cycle_participants', count(*) FROM temp_sdbi.review_cycle_participants
UNION ALL SELECT 'temp_sdbi.performance_reviews', count(*) FROM temp_sdbi.performance_reviews
UNION ALL SELECT 'temp_sdbi.self_reviews', count(*) FROM temp_sdbi.self_reviews
UNION ALL SELECT 'temp_sdbi.goal_review_ratings', count(*) FROM temp_sdbi.goal_review_ratings
UNION ALL SELECT 'temp_sdbi.competency_review_ratings', count(*) FROM temp_sdbi.competency_review_ratings
ORDER BY 1;
