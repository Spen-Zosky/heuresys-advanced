# Mapping Card — `public.key_results` → `sys.sys_okr_key_results`

## Metadata
- mapping_card_id: GOALS-PILOT-MAP-09
- source: `public.key_results` (20 rows)
- target: `sys.sys_okr_key_results`
- author: SDBI AI (Cowork Claude)
- confidence_overall: **0.92 HIGH** (auto-approve)

## Source semantic
- semantic_type: SUB-ENTITY (composition of OKR)
- contains_pii: false
- temporal: snapshot + updated + last_check_in_at
- soft_delete: NO
- triggers in source: 2 triggers update progress aggregation on OKR
- ratio: 20 KRs / 20 OKRs = exactly 1:1 (under-populated relative to typical 3-5 per OKR)

## Field mapping

| source_col | source_type | target_col | target_type | transform | confidence |
|---|---|---|---|---|---|
| id | uuid | (metadata) | jsonb | STORE_IN_METADATA | HIGH |
| okr_id | uuid | key_result_okr_id | uuid | LOOKUP_OKR_BY_LEGACY_ID | HIGH |
| description | text | key_result_description | text | DIRECT_COPY | HIGH |
| metric_type | varchar(50) | key_result_metric_type | varchar(32) | UPPERCASE | HIGH (percentage, number → PERCENTAGE, NUMBER fit target CHECK) |
| start_value | numeric(15,2) | key_result_start_value | numeric(15,2) | DIRECT_COPY | HIGH |
| target_value | numeric(15,2) | key_result_target_value | numeric(15,2) | DIRECT_COPY | HIGH |
| current_value | numeric(15,2) | key_result_current_value | numeric(15,2) | DIRECT_COPY | HIGH |
| unit | varchar(50) | key_result_unit | varchar(50) | DIRECT_COPY (NULL passthrough — 100% NULL in source) | HIGH (trivial) |
| progress_percent | numeric(5,2) | key_result_progress_percent | numeric(5,2) | DIRECT_COPY | HIGH |
| status | varchar(50) | key_result_status | varchar(32) | UPPERCASE | HIGH (3 source values fit target CHECK) |
| weight | numeric(5,2) | key_result_weight | numeric(5,2) | DIRECT_COPY | HIGH |
| owner_id | uuid | key_result_owner_user_id | uuid | LOOKUP_USER_BY_LEGACY_EMPLOYEE | HIGH (always populated in source) |
| created_at | timestamptz | created_at | timestamptz | DIRECT_COPY | HIGH |
| updated_at | timestamptz | updated_at | timestamptz | DIRECT_COPY | HIGH |
| tenant_id | uuid | key_result_tenant_id | uuid | LOOKUP_TENANT_ID | HIGH |
| last_check_in_at | timestamptz | key_result_last_check_in_at | timestamptz | DIRECT_COPY | HIGH |
| confidence_level | integer | key_result_confidence_level | integer | DIRECT_COPY (default 3) | HIGH |

## Computed
- `key_result_natural_key`: `'OKR_KEY_RESULT::' || tenant_slug || '::' || source_id::text`
- `key_result_metadata`: `{"legacy_id": "...", "import_run_id": "..."}`

## FK resolution
- tenant: brownfield.tenant_id_mappings
- okr: temp_sdbi.sys_okrs
- owner_user: employees_core via email lookup

## Pre-flight
- Source row count: **20**
- 1:1 with OKRs
- Anomaly: source `owner_id` has NO FK declared but observed always populated — verify resolution non-NULL
- Sample (3 rows): all about loan approval / digital onboarding / similar metrics

## Acceptance
| # | Criterion |
|---|---|
| A1 | count = 20 |
| A2 | Every key_result_okr_id resolves to existing sys_okrs |
| A3 | progress_percent matches recomputation from current/start/target where computable |
| A4 | Lineage rows = 20 |

## Confidence: **0.92 HIGH** — auto-approve

---
*End*
