# Mapping Card — `public.goal_comments` → `sys.sys_goal_comments`

## Metadata
- mapping_card_id: GOALS-PILOT-MAP-05
- source: `public.goal_comments` (856 rows)
- target: `sys.sys_goal_comments`
- author: SDBI AI (Cowork Claude)
- confidence_overall: **0.93 HIGH** (auto-approve)

## Source semantic
- semantic_type: SUB-ENTITY (discussion thread on goal)
- contains_pii: PRESENT in content text (user-written), but not in column structure
- temporal: snapshot + updated
- soft_delete: NO
- threading: self-FK `parent_comment_id` (100% NULL — unused yet)

## Field mapping

| source_col | source_type | target_col | target_type | transform | confidence |
|---|---|---|---|---|---|
| id | uuid | (metadata) | jsonb | STORE_IN_METADATA | HIGH |
| tenant_id | uuid | comment_tenant_id | uuid | LOOKUP_TENANT_ID | HIGH |
| goal_id | uuid | comment_goal_id | uuid | LOOKUP_GOAL_BY_LEGACY_ID | HIGH |
| author_id | uuid | comment_author_user_id | uuid | LOOKUP_USER_BY_LEGACY_EMPLOYEE | HIGH (0 NULL in source) |
| parent_comment_id | uuid | comment_parent_comment_id | uuid | LOOKUP_VIA_NATURAL_KEY (or NULL — 100% NULL in source) | HIGH (trivial) |
| content | text | comment_content | text | DIRECT_COPY (PRESERVE encoding) | HIGH |
| is_private | boolean | comment_is_private | boolean | DIRECT_COPY | HIGH |
| created_at | timestamptz | created_at | timestamptz | DIRECT_COPY | HIGH |
| updated_at | timestamptz | updated_at | timestamptz | DIRECT_COPY | HIGH |

## Computed
- `comment_natural_key`: `'GOAL_COMMENT::' || tenant_slug || '::' || source_id::text`
- `comment_metadata`: `{"legacy_id": "...", "import_run_id": "..."}`

## FK resolution
- tenant: brownfield.tenant_id_mappings
- goal: temp_sdbi.sys_goals
- author_user: employees_core.id → sys_users
- parent_comment: self-FK trivially NULL

## Pre-flight
- Source row count: **856**
- 820 distinct goal_id (~1.04 comments per goal avg)
- author_id always populated (0 NULL)
- parent_comment_id 100% NULL — threading unused

## Acceptance
| # | Criterion |
|---|---|
| A1 | count = 856 |
| A2 | 0 NULL on comment_content (NOT NULL) |
| A3 | All goal_id resolve |
| A4 | Lineage rows = 856 |

## Confidence: **0.93 HIGH** — auto-approve

---
*End*
