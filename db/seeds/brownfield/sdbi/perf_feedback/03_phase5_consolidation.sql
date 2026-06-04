-- db/seeds/brownfield/sdbi/perf_feedback/03_phase5_consolidation.sql  (SDBI Phase 5)
-- D6 — SDBI Option-B slice: PerformanceReviews + Feedback360.
-- Reference: db/seeds/brownfield/sdbi/goals_pilot/03_phase5_consolidation.sql + _template/.
--
-- Consolidate temp_sdbi.pf_* (raw, RTL-scoped) -> sys.* (4 base tables) + lineage + audit.
--   * tenant_id  via brownfield.tenant_id_mappings (legacy tenant -> canonical RTL tenant)
--   * user_id    via the I14 LEGACY_EMP:: crosswalk: sys_users.user_external_code =
--                  'LEGACY_EMP::' || <legacy employees_core.id>. Unresolved -> NULL + the raw
--                  legacy id preserved in *_metadata (NEVER dropped).
--   * child rating_review_id resolved from the parent PR via the legacy PR id crosswalk.
--   * cf.feedback_related_goal_id resolved against sys_goals (goal_metadata->>'legacy_id').
--   * 0-filled optional FKs (review_cycle_id/template_id/questionnaire_id/request_id/
--     performance_review_id back-links/competency_id) -> *_metadata, never own columns.
--   * legacy content_embedding/vector layer NOT staged, NOT imported (design §4.1/§4.3).
-- Lineage populates the 4 first-class SDBI columns added by migration 000063 (ADR-0014 §3.4).
-- Audit uses the SDBI rule_code SDBI_CONSOLIDATION_COMPLETE_V1 (migration 000063).
-- Idempotent: ON CONFLICT (tenant, natural_key) DO NOTHING/UPDATE; re-run inserts 0 net new.
-- Run via: psql … -v ON_ERROR_STOP=1 -f this_file.

BEGIN;

-- ============================================================================
-- Step 0 — anchor an SDBI import_run (lineage/audit FK parent)
-- ============================================================================
DO $run$
DECLARE v_run_id uuid := gen_random_uuid();
BEGIN
  IF NOT EXISTS (
      SELECT 1 FROM brownfield.import_runs
      WHERE import_run_metadata->>'workflow' = 'SDBI_PHASE_5'
        AND import_run_metadata->>'pilot' = 'perf_feedback') THEN
    INSERT INTO brownfield.import_runs (
      import_run_id, import_run_export_id, import_run_wave, import_run_status,
      import_run_started_at, import_run_metadata
    ) VALUES (
      v_run_id,
      (SELECT source_export_id FROM brownfield.source_exports ORDER BY created_at DESC LIMIT 1),
      NULL, 'RUNNING', now(),
      jsonb_build_object(
        'workflow', 'SDBI_PHASE_5',
        'pilot', 'perf_feedback',
        'scope', '4 source tables -> sys.* (perf reviews + feedback360) RTL reference subset',
        'mapping_card_id', 'sdbi_perf_feedback_v1')
    );
  END IF;
  PERFORM set_config('sdbi.run_id',
    (SELECT import_run_id::text FROM brownfield.import_runs
     WHERE import_run_metadata->>'workflow' = 'SDBI_PHASE_5'
       AND import_run_metadata->>'pilot' = 'perf_feedback'
     ORDER BY import_run_started_at DESC LIMIT 1), false);
END $run$;

