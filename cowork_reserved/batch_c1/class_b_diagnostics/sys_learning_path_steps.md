# Class B Diagnostic — sys_learning_path_steps

## §1 — State summary
- Target rows now: **0**
- Source tables:
  - `learning_path_courses` (124 in legacy_mirror)
  - `course_modules` (564 in legacy_mirror)
- Column mappings count: **20** (8 + 12)
- LOOKUP_FK count: **0** (!)
- JSON_EXTRACT count: 16
- LINEAGE_SOURCE_NK: 2
- Staged rows in `staging.wave1_learning_path_steps`: **688** (124+564)
- Audit rows pre-existing: WAVE1_ALL_RULES PASSED 688, HANDLED_VIA_LINEAGE_WRITE_V1 SKIPPED 2
- Required NOT NULL UUID cols: `learning_path_step_path_id` + `learning_path_step_module_id`
- UQ: `(path_id, ordinal)`

## §2 — Root cause analysis

ROOT CAUSE CATEGORY: **F (no FK mappings at all for 2 required NOT NULL UUID cols)**

NEITHER source has any LOOKUP_FK mapping for `learning_path_step_path_id` or `learning_path_step_module_id`. The compiler/authoring missed both required FKs entirely.

Evidence:
- `SELECT COUNT(*) FROM brownfield.column_mappings cm JOIN brownfield.table_mappings tm ON tm.table_mapping_id=cm.column_mapping_table_mapping_id WHERE tm.table_mapping_target_table='sys_learning_path_steps' AND cm.column_mapping_transform='LOOKUP_FK'` → 0.
- Sample staging from learning_path_courses: `{"id": "932385a1-…", "course_id": "e27116bb-…", "learning_path_id": "4524c985-…", "sequence_order": 9, …}` — both `course_id` and `learning_path_id` are present as legacy UUIDs but no mapping turns them into target FKs.
- WHERE skip filter pushes "FALSE" for both required cols → all 688 rows dropped.

Note: this is the SAME structural problem as sys_skill_learning_mappings — authoring missed required FK mappings.

## §3 — Proposed fix

**Authoring fix**: add 4 LOOKUP_FK mappings (2 per source):

```sql
-- learning_path_courses
INSERT INTO brownfield.column_mappings (column_mapping_table_mapping_id, column_mapping_source_column_id, column_mapping_target_column, column_mapping_transform, column_mapping_transform_payload)
VALUES (
  'af2921d6-24ad-4284-93ac-e3e2eb9c38fe',
  (SELECT source_column_id FROM brownfield.source_columns WHERE source_column_name='learning_path_id' AND source_table_id=(SELECT source_table_id FROM brownfield.source_tables WHERE source_table_name='learning_path_courses')),
  'learning_path_step_path_id',
  'LOOKUP_FK',
  '{"match_on": "learning_path_metadata->>legacy_id", "target_table": "sys_learning_paths"}'::jsonb
);
-- repeat for course_id → learning_path_step_module_id (sys_learning_modules)
-- repeat for course_modules source with module_id → step_module_id and course_id → step_path_id (semantically: course_module belongs to a course, but step_path_id expects a learning_path UUID — semantic mismatch warning, may need bridge table or skip course_modules source).
```

**Semantic caveat**: `course_modules` provides MODULES inside a course, not modules inside a learning_path. The current author intent may have been to treat each module as a step in any path containing the course — this is an architectural decision; consider keeping `course_modules` mappings as SKIP and only authoring `learning_path_courses` as the canonical step source.

Effort: **3-5h** (authoring + semantic clarification + sys_learning_paths lineage check + re-run).

**Lineage caveat**: sys_learning_paths lineage coverage is only **135/3227 = 4%**. Many lookups will fail. Need to either improve coverage OR change mapping payload to use a direct natural key column on sys_learning_paths (if exists).

## §4 — Acceptance criteria post-fix

- `sys_learning_path_steps` count: ≥ 100 (from learning_path_courses 124, after dedup on (path_id, ordinal)).
- Audit `WHERE_SKIP_FILTER_EXCLUDED_V1`: 0.
- `LOOKUP_FK_UNRESOLVABLE`: > 0 acceptable for legitimate orphan refs.

## §5 — Dependencies su altri fix

- **Depends on**: sys_learning_paths lineage coverage strengthening; semantic decision on course_modules role.
- **Blocks**: learning UX path step navigation.
