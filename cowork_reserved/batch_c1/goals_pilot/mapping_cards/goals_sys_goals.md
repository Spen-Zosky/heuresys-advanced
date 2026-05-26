# Mapping Card — `public.goals` → `sys.sys_goals`

## Metadata
- mapping_card_id: GOALS-PILOT-MAP-01
- source: `heuresys_platform.public.goals` (1067 rows)
- target: `heuresys_advanced.sys.sys_goals`
- created: 2026-05-20
- author: SDBI AI (Cowork Claude)
- approver: PENDING (Enzo)
- confidence_overall: **0.90 HIGH**
- workflow_phase: 2 (TARGET ANALOGY MATCHING)

## Source semantic analysis
- semantic_type: ENTITY (first-class hierarchical HRMS object)
- contains_pii: false (title + description occasionally include employee context but no SSN/email)
- temporal: mixed (snapshot fields + event-driven timestamps)
- soft_delete: NO (no deleted_at column in source)
- hierarchy: self-FK `parent_goal_id` (max depth 3 observed)

## Field mapping (per column)

| source_col | source_type | target_col | target_type | transform | confidence | reasoning |
|---|---|---|---|---|---|---|
| id | uuid | `goal_metadata->>'legacy_id'` | jsonb-extracted | STORE_IN_METADATA | HIGH | source uuid retained for lineage via metadata blob; target generates new uuid `goal_id` |
| tenant_id | uuid | goal_tenant_id | uuid | LOOKUP_TENANT_ID via brownfield.tenant_id_mappings | HIGH | already-proven path (Goal 003) |
| employee_id | uuid | goal_subject_user_id | uuid | LOOKUP_USER_BY_LEGACY_EMPLOYEE | MEDIUM | source employees_core.id → sys_users.user_id resolution via email or legacy_id metadata; 266/1067 NULL — pass through NULL |
| title | varchar(255) | goal_title | varchar(255) | DIRECT_COPY + TRIM | HIGH | type match |
| description | text | goal_description | text | DIRECT_COPY | HIGH | 0 NULL |
| goal_type | varchar(50) | goal_type | varchar(32) | UPPERCASE + length-validate | HIGH | source 13 values fit target CHECK (uppercased) |
| parent_goal_id | uuid | goal_parent_goal_id | uuid | LOOKUP_VIA_NATURAL_KEY (after first-pass insert) | HIGH | two-pass: pass 1 INSERT without parent_goal_id, pass 2 UPDATE setting parent_goal_id by joining temp_sdbi.legacy_id↔goal_id resolved |
| start_date | date | goal_start_date | date | DIRECT_COPY | HIGH | |
| due_date | date | goal_due_date | date | DIRECT_COPY | HIGH | |
| status | varchar(50) | goal_status | varchar(32) | UPPERCASE + extend CHECK to include `NOT_STARTED, ON_TRACK, IN_PROGRESS, AT_RISK, COMPLETED` | HIGH | 5 source values map 1:1 to target |
| progress_percent | integer | goal_progress_percent | integer | DIRECT_COPY (with COALESCE 0) | HIGH | |
| weight | numeric(3,2) | goal_weight | numeric(5,2) | DIRECT_COPY (widen precision) | HIGH | numeric expansion safe |
| created_at | timestamp WITHOUT TZ | created_at | timestamptz | CAST_TO_TIMESTAMPTZ assuming UTC | MEDIUM | source has no TZ — assume UTC. Document in mapping_card metadata |
| updated_at | timestamp WITHOUT TZ | updated_at | timestamptz | CAST_TO_TIMESTAMPTZ UTC | MEDIUM | same |
| completed_at | timestamp WITHOUT TZ | goal_completed_at | timestamptz | CAST_TO_TIMESTAMPTZ UTC | MEDIUM | same |
| category | varchar(100) | goal_category | varchar(100) | LOWERCASE_NORMALIZE (collapse Operations/operations etc.) | MEDIUM | source has case-inconsistency in 16 distinct values; transform standardizes to lowercase. Alternative: preserve as-is (loses normalization). RECOMMENDED: lowercase. |
| owner_id | uuid | goal_owner_user_id | uuid | LOOKUP_USER_BY_LEGACY_EMPLOYEE | MEDIUM | same as employee_id |
| priority | varchar(20) | goal_priority | varchar(16) | UPPERCASE | HIGH | 3 source values fit target CHECK |
| tags | jsonb | goal_tags | jsonb | DIRECT_COPY (array) | HIGH | |
| custom_fields | jsonb | goal_custom_fields | jsonb | DIRECT_COPY (object) | HIGH | |
| embedding | vector(1536) | (OMITTED) | — | SKIP | HIGH | 0 rows populated in source; HC-5 confirms |
| embedding_model | varchar(100) | (OMITTED) | — | SKIP | HIGH | 0 rows |
| embedding_generated_at | timestamptz | (OMITTED) | — | SKIP | HIGH | 0 rows |
| smart_criteria | jsonb | (OMITTED OR `goal_metadata->>'smart_criteria'`) | — | SKIP | HIGH | 0 rows; HC-5 |
| is_smart_validated | boolean | (OMITTED) | — | SKIP | HIGH | 0 rows |
| smart_score | integer | (OMITTED) | — | SKIP | HIGH | 0 rows |
| template_id | uuid | goal_template_id | uuid | LOOKUP_VIA_NATURAL_KEY (after goal_templates inserted) | HIGH | 100% NULL in source so trivially passes (`NULL→NULL`); FK declared for future |

