-- db/seeds/brownfield/sdbi/goals_pilot/02_phase3_temp_sdbi_seed.sql
-- SDBI Pilot Phase 3 — Seed temp_sdbi.* from legacy_mirror.* (10 tables)
-- Strategy: user_id resolutions NULL (legacy_mirror.employees_core absent — pragmatic pilot)
--           tenant_id via brownfield.tenant_id_mappings (4 → 1 canonical)
--           Self-FK and template_id NULL pass 1 (resolved Phase 5 late-bind)
-- Run via psql -v ON_ERROR_STOP=1

BEGIN;

-- Create SDBI import_run row (referenceable for lineage)
DO $$
DECLARE
  v_run_id uuid := gen_random_uuid();
BEGIN
  INSERT INTO brownfield.import_runs (
    import_run_id, import_run_export_id, import_run_wave, import_run_status,
    import_run_started_at, import_run_metadata
  ) VALUES (
    v_run_id,
    (SELECT source_export_id FROM brownfield.source_exports WHERE source_export_name = 'db-export-2026-05-15'),
    NULL,
    'RUNNING',
    now(),
    jsonb_build_object(
      'workflow', 'SDBI_PHASE_3',
      'pilot', 'goals_okrs',
      'scope', '10 tables → 10 sys.* + temp_sdbi staging',
      'authored_by', 'cli_batch_x2_block_c'
    )
  );
  PERFORM set_config('sdbi.run_id', v_run_id::text, true);
END $$;

-- =====================================================================
-- 1. temp_sdbi.goal_templates (40 rows) — no FK deps
-- =====================================================================
INSERT INTO temp_sdbi.goal_templates (
  _legacy_source_id, _import_run_id, template_tenant_id, template_role_id, template_org_unit_id,
  template_natural_key, template_name, template_description, template_category, template_goal_type,
  template_suggested_metrics, template_suggested_duration_days, template_suggested_weight,
  template_difficulty_level, template_is_company_wide, template_usage_count, template_is_active,
  template_deleted_at, template_metadata, template_created_by, template_updated_by,
  created_at, updated_at
)
SELECT
  src.id, current_setting('sdbi.run_id')::uuid, tm.canonical_tenant_id,
  NULL::uuid, NULL::uuid,
  'GOAL_TEMPLATE::' || tm.canonical_tenant_id::text || '::' || lower(TRIM(src.name)) || '::' || src.id::text,
  TRIM(src.name), src.description, src.category, UPPER(src.goal_type),
  src.suggested_metrics, src.suggested_duration_days, src.suggested_weight,
  UPPER(src.difficulty_level), src.is_company_wide, COALESCE(src.usage_count, 0),
  COALESCE(src.is_active, true), src.deleted_at,
  jsonb_build_object('legacy_id', src.id::text, 'legacy_table', 'public.goal_templates'),
  NULL::uuid, NULL::uuid, src.created_at, src.updated_at
FROM legacy_mirror.goal_templates src
JOIN brownfield.tenant_id_mappings tm ON tm.legacy_id = src.tenant_id::text
ON CONFLICT (_legacy_source_id) DO NOTHING;

-- =====================================================================
-- 2. temp_sdbi.goals (1067 rows)
-- =====================================================================
INSERT INTO temp_sdbi.goals (
  _legacy_source_id, _import_run_id, goal_tenant_id, goal_natural_key,
  goal_subject_user_id, goal_owner_user_id, goal_parent_goal_id, goal_template_id,
  goal_title, goal_description, goal_type, goal_category, goal_priority, goal_status,
  goal_progress_percent, goal_weight, goal_start_date, goal_due_date, goal_completed_at,
  goal_tags, goal_custom_fields, goal_metadata,
  goal_created_by, goal_updated_by, created_at, updated_at
)
SELECT
  src.id, current_setting('sdbi.run_id')::uuid, tm.canonical_tenant_id,
  'GOAL::' || tm.canonical_tenant_id::text || '::' || src.id::text,
  NULL::uuid, NULL::uuid, NULL::uuid, NULL::uuid,
  TRIM(src.title), src.description, UPPER(src.goal_type), LOWER(src.category),
  UPPER(src.priority), UPPER(src.status),
  COALESCE(src.progress_percent, 0), COALESCE(src.weight, 1.00),
  src.start_date, src.due_date, src.completed_at,
  COALESCE(src.tags, '[]'::jsonb), COALESCE(src.custom_fields, '{}'::jsonb),
  jsonb_build_object('legacy_id', src.id::text, 'legacy_table', 'public.goals',
                     'legacy_employee_id', src.employee_id::text, 'legacy_owner_id', src.owner_id::text,
                     'legacy_parent_goal_id', src.parent_goal_id::text, 'legacy_template_id', src.template_id::text),
  NULL::uuid, NULL::uuid, src.created_at, src.updated_at
