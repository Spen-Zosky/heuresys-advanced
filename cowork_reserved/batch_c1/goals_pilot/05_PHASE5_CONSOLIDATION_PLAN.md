# Phase 5 — Consolidation plan: `temp_sdbi.*` → `sys.*` (Goals/OKRs pilot)

**ADR ref**: ADR-0014 §3.1 Phase 5 (CONSOLIDATION REVIEW)
**Status**: PLAN ONLY — CLI executes after Phase 3 + human review of mapping cards
**Sequence**: Phase 3 (seed temp_sdbi) → Phase 4 (FK traversal — N/A for pilot, closed graph) → **PHASE 5** → Phase 6 (cleanup)

---

## §1 — Execution order (FK dependency-driven)

```
1. sys.sys_goal_templates           ← temp_sdbi.goal_templates       (no goals/okrs FK deps)
2. sys.sys_goals                     ← temp_sdbi.goals                (template_id late-bind in pass 2; parent_goal_id self-FK late-bind in pass 2)
3. sys.sys_goal_milestones           ← temp_sdbi.goal_milestones      (depends on sys_goals)
4. sys.sys_goal_check_ins            ← temp_sdbi.goal_check_ins       (depends on sys_goals)
5. sys.sys_goal_updates              ← temp_sdbi.goal_updates         (depends on sys_goals)
6. sys.sys_goal_comments             ← temp_sdbi.goal_comments        (depends on sys_goals; parent_comment_id self-FK pass 2)
7. sys.sys_goal_alignments           ← temp_sdbi.goal_alignments      (depends on sys_goals)
8. sys.sys_okrs                       ← temp_sdbi.okrs                 (parent_okr_id self-FK NULL — no pass 2)
9. sys.sys_okr_key_results            ← temp_sdbi.okr_key_results      (depends on sys_okrs)
10. sys.sys_okr_check_ins             ← temp_sdbi.okr_check_ins        (depends on sys_okrs + sys_okr_key_results)
```

Per-table consolidation = ONE `INSERT ... ON CONFLICT (natural_key) DO UPDATE` + lineage row generation + audit row.

---

## §2 — Step 1: sys.sys_goal_templates

```sql
BEGIN;

INSERT INTO sys.sys_goal_templates (
  template_id, template_tenant_id, template_role_id, template_org_unit_id,
  template_natural_key, template_name, template_description, template_category,
  template_goal_type, template_suggested_metrics, template_suggested_duration_days,
  template_suggested_weight, template_difficulty_level, template_is_company_wide,
  template_usage_count, template_is_active, template_deleted_at,
  template_metadata, template_created_by, template_updated_by,
  created_at, updated_at
)
SELECT
  template_id, template_tenant_id, template_role_id, template_org_unit_id,
  template_natural_key, template_name, template_description, template_category,
  template_goal_type, template_suggested_metrics, template_suggested_duration_days,
  template_suggested_weight, template_difficulty_level, template_is_company_wide,
  template_usage_count, template_is_active, template_deleted_at,
  template_metadata, template_created_by, template_updated_by,
  created_at, updated_at
FROM temp_sdbi.goal_templates
ON CONFLICT (template_tenant_id, template_natural_key) DO UPDATE SET
  template_metadata     = sys.sys_goal_templates.template_metadata || EXCLUDED.template_metadata,
  template_updated_by   = EXCLUDED.template_updated_by,
  updated_at            = now();

-- Lineage rows
INSERT INTO sys.sys_source_lineage_records (
  source_system, source_table, source_record_id,
  target_table_name, target_record_id,
  validation_status,
  source_lineage_sdbi_mapping_card_id,
  source_lineage_sdbi_confidence,
  source_lineage_sdbi_ai_model_id,
  source_lineage_sdbi_human_approver
)
SELECT
  'heuresys_platform',
  'public.goal_templates',
  t._legacy_source_id::text,
  'sys.sys_goal_templates',
  t.template_id,
  'VALID',
  'GOALS-PILOT-MAP-07',
  0.85,
  'cowork-claude-opus-4.7',
  '<approver_email>'
FROM temp_sdbi.goal_templates t
ON CONFLICT (source_system, source_table, source_record_id, target_table_name) DO NOTHING;

-- Audit row
INSERT INTO audit.import_validation_results (
  import_run_id, target_table, target_record_id, rule_code, status, message
)
SELECT
  t._import_run_id, 'sys.sys_goal_templates', t.template_id,
  'SDBI_CONSOLIDATION_COMPLETE_V1', 'PASSED',
  'Consolidated 1 row from temp_sdbi.goal_templates'
FROM temp_sdbi.goal_templates t;

COMMIT;

-- Verification
SELECT COUNT(*) FROM sys.sys_goal_templates;  -- expected: 40
SELECT COUNT(*) FROM sys.sys_source_lineage_records WHERE target_table_name='sys.sys_goal_templates';  -- expected: 40
```