-- ============================================================================
-- Step 1 — sys.sys_performance_reviews (entity)
-- ============================================================================
INSERT INTO sys.sys_performance_reviews (
  review_id, review_tenant_id, review_natural_key,
  review_subject_user_id, review_reviewer_user_id, review_calibrated_by_user_id, review_finalized_by_user_id,
  review_period_start, review_period_end,
  review_type, review_status, review_potential_rating,
  review_overall_rating, review_goal_achievement_rating, review_competency_rating,
  review_self_rating, review_calibrated_rating, review_pre_calibration_rating,
  review_performance_box, review_potential_box,
  review_strengths, review_areas_for_improvement, review_manager_comments, review_employee_comments,
  review_self_comments, review_development_plan, review_career_aspirations, review_calibration_notes,
  review_section_ratings, review_competency_ratings_snapshot, review_goal_ratings_snapshot, review_recommended_actions,
  review_self_submitted_at, review_manager_submitted_at, review_calibrated_at, review_finalized_at,
  review_self_review_completed_at, review_shared_at, review_submitted_at, review_acknowledged_at,
  review_self_assessment_status, review_metadata, created_at, updated_at
)
SELECT
  gen_random_uuid(),
  tm.canonical_tenant_id,
  'PERF_REVIEW::' || tm.canonical_tenant_id::text || '::' || t._legacy_id::text,
  su_emp.user_id, su_rev.user_id, su_cal.user_id, su_fin.user_id,
  t.review_period_start, t.review_period_end,
  COALESCE(UPPER(t.review_type), 'ANNUAL'),
  COALESCE(UPPER(t.review_status), 'DRAFT'),
  UPPER(t.potential_rating),
  t.overall_rating, t.goal_achievement_rating, t.competency_rating,
  t.self_rating, t.calibrated_rating, t.pre_calibration_rating,
  t.performance_box, t.potential_box,
  t.strengths, t.areas_for_improvement, t.manager_comments, t.employee_comments,
  t.self_comments, t.development_plan, t.career_aspirations, t.calibration_notes,
  COALESCE(t.section_ratings, '{}'::jsonb),
  COALESCE(t.competency_ratings, '{}'::jsonb),
  COALESCE(t.goal_ratings, '{}'::jsonb),
  COALESCE(t.recommended_actions, '[]'::jsonb),
  t.self_submitted_at, t.manager_submitted_at, t.calibrated_at, t.finalized_at,
  t.self_review_completed_at, t.shared_at, t.submitted_at, t.acknowledged_at,
  COALESCE(UPPER(t.self_assessment_status), 'NOT_STARTED'),
  jsonb_strip_nulls(jsonb_build_object(
    'legacy_id', t._legacy_id::text,
    'legacy_table', 'public.performance_reviews',
    'legacy_employee_id', t._legacy_employee_id::text,
    'legacy_reviewer_id', t._legacy_reviewer_id::text,
    'legacy_calibrated_by', t._legacy_calibrated_by::text,
    'legacy_finalized_by', t._legacy_finalized_by::text,
    'legacy_review_cycle_id', t._legacy_review_cycle_id::text,
    'legacy_template_id', t._legacy_template_id::text,
    'unresolved_employee', CASE WHEN t._legacy_employee_id IS NOT NULL AND su_emp.user_id IS NULL THEN t._legacy_employee_id::text END,
    'unresolved_reviewer', CASE WHEN t._legacy_reviewer_id IS NOT NULL AND su_rev.user_id IS NULL THEN t._legacy_reviewer_id::text END
  )),
  COALESCE(t.created_at, now()), COALESCE(t.updated_at, t.created_at, now())
FROM temp_sdbi.pf_performance_reviews t
JOIN brownfield.tenant_id_mappings tm ON tm.legacy_id = t._legacy_tenant_id::text
LEFT JOIN sys.sys_users su_emp ON su_emp.user_external_code = 'LEGACY_EMP::' || t._legacy_employee_id::text
LEFT JOIN sys.sys_users su_rev ON su_rev.user_external_code = 'LEGACY_EMP::' || t._legacy_reviewer_id::text
LEFT JOIN sys.sys_users su_cal ON su_cal.user_external_code = 'LEGACY_EMP::' || t._legacy_calibrated_by::text
LEFT JOIN sys.sys_users su_fin ON su_fin.user_external_code = 'LEGACY_EMP::' || t._legacy_finalized_by::text
ON CONFLICT (review_tenant_id, review_natural_key) DO NOTHING;

