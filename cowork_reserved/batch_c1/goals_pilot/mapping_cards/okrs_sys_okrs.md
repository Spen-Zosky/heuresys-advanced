# Mapping Card — `public.okrs` → `sys.sys_okrs`

## Metadata
- mapping_card_id: GOALS-PILOT-MAP-08
- source: `public.okrs` (20 rows)
- target: `sys.sys_okrs`
- author: SDBI AI (Cowork Claude)
- confidence_overall: **0.88 HIGH** (auto-approve, HC-2 awaits Enzo)

## Source semantic
- semantic_type: ENTITY (parallel to sys_goals but distinct methodology)
- contains_pii: false
- temporal: snapshot + updated_at
- soft_delete: NO
- hierarchy: self-FK parent_okr_id (100% NULL — no hierarchy used)
- distribution: RTL Bank 10, SmartFood 10 (no EcoNova, no Heuresys)
- ALL owner_id=NULL, ALL created_by=NULL, ALL fiscal_year=NULL, ALL fiscal_quarter=NULL

## Field mapping

| source_col | source_type | target_col | target_type | transform | confidence |
|---|---|---|---|---|---|
| id | uuid | (metadata) | jsonb | STORE_IN_METADATA | HIGH |
| tenant_id | uuid | okr_tenant_id | uuid | LOOKUP_TENANT_ID | HIGH |
| objective | text | okr_objective | text | DIRECT_COPY | HIGH |
| okr_type | varchar(50) | okr_okr_type | varchar(32) | UPPERCASE | HIGH (2 source values fit target CHECK) |
| department | varchar(100) | okr_department | varchar(100) | DIRECT_COPY | HIGH |
| period_type | varchar(20) | okr_period_type | varchar(16) | UPPERCASE | HIGH (only quarterly observed) |
| period_start | date | okr_period_start | date | DIRECT_COPY | HIGH |
| period_end | date | okr_period_end | date | DIRECT_COPY | HIGH |
| status | varchar(50) | okr_status | varchar(32) | UPPERCASE (active→ACTIVE) | HIGH |
| overall_progress | numeric(5,2) | okr_overall_progress | numeric(5,2) | DIRECT_COPY | HIGH |
| confidence_level | numeric(3,2) | okr_confidence_level | numeric(3,2) | DIRECT_COPY | HIGH |
| owner_id | uuid | okr_owner_user_id | uuid | LOOKUP_USER_BY_LEGACY_EMPLOYEE (100% NULL passthrough) | HIGH (trivial) |
| created_by | uuid | okr_created_by_user_id | uuid | LOOKUP_USER_BY_LEGACY_EMPLOYEE (100% NULL passthrough) | HIGH (trivial) |
| created_at | timestamptz | created_at | timestamptz | DIRECT_COPY | HIGH |
| updated_at | timestamptz | updated_at | timestamptz | DIRECT_COPY | HIGH |
| description | text | okr_description | text | DIRECT_COPY | HIGH |
| parent_okr_id | uuid | okr_parent_okr_id | uuid | PASSTHROUGH NULL (100% NULL) | HIGH (trivial) |
| tags | jsonb | okr_tags | jsonb | DIRECT_COPY | HIGH |
| fiscal_year | integer | okr_fiscal_year | integer | DERIVE_FISCAL_FROM_PERIOD `EXTRACT(YEAR FROM period_start)` | MEDIUM (source 100% NULL; derived value differs from "would-be" NULL) |
| fiscal_quarter | integer | okr_fiscal_quarter | integer | DERIVE_FISCAL_FROM_PERIOD `EXTRACT(QUARTER FROM period_start)` | MEDIUM (same reasoning) |

## Computed
- `okr_natural_key`: `'OKR::' || tenant_slug || '::' || source_id::text`
- `okr_metadata`: `{"legacy_id": "...", "import_run_id": "..."}`

## Special transform: DERIVE_FISCAL_FROM_PERIOD

For OKR rows with NULL fiscal_year/fiscal_quarter (100% of rows):
- `okr_fiscal_year = EXTRACT(YEAR FROM okr_period_start)::integer`
- `okr_fiscal_quarter = EXTRACT(QUARTER FROM okr_period_start)::integer`

Sample: period_start=2024-10-01 → fiscal_year=2024, fiscal_quarter=4
Sample: period_start=2024-10-01 → year 2024 Q4 (verified live)

This derives meaningful values from existing data rather than carrying NULL forward. Reversible (if Enzo prefers NULL passthrough, override transform).

## FK resolution
- tenant: brownfield.tenant_id_mappings
- owner_user: NULL (source 100% NULL)
- created_by_user: NULL
- parent_okr: NULL

## Pre-flight
- Source row count: **20**
- Tenant distribution: RTL Bank 10, SmartFood 10
- 100% NULL: owner_id, created_by, parent_okr_id, fiscal_year, fiscal_quarter
- Sample objective: "Expand to 3 new regional markets" (company, Q4-2024, progress 75.76%)

## Acceptance
| # | Criterion |
|---|---|
| A1 | count = 20 |
| A2 | All okr_tenant_id resolve |
| A3 | okr_period_end ≥ okr_period_start (CHECK) |
| A4 | fiscal_year derived (all rows non-NULL post-import) |
| A5 | Lineage rows = 20 |

## Confidence: **0.88 HIGH** — auto-approve

## Human review notes
- **HC-2**: kept separate from sys_goals (methodological distinction). Default proposal: KEEP SEPARATE.
- **DERIVE_FISCAL_FROM_PERIOD**: novel transform. Documented + reversible.

---
*End*
