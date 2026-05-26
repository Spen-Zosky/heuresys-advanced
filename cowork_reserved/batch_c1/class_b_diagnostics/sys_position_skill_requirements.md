# Class B Diagnostic — sys_position_skill_requirements

## §1 — State summary
- Target rows now: **0**
- Source tables (6 sources):
  - `job_template_skills` (28983 in legacy_mirror) — LARGEST single source in Wave 1 by row count
  - `skill_requirements_templates` (8)
  - `esco_occupation_skills` (126051 in mirror — but only 4 col_mappings + 1 LOOKUP_FK, mostly metadata)
  - `onet_occupation_skills` (71)
  - `onet_occupation_abilities` (215)
  - `onet_occupation_knowledge` (279)
  - `onet_occupation_work_activities` (218)
- Column mappings count: **53** (10 + 14 + 5 + 6 + 6 + 6 + 6)
- LOOKUP_FK count: **4** (2 on job_template_skills: tenant + 1 more; 2 on skill_requirements_templates: tenant + 1 more; 0 on each ONET source; 1 on esco_occupation_skills; 1 on onet_occupation_skills)
- JSON_EXTRACT count: 30
- DIRECT_COPY: 6
- LINEAGE_SOURCE_NK: 7
- Staged rows in `staging.wave1_position_skill_requirements`: **NONE — staging table does not exist** (verified above; not in pg_stat_user_tables list).
- Audit rows pre-existing: 0 (target absent from `wave_executor.stats` in latest run).
- Required NOT NULL UUID cols: `position_id` + `position_skill_requirement_tenant_id` + `skill_id`.
- UQ: `(position_id, skill_id)`.

## §2 — Root cause analysis

ROOT CAUSE CATEGORY: **F (staging table missing / not in whitelist)** — and **A (sys_positions only 161 rows; cascade gap)** secondary.

Critical: this target is in `brownfield.table_mappings` with 53 col_mappings, but **never staged** in any Wave 1 run. There is no `staging.wave1_position_skill_requirements` table. This means either:
(a) the stagingTableFor() whitelist in `repository.ts` excludes this target by name, OR
(b) the table_mapping is registered but the table_mapping_approval_status / wave is misconfigured, OR
(c) the engine skipped the stage phase for it.

Evidence:
- Listed in `brownfield.table_mappings`: yes, 6 source_table table_mappings exist.
- `staging.wave1_position_skill_requirements` table: not in `pg_stat_user_tables` schema='staging'.
- Latest run 08d3bc9f wave_executor.stats: no entry for `sys_position_skill_requirements` (per F10 §3 silent-skip table — confirmed absent).
- F10 §2.3 Position skill requirements: "silent-skip on position_skill_requirements / transform issue" — confirms target not surfaced.

Even if stage was fixed:
- `sys_positions` count: 161 (subset). Most source rows from `job_template_skills` reference `job_template_id` (140 templates), not `position_id` (161 positions seeded via test-admin).
- Semantic mismatch: source records are SKILL-REQUIRED-FOR-JOB-TEMPLATE, but target is SKILL-REQUIRED-FOR-POSITION. Bridge layer (job_template ↔ position) is unclear.

## §3 — Proposed fix

**Investigation-first fix**:

1. **Verify staging table whitelist**: `Read apps/api/src/modules/brownfield-wave-executor/repository.ts` `stagingTableFor()` function — check if `sys_position_skill_requirements` is in the allow-list. If absent, add it + create the staging table via migration (idempotent CREATE IF NOT EXISTS).
2. **Verify table_mappings approval**: `SELECT table_mapping_approval_status, table_mapping_wave FROM brownfield.table_mappings WHERE table_mapping_target_table='sys_position_skill_requirements'` — must be `APPROVED` + wave=1.
3. **Resolve sys_positions architectural gap**: decide if `job_template_id` → `position_id` mapping is via lineage, direct-mapping table, or if positions need to be expanded.
4. **Author position_id LOOKUP_FK** on all 6 sources (currently missing).
5. **Re-run Wave 1**.

Effort: **8-15h** (investigation + whitelist fix + semantic decision + authoring 6+ FK mappings + run + validation).

**Alternative SDBI path**: per F10 TOP 10 rank #2, this is HIGH priority. Consider authoring under SDBI workflow with AI-assisted matching since the semantic bridge (job_template ↔ position) needs human review anyway.

## §4 — Acceptance criteria post-fix

- `sys_position_skill_requirements` count: ≥ 1000 (subset of 30k source after dedup on (position_id, skill_id)).
- `staging.wave1_position_skill_requirements` table exists and has staged rows.
- All 6 source_tables represented in lineage.

## §5 — Dependencies su altri fix

- **Depends on**: staging table whitelist verification (might be just a config gap); sys_positions cardinality decision (architectural); sys_skills lineage coverage.
- **Blocks**: Position-centric I1 invariant workforce planning UX (HIGHEST architectural value per F10 TOP 10 rank #2).