-- ============================================================================
-- Step 2 — sys.sys_performance_review_competency_ratings (child; resolve review_id)
-- ============================================================================
INSERT INTO sys.sys_performance_review_competency_ratings (
  rating_id, rating_tenant_id, rating_review_id, rating_subject_user_id, rating_natural_key,
  rating_ksaba_dimension, rating_competency_name, rating_self_rating, rating_manager_rating,
  rating_self_comment, rating_manager_comment, rating_self_evidence, rating_weight,
  rating_metadata, created_at, updated_at
)
SELECT
  gen_random_uuid(),
  tm.canonical_tenant_id,
  pr.review_id,
  su_emp.user_id,
  'PERF_COMP_RATING::' || tm.canonical_tenant_id::text || '::' || c._legacy_id::text,
  UPPER(c.ksaba_dimension),
  c.competency_name,
  c.self_rating, c.manager_rating,
  c.self_comment, c.manager_comment, c.self_evidence,
  COALESCE(c.weight, 1.0),
  jsonb_strip_nulls(jsonb_build_object(
    'legacy_id', c._legacy_id::text,
    'legacy_table', 'public.competency_review_ratings',
    'legacy_performance_review_id', c._legacy_performance_review_id::text,
    'legacy_employee_id', c._legacy_employee_id::text,
    'legacy_competency_id', c._legacy_competency_id::text,
    'unresolved_employee', CASE WHEN c._legacy_employee_id IS NOT NULL AND su_emp.user_id IS NULL THEN c._legacy_employee_id::text END
  )),
  COALESCE(c.created_at, now()), COALESCE(c.updated_at, c.created_at, now())
FROM temp_sdbi.pf_competency_review_ratings c
JOIN brownfield.tenant_id_mappings tm ON tm.legacy_id = c._legacy_tenant_id::text
JOIN sys.sys_performance_reviews pr
  ON pr.review_natural_key = 'PERF_REVIEW::' || tm.canonical_tenant_id::text || '::' || c._legacy_performance_review_id::text
 AND pr.review_tenant_id = tm.canonical_tenant_id
LEFT JOIN sys.sys_users su_emp ON su_emp.user_external_code = 'LEGACY_EMP::' || c._legacy_employee_id::text
ON CONFLICT (rating_tenant_id, rating_natural_key) DO NOTHING;

-- ============================================================================
-- Step 3 — sys.sys_feedback_360_responses (event)
-- ============================================================================
INSERT INTO sys.sys_feedback_360_responses (
  response_id, response_tenant_id, response_natural_key,
  response_target_user_id, response_reviewer_user_id, response_review_id,
  response_relationship_type, response_overall_rating, response_strengths, response_areas_for_improvement,
  response_is_anonymous, response_status, response_sentiment_score, response_submission_time_seconds,
  response_completed_at, response_metadata, created_at
)
SELECT
  gen_random_uuid(),
  tm.canonical_tenant_id,
  'FEEDBACK_360::' || tm.canonical_tenant_id::text || '::' || f._legacy_id::text,
  su_tgt.user_id, su_rev.user_id,
  NULL,  -- legacy performance_review_id is 0-filled -> metadata only
  UPPER(f.relationship_type),
  f.overall_rating, f.strengths, f.areas_for_improvement,
  COALESCE(f.is_anonymous, true),
  COALESCE(UPPER(f.status), 'PENDING'),
  f.sentiment_score, f.submission_time_seconds,
  f.completed_at,
  jsonb_strip_nulls(jsonb_build_object(
    'legacy_id', f._legacy_id::text,
    'legacy_table', 'public.feedback_360',
    'legacy_target_employee_id', f._legacy_target_employee_id::text,
    'legacy_reviewer_employee_id', f._legacy_reviewer_employee_id::text,
    'legacy_review_cycle_id', f._legacy_review_cycle_id::text,
    'legacy_performance_review_id', f._legacy_performance_review_id::text,
    'legacy_questionnaire_id', f._legacy_questionnaire_id::text,
    'legacy_request_id', f._legacy_request_id::text,
    'unresolved_target', CASE WHEN f._legacy_target_employee_id IS NOT NULL AND su_tgt.user_id IS NULL THEN f._legacy_target_employee_id::text END,
    'unresolved_reviewer', CASE WHEN f._legacy_reviewer_employee_id IS NOT NULL AND su_rev.user_id IS NULL THEN f._legacy_reviewer_employee_id::text END
  )),
  COALESCE(f.created_at, now())
