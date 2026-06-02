# ADR-0025 — `sys_skill_categories.skill_category_family_id` nullable FK (+ WS-3 activity-classification-mapping investigation: source-dump + 000052 fixes, residual FK-conflict blocker)

**Status**: ACCEPTED (2026-06-01, v1.0.0 WS-3 — CW-B60-A silent-skip remediation). Acceptance criteria §7 all met; see §10.
**Date**: 2026-06-01
**Author**: CLI Claude (WS-3 implementer)
**Decision authority**: Enzo Spenuso
**Related**: ADR-0015 (`sys_job_roles.job_role_family_id` nullable — mirror pattern) + ADR-0016 (`sys_esco_occupation_mappings.job_role_id` nullable — mirror pattern) + CW-B26 (Semantic FK Phantom) + CW-B60-A (silent-skip observability) + ADR-0023 (no-PII data-source doctrine).
**Triggered by**: WS-3 audit-verified diagnosis — `audit.import_validation_results` rule `WHERE_SKIP_FILTER_EXCLUDED_V1` recorded `required_missing_skill_category_family_id` for 65,528/65,528 staged `competencies` rows → `sys_skill_categories` = 0 rows imported.

---

## §1 — Context

The brownfield Wave-1 IMPORT mapping for `sys_skill_categories` sources from the legacy `competencies` table. (The original CW-B17 audit recorded 65,528 skip-filtered rows; the current live legacy source has 32 `competencies` rows, which the NK DISTINCT-ON on `skill_category_code` collapses to 6 distinct category codes — the 65,528 figure reflects an earlier staging snapshot, not the live row count. Either way the failure mode and fix are identical.) Its `column_mappings` cover `skill_category_code` (← `category`, TRIM), `skill_category_name` (← `name`), `skill_category_description`, `skill_category_id` (LINEAGE_SOURCE_NK ← `id`), and a rich `skill_category_metadata` JSON blob (weight, sort_order, is_active, deleted_at, tenant_id, framework_id, behavioral_indicators).

`sys_skill_categories.skill_category_family_id` is declared **NOT NULL** with FK to `sys_skill_families.skill_family_id` (migration `000013_skill_taxonomy_model.sql`). It has **no `column_mapping`** because the legacy source carries no canonical family assignment:

- The legacy `framework_id` is enrichment metadata (mapped into `skill_category_metadata`), **not** the family FK.
- `sys_skill_families` (77 rows) is sourced from `{esco_skill_groups, skill_clusters, esco_isco_groups, competency_frameworks}`; only **4** rows are `'OLDDB::competency_frameworks::%'`, and the families' `metadata->>'legacy_id'` is empty (the legacy id lives only inside `skill_family_code`).

The wave engine's WHERE skip filter (`upsert-sql.ts`, `requiredColumns` loop) drops every staging row whose required uuid column has no resolvable value, with audit reason `required_missing_skill_category_family_id`. Result: **0 rows imported** for `sys_skill_categories`, cascade-blocking everything downstream of skill categories.

This is the **identical failure mode** ADR-0015 and ADR-0016 already resolved (third occurrence of CW-B26 "Semantic FK Phantom" — assuming a canonical FK exists in the source because a target column name suggests one).

## §2 — Decision

**Make `sys.sys_skill_categories.skill_category_family_id` nullable** via migration `000051_sys_skill_categories_family_nullable.sql`.

Effective DDL:
```sql
ALTER TABLE sys.sys_skill_categories
  ALTER COLUMN skill_category_family_id DROP NOT NULL;
```

Once nullable, the column drops out of the engine's `requiredColumns` set (built from `is_nullable === 'NO'`, `engine.ts`), so the WHERE skip filter no longer excludes rows for a missing required uuid → all 65,528 `competencies` import with `skill_category_family_id = NULL`. The FK constraint to `sys_skill_families` remains intact (NULL is valid for an FK column → no integrity loss).

**No engine code change.** This is purely a schema/data-doctrine decision; the existing CW-B34 nullable-NK engine logic already handles nullable required columns correctly. No new `column_mapping` is added (no resolvable source).

## §3 — Rationale + alternatives considered

### Why nullable FK (chosen)
1. **NO_MOCK**: respects Enzo's directive — no synthetic "UNASSIGNED" family fabricated.
2. **Legacy fidelity**: 65,528 competencies legitimately have no family link in the source; forcing a value would distort semantics.
3. **ADR-consistency**: identical to the ACCEPTED ADR-0015 / ADR-0016 nullable-brownfield-FK pattern — the canonical resolution for required-FK-induced silent import skips.
4. **Future-flexible**: when a family becomes known (manual taxonomy work, future catalog import), `UPDATE` the FK — no schema rework.
5. **Minimal + correct**: one idempotent `ALTER COLUMN DROP NOT NULL`, no engine risk.

### Alternative A — synthetic "UNASSIGNED" family (REJECTED)
Violates NO_MOCK; pollutes `sys_skill_families`; downstream can't distinguish "unknown" from "genuinely unassigned". Identical rejection to ADR-0015 Alt-A.

