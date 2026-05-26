# ADR-0020 — Wave-2 scope for application-level targets (CW-B60-B closure)

**Status**: ACCEPTED
**Date**: 2026-05-26
**Author**: Cowork session S935 phase B
**Related**: CW-B60-B (bias_registry §2 entry 60), MVP_4_ROADMAP §2.1, ADR-0014 SDBI semantic-driven brownfield import
**Triggered by**: S933 PREFLIGHT_REPORT §5 P0-3 candidate; S934 silent-skip observability fix (CW-B61) made the (B)-part of CW-B60 stand out as next forensic gap.

---

## §1 — Context

CW-B60 (X19 Brownfield Wave 1 re-run, run `6f561559`, 2026-05-25) surfaced a two-part residual. Part **(A)** — silent-filter on `executeUpsertSqlSidePerMapping` rowCount=0 — was closed by CW-B61 in S934 (`apps/api/src/modules/brownfield-wave-executor/upsert-sql.ts:763` audit + WARN emission).

Part **(B)** is structural: 3 `IMPORT/APPROVED` mappings in `brownfield.table_mappings` target sys tables that have **no `staging.wave1_<short>` table** in the engine whitelist (`apps/api/src/modules/brownfield-wave-executor/repository.ts::stagingTableFor` returns null for them). The result is a silent `continue` at `engine.ts:764`, producing no audit row, no log, and zero rows imported even when source data exists.

The 3 affected targets:

| # | Target | Mapped legacy sources (count) | Schema origin (NOT NULL FKs) |
|---:|---|---|---|
| 1 | `sys_blueprint_overrides` | 4+ (`benchmark_configs`, `benchmark_reports`, `holidays`, `tenant_industries`) | `sys_blueprint_activations` + `sys_blueprint_process_registry` + `sys_users.created_by` |
| 2 | `sys_position_skill_requirements` | 6+ (`esco_occupations`, `job_templates`, `onet_occupation_*`, `skill_req_templates`) | `sys_positions` + `sys_tenancies` + `sys_skills` (FK by `skill_id`) + `sys_users.created_by` |
| 3 | `sys_position_learning_requirements` | 2+ (`learning_bookmarks`, `job_title_path` patterns) | `sys_positions` + `sys_tenancies` + `sys_learning_paths` (FK by `learning_path_id`) + `sys_users.created_by` |

These mappings were seeded by **subagent A bootstrap** (`db/seeds/brownfield/wave1/03_table_mappings.sql`) with `natural_key_pattern` strings derived from legacy table semantics — but the engine never had matching staging tables to receive their data. The Wave-1 universe was never expanded to cover them; nor was an explicit Wave-2 plan written.

This ADR closes that gap.

---

## §2 — Schema analysis: are these tables IMPORT material at all?

The schema definitions in `db/migrations/000008_blueprint_catalog.sql §5`, `000011_position_model.sql §3`, `000014_position_skill_requirements.sql` reveal a uniform pattern that diverges from the other 18 Wave-1 targets:

1. **`created_by` / `updated_by` FK to `sys_users`**. All 3 carry user audit columns (`created_by uuid REFERENCES sys.sys_users(user_id) ON DELETE SET NULL`). The 18 Wave-1 catalog tables (skills, families, kpi templates, etc.) do **not** carry user-attribution columns — they're system catalogs populated by legacy data, not by user actions.
2. **Tenant-scoped activation/position dependencies**. Each row points to a tenant-active entity (`sys_blueprint_activations` is per-tenant; `sys_positions` is tenant-scoped). The 18 Wave-1 catalogs are mostly global (`_is_global=true`, `_tenant_id=NULL` allowed).
3. **Business-process semantics**. `blueprint_overrides` are decisions made by a tenant admin when activating a blueprint ("include this process? exclude that one?"). `position_*_requirements` are HR decisions made when defining a job position ("require this skill at PROFICIENT level"). These are **operational data**, not **reference data**.
4. **No legacy 1:1 correspondence**. The proposed legacy sources (`benchmark_configs`, `esco_occupations`, `onet_occupation_*`) are **adjacent semantic domains** that *could feed into* application-level decisions, but mapping them 1:1 to these tables would forge data the original users never produced.

**Verdict from schema**: the 3 targets are **application-level operational data**, not reference data eligible for brownfield import in any Wave.

---

## §3 — Decision

**Reclassify the 3 targets from `IMPORT/APPROVED` to `REFERENCE_ONLY/APPROVED` in `brownfield.table_mappings`.**

All `brownfield.table_mappings` rows where `table_mapping_target_table IN ('sys_blueprint_overrides', 'sys_position_skill_requirements', 'sys_position_learning_requirements')` get their `table_mapping_kind` updated to `REFERENCE_ONLY`. The mapping records (linking legacy source tables to these targets) are preserved as **documentary lineage** — they record that the legacy data was *considered* and *deemed not directly importable* — but the engine will no longer attempt to import them.