FROM temp_sdbi.pf_feedback_360 f
JOIN brownfield.tenant_id_mappings tm ON tm.legacy_id = f._legacy_tenant_id::text
LEFT JOIN sys.sys_users su_tgt ON su_tgt.user_external_code = 'LEGACY_EMP::' || f._legacy_target_employee_id::text
LEFT JOIN sys.sys_users su_rev ON su_rev.user_external_code = 'LEGACY_EMP::' || f._legacy_reviewer_employee_id::text
ON CONFLICT (response_tenant_id, response_natural_key) DO NOTHING;

-- ============================================================================
-- Step 4 — sys.sys_continuous_feedback (event)
-- ============================================================================
INSERT INTO sys.sys_continuous_feedback (
  feedback_id, feedback_tenant_id, feedback_natural_key,
  feedback_from_user_id, feedback_to_user_id, feedback_related_goal_id,
  feedback_type, feedback_message, feedback_category, feedback_visibility, feedback_is_private,
  feedback_tags, feedback_sentiment_score, feedback_acknowledged, feedback_acknowledged_at,
  feedback_metadata, created_at
)
SELECT
  gen_random_uuid(),
  tm.canonical_tenant_id,
  'CONTINUOUS_FEEDBACK::' || tm.canonical_tenant_id::text || '::' || c._legacy_id::text,
  su_from.user_id, su_to.user_id, g.goal_id,
  COALESCE(UPPER(c.feedback_type), 'PRAISE'),
  c.message,
  c.category,
  COALESCE(UPPER(c.visibility), 'PRIVATE'),
  COALESCE(c.is_private, false),
  c.tags, c.sentiment_score,
  COALESCE(c.acknowledged, false), c.acknowledged_at,
  jsonb_strip_nulls(jsonb_build_object(
    'legacy_id', c._legacy_id::text,
    'legacy_table', 'public.continuous_feedback',
    'legacy_from_employee_id', c._legacy_from_employee_id::text,
    'legacy_to_employee_id', c._legacy_to_employee_id::text,
    'legacy_related_goal_id', c._legacy_related_goal_id::text,
    'legacy_competency_id', c._legacy_competency_id::text,
    'legacy_performance_review_id', c._legacy_performance_review_id::text,
    'unresolved_from', CASE WHEN c._legacy_from_employee_id IS NOT NULL AND su_from.user_id IS NULL THEN c._legacy_from_employee_id::text END,
    'unresolved_to', CASE WHEN c._legacy_to_employee_id IS NOT NULL AND su_to.user_id IS NULL THEN c._legacy_to_employee_id::text END,
    'unresolved_related_goal', CASE WHEN c._legacy_related_goal_id IS NOT NULL AND g.goal_id IS NULL THEN c._legacy_related_goal_id::text END
  )),
  COALESCE(c.created_at, now())
FROM temp_sdbi.pf_continuous_feedback c
JOIN brownfield.tenant_id_mappings tm ON tm.legacy_id = c._legacy_tenant_id::text
LEFT JOIN sys.sys_users su_from ON su_from.user_external_code = 'LEGACY_EMP::' || c._legacy_from_employee_id::text
LEFT JOIN sys.sys_users su_to   ON su_to.user_external_code   = 'LEGACY_EMP::' || c._legacy_to_employee_id::text
LEFT JOIN sys.sys_goals g ON g.goal_tenant_id = tm.canonical_tenant_id
                          AND g.goal_metadata->>'legacy_id' = c._legacy_related_goal_id::text
ON CONFLICT (feedback_tenant_id, feedback_natural_key) DO NOTHING;

-- ============================================================================
-- Step 5 — lineage (one bulk INSERT per target; SDBI first-class columns populated)
-- ============================================================================
-- 5a. performance_reviews
INSERT INTO sys.sys_source_lineage_records (
  source_lineage_tenant_id, source_lineage_source_system, source_lineage_source_table,
  source_lineage_source_record_id, source_lineage_source_natural_key,
  source_lineage_import_run_id, source_lineage_target_table_name, source_lineage_target_record_id,
  source_lineage_mapping_confidence, source_lineage_validation_status, source_lineage_metadata,
  source_lineage_sdbi_mapping_card_id, source_lineage_sdbi_confidence,
  source_lineage_sdbi_ai_model_id, source_lineage_sdbi_human_approver)