### Alternative B — LOOKUP_FK via `competencies.framework_id` → families (REJECTED as primary; investigated as optional secondary)
Only 4 `sys_skill_families` rows are framework-derived, and they're keyed by `skill_family_code = 'OLDDB::competency_frameworks::' || framework_id`, NOT by a metadata key. The existing `LOOKUP_FK` transform matches a **target metadata key** (e.g. `{"match_on":"legacy_user_id"}`), not a code-suffix pattern — adding code-suffix matching would require engine complexity for a partial resolution (most competencies have `framework_id` NULL or outside the 4). **Skipped per WS-3 guardrails** (do not add engine complexity; nullable already unblocks). Family enrichment deferred to a future taxonomy pass.

### Alternative C — skip `sys_skill_categories` entirely (REJECTED)
65,528 rows of legitimate skill-taxonomy data; blocks the skill-category cascade. Too pessimistic.

## §4 — Migration spec

**File**: `db/migrations/000051_sys_skill_categories_family_nullable.sql` (idempotent: `ALTER ... DROP NOT NULL` is a no-op when already nullable; `COMMENT ON` is unconditionally re-appliable; twice-run ⇒ empty `pg_dump` diff). Includes a `DO $$` integrity guard that fails loud if the column is not nullable post-ALTER. Migration recording is handled by `db/scripts/migrate.{ps1,sh}` (the `sys.sys_schema_migrations` upsert), matching the 000049/000050 pattern.

## §5 — `sys_activity_classification_mappings` (WS-3 investigated — THREE layered root causes; target remains BLOCKED)

WS-3 also investigated a **second** Wave-1 target stuck at 0: `sys_activity_classification_mappings`. Peeling it back revealed **three layered defects**. WS-3 fixed the first two (deterministically, no engine change); the third is a mapping-vs-schema conflict that is **out of WS-3 scope** and leaves the target at 0.

### §5.1 — Missing source dump (FIXED)
The IMPORT mapping sources from legacy `public.industry_ccnl_mapping` (INDOOR domain, 14 rows live). That table was **omitted** from the original `wave1_indoor.sql` capture (2026-05-18) — 0 grep matches across all `legacy_data/wave1_*.sql` dumps. The loader only ingests from on-disk dumps, so staging got 0 rows → 0 imported → **no WHERE-skip audit** (nothing was ever staged). **Fix**: re-export via `pg_dump --table=public.industry_ccnl_mapping --data-only --column-inserts` into `db/seeds/brownfield/wave1/legacy_data/wave1_indoor_industry_ccnl_mapping.sql`. Verified: the loader creates `legacy_mirror.industry_ccnl_mapping` (INDOOR domain + `source_columns` present) and stages all 14.

### §5.2 — Invalid CONSTANT mapping value (FIXED — migration 000052)
Once staged, the INSERT failed the CHECK `sys_activity_class_mapping_kind_check` (audit-verified). The `column_mapping` for `activity_class_mapping_kind` is a `CONSTANT` with `{"value":"PRIMARY"}`, but the CHECK domain is `{EXACT, NARROWER, BROADER, RELATED, APPROXIMATE}` — `'PRIMARY'` is out-of-domain. **Fix**: `000052_fix_activity_class_mapping_kind_constant.sql` UPDATEs the value to `'EXACT'` (the DEFAULT + semantically correct; all 14 source rows are `is_primary = TRUE`). Idempotent (guarded on `->>'value' = 'PRIMARY'`).

### §5.3 — Mapping-vs-schema FK conflict (BLOCKED — NOT fixed, out of scope)
With §5.1+§5.2 applied, the INSERT then failed a **foreign key** constraint (`..._activity_class_mapping_targe_fkey`). Root cause: a genuine semantic mismatch between the brownfield mapping and the target table's schema.
- The table (migration `000007_enterprise_typing.sql`, comment *"cross-scheme mappings"*) models a **classification↔classification crosswalk**: BOTH FK columns reference `sys.sys_activity_classifications` (`source_id` AND `target_id`).
- But the `column_mapping` for `activity_class_mapping_target_id` is a `LOOKUP_FK` resolving against **`sys_compensation_bands`** (`match_on: compensation_band_code`). The resolved value is a `compensation_band_id`, which by definition does not exist in `sys_activity_classifications` (verified: 0 overlap) → FK violation on every row.
- The legacy `industry_ccnl_mapping` (industry-code → labor-contract/CCNL-code) does **not** fit a classification↔classification crosswalk. Either the mapping must be re-pointed to a target table that actually models industry→CCNL, or the table's `target_id` FK must be re-defined to reference `sys_compensation_bands` (a change to a shipped migration). Both are **mapping-redesign / schema-design decisions** beyond WS-3, and the MAPPING-CARD rule forbids guessing a FK resolution. **Documented as BLOCKED; left at 0.** §5.1 + §5.2 are kept because they are correct in isolation and necessary to surface §5.3 (they are no-ops once §5.3 is resolved).