FROM legacy_mirror.goals src
JOIN brownfield.tenant_id_mappings tm ON tm.legacy_id = src.tenant_id::text
ON CONFLICT (_legacy_source_id) DO NOTHING;

-- =====================================================================
-- 3. temp_sdbi.goal_milestones (1000 rows)
-- =====================================================================
INSERT INTO temp_sdbi.goal_milestones (
  _legacy_source_id, _legacy_source_goal_id, _import_run_id,
  milestone_tenant_id, milestone_goal_id, milestone_natural_key,
  milestone_title, milestone_description, milestone_target_date, milestone_completed_at,
  milestone_status, milestone_weight, milestone_metadata,
  milestone_created_by, milestone_updated_by, created_at, updated_at
)
SELECT
  src.id, src.goal_id, current_setting('sdbi.run_id')::uuid,
  g.goal_tenant_id, g.goal_id,
  'MILESTONE::' || g.goal_tenant_id::text || '::' || src.id::text,
  TRIM(src.title), src.description, src.target_date, src.completed_at,
  UPPER(src.status), COALESCE(src.weight, 1.00),
  jsonb_build_object('legacy_id', src.id::text, 'legacy_goal_id', src.goal_id::text),
  NULL::uuid, NULL::uuid, src.created_at, src.updated_at
FROM legacy_mirror.goal_milestones src
JOIN temp_sdbi.goals g ON g._legacy_source_id = src.goal_id
ON CONFLICT (_legacy_source_id) DO NOTHING;

-- =====================================================================
-- 4. temp_sdbi.goal_check_ins (1000 rows)
-- =====================================================================
INSERT INTO temp_sdbi.goal_check_ins (
  _legacy_source_id, _legacy_source_goal_id, _legacy_source_employee_id, _import_run_id,
  check_in_tenant_id, check_in_goal_id, check_in_subject_user_id, check_in_natural_key,
  check_in_date, check_in_previous_progress, check_in_new_progress, check_in_status_update,
  check_in_notes, check_in_blockers, check_in_next_steps, check_in_confidence_level,
  check_in_metadata, created_at
)
SELECT
  src.id, src.goal_id, COALESCE(src.employee_id, '00000000-0000-0000-0000-000000000000'::uuid),
  current_setting('sdbi.run_id')::uuid,
  g.goal_tenant_id, g.goal_id, NULL::uuid,
  'GOAL_CHECK_IN::' || g.goal_tenant_id::text || '::' || src.id::text,
  src.check_in_date, src.previous_progress, src.new_progress, UPPER(src.status_update),
  src.notes, src.blockers, src.next_steps, src.confidence_level,
  jsonb_build_object('legacy_id', src.id::text, 'legacy_goal_id', src.goal_id::text,
                     'legacy_employee_id', src.employee_id::text),
  src.created_at
FROM legacy_mirror.goal_check_ins src
JOIN temp_sdbi.goals g ON g._legacy_source_id = src.goal_id
ON CONFLICT (_legacy_source_id) DO NOTHING;

