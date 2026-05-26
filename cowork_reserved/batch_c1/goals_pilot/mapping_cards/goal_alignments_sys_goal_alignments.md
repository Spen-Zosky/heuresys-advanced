# Mapping Card — `public.goal_alignments` → `sys.sys_goal_alignments`

## Metadata
- mapping_card_id: GOALS-PILOT-MAP-06
- source: `public.goal_alignments` (100 rows)
- target: `sys.sys_goal_alignments`
- author: SDBI AI (Cowork Claude)
- confidence_overall: **0.95 HIGH** (auto-approve)

## Source semantic
- semantic_type: JUNCTION (M:N goals × goals)
- contains_pii: false
- temporal: append-only (no updated_at)
- soft_delete: NO
- constraints: source UQ `(goal_id, aligned_goal_id)` + CHECK no self-alignment

## Field mapping

| source_col | source_type | target_col | target_type | transform | confidence |
|---|---|---|---|---|---|
| id | uuid | (metadata) | jsonb | STORE_IN_METADATA | HIGH |
| tenant_id | uuid | alignment_tenant_id | uuid | LOOKUP_TENANT_ID | HIGH |
| goal_id | uuid | alignment_source_goal_id | uuid | LOOKUP_GOAL_BY_LEGACY_ID | HIGH |
| aligned_goal_id | uuid | alignment_aligned_goal_id | uuid | LOOKUP_GOAL_BY_LEGACY_ID | HIGH |
| alignment_type | varchar(50) | alignment_type | varchar(32) | UPPERCASE | HIGH (1/4 values used, target CHECK accepts all 4) |
| alignment_weight | numeric(5,2) | alignment_weight | numeric(5,2) | DIRECT_COPY | HIGH |
| created_at | timestamptz | created_at | timestamptz | DIRECT_COPY | HIGH |

## Computed
- `alignment_natural_key`: `'GOAL_ALIGNMENT::' || tenant_slug || '::' || source_id::text`
- `alignment_metadata`: `{"legacy_id": "...", "import_run_id": "..."}`

## FK resolution
- tenant: brownfield.tenant_id_mappings
- source_goal + aligned_goal: temp_sdbi.sys_goals (both resolved post-goals-insert)

## Pre-flight
- Source row count: **100**
- alignment_type distribution: 100% `supports` (1/4 enum values used)
- Cross-tenant check: 0 cross-tenant alignments
- Self-alignment check: source CHECK enforces, target CHECK re-enforces
- UQ collision: source has `unique_goal_alignment` (goal_id, aligned_goal_id) — target replicates as UQ

## Acceptance
| # | Criterion |
|---|---|
| A1 | count = 100 |
| A2 | UQ `(source_goal_id, aligned_goal_id)` no violations |
| A3 | 0 self-alignments |
| A4 | 0 cross-tenant alignments |
| A5 | Lineage rows = 100 |

## Confidence: **0.95 HIGH** — auto-approve

---
*End*