The reclassification migration is **idempotent** and **non-destructive**: it only flips a `varchar(32)` enum-like column value; nothing is deleted.

Additionally:
- `cowork_reserved/bias_registry.md` §2 entry CW-B60-B is reclassified to **MITIGATED via ADR-0020**.
- `docs/MVP_4_ROADMAP.md §2.1 Wave 2` is amended to note that these 3 targets are **explicitly NOT in Wave-2 scope** either — they are application-level and will be populated by user actions in MVP-4 features (blueprint activation UI, position editor UI, training-requirements editor UI).
- An **engine improvement is deferred** (not blocking): `engine.ts:764` should emit a `logger.warn` when `stagingTableFor(target)===null` for any `IMPORT` mapping (the only legitimate case after this ADR is `REFERENCE_ONLY` mappings, which `executeStage`/`executeApprove`/`executeUpsert` should skip silently by design — but a warning will catch future drift if anyone re-introduces an `IMPORT` mapping without a staging table).

---

## §4 — Alternatives considered

### Alt-1 — Wave-2 import (formal expansion of staging whitelist)

Create `staging.wave1_blueprint_overrides`, `staging.wave1_position_skill_requirements`, `staging.wave1_position_learning_requirements`. Implement `executeStage` queries that map legacy sources (benchmark_configs / esco_occupations / etc.) into these staging tables, then run the same generic pipeline.

**Why rejected**:
- Semantic mismatch: `benchmark_configs` is not a `blueprint_override`. Forcing the mapping would forge data with synthetic `blueprint_override_inclusion = 'IN'` defaults and dummy `created_by` users (which user did this override? no answer in legacy data). This violates the auditability contract the schema's `created_by` FK encodes.
- `position_skill_requirements` from `esco_occupations`: ESCO is a global occupation taxonomy (~3k occupations × ~13k skills). Mapping these to a tenant's `sys_positions` would require fabricating tenant-position associations that don't exist in legacy. Result: garbage at scale.
- Tooling cost: 3 new migrations + 3 new staging table definitions + ~9 new column_mappings rows per target + new transform logic for FK lookups to non-Wave-1 parents (`sys_positions`, `sys_blueprint_activations`). Estimated 4-6h effort for data nobody asked for.

### Alt-2 — Computed views (MATERIALIZED VIEW pattern from ADR-0008 PIP)

Define each target as a `MATERIALIZED VIEW` over derived inputs (`position_skill_requirements` as a computed projection from `esco_occupations × esco_occupation_skills × sys_job_role_esco_mappings × sys_positions`).

**Why rejected**:
- Schema contract collision: the 3 tables exist as **regular tables** in migrations 8/11/14. They have user-attribution columns (`created_by`, `updated_by`) that no computed view can populate. To make them views we'd need to drop the tables and replace them — destructive schema change with cascading FK impact.
- Design intent: these tables are designed to be **user-editable** (UI: "add a skill requirement to this position"). Views would block user inserts/updates.
- ADR-0008 PIP pattern applies to **derived analytics projections** (read-only synthesis of multi-table data for dashboards). It does not apply to **operational tables** where rows are individually authored.

### Alt-3 — Status quo (leave as `IMPORT/APPROVED` + silent skip)

Do nothing; let `engine.ts:764` silently skip these and document the discrepancy in `HANDOFF.md`.

**Why rejected**:
- Silent skip is exactly the observability anti-pattern S934 fixed for (A). Leaving (B) as silent skip would be inconsistent.
- Future engine refactors might tighten `stagingTableFor` to raise instead of return null — that would crash on these mappings. Better to fix the root data classification.
- New developers reading `brownfield.table_mappings` would expect `IMPORT/APPROVED` mappings to actually import; they don't. False signal in the data model.

### Alt-4 — Hybrid (one target each strategy)

Could there be a meaningful split (blueprint_overrides=REFERENCE_ONLY, position_skill_requirements=Wave-2 via ESCO, position_learning_requirements=computed)? Considered briefly.

**Why rejected**: the 3 share the same architectural signature (user-attribution + tenant-scoped + operational). A uniform decision is simpler to reason about, easier to test, and resilient to future schema evolution. Splitting strategies risks "exception fatigue" in the engine and in the brownfield documentation.

---

## §5 — Consequences

### Positive

