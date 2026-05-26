# Class B Diagnostic — sys_process_kpi_templates

## §1 — State summary
- Target rows now: **0**
- Source tables: `process_kpis` (81 in legacy_mirror).
- Column mappings count: **13**
- LOOKUP_FK count: **2** (`process_kpi_template_process_id` + `process_kpi_template_kpi_id`)
- JSON_EXTRACT count: 8
- LINEAGE_SOURCE_NK: 1
- Staged rows in `staging.wave1_process_kpi_templates`: **81**
- Audit rows pre-existing: WAVE1_ALL_RULES PASSED 81, HANDLED_VIA_LINEAGE_WRITE_V1 SKIPPED 1
- Required NOT NULL UUID cols: `process_kpi_template_process_id` (FK sys_blueprint_process_registry, 23 rows) + `process_kpi_template_kpi_id` (FK sys_kpi_definitions, **0 rows**).
- UQ: `(process_id, kpi_id)`

## §2 — Root cause analysis

ROOT CAUSE CATEGORY: **A (cascade prerequisite empty: sys_kpi_definitions) + B (form b lineage for process_id)**

Two compounding issues:

1. **sys_kpi_definitions is EMPTY** (0 rows). The LOOKUP_FK on `process_kpi_template_kpi_id` has `match_on="kpi_definition_code"` (plain-column form) and `target_table="sys_kpi_definitions"`. Compiler emits `(SELECT kpi_definition_id FROM sys.sys_kpi_definitions WHERE kpi_definition_code = src LIMIT 1)`. With 0 rows in sys_kpi_definitions, this always returns NULL → WHERE filter drops all 81 rows.
   - sys_kpi_definitions has NO brownfield mapping at all (per F10 §2.4 KPI universe). Source `job_kpis` 2000 + `tenant_job_kpis` 80 + `process_kpis` 81 in platform but only `process_kpis` is mapped — into sys_process_kpi_templates (the bridge) not into sys_kpi_definitions (the parent).

2. **sys_blueprint_process_registry has only 23 rows** (out of 63 staged — partial). The LOOKUP_FK on `process_kpi_template_process_id` uses `match_on="blueprint_process_metadata->>legacy_id"` form (b) → P1 lineage JOIN. But sys_blueprint_process_registry lineage coverage is unknown (likely small). Even if it works, only 23 records covered.

Evidence:
- `sys_kpi_definitions` count: 0.
- `sys_blueprint_process_registry` count: 23 (only 36% of 63 staged).
- Sample staging row: `{"id": "00883206-…", "kpi_code": "BP-EN-001-KPI-02", "kpi_name": "Accuratezza stime produzione", "process_id": "06a0a23c-…", ...}` — both `process_id` and `kpi_code` are real source values; the FK fails because sys_kpi_definitions has no row with `kpi_definition_code='BP-EN-001-KPI-02'`.

## §3 — Proposed fix

**Cascade fix**:

1. **Resolve sys_kpi_definitions first**: This is itself a TRUE GAP (Class D in F10) — needs schema authoring + extract + mapping for `job_kpis`/`tenant_job_kpis` sources. Per F10 §2.4 effort: 3T (~12-18h).
   - **Alternative**: bootstrap sys_kpi_definitions from `process_kpis.kpi_code` values themselves (extract distinct kpi codes from process_kpis → insert 1 row per unique kpi_code with derived fields, then re-run wave1).
2. **Resolve sys_blueprint_process_registry completion**: from 23 → ~26 (verify why 40 of 63 not upserted; likely lineage gaps too).
3. **Re-run Wave 1**.

Effort: **8-12h** (KPI universe bootstrap is the long pole; bridge fix is trivial once parents populated).

## §4 — Acceptance criteria post-fix

- `sys_process_kpi_templates` count: ≥ 80 (out of 81 staged).
- `sys_kpi_definitions` count: ≥ 81 distinct kpi_codes from process_kpis.
- Audit `WHERE_SKIP_FILTER_EXCLUDED_V1`: 0.

## §5 — Dependencies su altri fix

- **Depends on**: sys_kpi_definitions bootstrap (TRUE GAP) + sys_blueprint_process_registry full coverage.
- **Blocks**: KPI assignment to processes UX; performance management workstream.