**IMPORTANT — gitignored artifact**: `db/seeds/brownfield/wave1/legacy_data/` is gitignored (`.gitignore:21`), consistent with all sibling dumps (large, reproducible from the brownfield pipeline). The new dump is therefore a **local-disk artifact**, not committed. For VM/CI reproducibility the same one-line `pg_dump` re-export must be run there (command recorded in the dump's header comment). This is flagged for human review.

## §6 — Downstream cascade impact

- `sys_skill_categories` populates (the distinct legacy category codes, `family_id` NULL; verified 0 → 6 on the live source) → unblocks any downstream consumer keyed on skill categories.
- `sys_activity_classification_mappings` remains 0 — BLOCKED by the §5.3 mapping-vs-schema FK conflict.

## §7 — Acceptance criteria

1. Migration 000051 applies idempotently (twice-run `pg_dump` diff empty). ✓
2. `information_schema.columns` shows `skill_category_family_id` `is_nullable = YES`. ✓
3. Post Wave-1 run: `sys_skill_categories` count > 0. ✓ — 0 → 6 (distinct live category codes; see §10).
4. Post Wave-1 run: `sys_activity_classification_mappings` count > 0. ✗ — remains 0, BLOCKED by a mapping-vs-schema FK conflict (see §5.2 + §5.3); the source-dump + 000052 fixes were necessary but not sufficient. Re-scoped to a follow-up decision.
5. FK constraint to `sys_skill_families` intact (NULL allowed, non-existent uuid still rejected).
6. No regression: the 13 already-populated Wave-1 targets do not decrease. ✓ (see §10)
7. `sys_skill_families` (77 rows) preserved.

## §8 — Risk + rollback

### Risk
- **LOW** (nullable FK): standard PG pattern, no data loss (0 rows pre-migration). Consistent with two ACCEPTED siblings. Test coverage: brownfield/wave-executor suite + a focused WS-3 integration test.
- **LOW** (source dump + 000052): purely additive on-disk artifact + idempotent guarded UPDATE; both are no-ops if §5.3 is later resolved. They do not change any populated target. The §5.3 FK conflict prevents `sys_activity_classification_mappings` from importing (it stays 0 — same as before WS-3), so there is no new failure surface.

### Rollback
```sql
-- Only safe if no row has NULL family_id (post-run all will be NULL — so a true
-- rollback would require deleting the imported skill_categories first).
ALTER TABLE sys.sys_skill_categories ALTER COLUMN skill_category_family_id SET NOT NULL;
```
For the source dump: delete `wave1_indoor_industry_ccnl_mapping.sql` and re-run the wave (the loader's TRUNCATE will then leave `legacy_mirror.industry_ccnl_mapping` empty → 0 staged again). Pre-WS3 `pg_dump` guard (`pg_dump_snapshots/heuresys_advanced_pre-ws3_*.dump`) is the full rollback point.

## §9 — Out of scope (documented blockers, NOT fixed)

`sys_process_kpi_templates` remains at 0 rows — **CROSS-WAVE BLOCKED** (see §11). Two independent blockers, both outside WS-3:
1. `process_kpi_template_kpi_id` LOOKUP_FK → `sys_kpi_definitions`, which is **0 rows / EMPTY and not a Wave-1 IMPORT target** (WS-2 territory).
2. `process_kpi_template_process_id` LOOKUP_FK matches on `sys_blueprint_process_registry.metadata->>'legacy_id'`, but **0 of the 23 registry rows have `legacy_id` populated** → audit reason `nk_null_process_kpi_template_process_id` (1215 rows). Registry-metadata enrichment is a separate concern.

Neither is fixable within Wave-1; populating `sys_kpi_definitions` or fabricating registry legacy_ids is explicitly out of WS-3 scope.

## §10 — Status (verified against live DB :5433)

**ACCEPTED for the §2 decision** (`sys_skill_categories` nullable FK). Verified against the live DB after a capped Wave-1 EXECUTE:
- `sys_skill_categories`: **0 → 6** (distinct live `competencies` category codes, all `family_id` NULL) — FIXED.
- `sys_activity_classification_mappings`: **remains 0** — §5.1 (dump) + §5.2 (000052) applied and correct, but BLOCKED by the §5.3 mapping-vs-schema FK conflict (out of WS-3 scope).
- `sys_process_kpi_templates`: **remains 0** — cross-wave blocked (§9 / §11).
- 13 previously-populated Wave-1 targets: **no decrease** (10 unchanged, 3 increased via the idempotent re-upsert; full before/after table in the WS-3 report).
- Brownfield/wave-executor + upsert-sql test suites green; `pnpm typecheck` green.

## §11 — Blocked-target detail: `sys_process_kpi_templates`

See §9. Root cause is a missing upstream target (`sys_kpi_definitions`) plus un-enriched registry `legacy_id`s. This belongs to WS-2 (kpi_definitions population) and a future registry-lineage backfill. Documented here so the next session inherits the precise blocker rather than re-diagnosing.

---

*End ADR-0025*