- **Engine silent-skip path coverage**: combined with CW-B61 (S934), the engine now has zero unexplained silent paths in the Wave-1 happy path. Every `0 upserted` outcome has either an audit row (`SILENT_UPSERT_ZERO_ROWS_V1` for INSERT rowCount=0) or a deliberate `REFERENCE_ONLY` classification (skipped by design).
- **Data classification honesty**: `brownfield.table_mappings.table_mapping_kind` becomes a reliable signal — `IMPORT` truly means importable, `REFERENCE_ONLY` truly means documentary.
- **Future engine simplification**: a follow-up could enforce `stagingTableFor(target)!==null` as a database `CHECK` constraint on `IMPORT` mappings via `validation_views_and_checks` migration pattern. This ADR makes that future tightening safe.
- **Brownfield contract clarity**: subagent-A bootstrap output (the 3 problematic mappings) is reclassified rather than deleted — the historical decision-making trail is preserved as documentary lineage.

### Negative

- **No new imported data**: 0 rows added to any of the 3 sys tables from this migration. They will remain empty until MVP-4 application features populate them via user UI.
- **Test surface change**: any future test that asserts `sys_blueprint_overrides` is populated from a Wave-1 import will need to be rewritten to either skip the assertion or seed application-level fixtures.
- **Discovery cost**: developers grep'ing `brownfield.table_mappings WHERE target='sys_position_skill_requirements'` will see `REFERENCE_ONLY` rows pointing at ESCO/ONET tables — must read this ADR to understand why.

### Neutral

- The CW-B60-B bias entry transitions from `PENDING Wave-2 scope decision` to `MITIGATED via ADR-0020`. Effective valid bias count moves from 60 → 60 (no new bias, status flip only).
- MVP-3 Tappa D 13/19 IMPORT closure status remains valid: with 3 targets reclassified to REFERENCE_ONLY, the IMPORT denominator drops from 19 to 16, and 13/16 = 81% IMPORT closure (was 13/19 = 68%). This is a presentation refinement only; the data outcome is unchanged.

---

## §6 — Implementation

### Migration: `db/migrations/000044_cw_b60_b_reclassify_application_level_targets.sql`

Idempotent UPDATE on `brownfield.table_mappings.table_mapping_kind` for the 3 affected targets. Rationale captured in the `table_mapping_rationale` column suffix.

### Engine doc update

`apps/api/src/modules/brownfield-wave-executor/repository.ts::stagingTableFor` gets a JSDoc note pointing to this ADR for the "returns null is expected for REFERENCE_ONLY targets" contract.

### Bias registry update

`cowork_reserved/bias_registry.md` §2 entry 60 part (B) reclassified to **MITIGATED via ADR-0020**. Tally remains 60 catalogued / 42 mitigated.

### MVP_4_ROADMAP amendment

`docs/MVP_4_ROADMAP.md §2.1 Wave 2` adds an explicit "Out of scope" sub-section listing these 3 targets.

---

## §7 — Verification (post-migration)

```sql
-- 1. The 3 targets are now REFERENCE_ONLY.
SELECT table_mapping_target_table, table_mapping_kind, count(*)
  FROM brownfield.table_mappings
 WHERE table_mapping_target_table IN (
   'sys_blueprint_overrides',
   'sys_position_skill_requirements',
   'sys_position_learning_requirements'
 )
 GROUP BY table_mapping_target_table, table_mapping_kind
 ORDER BY table_mapping_target_table;
-- Expected: 3 rows, all with table_mapping_kind = 'REFERENCE_ONLY'.

-- 2. No IMPORT mappings reference a sys target without a Wave-1 staging table.
SELECT table_mapping_target_table
  FROM brownfield.table_mappings
 WHERE table_mapping_kind = 'IMPORT'
   AND table_mapping_target_table NOT IN (
     'sys_skills','sys_skill_families','sys_skill_categories',
     'sys_skill_taxonomy_edges','sys_skill_aliases',
     'sys_learning_modules','sys_learning_paths','sys_learning_path_steps',
     'sys_skill_learning_mappings','sys_user_certifications',
     'sys_esco_occupation_mappings','sys_activity_classifications',
     'sys_activity_classification_mappings','sys_compensation_bands',
     'sys_process_kpi_templates','sys_blueprint_process_registry',
     'sys_job_roles','sys_job_families'
   );
-- Expected: 0 rows.

-- 3. Engine dry-run on a fresh import_run for these 3 targets emits no audit
--    rows of kind 'SILENT_UPSERT_ZERO_ROWS_V1' (because REFERENCE_ONLY skips
--    the upsert phase entirely, not just rowCount=0).
```

---

## §8 — Related decisions

- **ADR-0014 SDBI** — semantic-driven brownfield import. This ADR refines the SDBI doctrine by adding "application-level operational data" as an explicit out-of-scope category.
- **ADR-0012 brownfield_table_mapping_wave_column** — the wave classification mechanism this ADR uses (`REFERENCE_ONLY` value).
- **CW-B61 (S934)** — silent-skip observability fix; pairs with this ADR to close the CW-B60 forensic gap end-to-end.
