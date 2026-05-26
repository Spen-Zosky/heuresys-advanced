# Mapping Card — `public.goal_milestones` → `sys.sys_goal_milestones`

## Metadata
- mapping_card_id: GOALS-PILOT-MAP-02
- source: `heuresys_platform.public.goal_milestones` (1000 rows)
- target: `heuresys_advanced.sys.sys_goal_milestones`
- author: SDBI AI (Cowork Claude)
- approver: PENDING (Enzo)
- confidence_overall: **0.95 HIGH** (auto-approve)
- workflow_phase: 2

## Source semantic analysis
- semantic_type: SUB-ENTITY (composition of goal)
- contains_pii: false
- temporal: snapshot + completed_at event
- soft_delete: NO
- ratio: 1000 milestones / 400 distinct goals = avg 2.5 milestones/goal

## Field mapping

| source_col | source_type | target_col | target_type | transform | confidence | reasoning |
|---|---|---|---|---|---|---|
| id | uuid | (legacy_id in metadata) | jsonb | STORE_IN_METADATA | HIGH | new uuid generated |
| tenant_id | uuid | milestone_tenant_id | uuid | LOOKUP_TENANT_ID | HIGH | proven path |
| goal_id | uuid | milestone_goal_id | uuid | LOOKUP_GOAL_BY_LEGACY_ID | HIGH | resolved via temp_sdbi mapping post-goals-insert |
| title | varchar(255) | milestone_title | varchar(255) | DIRECT_COPY + TRIM | HIGH | |
| description | text | milestone_description | text | DIRECT_COPY | HIGH | |
| target_date | date | milestone_target_date | date | DIRECT_COPY | HIGH | |
| completed_at | timestamptz | milestone_completed_at | timestamptz | DIRECT_COPY | HIGH | source already TZ-aware |
| status | varchar(20) | milestone_status | varchar(32) | UPPERCASE | HIGH | 4 source values fit target (PENDING, COMPLETED, MISSED, CANCELLED) |
| weight | numeric(5,2) | milestone_weight | numeric(5,2) | DIRECT_COPY | HIGH | |
| created_at | timestamptz | created_at | timestamptz | DIRECT_COPY | HIGH | |
| updated_at | timestamptz | updated_at | timestamptz | DIRECT_COPY | HIGH | |

## Computed columns
- `milestone_natural_key`: `'GOAL_MILESTONE::' || tenant_slug || '::' || source_id::text`
- `milestone_metadata`: `{"legacy_id": "<source.id>", "import_run_id": "<run_uuid>", "imported_at": "..."}`
- `milestone_created_by` / `milestone_updated_by`: NULL (source no audit actor)

## FK resolution
- tenant: brownfield.tenant_id_mappings
- goal: temp_sdbi.sys_goals.legacy_id ↔ goal_id

## Pre-flight
- Source row count: **1000**
- FK integrity: 0 dangling (goal_id CASCADE source-side, target-side resolved via temp_sdbi)
- Sample (3 rows): "Completare fase di analisi"/2026-03-16/completed/0.40; "Raggiungere target KPI"/2026-03-31/pending/0.50; "Raggiungere obiettivo intermedio 50%"/2026-03-17/pending/0.50
- Distinct goal_id with milestones: 400 (40% of source goals)

## Acceptance
| # | Criterion |
|---|---|
| A1 | `sys.sys_goal_milestones` count = 1000 |
| A2 | All milestone_goal_id resolve to existing sys.sys_goals |
| A3 | 0 NULL on NOT NULL cols |
| A4 | Status distribution preserved (pending + completed observed in source) |
| A5 | Lineage rows = 1000 |

## Confidence: **0.95 HIGH** (auto-approve)

## Human review notes
- None — straightforward composition pattern, all transforms trivial

---
*End*
