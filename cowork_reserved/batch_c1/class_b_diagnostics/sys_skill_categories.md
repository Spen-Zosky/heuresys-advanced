# Class B Diagnostic — sys_skill_categories

## §1 — State summary
- Target rows now: **0**
- Source tables:
  - `skill_classifications` (7215 in legacy_mirror)
  - `competencies` (32 in legacy_mirror)
  - `ontology_categories` (9 in legacy_mirror)
- Column mappings count: **45** (18 + 13 + 14)
- LOOKUP_FK count: **0**
- JSON_EXTRACT count: 28
- LINEAGE_SOURCE_NK: 3 (1 per source)
- TRIM/CAST/etc.: 14
- Staged rows in `staging.wave1_skill_categories`: **7256**
- Audit rows pre-existing: WAVE1_ALL_RULES PASSED 7256, HANDLED_VIA_LINEAGE_WRITE_V1 SKIPPED 3
- UQ index: `sys_skill_categories_code_uq (skill_category_code)` — naturalKey column is `skill_category_code` (varchar, not uuid)
- Required NOT NULL UUID column: `skill_category_family_id` (NOT in any mapping! → WHERE skip filter pushes "FALSE")

## §2 — Root cause analysis

ROOT CAUSE CATEGORY: **A (cascade) + F (no mapping for required NOT NULL FK)**

Specific issue: The target table has a required NOT NULL UUID column `skill_category_family_id` (FK to `sys_skill_families`). NO column mapping in the 45 column_mappings provides this column. The WHERE skip filter at `upsert-sql.ts:411` pushes `FALSE` for any required UUID column with no mapping entry, causing ALL 7256 staging rows to be filtered out.

Evidence:
- Schema check: `SELECT a.attname FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='sys' AND c.relname='sys_skill_categories' AND a.attnotnull AND format_type(a.atttypid,a.atttypmod)='uuid'` → `skill_category_id`, **`skill_category_family_id`**.
- Column mappings: zero of the 45 maps to `skill_category_family_id`.
- Upsert-sql §5 (line 398-416): "for each required UUID column other than PK/tenant/global/meta/name and not in NK, if no entry → skipFilters.push('FALSE')".
- Cross-check: `sys_skill_families` has 77 rows — parent exists.
- Sample staging from `competencies`: contains `framework_id` (matches `sys_skill_families` parent) but no mapping authored.

The brownfield mapping authoring missed authoring a LOOKUP_FK from source `framework_id` / `parent_category_id` / similar → `skill_category_family_id`.

## §3 — Proposed fix

**Authoring fix**: add 3 column_mappings (one per source) to populate `skill_category_family_id`:

```sql
-- Example for competencies → sys_skill_categories (similar for skill_classifications + ontology_categories)
INSERT INTO brownfield.column_mappings (
  column_mapping_table_mapping_id,
  column_mapping_source_column_id,
  column_mapping_target_column,
  column_mapping_transform,
  column_mapping_transform_payload
) VALUES (
  '79b8eda7-0815-42af-8687-265eb424545b',  -- table_mapping_id for competencies→sys_skill_categories
  (SELECT source_column_id FROM brownfield.source_columns
    WHERE source_column_name='framework_id'
      AND source_table_id=(SELECT source_table_id FROM brownfield.source_tables WHERE source_table_name='competencies')),
  'skill_category_family_id',
  'LOOKUP_FK',
  '{"match_on": "skill_family_code", "target_table": "sys_skill_families"}'::jsonb
);
```

CW-B20 caveat: if the UQ constraint `brownfield_column_mappings_pair_uq (table_mapping_id, source_column_id)` blocks — that pair is unique. Verify `framework_id` is not already mapped (e.g. as JSON_EXTRACT). If conflict, either pick a different source column or relax UQ.

Effort: **3-5h** (authoring 3 mappings + verifying `sys_skill_families.skill_family_code` matches semantically + re-run + validation).

## §4 — Acceptance criteria post-fix

- `sys_skill_categories` count: ≥ 32 (from competencies), expected 32 + 9 (ontology_categories) + dedupe of 7215 skill_classifications (which may collapse heavily under UQ on `skill_category_code`).
- Audit class `WHERE_SKIP_FILTER_EXCLUDED_V1` (post CW-B17): 0.
- All 7256 staging rows have `staging_target_record_id IS NOT NULL` or staging.validation_status='SKIPPED' with class `LOOKUP_FK_UNRESOLVABLE`.

## §5 — Dependencies su altri fix

- **Depends on**: zero. `sys_skill_families` (77) is populated. Self-contained authoring fix.
- **Blocks**: nothing directly, but unlocks UX features for skill categorization (downstream of skill workforce planning).