## §3 — Step 2: sys.sys_goals (two-pass for self-FK + template_id)

**Pass 1: INSERT without parent_goal_id and template_id resolutions**

```sql
BEGIN;

INSERT INTO sys.sys_goals (
  goal_id, goal_tenant_id, goal_natural_key,
  goal_subject_user_id, goal_owner_user_id,
  goal_parent_goal_id, goal_template_id,           -- both NULL pass 1
  goal_title, goal_description,
  goal_type, goal_category, goal_priority, goal_status,
  goal_progress_percent, goal_weight,
  goal_start_date, goal_due_date, goal_completed_at,
  goal_tags, goal_custom_fields, goal_metadata,
  goal_created_by, goal_updated_by,
  created_at, updated_at
)
SELECT
  goal_id, goal_tenant_id, goal_natural_key,
  goal_subject_user_id, goal_owner_user_id,
  NULL::uuid, NULL::uuid,
  goal_title, goal_description,
  goal_type, goal_category, goal_priority, goal_status,
  goal_progress_percent, goal_weight,
  goal_start_date, goal_due_date, goal_completed_at,
  goal_tags, goal_custom_fields, goal_metadata,
  goal_created_by, goal_updated_by,
  created_at, updated_at
FROM temp_sdbi.goals
ON CONFLICT (goal_tenant_id, goal_natural_key) DO UPDATE SET
  goal_metadata     = sys.sys_goals.goal_metadata || EXCLUDED.goal_metadata,
  updated_at        = now();

COMMIT;
```

**Pass 2: UPDATE parent_goal_id (resolve self-FK by joining temp_sdbi natural keys)**

```sql
BEGIN;

UPDATE sys.sys_goals child
SET goal_parent_goal_id = parent.goal_id
FROM temp_sdbi.goals temp_child
  JOIN temp_sdbi.goals temp_parent
    ON temp_parent._legacy_source_id = (
      SELECT lm.parent_goal_id FROM legacy_mirror.goals lm WHERE lm.id = temp_child._legacy_source_id
    )
  JOIN sys.sys_goals parent
    ON parent.goal_tenant_id = temp_parent.goal_tenant_id
   AND parent.goal_natural_key = temp_parent.goal_natural_key
WHERE child.goal_tenant_id = temp_child.goal_tenant_id
  AND child.goal_natural_key = temp_child.goal_natural_key;

COMMIT;
```

**Pass 3: UPDATE template_id**

(All template_id 100% NULL in source — skip pass 3 or set to literal NULL via the pass 1 default.)

**Lineage + audit (after both passes)**:

```sql
INSERT INTO sys.sys_source_lineage_records (...)
SELECT 'heuresys_platform', 'public.goals', t._legacy_source_id::text,
       'sys.sys_goals', t.goal_id, 'VALID',
       'GOALS-PILOT-MAP-01', 0.90, 'cowork-claude-opus-4.7', '<approver>'
FROM temp_sdbi.goals t
ON CONFLICT DO NOTHING;

INSERT INTO audit.import_validation_results (...)
SELECT t._import_run_id, 'sys.sys_goals', t.goal_id,
       'SDBI_CONSOLIDATION_COMPLETE_V1', 'PASSED', NULL
FROM temp_sdbi.goals t;
```

Verification:
```sql
SELECT COUNT(*) FROM sys.sys_goals;          -- expected: 1067
SELECT COUNT(*) FROM sys.sys_goals WHERE goal_parent_goal_id IS NOT NULL;  -- expected: 792 (1067 - 275 NULL)
```

## §4 — Steps 3-7: sys_goal_milestones, sys_goal_check_ins, sys_goal_updates, sys_goal_comments, sys_goal_alignments

Same pattern per table:

```sql
BEGIN;

INSERT INTO sys.<target_table> (...)
SELECT ... ,
  (SELECT goal_id FROM temp_sdbi.goals tg
   WHERE tg._legacy_source_id = t._legacy_source_goal_id) AS <fk_col>,
  ...
FROM temp_sdbi.<source_table> t
ON CONFLICT (...) DO UPDATE SET
  ...metadata-merge updates...;

-- Lineage + audit per pattern above
COMMIT;
```

**Special for sys_goal_comments**: parent_comment_id is 100% NULL in source — pass 2 skipped.

**Special for sys_goal_alignments**: both source_goal_id and aligned_goal_id resolved in pass 1 via `temp_sdbi.goals._legacy_source_id` lookup:

```sql
INSERT INTO sys.sys_goal_alignments (
  alignment_id, alignment_tenant_id,
  alignment_source_goal_id, alignment_aligned_goal_id,
  alignment_natural_key, alignment_type, alignment_weight,
  alignment_metadata, created_at
)
SELECT
  t.alignment_id, t.alignment_tenant_id,
  (SELECT goal_id FROM temp_sdbi.goals WHERE _legacy_source_id = t._legacy_source_source_goal_id),
  (SELECT goal_id FROM temp_sdbi.goals WHERE _legacy_source_id = t._legacy_source_aligned_goal_id),
  t.alignment_natural_key, t.alignment_type, t.alignment_weight,
  t.alignment_metadata, t.created_at
FROM temp_sdbi.goal_alignments t
ON CONFLICT (alignment_source_goal_id, alignment_aligned_goal_id) DO NOTHING;
```

## §5 — Step 8: sys_okrs (single pass, parent_okr_id all NULL)

```sql
BEGIN;

INSERT INTO sys.sys_okrs (
  okr_id, okr_tenant_id, okr_owner_user_id, okr_created_by_user_id, okr_parent_okr_id,
  okr_natural_key, okr_objective, okr_description, okr_okr_type, okr_department,
  okr_period_type, okr_period_start, okr_period_end,
  okr_fiscal_year, okr_fiscal_quarter, okr_status,
  okr_overall_progress, okr_confidence_level,
  okr_tags, okr_metadata, created_at, updated_at
)
SELECT
  okr_id, okr_tenant_id, okr_owner_user_id, okr_created_by_user_id, NULL::uuid,
  okr_natural_key, okr_objective, okr_description, okr_okr_type, okr_department,
  okr_period_type, okr_period_start, okr_period_end,
  okr_fiscal_year, okr_fiscal_quarter, okr_status,
  okr_overall_progress, okr_confidence_level,
  okr_tags, okr_metadata, created_at, updated_at
FROM temp_sdbi.okrs
ON CONFLICT (okr_tenant_id, okr_natural_key) DO UPDATE SET
  okr_metadata = sys.sys_okrs.okr_metadata || EXCLUDED.okr_metadata,
  updated_at   = now();

COMMIT;
```

(No pass 2 — `parent_okr_id` 100% NULL in source.)

## §6 — Step 9: sys_okr_key_results

```sql
BEGIN;

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

COMMIT;
```

## §7 — Step 10: sys_okr_check_ins (merged target with FK to KR resolved from temp)

```sql
BEGIN;

INSERT INTO sys.sys_okr_check_ins (
  check_in_id, check_in_tenant_id, check_in_okr_id, check_in_key_result_id,
  check_in_subject_user_id, check_in_natural_key, check_in_scope, check_in_date,
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
  END                                                                                  AS check_in_key_result_id,
  t.check_in_subject_user_id,
  t.check_in_natural_key, t.check_in_scope, t.check_in_date,
  t.check_in_previous_value, t.check_in_new_value, t.check_in_previous_progress, t.check_in_new_progress,
  t.check_in_overall_progress, t.check_in_status_update, t.check_in_next_steps,
  t.check_in_key_result_updates_snapshot, t.check_in_confidence_level,
  t.check_in_notes, t.check_in_blockers, t.check_in_metadata, t.created_at
FROM temp_sdbi.okr_check_ins t
ON CONFLICT (check_in_tenant_id, check_in_natural_key) DO NOTHING;

COMMIT;
```

## §8 — Aggregate lineage + audit pattern

For ALL 10 tables, after their INSERT block, emit:

