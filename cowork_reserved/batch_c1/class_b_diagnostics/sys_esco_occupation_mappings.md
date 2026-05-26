# Class B Diagnostic — sys_esco_occupation_mappings

## §1 — State summary
- Target rows now: **0**
- Source tables:
  - `esco_occupations` (3040 in legacy_mirror)
  - `onet_occupations` (25)
  - `onet_esco_mappings` (135 — also a source for sys_skill_taxonomy_edges)
  - `occupation_industry_classifications` (4565)
  - `industry_occupation_mapping` (15)
- Column mappings count: **53** (20 + 17 + 10 + 6 + + N — table shows 4 sources, the 5th aggregates)
- LOOKUP_FK count: **0** (!)
- JSON_EXTRACT count: 33
- LINEAGE_SOURCE_NK: 5
- SKIP: 5 (in esco_occupations: 4; onet_occupations: 1)
- Staged rows in `staging.wave1_esco_occupation_mappings`: **7645** (largest silent skip)
- Audit rows pre-existing: WAVE1_ALL_RULES PASSED 7645, HANDLED_VIA_LINEAGE_WRITE_V1 SKIPPED 5
- Required NOT NULL UUID col: `esco_occupation_mapping_job_role_id` (FK to sys_job_roles)
- UQ: `(job_role_id, esco_uri)`

## §2 — Root cause analysis

ROOT CAUSE CATEGORY: **A (cascade prerequisite empty) + F (no FK mapping)**

CASCADE BLOCKER: `sys_job_roles` is EMPTY (0 rows). The required NOT NULL UUID column `esco_occupation_mapping_job_role_id` cannot resolve any value, regardless of mapping authoring, until sys_job_roles is populated.

In addition:
- ZERO LOOKUP_FK mappings exist in the 53 column_mappings → even if sys_job_roles were populated, there's no resolution path for the FK.
- WHERE skip filter at upsert-sql.ts:411 pushes "FALSE" → all 7645 rows dropped.

Evidence:
- `sys_job_roles count` = 0 (verified).
- `SELECT COUNT(*) FROM brownfield.column_mappings cm JOIN brownfield.table_mappings tm ON tm.table_mapping_id=cm.column_mapping_table_mapping_id WHERE tm.table_mapping_target_table='sys_esco_occupation_mappings' AND cm.column_mapping_transform='LOOKUP_FK'` → 0.

Note: this is the LARGEST silent skip in the latest run (7645 rows = 18.5% of all staged).

## §3 — Proposed fix

**Two-step cascade fix**:

1. **First fix sys_job_roles** (see its own diagnostic file): requires populating sys_job_families first (no mapping exists → seed/migration needed), then re-mapping sys_job_roles.
2. **Then author LOOKUP_FK mappings here**: for each source, identify the column that links to a job role. Most likely `esco_uri` / `isco_code` / `occupation_code` → match_on=`job_role_external_code` or similar. Without sys_job_roles populated AND with a `job_role_external_code` column or lineage entries, the FK cannot resolve.

Effort: **6-10h** (dependent on sys_job_roles being resolved first; then 3-4h mapping authoring + re-run).

**Alternative architecture decision**: relax `esco_occupation_mapping_job_role_id` to NULLABLE. Reasoning: ESCO occupations exist independent of organizational job roles — the mapping is a *catalog enrichment* not a *organizational fact*. This would unblock the import while preserving join-on-demand semantics. This requires a new migration.

Effort if nullable approach: **2-3h** (1 migration + re-run, no FK authoring needed).

## §4 — Acceptance criteria post-fix

- `sys_esco_occupation_mappings` count: ≥ 3000 (subset of 3040 esco_occupations + 25 onet_occupations).
- All 5 source_tables represented.
- Audit `WHERE_SKIP_FILTER_EXCLUDED_V1`: 0 OR `LOOKUP_FK_UNRESOLVABLE` documented for orphans.

## §5 — Dependencies su altri fix

- **Depends on**: sys_job_roles (cascade chain root: sys_job_families → sys_job_roles → sys_esco_occupation_mappings) — see sys_job_families.md + sys_job_roles.md.
- **Blocks**: career path discovery, recruiting requisitions matching, occupation taxonomy UX.
