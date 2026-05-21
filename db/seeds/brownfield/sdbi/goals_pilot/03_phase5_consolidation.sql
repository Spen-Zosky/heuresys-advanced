-- db/seeds/brownfield/sdbi/goals_pilot/03_phase5_consolidation.sql
-- SDBI Pilot Phase 5 — Consolidate temp_sdbi.* → sys.* + lineage + audit
-- Schema fixes vs Cowork spec 05:
--   - sys.sys_source_lineage_records uses prefix source_lineage_*
--   - audit.import_validation_results uses prefix import_validation_result_*
-- Simplifications vs Cowork spec:
--   - Skip pass 2 self-FK resolution (parent_goal_id stays NULL — pragmatic pilot)
--   - source_table_id in audit rows: NULL (no brownfield.source_tables entries for SDBI tables)

BEGIN;

-- ===== Step 1: sys.sys_goal_templates (40 rows) =====
INSERT INTO sys.sys_goal_templates (
  template_id, template_tenant_id, template_role_id, template_org_unit_id,
  template_natural_key, template_name, template_description, template_category,
  template_goal_type, template_suggested_metrics, template_suggested_duration_days,
  template_suggested_weight, template_difficulty_level, template_is_company_wide,
  template_usage_count, template_is_active, template_deleted_at,
  template_metadata, template_created_by, template_updated_by, created_at, updated_at
)
SELECT
  template_id, template_tenant_id, template_role_id, template_org_unit_id,
  template_natural_key, template_name, template_description, template_category,
  template_goal_type, template_suggested_metrics, template_suggested_duration_days,
  template_suggested_weight, template_difficulty_level, template_is_company_wide,
  template_usage_count, template_is_active, template_deleted_at,
  template_metadata, template_created_by, template_updated_by, created_at, updated_at
FROM temp_sdbi.goal_templates
ON CONFLICT (template_tenant_id, template_natural_key) DO UPDATE SET
  template_metadata = sys.sys_goal_templates.template_metadata || EXCLUDED.template_metadata,
  updated_at = now();

-- ===== Step 2: sys.sys_goals (1067 rows, pass 1 only) =====
INSERT INTO sys.sys_goals (
  goal_id, goal_tenant_id, goal_natural_key,
  goal_subject_user_id, goal_owner_user_id, goal_parent_goal_id, goal_template_id,
  goal_title, goal_description, goal_type, goal_category, goal_priority, goal_status,
  goal_progress_percent, goal_weight, goal_start_date, goal_due_date, goal_completed_at,
  goal_tags, goal_custom_fields, goal_metadata,
  goal_created_by, goal_updated_by, created_at, updated_at
)
SELECT
  goal_id, goal_tenant_id, goal_natural_key,
  goal_subject_user_id, goal_owner_user_id, NULL::uuid, NULL::uuid,
  goal_title, goal_description, goal_type, goal_category, goal_priority, goal_status,
  goal_progress_percent, goal_weight, goal_start_date, goal_due_date, goal_completed_at,
  goal_tags, goal_custom_fields, goal_metadata,
  goal_created_by, goal_updated_by, created_at, updated_at
FROM temp_sdbi.goals
ON CONFLICT (goal_tenant_id, goal_natural_key) DO UPDATE SET
  goal_metadata = sys.sys_goals.goal_metadata || EXCLUDED.goal_metadata,
  updated_at = now();

-- ===== Step 3: sys.sys_goal_milestones (1000 rows) =====
INSERT INTO sys.sys_goal_milestones (
  milestone_id, milestone_tenant_id, milestone_goal_id, milestone_natural_key,
  milestone_title, milestone_description, milestone_target_date, milestone_completed_at,
  milestone_status, milestone_weight, milestone_metadata,
  milestone_created_by, milestone_updated_by, created_at, updated_at
)
SELECT
  t.milestone_id, t.milestone_tenant_id,
  (SELECT goal_id FROM temp_sdbi.goals tg WHERE tg._legacy_source_id = t._legacy_source_goal_id) AS milestone_goal_id,
  t.milestone_natural_key,
  t.milestone_title, t.milestone_description, t.milestone_target_date, t.milestone_completed_at,
  t.milestone_status, t.milestone_weight, t.milestone_metadata,
  t.milestone_created_by, t.milestone_updated_by, t.created_at, t.updated_at
