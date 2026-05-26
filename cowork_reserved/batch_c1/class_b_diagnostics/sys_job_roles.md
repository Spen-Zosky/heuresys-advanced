# Class B Diagnostic — sys_job_roles

## §1 — State summary
- Target rows now: **0**
- Source tables:
  - `job_templates` (140 in legacy_mirror)
  - `ccnl_job_title_mapping` (91 in legacy_mirror)
- Column mappings count: **43** (34 + 9)
- LOOKUP_FK count: **0** (!)
- JSON_EXTRACT count: 28
- LINEAGE_SOURCE_NK: 2
- SKIP: 4
- CAST_VARCHAR: 1
- Staged rows in `staging.wave1_job_roles`: **231** (140+91)
- Audit rows pre-existing: WAVE1_ALL_RULES PASSED 231, HANDLED_VIA_LINEAGE_WRITE_V1 SKIPPED 2
- Required NOT NULL UUID col: **`job_role_family_id`** (FK to sys_job_families, which is EMPTY)
- UQ: `job_role_code`

## §2 — Root cause analysis

ROOT CAUSE CATEGORY: **A (cascade prerequisite empty: sys_job_families)**

The required NOT NULL UUID column `job_role_family_id` points to `sys_job_families` which has **0 rows** AND has **0 brownfield mappings**. The cascade chain is fundamentally broken at its root: `sys_job_families` has no mapping authored (source `job_families` 27 rows exists in PLATFORM but NOT in legacy_mirror).

In addition:
- ZERO LOOKUP_FK mappings on sys_job_roles → no resolution path for `job_role_family_id` even if sys_job_families were populated.
- WHERE filter pushes "FALSE" → all 231 rows dropped.

Evidence:
- `sys_job_families` row count: 0.
- `brownfield.table_mappings WHERE target='sys_job_families'`: 0 entries.
- `legacy_mirror.job_families`: table either missing or empty (need to verify — likely 6th MIRROR GAP).
- `heuresys_platform.public.job_families`: 27 rows (per F10 §2.3 + verification).

## §3 — Proposed fix

**Three-step cascade fix**:

1. **Resolve sys_job_families** (see its own diagnostic): extract source `job_families` (27 rows) from platform to mirror, author table_mapping + column_mappings, run wave 1 for it.
2. **Author LOOKUP_FK on sys_job_roles**: for each source, map a job-family-discriminator column to `job_role_family_id`. Example for `job_templates`: `category` column (text) → `match_on=job_family_code target_table=sys_job_families`. For `ccnl_job_title_mapping`: `ccnl_category_code` → similar.
3. **Re-run Wave 1**.

Effort: **5-8h** (3h for sys_job_families bootstrap + 2-3h authoring on sys_job_roles + 1-2h re-run).

**Alternative**: same as sys_esco_occupation_mappings — relax `job_role_family_id` to NULLABLE if the family-grouping is enrichment-only. Decision is architectural (do we need every job_role bound to a family?).

## §4 — Acceptance criteria post-fix

- `sys_job_roles` count: ≥ 140 (job_templates).
- `sys_job_families` count: ≥ 27.
- Audit `WHERE_SKIP_FILTER_EXCLUDED_V1`: 0.

## §5 — Dependencies su altri fix

- **Depends on**: sys_job_families bootstrap.
- **Blocks**: sys_esco_occupation_mappings (7645 silent skipped); sys_position_skill_requirements (downstream); career path discovery; recruiting matching.
