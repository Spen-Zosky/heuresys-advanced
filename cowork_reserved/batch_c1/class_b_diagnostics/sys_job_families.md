# Class B Diagnostic — sys_job_families

## §1 — State summary
- Target rows now: **0**
- Source tables: **NONE in brownfield.table_mappings** (zero mapping authored).
- Platform source: `heuresys_platform.public.job_families` 27 rows.
- Mirror source: not present (or empty — 6th undocumented MIRROR GAP candidate).
- Column mappings count: **0**
- LOOKUP_FK count: 0
- Staged rows: **0** (no staging table — `staging.wave1_job_families` does not exist; verified above).
- Audit rows: 0 (target not in wave_executor.stats).
- Required NOT NULL UUID col: `job_family_id` (PK, auto-generated).
- UQ: `job_family_code` (varchar).
- Cascade impact: **blocks sys_job_roles → sys_esco_occupation_mappings → sys_position_skill_requirements + downstream**.

## §2 — Root cause analysis

ROOT CAUSE CATEGORY: **D (true source-side gap: no extraction, no mapping)**

This is a SOURCE-GAP, not a silent skip. The wave 1 authoring pipeline never included `job_families` as a source. The target table schema exists in sys.* (sys_job_families) with UQ on `job_family_code`, but:
1. No row in `brownfield.source_tables` (verified — likely absent or unused).
2. No row in `brownfield.table_mappings`.
3. No row in `staging.wave1_job_families` (no staging table created by stagingTableFor whitelist).
4. No audit trace.

Evidence:
- `SELECT COUNT(*) FROM brownfield.table_mappings WHERE table_mapping_target_table='sys_job_families'` → 0.
- `pg_stat_user_tables` lists no staging.wave1_job_families.

This target is in the same class as TRUE GAP (Class D in F10 framework), except the target schema already exists.

## §3 — Proposed fix

**Bootstrap fix (Class C+B authoring)**:

1. **Restore mirror**: pg_dump --data-only `public.job_families` from platform, sed rename schema, COPY into legacy_mirror (same protocol as C1.4).
2. **Add to extract-wave1-legacy.sh**: append `job_families` to source table list (idempotent script — safe to re-run; will be future-proof).
3. **Author `brownfield.source_tables` row** for `job_families` + 7 source_columns.
4. **Author `brownfield.table_mappings`** row with target=`sys_job_families`.
5. **Author column_mappings** (7-12 entries: id → JSON_EXTRACT in metadata, code → job_family_code DIRECT_COPY/TRIM, name → job_family_name, description → job_family_description, parent_id → optional self-LOOKUP_FK if `sys_job_families` has parent FK, etc.).
6. **Run Wave 1 retry**.

Effort: **3-5h** (1h restore + 2h authoring + 1-2h re-run + validation).

## §4 — Acceptance criteria post-fix

- `sys_job_families` count: 27 (matches source).
- Audit class for `sys_job_families`: WAVE1_ALL_RULES PASSED 27 + lineage 27.
- `sys_source_lineage_records` for `source_lineage_source_table='job_families'`: 27.

## §5 — Dependencies su altri fix

- **Depends on**: nothing (root of cascade).
- **Blocks**: sys_job_roles (231 staged) → sys_esco_occupation_mappings (7645 staged) → sys_position_skill_requirements (potential downstream). Total cascade unlock: 7876+ rows.
- **Priority**: HIGHEST among the 12 — root cause of cascade for 3 other targets.