```sql
-- Lineage (per-row)
INSERT INTO sys.sys_source_lineage_records (
  source_system, source_table, source_record_id, target_table_name, target_record_id, validation_status,
  source_lineage_sdbi_mapping_card_id, source_lineage_sdbi_confidence,
  source_lineage_sdbi_ai_model_id, source_lineage_sdbi_human_approver
)
SELECT 'heuresys_platform', 'public.<source_table>', t._legacy_source_id::text,
       'sys.<target_table>', t.<target_pk>, 'VALID',
       '<mapping_card_id>', <confidence>, 'cowork-claude-opus-4.7', '<approver>'
FROM temp_sdbi.<table> t
ON CONFLICT (source_system, source_table, source_record_id, target_table_name) DO NOTHING;

-- Audit (per-run aggregate)
INSERT INTO audit.import_validation_results (
  import_run_id, target_table, target_record_id, rule_code, status, message
)
SELECT t._import_run_id, 'sys.<target_table>', t.<target_pk>,
       'SDBI_CONSOLIDATION_COMPLETE_V1', 'PASSED',
       'Consolidated row via SDBI Goals/OKRs pilot'
FROM temp_sdbi.<table> t;
```

For the `sys.sys_okr_check_ins` merge target, the `source_table` field in lineage must reflect `_legacy_source_table` (either `public.okr_check_ins` or `public.okr_checkins`) to preserve dual-source traceability.

---

## §9 — DRY_RUN verification queries (BEFORE final commit)

Per ADR-0014 §4.3 risk: "Phase 5 introduces inconsistency". Before any DROP TABLE temp_sdbi, run:

```sql
-- 1) Row count parity per table
SELECT 'sys_goals'            AS tbl, (SELECT COUNT(*) FROM sys.sys_goals)            AS sys_count, (SELECT COUNT(*) FROM temp_sdbi.goals)            AS temp_count UNION ALL
SELECT 'sys_goal_milestones', (SELECT COUNT(*) FROM sys.sys_goal_milestones), (SELECT COUNT(*) FROM temp_sdbi.goal_milestones) UNION ALL
SELECT 'sys_goal_check_ins',  (SELECT COUNT(*) FROM sys.sys_goal_check_ins),  (SELECT COUNT(*) FROM temp_sdbi.goal_check_ins)  UNION ALL
SELECT 'sys_goal_updates',    (SELECT COUNT(*) FROM sys.sys_goal_updates),    (SELECT COUNT(*) FROM temp_sdbi.goal_updates)    UNION ALL
SELECT 'sys_goal_comments',   (SELECT COUNT(*) FROM sys.sys_goal_comments),   (SELECT COUNT(*) FROM temp_sdbi.goal_comments)   UNION ALL
SELECT 'sys_goal_alignments', (SELECT COUNT(*) FROM sys.sys_goal_alignments), (SELECT COUNT(*) FROM temp_sdbi.goal_alignments) UNION ALL
SELECT 'sys_goal_templates',  (SELECT COUNT(*) FROM sys.sys_goal_templates),  (SELECT COUNT(*) FROM temp_sdbi.goal_templates)  UNION ALL
SELECT 'sys_okrs',            (SELECT COUNT(*) FROM sys.sys_okrs),            (SELECT COUNT(*) FROM temp_sdbi.okrs)            UNION ALL
SELECT 'sys_okr_key_results', (SELECT COUNT(*) FROM sys.sys_okr_key_results), (SELECT COUNT(*) FROM temp_sdbi.okr_key_results) UNION ALL
SELECT 'sys_okr_check_ins',   (SELECT COUNT(*) FROM sys.sys_okr_check_ins),   (SELECT COUNT(*) FROM temp_sdbi.okr_check_ins);
```

Expected: every `sys_count = temp_count` on first run.

```sql
-- 2) Lineage completeness
SELECT target_table_name, COUNT(*) FROM sys.sys_source_lineage_records
WHERE source_lineage_sdbi_mapping_card_id LIKE 'GOALS-PILOT-MAP-%'
GROUP BY 1
ORDER BY 1;
```

Expected sum across all 10 target tables: 5939 (matches §2 of 02_TARGET_SCHEMA_PROPOSAL.md).

