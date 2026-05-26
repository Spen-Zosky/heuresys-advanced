# Class B Diagnostic — sys_blueprint_overrides

## §1 — State summary
- Target rows now: **0**
- Source tables (heterogeneous, 4 sources):
  - `benchmark_configs` (8)
  - `benchmark_reports` (4)
  - `holidays` (144)
  - `tenant_industry_classifications` (4 — restored post-C1.4)
- Column mappings count: **53** (13 + 21 + 13 + 6)
- LOOKUP_FK count: **1** (only on `benchmark_reports.created_by` → sys_users via legacy_user_id — Goal 003 Item A fallback path)
- JSON_EXTRACT count: 43 (most data goes into `blueprint_override_metadata` jsonb)
- LINEAGE_SOURCE_NK: 4
- Staged rows: **0** (target absent from staging; not in pg_stat_user_tables list).
- Audit rows pre-existing: 0 (not surfaced in wave_executor.stats latest run).
- Required NOT NULL UUID cols: `blueprint_override_activation_id` + `blueprint_override_process_id`.
- UQ: `(activation_id, process_id)`.

## §2 — Root cause analysis

ROOT CAUSE CATEGORY: **A (cascade prerequisite empty: sys_blueprint_activations) + F (zero FK mappings for required UUID cols) + F (staging table missing)**

Three compounding issues:

1. **sys_blueprint_activations is EMPTY** (0 rows). No source mapping exists for it in brownfield. Required NOT NULL UUID `blueprint_override_activation_id` cannot resolve to anything.
2. **NO LOOKUP_FK mappings** for either `blueprint_override_activation_id` OR `blueprint_override_process_id`. The only LOOKUP_FK is on `created_by` (a non-NK, non-required column). WHERE filter pushes "FALSE" for both required cols.
3. **Semantic incoherence**: source tables are extremely heterogeneous (benchmark_configs, benchmark_reports, holidays, tenant_industry_classifications) — none of them logically represent "blueprint_override" entities. This appears to be a placeholder authoring (53 col_mappings dump all source columns into `blueprint_override_metadata` jsonb without intent).
4. **Staging table missing**: `staging.wave1_blueprint_overrides` is not in pg_stat_user_tables list — same condition as sys_position_skill_requirements (whitelist/init gap).

Evidence:
- `sys_blueprint_activations` row count: 0.
- `sys_blueprint_process_registry` row count: 23 (partial, see its own area).
- Column mappings: 0 of 53 maps to `blueprint_override_activation_id` or `blueprint_override_process_id`.
- F10 §2.8: "Blueprint overrides | B | … source partially-empty + cascade" — confirmed.

## §3 — Proposed fix

**Strategic decision required (architectural)**:

**Option A — Defer to SDBI/Class D**: this target's semantic intent is unclear; the 4 source tables don't naturally form "blueprint overrides". Mark as INFEASIBLE in Wave 1, move authoring to SDBI Phase 2 with AI-assisted semantic alignment.

**Option B — Re-author from scratch**: 
1. Define what a "blueprint override" semantically is (likely: tenant-specific override of platform blueprint defaults — would map to NEW source tables, not the 4 heterogeneous ones).
2. Drop existing 53 column_mappings (CASCADE via brownfield FK).
3. Bootstrap sys_blueprint_activations first (no source → seed-driven, or new mapping for new source).
4. Re-author 4 source mappings for the right tables OR drop them.

**Option C — Quick-fix tactical**: keep current 53 mappings as is, add 2 LOOKUP_FK on each source pointing to sys_blueprint_activations (dummy seed 1 row) + sys_blueprint_process_registry (lineage JOIN). Result: 4 rows in sys_blueprint_overrides with metadata blob, no meaningful semantic content.

Effort: A=0h (defer); B=12-20h (re-architect); C=4-6h (tactical bandaid).

**Recommendation**: A (defer to SDBI Class D). The current authoring appears to be exploratory/placeholder rather than production-intent.

## §4 — Acceptance criteria post-fix

If A: `sys_blueprint_overrides` count remains 0; documented as DEFERRED in F10/F11. Audit class `DEFERRED_TO_SDBI_V1`.
If C: `sys_blueprint_overrides` count ≥ 4 (1 per non-empty source).
If B: design-driven; ≥ N matching new semantic intent.

## §5 — Dependencies su altri fix

- **Depends on**: sys_blueprint_activations bootstrap (TRUE GAP); semantic decision on intent.
- **Blocks**: tenant-specific blueprint customization UX (low priority per F10).