## Computed target columns
- `goal_natural_key`: `'GOAL::' || tenant_slug || '::' || source_id::text`
  - e.g. `GOAL::rtl-bank::562562ae-4c74-4189-ad93-d1c9eacb0eae`
- `goal_metadata`:
  ```jsonb
  {
    "legacy_id": "<source.id>",
    "legacy_table": "public.goals",
    "import_run_id": "<run_uuid>",
    "imported_at": "<timestamp>"
  }
  ```
- `goal_created_by` / `goal_updated_by`: NULL (source has no audit actor on goals table)

## FK resolution strategy

| FK | Resolution |
|---|---|
| `goal_tenant_id` | `brownfield.tenant_id_mappings.canonical_tenant_id` WHERE `legacy_id = source.tenant_id::text` |
| `goal_subject_user_id` | `sys_users.user_id` WHERE `sys_users.user_email = (SELECT email FROM employees_core JOIN users ON users.employee_id = employees_core.id WHERE employees_core.id = source.employee_id)`. Mediation table `user_pernr_mapping` (571 rows) helps cross-DB. Fallback: NULL if no match |
| `goal_owner_user_id` | Same as subject_user (employees_core path) |
| `goal_parent_goal_id` | Two-pass: pass 1 NULL, pass 2 UPDATE using temp_sdbi.legacy_id ↔ goal_id mapping |
| `goal_template_id` | Resolve via goal_templates SDBI seeded first |

## Pre-flight checks (verified live)
- Source row count: **1067**
- Sample validation (3 rows extracted):
  - row 1: tenant=0c54b84a (RTL Bank), goal_type=objective, status=in_progress, parent=f0f35807 → OK
  - row 2: tenant=1d7bf448 (SmartFood), goal_type=individual, status=on_track, owner_id=NULL → OK
  - row 3: tenant=0c54b84a, goal_type=performance, status=completed, parent=d692221c → OK
- FK integrity:
  - employee_id → employees_core: 0 dangling (verified `SELECT COUNT(*) FROM goals LEFT JOIN employees_core...`)
  - owner_id → employees_core: 0 dangling
  - parent_goal_id → goals: 0 dangling (self-FK valid)
  - template_id → goal_templates: 100% NULL (no test needed)
- Cascade dependencies:
  - 1811 goal_updates (CASCADE)
  - 1000 goal_check_ins (CASCADE)
  - 1000 goal_milestones (CASCADE)
  - 856 goal_comments (CASCADE)
  - 100 goal_alignments (CASCADE both source + aligned)

## Post-execution acceptance criteria

| # | Criterion | Check |
|---|---|---|
| A1 | `sys.sys_goals` count = 1067 | `SELECT COUNT(*) FROM sys.sys_goals` |
| A2 | 0 NULL on NOT NULL cols | `SELECT COUNT(*) FROM sys.sys_goals WHERE goal_tenant_id IS NULL OR goal_title IS NULL OR ...` = 0 |
| A3 | All goal_tenant_id resolve to existing tenancy | `SELECT COUNT(*) FROM sys.sys_goals g LEFT JOIN sys.sys_tenancies t ON t.tenant_id=g.goal_tenant_id WHERE t.tenant_id IS NULL` = 0 |
| A4 | goal_subject_user_id NULL ratio matches source (25%) | `SELECT COUNT(*) FILTER (WHERE goal_subject_user_id IS NULL)::float / COUNT(*) FROM sys.sys_goals` ≈ 0.25 |
| A5 | parent_goal_id resolves to existing goal_id (self-FK) | `SELECT COUNT(*) FROM sys.sys_goals child LEFT JOIN sys.sys_goals parent ON parent.goal_id=child.goal_parent_goal_id WHERE child.goal_parent_goal_id IS NOT NULL AND parent.goal_id IS NULL` = 0 |
| A6 | Hierarchy depth ≤ 3 preserved | recursive CTE max depth = 3 |
| A7 | Lineage rows = 1067 | `SELECT COUNT(*) FROM sys.sys_source_lineage_records WHERE target_table_name='sys.sys_goals'` = 1067 |

## Confidence breakdown

| Aspect | Confidence | Notes |
|---|---|---|
| Schema/type compat | 0.95 | Type widening or compatible narrowing only |
| Value enum mapping | 0.90 | All source values fit target CHECK after UPPERCASE |
| FK resolution | 0.85 | Two-pass approach for self-FK; user lookup via mediation table needs validation |
| Audit instrumentation | 0.95 | Standard pattern |
| Edge cases | 0.85 | Timezone assumption (timestamp→timestamptz UTC) is heuristic |
| **Overall** | **0.90 HIGH** | Auto-approve qualified (>0.85 threshold ADR-0014 §3.3) |

## Human review notes
- [PENDING] Enzo confirm HC-5 (drop embedding/smart_criteria from target schema entirely)
- [PENDING] Enzo confirm HC-6 (employee_id → goal_subject_user_id semantic per I1+I7)
- [PENDING] Confirm timestamptz UTC assumption for the 3 timestamp-without-tz source cols

---
*End mapping_card goals_sys_goals.md*