SELECT
  pr.review_tenant_id, 'heuresys_platform', 'performance_reviews',
  (pr.review_metadata->>'legacy_id'),
  'OLDDB::performance_reviews::' || (pr.review_metadata->>'legacy_id'),
  current_setting('sdbi.run_id')::uuid, 'sys_performance_reviews', pr.review_id,
  0.90, 'VALID',
  jsonb_build_object('sdbi_mapping_card_id', 'performance_reviews__sys_performance_reviews'),
  'performance_reviews__sys_performance_reviews', 0.90, 'claude-opus-4-8', 'enzo.spenuso@outlook.com'
FROM sys.sys_performance_reviews pr
WHERE pr.review_metadata->>'legacy_id' IS NOT NULL
ON CONFLICT (source_lineage_source_system, source_lineage_source_table,
             source_lineage_source_record_id, source_lineage_target_table_name) DO NOTHING;

-- 5b. competency_review_ratings
INSERT INTO sys.sys_source_lineage_records (
  source_lineage_tenant_id, source_lineage_source_system, source_lineage_source_table,
  source_lineage_source_record_id, source_lineage_source_natural_key,
  source_lineage_import_run_id, source_lineage_target_table_name, source_lineage_target_record_id,
  source_lineage_mapping_confidence, source_lineage_validation_status, source_lineage_metadata,
  source_lineage_sdbi_mapping_card_id, source_lineage_sdbi_confidence,
  source_lineage_sdbi_ai_model_id, source_lineage_sdbi_human_approver)
SELECT
  r.rating_tenant_id, 'heuresys_platform', 'competency_review_ratings',
  (r.rating_metadata->>'legacy_id'),
  'OLDDB::competency_review_ratings::' || (r.rating_metadata->>'legacy_id'),
  current_setting('sdbi.run_id')::uuid, 'sys_performance_review_competency_ratings', r.rating_id,
  0.93, 'VALID',
  jsonb_build_object('sdbi_mapping_card_id', 'competency_review_ratings__sys_performance_review_competency_ratings'),
  'competency_review_ratings__sys_performance_review_competency_ratings', 0.93, 'claude-opus-4-8', 'enzo.spenuso@outlook.com'
FROM sys.sys_performance_review_competency_ratings r
WHERE r.rating_metadata->>'legacy_id' IS NOT NULL
ON CONFLICT (source_lineage_source_system, source_lineage_source_table,
             source_lineage_source_record_id, source_lineage_target_table_name) DO NOTHING;

-- 5c. feedback_360
INSERT INTO sys.sys_source_lineage_records (
  source_lineage_tenant_id, source_lineage_source_system, source_lineage_source_table,
  source_lineage_source_record_id, source_lineage_source_natural_key,
  source_lineage_import_run_id, source_lineage_target_table_name, source_lineage_target_record_id,
  source_lineage_mapping_confidence, source_lineage_validation_status, source_lineage_metadata,
  source_lineage_sdbi_mapping_card_id, source_lineage_sdbi_confidence,
  source_lineage_sdbi_ai_model_id, source_lineage_sdbi_human_approver)
SELECT
  f.response_tenant_id, 'heuresys_platform', 'feedback_360',
  (f.response_metadata->>'legacy_id'),
  'OLDDB::feedback_360::' || (f.response_metadata->>'legacy_id'),
  current_setting('sdbi.run_id')::uuid, 'sys_feedback_360_responses', f.response_id,
  0.92, 'VALID',
  jsonb_build_object('sdbi_mapping_card_id', 'feedback_360__sys_feedback_360_responses'),
  'feedback_360__sys_feedback_360_responses', 0.92, 'claude-opus-4-8', 'enzo.spenuso@outlook.com'
FROM sys.sys_feedback_360_responses f
WHERE f.response_metadata->>'legacy_id' IS NOT NULL
ON CONFLICT (source_lineage_source_system, source_lineage_source_table,
             source_lineage_source_record_id, source_lineage_target_table_name) DO NOTHING;