-- =====================================================================
-- 5. temp_sdbi.goal_updates (1811 rows)
-- =====================================================================
INSERT INTO temp_sdbi.goal_updates (
  _legacy_source_id, _legacy_source_goal_id, _legacy_source_author_id, _import_run_id,
  update_tenant_id, update_goal_id, update_author_user_id, update_natural_key,
  update_type, update_previous_progress, update_new_progress, update_previous_status, update_new_status,
  update_content, update_attachments, update_metadata, created_at
)
SELECT
  src.id, src.goal_id, src.author_id, current_setting('sdbi.run_id')::uuid,
  g.goal_tenant_id, g.goal_id, NULL::uuid,
  'GOAL_UPDATE::' || g.goal_tenant_id::text || '::' || src.id::text,
  UPPER(src.update_type), src.previous_progress, src.new_progress,
  UPPER(src.previous_status), UPPER(src.new_status),
  src.content, COALESCE(src.attachments, '[]'::jsonb),
  jsonb_build_object('legacy_id', src.id::text, 'legacy_goal_id', src.goal_id::text,
                     'legacy_author_id', src.author_id::text),
  src.created_at
FROM legacy_mirror.goal_updates src
JOIN temp_sdbi.goals g ON g._legacy_source_id = src.goal_id
ON CONFLICT (_legacy_source_id) DO NOTHING;

-- =====================================================================
-- 6. temp_sdbi.goal_comments (856 rows)
-- =====================================================================
INSERT INTO temp_sdbi.goal_comments (
  _legacy_source_id, _legacy_source_goal_id, _legacy_source_author_id, _legacy_source_parent_comment_id,
  _import_run_id, comment_tenant_id, comment_goal_id, comment_author_user_id, comment_parent_comment_id,
  comment_natural_key, comment_content, comment_is_private, comment_metadata,
  created_at, updated_at
)
SELECT
  src.id, src.goal_id, src.author_id, src.parent_comment_id,
  current_setting('sdbi.run_id')::uuid,
  g.goal_tenant_id, g.goal_id, NULL::uuid, NULL::uuid,
  'GOAL_COMMENT::' || g.goal_tenant_id::text || '::' || src.id::text,
  src.content, COALESCE(src.is_private, false),
  jsonb_build_object('legacy_id', src.id::text, 'legacy_goal_id', src.goal_id::text,
                     'legacy_author_id', src.author_id::text,
                     'legacy_parent_comment_id', src.parent_comment_id::text),
  src.created_at, src.updated_at
FROM legacy_mirror.goal_comments src
JOIN temp_sdbi.goals g ON g._legacy_source_id = src.goal_id
ON CONFLICT (_legacy_source_id) DO NOTHING;

-- =====================================================================
-- 7. temp_sdbi.goal_alignments (100 rows)
-- =====================================================================
INSERT INTO temp_sdbi.goal_alignments (
  _legacy_source_id, _legacy_source_source_goal_id, _legacy_source_aligned_goal_id, _import_run_id,
  alignment_tenant_id, alignment_source_goal_id, alignment_aligned_goal_id, alignment_natural_key,
  alignment_type, alignment_weight, alignment_metadata, created_at
)
SELECT
  src.id, src.goal_id, src.aligned_goal_id, current_setting('sdbi.run_id')::uuid,
  g_src.goal_tenant_id, g_src.goal_id, g_aln.goal_id,
  'GOAL_ALIGNMENT::' || g_src.goal_tenant_id::text || '::' || src.id::text,
  UPPER(src.alignment_type), COALESCE(src.alignment_weight, 1.00),
  jsonb_build_object('legacy_id', src.id::text, 'legacy_source_goal_id', src.goal_id::text,
                     'legacy_aligned_goal_id', src.aligned_goal_id::text),
  src.created_at
FROM legacy_mirror.goal_alignments src
JOIN temp_sdbi.goals g_src ON g_src._legacy_source_id = src.goal_id
JOIN temp_sdbi.goals g_aln ON g_aln._legacy_source_id = src.aligned_goal_id
ON CONFLICT (_legacy_source_id) DO NOTHING;

