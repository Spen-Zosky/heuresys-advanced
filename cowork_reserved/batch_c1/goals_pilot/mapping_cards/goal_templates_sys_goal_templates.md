# Mapping Card — `public.goal_templates` → `sys.sys_goal_templates`

## Metadata
- mapping_card_id: GOALS-PILOT-MAP-07
- source: `public.goal_templates` (40 rows)
- target: `sys.sys_goal_templates`
- author: SDBI AI (Cowork Claude)
- confidence_overall: **0.85 HIGH** (auto-approve, with HC-4 caveat)

## Source semantic
- semantic_type: REFERENCE CATALOG (template library)
- contains_pii: false
- temporal: snapshot + updated
- soft_delete: column exists (deleted_at) but 100% NULL
- distribution: 10 templates per tenant (likely seeded uniformly)

## Field mapping

| source_col | source_type | target_col | target_type | transform | confidence |
|---|---|---|---|---|---|
| id | uuid | (metadata) | jsonb | STORE_IN_METADATA | HIGH |
| tenant_id | uuid | template_tenant_id | uuid | LOOKUP_TENANT_ID | HIGH |
| name | varchar(255) | template_name | varchar(255) | DIRECT_COPY + TRIM | HIGH |
| description | text | template_description | text | DIRECT_COPY | HIGH |
| category | varchar(100) | template_category | varchar(100) | DIRECT_COPY | HIGH |
| goal_type | varchar(50) | template_goal_type | varchar(32) | UPPERCASE | HIGH |
| suggested_metrics | text[] | template_suggested_metrics | text[] | DIRECT_COPY (preserve array type) | HIGH |
| suggested_duration_days | integer | template_suggested_duration_days | integer | DIRECT_COPY | HIGH |
| suggested_weight | numeric(3,2) | template_suggested_weight | numeric(5,2) | DIRECT_COPY (widen) | HIGH |
| difficulty_level | varchar(20) | template_difficulty_level | varchar(32) | UPPERCASE | HIGH |
| role_id | uuid | template_role_id | uuid | PASSTHROUGH NULL (100% NULL) — HC-4 | HIGH (trivial) |
| is_company_wide | boolean | template_is_company_wide | boolean | DIRECT_COPY | HIGH |
| usage_count | integer | template_usage_count | integer | DIRECT_COPY (with COALESCE 0) | HIGH |
| is_active | boolean | template_is_active | boolean | DIRECT_COPY | HIGH |
| created_by | uuid | template_created_by | uuid | LOOKUP_USER_BY_LEGACY_EMPLOYEE (100% NULL passthrough) — HC-4 | HIGH (trivial) |
| created_at | timestamptz | created_at | timestamptz | DIRECT_COPY | HIGH |
| updated_at | timestamptz | updated_at | timestamptz | DIRECT_COPY | HIGH |
| deleted_at | timestamptz | template_deleted_at | timestamptz | DIRECT_COPY (NULL) — HC-4 | HIGH (trivial) |
| org_unit_id | uuid | template_org_unit_id | uuid | PASSTHROUGH NULL (100% NULL) — HC-4 | HIGH (trivial) |

## Computed
- `template_natural_key`: `'GOAL_TEMPLATE::' || tenant_slug || '::' || lower(name) || '::' || source_id::text`
- `template_metadata`: `{"legacy_id": "...", "import_run_id": "..."}`
- `template_updated_by`: NULL (no source field; future use)

## FK resolution
- tenant: brownfield.tenant_id_mappings
- role_id: NULL (HC-4)
- org_unit_id: NULL (HC-4)
- created_by: NULL (HC-4)

## Pre-flight
- Source row count: **40**
- 4 cols 100% NULL: role_id, created_by, deleted_at, org_unit_id (HC-4 awaits Enzo)
- Sample (3 rows): all "Improve Customer Satisfaction" template duplicated per-tenant — same metrics array, same duration 90 days
- Tenant distribution: 10/10/10/10 (RTL Bank/SmartFood/EcoNova/Heuresys)

## Acceptance
| # | Criterion |
|---|---|
| A1 | count = 40 |
| A2 | All template_tenant_id resolve |
| A3 | `template_suggested_metrics` preserved as text[] (not converted to jsonb) |
| A4 | Lineage rows = 40 |

## Confidence: **0.85 HIGH** — auto-approve (HC-4 just confirms inclusion of NULL cols)

## Human review notes
- **HC-4**: 4 columns 100% NULL in source. Decision: INCLUDE all as nullable (forward-compat). Alternative: omit entirely. Default proposal: INCLUDE.

---
*End*