```sql
-- 3) FK integrity post-import
SELECT 'orphan goal parent'  AS chk, COUNT(*) FROM sys.sys_goals c
  LEFT JOIN sys.sys_goals p ON p.goal_id = c.goal_parent_goal_id
  WHERE c.goal_parent_goal_id IS NOT NULL AND p.goal_id IS NULL
UNION ALL
SELECT 'orphan milestone goal',   COUNT(*) FROM sys.sys_goal_milestones m LEFT JOIN sys.sys_goals g ON g.goal_id=m.milestone_goal_id WHERE g.goal_id IS NULL
UNION ALL
SELECT 'orphan check_in goal',    COUNT(*) FROM sys.sys_goal_check_ins c LEFT JOIN sys.sys_goals g ON g.goal_id=c.check_in_goal_id WHERE g.goal_id IS NULL
UNION ALL
SELECT 'orphan kr okr',           COUNT(*) FROM sys.sys_okr_key_results kr LEFT JOIN sys.sys_okrs o ON o.okr_id=kr.key_result_okr_id WHERE o.okr_id IS NULL
UNION ALL
SELECT 'cross-tenant alignment',  COUNT(*) FROM sys.sys_goal_alignments a JOIN sys.sys_goals s ON s.goal_id=a.alignment_source_goal_id JOIN sys.sys_goals al ON al.goal_id=a.alignment_aligned_goal_id WHERE s.goal_tenant_id<>al.goal_tenant_id;
```

Every row in this check must report 0 violations.

```sql
-- 4) CHECK validation (goal_due_date >= goal_start_date)
SELECT COUNT(*) FROM sys.sys_goals WHERE goal_due_date IS NOT NULL AND goal_start_date IS NOT NULL AND goal_due_date < goal_start_date;
-- expected: 0
```

## §10 — Rollback procedure (if Phase 5 fails)

```sql
-- Within a single transaction (ROLLBACK on error)
-- If COMMIT already done and need full rollback:
BEGIN;

-- Step 1: remove SDBI-imported sys.* rows
DELETE FROM sys.sys_okr_check_ins
  WHERE check_in_id IN (SELECT check_in_id FROM temp_sdbi.okr_check_ins);
DELETE FROM sys.sys_okr_key_results
  WHERE key_result_id IN (SELECT key_result_id FROM temp_sdbi.okr_key_results);
DELETE FROM sys.sys_okrs
  WHERE okr_id IN (SELECT okr_id FROM temp_sdbi.okrs);
DELETE FROM sys.sys_goal_alignments
  WHERE alignment_id IN (SELECT alignment_id FROM temp_sdbi.goal_alignments);
DELETE FROM sys.sys_goal_comments
  WHERE comment_id IN (SELECT comment_id FROM temp_sdbi.goal_comments);
DELETE FROM sys.sys_goal_updates
  WHERE update_id IN (SELECT update_id FROM temp_sdbi.goal_updates);
DELETE FROM sys.sys_goal_check_ins
  WHERE check_in_id IN (SELECT check_in_id FROM temp_sdbi.goal_check_ins);
DELETE FROM sys.sys_goal_milestones
  WHERE milestone_id IN (SELECT milestone_id FROM temp_sdbi.goal_milestones);
DELETE FROM sys.sys_goals
  WHERE goal_id IN (SELECT goal_id FROM temp_sdbi.goals);
DELETE FROM sys.sys_goal_templates
  WHERE template_id IN (SELECT template_id FROM temp_sdbi.goal_templates);

-- Step 2: remove lineage + audit
DELETE FROM sys.sys_source_lineage_records WHERE source_lineage_sdbi_mapping_card_id LIKE 'GOALS-PILOT-MAP-%';
DELETE FROM audit.import_validation_results WHERE rule_code='SDBI_CONSOLIDATION_COMPLETE_V1' AND target_table LIKE 'sys.sys_goal%' OR target_table LIKE 'sys.sys_okr%';

COMMIT;
```

(Note: rollback assumes temp_sdbi tables are still populated. Phase 6 cleanup runs ONLY after Phase 5 is confirmed.)

## §11 — Bias mitigations (per ADR-0014 §3.8)

| Bias | Phase 5 mitigation |
|---|---|
| CW-B17 silent skip | EVERY row in temp_sdbi gets a corresponding lineage row + audit row. Zero implicit drop. |
| CW-B19 source-side FK | FK resolution done in INSERT...SELECT subquery; if subquery returns NULL, the FK column is NULL (CASCADE→SET NULL semantics depending on table) — never raises constraint error. |
| CW-B20 UQ block | Each ON CONFLICT path is on `(tenant_id, natural_key)` UQ which IS DECLARED in migration 000035. No silent skip from missing UQ. |

---

*End of 05_PHASE5_CONSOLIDATION_PLAN.md*
