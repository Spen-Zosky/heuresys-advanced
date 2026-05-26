# Class B Diagnostic — sys_skill_aliases

## §1 — State summary
- Target rows now: **0**
- Source tables (via brownfield.table_mappings):
  - `skill_aliases` (80 rows in legacy_mirror, 80 in platform)
  - `skill_synonyms` (50 rows in legacy_mirror)
- Column mappings count: **16** (9 from skill_aliases, 7 from skill_synonyms)
- LOOKUP_FK count among mappings: **1** (`skill_alias_skill_id`)
- JSON_EXTRACT count: 9
- LINEAGE_SOURCE_NK: 2 (1 per source_table)
- Other transforms: TRIM/CAST mostly
- Staged rows in `staging.wave1_skill_aliases`: **130** (80 + 50)
- Audit rows pre-existing: WAVE1_ALL_RULES PASSED 130, HANDLED_VIA_LINEAGE_WRITE_V1 SKIPPED 2

## §2 — Root cause analysis

ROOT CAUSE CATEGORY: **B + cascade**

Specific issue: The single LOOKUP_FK on `skill_alias_skill_id` uses payload `{"match_on": "skill_metadata->>legacy_id", "target_table": "sys_skills"}` — form (b) with `legacy_id` jsonb key. Pre P1 (commit `127e1a7` of 2026-05-20 00:15), this resolved NULL deterministically because `sys_skills.skill_metadata` never contains `legacy_id` key (0/6037 verified). Post P1, the compiler rewrites to a lineage JOIN; the lineage table is the canonical legacy_id→target row PK mapping.

Evidence:
- `sys_skills` lineage coverage: **444 / 6037** = 7.4% (lineage entries existed only for ontology_feedback, onet_skills, competencies, etc. — none from `esco_skills` source).
- Verified: `SELECT COUNT(*) FROM sys.sys_source_lineage_records WHERE source_lineage_source_record_id = '0fd7ad65-774a-490f-a46b-3afc4753f02c'` (a real `esco_skill_id` from `wave1_skill_aliases` staging) → **0 rows**.
- Sample staging row from `skill_synonyms`: `{"id": "00d51de3-…", "esco_skill_id": "0fd7ad65-…", "synonym": "Project Management", …}` — the FK source value is the ESCO skill UUID, but `esco_skills` source table itself has 0 lineage entries (had 0 rows in mirror until C1.4 restored 14011 of them; never staged in Wave 1 run 08d3bc9f).

The latest run (2026-05-19 18:52) PRE-dates the P1 fix (2026-05-20 00:15) by 6 hours → silent skip happened due to old form (b) NULL emission. But a fresh re-run will STILL fail: the lineage JOIN cannot resolve `esco_skill_id` because esco_skills (now restored, 14011 rows) has never been imported into sys_skills, so no lineage entries exist for it.

Note: this is the **simplest** of the cascade chains because both source tables exist in mirror with full data (80+50) and the only FK is `sys_skills`.

## §3 — Proposed fix

**Two-part fix**:

1. **Pre-requisite**: ensure `esco_skills` (14011 rows in mirror as of C1.4) is staged & upserted into `sys_skills`. Verify `brownfield.table_mappings` already has an entry — query `SELECT * FROM brownfield.table_mappings WHERE table_mapping_target_table='sys_skills' AND table_mapping_source_table_id IN (SELECT source_table_id FROM brownfield.source_tables WHERE source_table_name='esco_skills')`. If missing, add via the EXPLICIT_MAP authoring script + run `generate_wave1_column_mappings.mjs` for that one source_table.
2. **Re-run Wave 1**: after esco_skills upsert produces lineage entries, re-run the executor. The P1 fix (already committed `127e1a7`) will resolve `skill_alias_skill_id` via lineage JOIN automatically.

Code change: none (P1 already shipped). Pure data-flow fix.

Effort: **1-2h** (single re-run + validation).

## §4 — Acceptance criteria post-fix

- `sys_skill_aliases` count: ≥ **80** (skill_aliases) — synonyms 50 may double-up under UQ `(skill_alias_skill_id, lower(label), locale)`, expected ~100-130.
- `sys_skills` count grows from 6037 → ~20000 (after esco_skills 14011 staged).
- `sys_source_lineage_records` for `source_lineage_source_table='esco_skills'` ≥ 14000.
- Audit class `WHERE_SKIP_FILTER_EXCLUDED_V1` (post CW-B17 fix) for sys_skill_aliases: 0.
- Cross-check: no row in `staging.wave1_skill_aliases` with `staging_target_record_id IS NULL`.

## §5 — Dependencies su altri fix

- **Depends on**: addition of `esco_skills` source_table mapping into `brownfield.table_mappings` (target `sys_skills`). If already present, just re-run.
- **Blocks**: nothing (sys_skill_aliases is a leaf).