-- 5d. continuous_feedback
INSERT INTO sys.sys_source_lineage_records (
  source_lineage_tenant_id, source_lineage_source_system, source_lineage_source_table,
  source_lineage_source_record_id, source_lineage_source_natural_key,
  source_lineage_import_run_id, source_lineage_target_table_name, source_lineage_target_record_id,
  source_lineage_mapping_confidence, source_lineage_validation_status, source_lineage_metadata,
  source_lineage_sdbi_mapping_card_id, source_lineage_sdbi_confidence,
  source_lineage_sdbi_ai_model_id, source_lineage_sdbi_human_approver)
SELECT
  cf.feedback_tenant_id, 'heuresys_platform', 'continuous_feedback',
  (cf.feedback_metadata->>'legacy_id'),
  'OLDDB::continuous_feedback::' || (cf.feedback_metadata->>'legacy_id'),
  current_setting('sdbi.run_id')::uuid, 'sys_continuous_feedback', cf.feedback_id,
  0.93, 'VALID',
  jsonb_build_object('sdbi_mapping_card_id', 'continuous_feedback__sys_continuous_feedback'),
  'continuous_feedback__sys_continuous_feedback', 0.93, 'claude-opus-4-8', 'enzo.spenuso@outlook.com'
FROM sys.sys_continuous_feedback cf
WHERE cf.feedback_metadata->>'legacy_id' IS NOT NULL
ON CONFLICT (source_lineage_source_system, source_lineage_source_table,
             source_lineage_source_record_id, source_lineage_target_table_name) DO NOTHING;

-- ============================================================================
-- Step 6 — audit markers (SDBI_CONSOLIDATION_COMPLETE_V1, one per target table)
-- ============================================================================
INSERT INTO audit.import_validation_results (
  import_validation_result_run_id, import_validation_result_source_table_id,
  import_validation_result_rule_code, import_validation_result_status,
  import_validation_result_message, import_validation_result_payload)
SELECT
  current_setting('sdbi.run_id')::uuid, NULL,
  'SDBI_CONSOLIDATION_COMPLETE_V1', 'PASSED',
  'SDBI Phase 5 consolidation complete for ' || x.target_table || '.',
  jsonb_build_object(
    'sdbi_mapping_card_id', x.card, 'sdbi_ai_model_id', 'claude-opus-4-8',
    'target_table', x.target_table, 'source_table', x.source_table, 'rows', x.rows)
FROM (
  VALUES
    ('sys_performance_reviews','performance_reviews','performance_reviews__sys_performance_reviews',
       (SELECT count(*) FROM sys.sys_performance_reviews)),
    ('sys_performance_review_competency_ratings','competency_review_ratings','competency_review_ratings__sys_performance_review_competency_ratings',
       (SELECT count(*) FROM sys.sys_performance_review_competency_ratings)),
    ('sys_feedback_360_responses','feedback_360','feedback_360__sys_feedback_360_responses',
       (SELECT count(*) FROM sys.sys_feedback_360_responses)),
    ('sys_continuous_feedback','continuous_feedback','continuous_feedback__sys_continuous_feedback',
       (SELECT count(*) FROM sys.sys_continuous_feedback))
) AS x(target_table, source_table, card, rows);

-- mark the import_run finished
UPDATE brownfield.import_runs
SET import_run_status = 'COMPLETED', import_run_finished_at = now()
WHERE import_run_id = current_setting('sdbi.run_id')::uuid;

COMMIT;

-- ============================================================================
-- Verify counts
-- ============================================================================
SELECT 'sys_performance_reviews' AS t, count(*) FROM sys.sys_performance_reviews
UNION ALL SELECT 'sys_performance_review_competency_ratings', count(*) FROM sys.sys_performance_review_competency_ratings
UNION ALL SELECT 'sys_feedback_360_responses', count(*) FROM sys.sys_feedback_360_responses
UNION ALL SELECT 'sys_continuous_feedback', count(*) FROM sys.sys_continuous_feedback
UNION ALL SELECT 'sys_nine_box_grid (VIEW)', count(*) FROM sys.sys_nine_box_grid
UNION ALL SELECT 'lineage (perf_feedback)', count(*) FROM sys.sys_source_lineage_records
  WHERE source_lineage_target_table_name IN ('sys_performance_reviews','sys_performance_review_competency_ratings','sys_feedback_360_responses','sys_continuous_feedback');
