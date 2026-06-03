# SDBI seed-bundle template

Reusable skeleton for a single SDBI macro-area, promoted from the proven Goals/OKRs pilot
(`db/seeds/brownfield/sdbi/goals_pilot/`). Operational procedure: `docs/sdbi/RUNBOOK.md`.
Doctrine: `docs/architecture/adr/0014_sdbi_semantic_driven_brownfield_import.md`.

## How to use

1. Copy this directory to `db/seeds/brownfield/sdbi/<area>/` (e.g. `performance_reviews/`).
2. Replace every placeholder (legend below) — one entity per source/target table; duplicate the
   per-entity blocks for multi-table areas.
3. Author the mapping cards in Phase 2 from `mapping_card.template.md` (one per source table).
4. Apply in order `01 → 02 → 03` (RUNBOOK §3). Idempotent: re-run inserts 0 rows.

## Placeholder legend

| Placeholder | Meaning | Example |
|---|---|---|
| `<AREA>` | macro-area slug | `performance_reviews` |
| `<ENTITY>` | target entity, snake singular | `performance_review` |
| `<TARGET_TABLE>` | `sys.sys_<plural>` | `sys.sys_performance_reviews` |
| `<SOURCE_TABLE>` | legacy_mirror source table | `legacy_mirror.performance_reviews` |
| `<SOURCE_SYSTEM>` | lineage source_system | `heuresys_platform` |
| `<NK_PREFIX>` | natural-key prefix (UPPER) | `PERF_REVIEW` |
| `<MAPPING_CARD_ID>` | mapping card id | `PERFREVIEW-MAP-01` |
| `<AI_MODEL_ID>` | AI model that authored the mapping | `claude-opus-4-x` |
| `<CONFIDENCE>` | overall mapping confidence [0,1] | `0.88` |
| `<APPROVER>` | human approver handle | `enzo.spenuso@outlook.com` |

## Invariants every copy must honor

- I3/I4: target tables are `sys.sys_<plural>`; staging is `temp_sdbi.<entity>` (no FK constraints).
- I5: tenant isolation via FK only, never RLS.
- I14: legacy person = `employees`; resolve users via `LEGACY_EMP::` || employees.id (never users.id).
- RD-08: categorical = varchar + CHECK, never ENUM.
- Idempotent: `CREATE … IF NOT EXISTS`, `INSERT … ON CONFLICT … DO NOTHING|DO UPDATE`.
- Lineage rows populate the 4 SDBI columns (mig 000063); audit rows use the SDBI rule_codes.

## Files

| File | Phase | Purpose |
|---|---|---|
| `01_temp_sdbi_ddl.sql` | 3 | `CREATE TABLE temp_sdbi.<entity>` mirror (no FK), TRUNCATE-able staging |
| `02_phase3_temp_sdbi_seed.sql` | 3 | create SDBI import_run + `INSERT…SELECT` from legacy_mirror into temp_sdbi |
| `03_phase5_consolidation.sql` | 5 | consolidate temp_sdbi → sys.* + lineage (4 SDBI cols) + audit (SDBI rule_codes) |
| `mapping_card.template.md` | 2 | per-source-table field mapping card (ADR-0014 §3.6) |