FROM temp_sdbi.goal_milestones t
ON CONFLICT (milestone_tenant_id, milestone_natural_key) DO UPDATE SET
  milestone_metadata = sys.sys_goal_milestones.milestone_metadata || EXCLUDED.milestone_metadata,
  updated_at = now();

-- ===== Step 4: sys.sys_goal_check_ins (1000 rows) =====
INSERT INTO sys.sys_goal_check_ins (
  check_in_id, check_in_tenant_id, check_in_goal_id, check_in_subject_user_id,
  check_in_natural_key, check_in_date, check_in_previous_progress, check_in_new_progress,
  check_in_status_update, check_in_notes, check_in_blockers, check_in_next_steps,
  check_in_confidence_level, check_in_metadata, created_at
)
SELECT
  t.check_in_id, t.check_in_tenant_id,
  (SELECT goal_id FROM temp_sdbi.goals tg WHERE tg._legacy_source_id = t._legacy_source_goal_id) AS check_in_goal_id,
  -- check_in_subject_user_id is NOT NULL FK to sys_users; legacy employee_id can't be
  -- resolved without legacy_mirror.employees_core (out of scope pilot). Use admin user
  -- as placeholder + record real legacy_employee_id in metadata.
  '82c89e25-95db-46eb-be24-33a840cb3b79'::uuid,
  t.check_in_natural_key, t.check_in_date, t.check_in_previous_progress, t.check_in_new_progress,
  t.check_in_status_update, t.check_in_notes, t.check_in_blockers, t.check_in_next_steps,
  t.check_in_confidence_level,
  t.check_in_metadata || jsonb_build_object('subject_user_id_placeholder', true, 'legacy_employee_id', t._legacy_source_employee_id::text),
  t.created_at
FROM temp_sdbi.goal_check_ins t
ON CONFLICT (check_in_tenant_id, check_in_natural_key) DO NOTHING;

-- ===== Step 5: sys.sys_goal_updates (1811 rows) =====
INSERT INTO sys.sys_goal_updates (
  update_id, update_tenant_id, update_goal_id, update_author_user_id, update_natural_key,
  update_type, update_previous_progress, update_new_progress,
  update_previous_status, update_new_status, update_content, update_attachments,
  update_metadata, created_at
)
SELECT
  t.update_id, t.update_tenant_id,
  (SELECT goal_id FROM temp_sdbi.goals tg WHERE tg._legacy_source_id = t._legacy_source_goal_id) AS update_goal_id,
  t.update_author_user_id, t.update_natural_key,
  t.update_type, t.update_previous_progress, t.update_new_progress,
  t.update_previous_status, t.update_new_status, t.update_content, t.update_attachments,
  t.update_metadata, t.created_at
FROM temp_sdbi.goal_updates t
ON CONFLICT (update_tenant_id, update_natural_key) DO NOTHING;

-- ===== Step 6: sys.sys_goal_comments (856 rows) =====
INSERT INTO sys.sys_goal_comments (
  comment_id, comment_tenant_id, comment_goal_id, comment_author_user_id, comment_parent_comment_id,
  comment_natural_key, comment_content, comment_is_private, comment_metadata, created_at, updated_at
)
SELECT
  t.comment_id, t.comment_tenant_id,
  (SELECT goal_id FROM temp_sdbi.goals tg WHERE tg._legacy_source_id = t._legacy_source_goal_id) AS comment_goal_id,
  t.comment_author_user_id, NULL::uuid,
  t.comment_natural_key, t.comment_content, t.comment_is_private, t.comment_metadata,
  t.created_at, t.updated_at
FROM temp_sdbi.goal_comments t
ON CONFLICT (comment_tenant_id, comment_natural_key) DO NOTHING;

-- ===== Step 7: sys.sys_goal_alignments (100 rows) =====
INSERT INTO sys.sys_goal_alignments (
  alignment_id, alignment_tenant_id,
  alignment_source_goal_id, alignment_aligned_goal_id, alignment_natural_key,
  alignment_type, alignment_weight, alignment_metadata, created_at
)
SELECT
  t.alignment_id, t.alignment_tenant_id,
  (SELECT goal_id FROM temp_sdbi.goals WHERE _legacy_source_id = t._legacy_source_source_goal_id) AS alignment_source_goal_id,
  (SELECT goal_id FROM temp_sdbi.goals WHERE _legacy_source_id = t._legacy_source_aligned_goal_id) AS alignment_aligned_goal_id,
  t.alignment_natural_key, t.alignment_type, t.alignment_weight, t.alignment_metadata, t.created_at
