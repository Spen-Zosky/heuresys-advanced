# Mapping Card — `public.goal_check_ins` → `sys.sys_goal_check_ins`

## Metadata
- mapping_card_id: GOALS-PILOT-MAP-03
- source: `public.goal_check_ins` (1000 rows)
- target: `sys.sys_goal_check_ins`
- author: SDBI AI (Cowork Claude)
- approver: PENDING (Enzo)
- confidence_overall: **0.90 HIGH**
- workflow_phase: 2

## Source semantic
- semantic_type: EVENT LOG (scheduled check-in by employee on goal)
- contains_pii: false (free-text notes potentially contain user names but redacted via author resolution)
- temporal: append-only event
- soft_delete: NO
- ratio: 1000 check-ins / 314 distinct goals = 3.2 avg

## Field mapping

| source_col | source_type | target_col | target_type | transform | confidence |
|---|---|---|---|---|---|
| id | uuid | (legacy_id in metadata) | jsonb | STORE_IN_METADATA | HIGH |
| tenant_id | uuid | check_in_tenant_id | uuid | LOOKUP_TENANT_ID | HIGH |
| goal_id | uuid | check_in_goal_id | uuid | LOOKUP_GOAL_BY_LEGACY_ID | HIGH |
| employee_id | uuid | check_in_subject_user_id | uuid | LOOKUP_USER_BY_LEGACY_EMPLOYEE | HIGH (0 NULL in source — always resolvable) |
| check_in_date | date | check_in_date | date | DIRECT_COPY | HIGH |
| previous_progress | integer | check_in_previous_progress | integer | DIRECT_COPY | HIGH |
| new_progress | integer | check_in_new_progress | integer | DIRECT_COPY | HIGH |
| status_update | varchar(50) | check_in_status_update | varchar(32) | UPPERCASE | HIGH (5 source values fit target CHECK after UPPER) |
| notes | text | check_in_notes | text | DIRECT_COPY | HIGH |
| blockers | text | check_in_blockers | text | DIRECT_COPY | HIGH |
| next_steps | text | check_in_next_steps | text | DIRECT_COPY | HIGH |
| confidence_level | integer | check_in_confidence_level | integer | DIRECT_COPY | HIGH |
| created_at | timestamptz | created_at | timestamptz | DIRECT_COPY | HIGH |

## Computed
- `check_in_natural_key`: `'GOAL_CHECK_IN::' || tenant_slug || '::' || source_id::text`
- `check_in_metadata`: `{"legacy_id": "<source.id>", "import_run_id": "..."}`

## FK resolution
- tenant: brownfield.tenant_id_mappings
- goal: temp_sdbi.sys_goals
- subject_user: employees_core.id → sys_users via user_email lookup

## Pre-flight
- Source row count: **1000**
- NULL ratios: notes 80%, status_update YES (some NULL), confidence_level YES (some NULL); employee_id 0% NULL ✓
- Date range: 2026-01-02 .. 2026-05-06

## Acceptance
| # | Criterion |
|---|---|
| A1 | count = 1000 |
| A2 | 0 NULL on `check_in_subject_user_id` (NOT NULL in target since 0% NULL in source) |
| A3 | All check_in_goal_id FK resolve |
| A4 | Lineage rows = 1000 |

## Confidence: **0.90 HIGH** — auto-approve

## Human review notes
- None — clean event-log pattern. `check_in_subject_user_id` NOT NULL is enforced since source has 0/1000 NULL.

---
*End*