-- =====================================================================
-- 8. temp_sdbi.okrs (20 rows)
-- =====================================================================
INSERT INTO temp_sdbi.okrs (
  _legacy_source_id, _import_run_id, okr_tenant_id, okr_owner_user_id, okr_created_by_user_id,
  okr_parent_okr_id, okr_natural_key, okr_objective, okr_description, okr_okr_type, okr_department,
  okr_period_type, okr_period_start, okr_period_end, okr_fiscal_year, okr_fiscal_quarter,
  okr_status, okr_overall_progress, okr_confidence_level, okr_tags, okr_metadata,
  created_at, updated_at
)
SELECT
  src.id, current_setting('sdbi.run_id')::uuid, tm.canonical_tenant_id,
  NULL::uuid, NULL::uuid, NULL::uuid,
  'OKR::' || tm.canonical_tenant_id::text || '::' || src.id::text,
  TRIM(src.objective), src.description, UPPER(src.okr_type), src.department,
  UPPER(src.period_type), src.period_start, src.period_end,
  COALESCE(src.fiscal_year, EXTRACT(YEAR FROM src.period_start)::integer),
  src.fiscal_quarter,
  UPPER(src.status), COALESCE(src.overall_progress, 0.00), src.confidence_level,
  COALESCE(src.tags, '[]'::jsonb),
  jsonb_build_object('legacy_id', src.id::text, 'legacy_owner_id', src.owner_id::text,
                     'legacy_parent_okr_id', src.parent_okr_id::text),
  src.created_at, src.updated_at
FROM legacy_mirror.okrs src
JOIN brownfield.tenant_id_mappings tm ON tm.legacy_id = src.tenant_id::text
ON CONFLICT (_legacy_source_id) DO NOTHING;

-- =====================================================================
-- 9. temp_sdbi.okr_key_results (20 rows)
-- =====================================================================
INSERT INTO temp_sdbi.okr_key_results (
  _legacy_source_id, _legacy_source_okr_id, _import_run_id,
  key_result_tenant_id, key_result_okr_id, key_result_owner_user_id, key_result_natural_key,
  key_result_description, key_result_metric_type, key_result_start_value, key_result_target_value,
  key_result_current_value, key_result_unit, key_result_progress_percent, key_result_status,
  key_result_weight, key_result_confidence_level, key_result_last_check_in_at, key_result_metadata,
  created_at, updated_at
)
SELECT
  src.id, src.okr_id, current_setting('sdbi.run_id')::uuid,
  o.okr_tenant_id, o.okr_id, NULL::uuid,
  'OKR_KR::' || o.okr_tenant_id::text || '::' || src.id::text,
  src.description, UPPER(src.metric_type), src.start_value, src.target_value,
  COALESCE(src.current_value, src.start_value), src.unit,
  COALESCE(src.progress_percent, 0.00), UPPER(src.status),
  COALESCE(src.weight, 1.00), COALESCE(src.confidence_level, 3),
  src.last_check_in_at,
  jsonb_build_object('legacy_id', src.id::text, 'legacy_okr_id', src.okr_id::text),
  src.created_at, src.updated_at
FROM legacy_mirror.key_results src
JOIN temp_sdbi.okrs o ON o._legacy_source_id = src.okr_id
ON CONFLICT (_legacy_source_id) DO NOTHING;

-- =====================================================================
-- 10. temp_sdbi.okr_check_ins (merged: okr_check_ins 15 + okr_checkins 10 = 25 rows)
-- =====================================================================
-- A: okr_check_ins (per-KR)
INSERT INTO temp_sdbi.okr_check_ins (
  _legacy_source_id, _legacy_source_table, _legacy_source_okr_id, _legacy_source_key_result_id,
  _legacy_source_user_id, _import_run_id,
  check_in_tenant_id, check_in_okr_id, check_in_key_result_id, check_in_subject_user_id,
  check_in_natural_key, check_in_scope, check_in_date,
  check_in_previous_value, check_in_new_value, check_in_status_update,
  check_in_confidence_level, check_in_notes, check_in_metadata,
  created_at
)
SELECT
  src.id, 'okr_check_ins', src.okr_id, src.key_result_id, src.employee_id,
  current_setting('sdbi.run_id')::uuid,
  o.okr_tenant_id, o.okr_id, kr.key_result_id, NULL::uuid,
  'OKR_CHECK_IN::' || o.okr_tenant_id::text || '::okr_check_ins::' || src.id::text,
  'KEY_RESULT', src.check_in_date,
  src.previous_value, src.new_value, NULL::text,
  src.confidence_level, src.notes,
  jsonb_build_object('legacy_id', src.id::text, 'legacy_table', 'okr_check_ins',
                     'legacy_okr_id', src.okr_id::text, 'legacy_key_result_id', src.key_result_id::text,
                     'legacy_employee_id', src.employee_id::text),
  src.created_at