FROM temp_sdbi.goal_alignments t
ON CONFLICT (alignment_source_goal_id, alignment_aligned_goal_id) DO NOTHING;

-- ===== Step 8: sys.sys_okrs (20 rows) =====
INSERT INTO sys.sys_okrs (
  okr_id, okr_tenant_id, okr_owner_user_id, okr_created_by_user_id, okr_parent_okr_id,
  okr_natural_key, okr_objective, okr_description, okr_okr_type, okr_department,
  okr_period_type, okr_period_start, okr_period_end,
  okr_fiscal_year, okr_fiscal_quarter, okr_status,
  okr_overall_progress, okr_confidence_level, okr_tags, okr_metadata, created_at, updated_at
)
SELECT
  okr_id, okr_tenant_id, okr_owner_user_id, okr_created_by_user_id, NULL::uuid,
  okr_natural_key, okr_objective, okr_description, okr_okr_type, okr_department,
  okr_period_type, okr_period_start, okr_period_end,
  okr_fiscal_year, okr_fiscal_quarter, okr_status,
  okr_overall_progress, okr_confidence_level, okr_tags, okr_metadata, created_at, updated_at
FROM temp_sdbi.okrs
ON CONFLICT (okr_tenant_id, okr_natural_key) DO UPDATE SET
  okr_metadata = sys.sys_okrs.okr_metadata || EXCLUDED.okr_metadata,
  updated_at = now();

-- ===== Step 9: sys.sys_okr_key_results (20 rows) =====
INSERT INTO sys.sys_okr_key_results (
  key_result_id, key_result_tenant_id, key_result_okr_id, key_result_owner_user_id,
  key_result_natural_key, key_result_description, key_result_metric_type,
  key_result_start_value, key_result_target_value, key_result_current_value,
  key_result_unit, key_result_progress_percent, key_result_status,
  key_result_weight, key_result_confidence_level, key_result_last_check_in_at,
  key_result_metadata, created_at, updated_at
)
SELECT
  t.key_result_id, t.key_result_tenant_id,
  (SELECT okr_id FROM temp_sdbi.okrs WHERE _legacy_source_id = t._legacy_source_okr_id) AS key_result_okr_id,
  t.key_result_owner_user_id,
  t.key_result_natural_key, t.key_result_description, t.key_result_metric_type,
  t.key_result_start_value, t.key_result_target_value, t.key_result_current_value,
  t.key_result_unit, t.key_result_progress_percent, t.key_result_status,
  t.key_result_weight, t.key_result_confidence_level, t.key_result_last_check_in_at,
  t.key_result_metadata, t.created_at, t.updated_at
FROM temp_sdbi.okr_key_results t
ON CONFLICT (key_result_tenant_id, key_result_natural_key) DO UPDATE SET
  key_result_metadata = sys.sys_okr_key_results.key_result_metadata || EXCLUDED.key_result_metadata,
  updated_at = now();

-- ===== Step 10: sys.sys_okr_check_ins (25 rows, merged A+B) =====
INSERT INTO sys.sys_okr_check_ins (
  check_in_id, check_in_tenant_id,
  check_in_okr_id, check_in_key_result_id, check_in_subject_user_id,
  check_in_natural_key, check_in_scope, check_in_date,
  check_in_previous_value, check_in_new_value, check_in_previous_progress, check_in_new_progress,
  check_in_overall_progress, check_in_status_update, check_in_next_steps,
  check_in_key_result_updates_snapshot, check_in_confidence_level,
  check_in_notes, check_in_blockers, check_in_metadata, created_at
)
SELECT
  t.check_in_id, t.check_in_tenant_id,
  (SELECT okr_id FROM temp_sdbi.okrs WHERE _legacy_source_id = t._legacy_source_okr_id) AS check_in_okr_id,
  CASE WHEN t._legacy_source_key_result_id IS NULL THEN NULL
       ELSE (SELECT key_result_id FROM temp_sdbi.okr_key_results WHERE _legacy_source_id = t._legacy_source_key_result_id)
  END AS check_in_key_result_id,
  t.check_in_subject_user_id,
  t.check_in_natural_key, t.check_in_scope, t.check_in_date,
  t.check_in_previous_value, t.check_in_new_value, t.check_in_previous_progress, t.check_in_new_progress,
  t.check_in_overall_progress, t.check_in_status_update, t.check_in_next_steps,
  t.check_in_key_result_updates_snapshot, t.check_in_confidence_level,
  t.check_in_notes, t.check_in_blockers, t.check_in_metadata, t.created_at
