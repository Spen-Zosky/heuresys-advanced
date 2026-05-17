# Wave 1 Execution Runbook

> **Status (2026-05-17, MVP-3 Tappa D partial)**: pre-flight check scripted, end-to-end execution planned but not yet performed. This runbook is the canonical scheduling artifact for the dedicated Wave 1 execution session.

The actual data-transformation lift is documented in `docs/brownfield/BROWNFIELD_IMPORT_PLAN.md` §3 (Wave 1 — Low-Risk Catalogs). This runbook is the operational checklist for the **execution session** itself.

## Pre-execution gate (required green)

1. SSH tunnel `localhost:5433 → OCI VM:5432` up.
2. `pnpm test` API 208/208 green (current baseline).
3. `pnpm exec playwright test` smoke + a11y green.
4. Sufficient WAL space on OCI VM PostgreSQL (~20 GB free, since Wave 1 expects ~3-5 GB of import data plus index churn).
5. **Pre-flight check passes**:

   ```bash
   # Bash / Mac / VM
   export DATABASE_URL="postgres://heuresys:***@localhost:5433/heuresys_advanced"
   bash db/scripts/brownfield-wave-1-preflight.sh

   # Windows PowerShell
   $env:DATABASE_URL = "postgres://heuresys:***@localhost:5433/heuresys_advanced"
   pwsh db/scripts/brownfield-wave-1-preflight.ps1
   ```

   The script exits 0 only when:
   - DB reachable.
   - `brownfield` schema present.
   - `brownfield.table_mappings WHERE wave=1 AND status='APPROVED'` ≥ 1.
   - Every approved mapping references a registered `brownfield.source_tables` row.
   - All 17 canonical Wave 1 target tables exist under `sys.sys_*`.
   - Informational: top 10 source tables by row count printed.

## Execution sequence (per Wave 1 §3.3-3.5)

1. **Trigger the wave run** via `POST /v1/brownfield/import-runs` with payload `{ "wave": 1, "mode": "EXECUTE" }`. This creates a row in `brownfield.import_runs` with state `RUNNING`.
2. **Stage** — for every APPROVED mapping, the import pipeline:
   - Drops + recreates `staging.<tableset>` (idempotent).
   - Bulk-inserts source rows mapped 1:1 to the canonical column shape.
3. **Validate** — `brownfield.import_validation_results` is populated with PASSED/FAIL per source row. Pass criteria for Wave 1: NOT NULL on natural keys, FK resolution, regex shape on critical fields, confidence ≥ 0.9.
4. **Approve** — Wave 1 allows auto-approve when validation 100% PASSED (recorded with `approver = 'AUTO'` in `brownfield.import_approval_decisions`).
5. **Upsert into canonical** — idempotent INSERT … ON CONFLICT (natural key) DO UPDATE SET … (evolving columns only).
6. **Lineage** — every canonical row gets a `sys.sys_source_lineage_records` entry tied to `import_run_id`.
7. **Audit** — `audit.import_events` accumulates the full event stream of the run.

## Wave 1 source → target map (full)

See `docs/brownfield/BROWNFIELD_IMPORT_PLAN.md` §3.1. Summary (≈93 source tables):

| Source domain | Source count | Canonical targets |
|---|---|---|
| ESKAP | 29 | sys_skills, sys_skill_taxonomy_edges, sys_skill_aliases, sys_esco_occupation_mappings, sys_user_education_records |
| SKILGRO | 39 | sys_skill_families, sys_skill_categories, sys_learning_modules, sys_learning_paths, sys_learning_path_steps, sys_skill_learning_mappings, sys_user_certifications |
| INDOOR | 10 | sys_activity_classifications, sys_activity_classification_mappings, sys_blueprint_overrides |
| ITLAB | 7 | sys_compensation_bands |
| PROGOV | 2 | sys_process_kpi_templates |
| OPOURSKA | 4 | sys_blueprint_process_registry, sys_job_roles |
| H2R | 2 | sys_skill_learning_mappings, sys_position_learning_requirements |

## Acceptance criteria (per §3.4)

```sql
-- 1. All wave 1 source tables present with status=APPROVED
SELECT count(*) FROM brownfield.table_mappings
 WHERE table_mapping_wave = 1 AND table_mapping_status = 'APPROVED';

-- 2. All validation results PASSED
SELECT count(*) FROM brownfield.import_validation_results
 WHERE import_validation_result_run_id IN (
   SELECT import_run_id FROM brownfield.import_runs WHERE import_run_wave = 1
 ) AND import_validation_result_status != 'PASSED';
-- → must return 0

-- 3. Every canonical row has lineage
SELECT count(*) FROM sys.sys_skills
 WHERE NOT EXISTS (
   SELECT 1 FROM sys.sys_source_lineage_records
    WHERE source_lineage_record_canonical_id = sys_skills.skill_id
 );
-- → must return 0 for every Wave-1 target with lineage tracking

-- 4. Re-running the wave produces an empty diff
-- (idempotency check — manual: run twice, then dump-diff)
```

## Rollback (per §3.5)

If validation fails irrecoverably or the canonical upsert produces unexpected
state, the rollback procedure is:

1. Mark the `brownfield.import_runs` row `state = 'FAILED'` with `failure_reason`.
2. Run the lineage-scoped corrective wave (`mode = 'CORRECTIVE_DELETE'`) that
   deletes rows from `sys.sys_*` where `sys.sys_source_lineage_records.import_run_id = :bad_run` AND no other canonical references depend on them.
3. Truncate `staging.*` of this wave.
4. Investigate, fix mappings, re-trigger.

## Effort estimate for the dedicated execution session

| Phase | Hours |
|---|---|
| Pre-flight + dry-run + sanity | 1 |
| Stage 93 source tables | 1-2 |
| Validation engine run + spot fix | 2-3 |
| Upsert into canonical | 1-2 |
| Lineage + audit | 1 |
| Idempotency proof (run twice) | 1 |
| **TOTAL** | **7-10h** |

This is the most realistic single-session lift. If validation surfaces N>0 source-level data quality issues, expect an additional 2-4h to fix mappings and reseed.

## Out of scope for Wave 1 execution

- **Wave 2** (tenant operating model — RTL_BANK_REFERENCE specifically) — separate session.
- **Wave 3-4** (sensitive tenant + cross-tenant) — gated, human approval required.
- Brownfield UI "wave runner" page in `/brownfield-adaptation` — current page is read-only viewer; trigger button lands in MVP-3.6.

## Reference

- `docs/brownfield/BROWNFIELD_IMPORT_PLAN.md` — full pipeline + 4-wave plan.
- `docs/brownfield/BROWNFIELD_ADAPTATION_MAP.md` — the mapping spec each source table must satisfy.
- `docs/brownfield/BROWNFIELD_TABLE_CLASSIFICATION_REPORT.md` — which tables are IMPORT vs REFERENCE_ONLY vs EXCLUDE.
- `db/scripts/brownfield-wave-1-preflight.{sh,ps1}` — operational pre-flight.
- `apps/api/src/modules/brownfield-{import-runs,source-exports,table-mappings}` — API surface for wave management.
