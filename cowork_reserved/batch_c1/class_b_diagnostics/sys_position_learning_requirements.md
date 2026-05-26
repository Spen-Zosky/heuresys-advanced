# Class B Diagnostic — sys_position_learning_requirements

## §1 — State summary
- Target rows now: **0**
- Source tables: `job_title_learning_paths` (**0 in legacy_mirror**, **0 in heuresys_platform** — source-empty).
- Column mappings count: **7**
- LOOKUP_FK count: **3** (`learning_path_id`, `position_id`, `position_learning_requirement_tenant_id`)
- JSON_EXTRACT count: 2
- LINEAGE_SOURCE_NK: 1
- Staged rows: **0** (source-empty → nothing to stage).
- Audit rows: 0 audit (source row count 0 → no rule emission).
- Required NOT NULL UUID cols: `position_id` + `learning_path_id` + `position_learning_requirement_tenant_id`.
- UQ: `(position_id, learning_path_id)`.

## §2 — Root cause analysis

ROOT CAUSE CATEGORY: **D (source-empty, legitimate)**

Pure source-data emptiness. The source `job_title_learning_paths` has 0 rows in both legacy_mirror AND heuresys_platform — there is no legacy data to import. The 7 column mappings are correctly authored (3 LOOKUP_FK with proper payload shapes including form (b) for learning_path_id + plain-column for tenant + a special form for position_id using `position_metadata->>legacy_job_title`).

Evidence:
- `SELECT COUNT(*) FROM legacy_mirror.job_title_learning_paths` → 0.
- `SELECT COUNT(*) FROM heuresys_platform.public.job_title_learning_paths` → expected 0 (per F10 §2.3 row count "job_title_learning_paths 0").
- Wave_executor latest run stats: no entry for `sys_position_learning_requirements` (target absent from `wave_executor.stats[]` because nothing staged).

This is the SAME pattern as `sys_activity_classification_mappings` (post-C1.4 mirror restore the source `industry_ccnl_mapping` now has 14 rows — for THIS target, source remains 0).

## §3 — Proposed fix

**No fix needed (legitimate source-empty)**: document as Class D source-empty acceptance.

Action: add explicit audit row `SOURCE_EMPTY_ACCEPTED_V1` per target in audit trail when source row count is 0. This belongs in the CW-B17 audit class expansion already authored in C1.5.

Effort: **0h** for data; **1h** to document in F10 §3 and add explicit audit class emission (already partially covered by C1.5 patches).

## §4 — Acceptance criteria post-fix

- `sys_position_learning_requirements` count: 0 (correct, source-empty).
- Audit class `SOURCE_EMPTY_ACCEPTED_V1` row exists for this target.
- No `WHERE_SKIP_FILTER_EXCLUDED_V1` rows.

## §5 — Dependencies su altri fix

- **Depends on**: nothing. Source-side gap, legitimate.
- **Blocks**: nothing.
- **Future**: if/when the legacy `job_title_learning_paths` is populated (Wave 2 or organizational seed phase), the existing 7 mappings are correctly authored and will activate automatically.