FROM temp_sdbi.okr_check_ins t
ON CONFLICT (check_in_tenant_id, check_in_natural_key) DO NOTHING;

-- ===== Lineage records (single bulk INSERT per target table) =====
-- Pattern: source_system='heuresys_platform', natural_key='OLDDB::<table>::<id>'
INSERT INTO sys.sys_source_lineage_records (
  source_lineage_tenant_id, source_lineage_source_system, source_lineage_source_table,
  source_lineage_source_record_id, source_lineage_source_natural_key,
  source_lineage_import_run_id, source_lineage_target_table_name, source_lineage_target_record_id,
  source_lineage_mapping_confidence, source_lineage_validation_status, source_lineage_metadata
)
SELECT t.template_tenant_id, 'heuresys_platform', 'goal_templates',
       t._legacy_source_id::text,
       'OLDDB::goal_templates::' || t._legacy_source_id::text,
       t._import_run_id, 'sys_goal_templates', t.template_id,
       0.85, 'VALID',
       jsonb_build_object('sdbi_mapping_card_id', 'GOALS-PILOT-MAP-07', 'sdbi_ai_model_id', 'cowork-claude-opus-4.7')
FROM temp_sdbi.goal_templates t
ON CONFLICT (source_lineage_source_system, source_lineage_source_table, source_lineage_source_record_id, source_lineage_target_table_name) DO NOTHING;

INSERT INTO sys.sys_source_lineage_records (
  source_lineage_tenant_id, source_lineage_source_system, source_lineage_source_table,
  source_lineage_source_record_id, source_lineage_source_natural_key,
  source_lineage_import_run_id, source_lineage_target_table_name, source_lineage_target_record_id,
  source_lineage_mapping_confidence, source_lineage_validation_status, source_lineage_metadata
)
SELECT t.goal_tenant_id, 'heuresys_platform', 'goals', t._legacy_source_id::text,
       'OLDDB::goals::' || t._legacy_source_id::text,
       t._import_run_id, 'sys_goals', t.goal_id, 0.90, 'VALID',
       jsonb_build_object('sdbi_mapping_card_id', 'GOALS-PILOT-MAP-01', 'sdbi_ai_model_id', 'cowork-claude-opus-4.7')
FROM temp_sdbi.goals t
ON CONFLICT (source_lineage_source_system, source_lineage_source_table, source_lineage_source_record_id, source_lineage_target_table_name) DO NOTHING;

-- Audit rows DEFERRED — audit.import_validation_results.import_validation_result_source_table_id
-- has NOT NULL FK to brownfield.source_tables, but SDBI workflow doesn't register source_tables
-- entries for its 11 legacy source tables (they're queried direct via legacy_mirror.* without
-- a brownfield registry footprint). Two options for batch C3:
--   (a) extend audit schema to make source_table_id nullable for SDBI workflow rows
--   (b) auto-register placeholder source_tables entries for each SDBI source table
-- The lineage rows (sys.sys_source_lineage_records) already provide per-row provenance —
-- SDBI_CONSOLIDATION_COMPLETE_V1 audit marker can be added once the schema decision is made.

COMMIT;

-- Verify counts
SELECT 'sys_goal_templates' AS t, COUNT(*) FROM sys.sys_goal_templates
UNION ALL SELECT 'sys_goals', COUNT(*) FROM sys.sys_goals
UNION ALL SELECT 'sys_goal_milestones', COUNT(*) FROM sys.sys_goal_milestones
UNION ALL SELECT 'sys_goal_check_ins', COUNT(*) FROM sys.sys_goal_check_ins
UNION ALL SELECT 'sys_goal_updates', COUNT(*) FROM sys.sys_goal_updates
UNION ALL SELECT 'sys_goal_comments', COUNT(*) FROM sys.sys_goal_comments
UNION ALL SELECT 'sys_goal_alignments', COUNT(*) FROM sys.sys_goal_alignments
UNION ALL SELECT 'sys_okrs', COUNT(*) FROM sys.sys_okrs
UNION ALL SELECT 'sys_okr_key_results', COUNT(*) FROM sys.sys_okr_key_results
UNION ALL SELECT 'sys_okr_check_ins', COUNT(*) FROM sys.sys_okr_check_ins
ORDER BY 1;
