# Class B Diagnostic — sys_skill_learning_mappings

## §1 — State summary
- Target rows now: **0**
- Source tables:
  - `job_title_courses` (207 in legacy_mirror)
  - `course_esco_skills` (717)
  - `certification_esco_skills` (664)
- Column mappings count: **23** (9 + 8 + 6)
- LOOKUP_FK count: **2** (both on `job_title_courses` source: `skill_learning_mapping_module_id` + `skill_learning_mapping_skill_id`)
- JSON_EXTRACT count: 15
- LINEAGE_SOURCE_NK: 3
- Staged rows in `staging.wave1_skill_learning_mappings`: **1588** (= 207 + 717 + 664)
- Audit rows pre-existing: WAVE1_ALL_RULES PASSED 1588, HANDLED_VIA_LINEAGE_WRITE_V1 SKIPPED 3
- Required NOT NULL UUID cols: `skill_learning_mapping_skill_id` + `skill_learning_mapping_module_id`
- UQ: `(skill_id, module_id)` pair

## §2 — Root cause analysis

ROOT CAUSE CATEGORY: **B + F (2 of 3 sources lack FK mappings)**

The 2 LOOKUP_FK mappings are ONLY on the `job_title_courses` source (207 rows). The other two larger sources (`course_esco_skills` 717 + `certification_esco_skills` 664) have NO mapping for the required NOT NULL UUID columns → WHERE filter "FALSE" → all 1381 rows silently dropped.

For the 207 `job_title_courses` rows that DO have LOOKUP_FK:
- `skill_learning_mapping_module_id`: `match_on=learning_module_metadata->>legacy_id` form (b). Post P1 → lineage JOIN. Lineage coverage for sys_learning_modules: **92 / 4488 = 2%**. Almost all lookups will return NULL.
- `skill_learning_mapping_skill_id`: `match_on=skill_name` (plain column, not jsonb). Compiles to `SELECT skill_id FROM sys.sys_skills WHERE skill_name = (staging_raw_record->>'job_title') LIMIT 1`. But `job_title` is a job-role string, not a skill name → unlikely to match.

Evidence:
- Mapping payload for `skill_learning_mapping_skill_id` (job_title_courses): `{"match_on": "skill_name", "target_table": "sys_skills"}` with source column = `job_title` → semantic mismatch.
- Sample staging from certification_esco_skills: `{"id": "0aa4f9f7-…", "skill_name": "Motion graphics", "esco_skill_uri": "http://esco.eu/skill/DS5", "certification_id": "01929272-…"}` — has skill_name + esco_skill_uri but the source has NO LOOKUP_FK mapping at all.

## §3 — Proposed fix

**Authoring fix + semantic correction**:

1. Author 4 LOOKUP_FK mappings (2 per missing source):
   - `course_esco_skills`: map `course_id` → `skill_learning_mapping_module_id` (lineage JOIN to sys_learning_modules); map `esco_skill_uri` → `skill_learning_mapping_skill_id` (match_on=`skill_external_uri`).
   - `certification_esco_skills`: map `certification_id` → `skill_learning_mapping_module_id` (BUT certifications are not in sys_learning_modules currently — see sys_user_certifications which has 1 row); map `esco_skill_uri` → `skill_learning_mapping_skill_id`.
2. Fix the existing `job_title_courses` skill_id mapping: change source_column from `job_title` to a proper skill UUID column (or accept it as a job-role linker, in which case it doesn't belong on sys_skill_learning_mappings).
3. Strengthen lineage coverage on sys_learning_modules (see #sys_learning_path_steps diagnostic).

Effort: **4-6h** (mapping authoring + semantic review + re-run).

## §4 — Acceptance criteria post-fix

- `sys_skill_learning_mappings` count: ≥ 500 (subset of 1588 after legitimate cross-source dedup on (skill_id, module_id)).
- Audit `WHERE_SKIP_FILTER_EXCLUDED_V1`: 0.
- `LOOKUP_FK_UNRESOLVABLE`: documented for legitimate cases (skill_name not in sys_skills).

## §5 — Dependencies su altri fix

- **Depends on**: sys_learning_modules lineage strengthening; sys_skills external_uri index if needed.
- **Blocks**: skill-to-course recommendation engine (downstream).