FROM legacy_mirror.okr_check_ins src
JOIN temp_sdbi.okrs o ON o._legacy_source_id = src.okr_id
LEFT JOIN temp_sdbi.okr_key_results kr ON kr._legacy_source_id = src.key_result_id
ON CONFLICT (_legacy_source_id, _legacy_source_table) DO NOTHING;

-- B: okr_checkins (per-OKR aggregate)
INSERT INTO temp_sdbi.okr_check_ins (
  _legacy_source_id, _legacy_source_table, _legacy_source_okr_id,
  _legacy_source_user_id, _import_run_id,
  check_in_tenant_id, check_in_okr_id, check_in_subject_user_id,
  check_in_natural_key, check_in_scope, check_in_date,
  check_in_overall_progress, check_in_status_update, check_in_next_steps,
  check_in_key_result_updates_snapshot, check_in_confidence_level, check_in_blockers, check_in_metadata,
  created_at
)
SELECT
  src.id, 'okr_checkins', src.okr_id, src.author_id,
  current_setting('sdbi.run_id')::uuid,
  o.okr_tenant_id, o.okr_id, NULL::uuid,
  'OKR_CHECK_IN::' || o.okr_tenant_id::text || '::okr_checkins::' || src.id::text,
  'OKR_AGGREGATE', src.checkin_date,
  src.overall_progress, src.status_update, src.next_steps,
  src.key_result_updates, src.confidence_level, src.blockers,
  jsonb_build_object('legacy_id', src.id::text, 'legacy_table', 'okr_checkins',
                     'legacy_okr_id', src.okr_id::text, 'legacy_author_id', src.author_id::text),
  src.created_at
FROM legacy_mirror.okr_checkins src
JOIN temp_sdbi.okrs o ON o._legacy_source_id = src.okr_id
ON CONFLICT (_legacy_source_id, _legacy_source_table) DO NOTHING;

-- Mark run COMPLETED
UPDATE brownfield.import_runs
   SET import_run_status='COMPLETED', import_run_finished_at=now()
 WHERE import_run_id = current_setting('sdbi.run_id')::uuid;

COMMIT;

-- Verify counts
SELECT 'temp_sdbi.goal_templates' AS t, COUNT(*) FROM temp_sdbi.goal_templates
UNION ALL SELECT 'temp_sdbi.goals', COUNT(*) FROM temp_sdbi.goals
UNION ALL SELECT 'temp_sdbi.goal_milestones', COUNT(*) FROM temp_sdbi.goal_milestones
UNION ALL SELECT 'temp_sdbi.goal_check_ins', COUNT(*) FROM temp_sdbi.goal_check_ins
UNION ALL SELECT 'temp_sdbi.goal_updates', COUNT(*) FROM temp_sdbi.goal_updates
UNION ALL SELECT 'temp_sdbi.goal_comments', COUNT(*) FROM temp_sdbi.goal_comments
UNION ALL SELECT 'temp_sdbi.goal_alignments', COUNT(*) FROM temp_sdbi.goal_alignments
UNION ALL SELECT 'temp_sdbi.okrs', COUNT(*) FROM temp_sdbi.okrs
UNION ALL SELECT 'temp_sdbi.okr_key_results', COUNT(*) FROM temp_sdbi.okr_key_results
UNION ALL SELECT 'temp_sdbi.okr_check_ins', COUNT(*) FROM temp_sdbi.okr_check_ins
ORDER BY 1;
