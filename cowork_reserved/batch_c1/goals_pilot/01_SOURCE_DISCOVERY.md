# Phase 1 — SOURCE DISCOVERY — Goals/OKRs (Batch C1.8)

**Authored**: 2026-05-20 (Cowork Claude, SDBI supervisor)
**ADR ref**: ADR-0014 §3.1 Phase 1
**Source DB**: `heuresys_platform` @ oracle-vm-default:5432 (postgres 16.14, sudo postgres, read-only)
**Snapshot timestamp**: 2026-05-20T16:30Z
**Verification method**: live SSH `\d` + `SELECT ... FROM information_schema` + `SELECT ... FROM <table>`
**Tables in scope**: 10 (`goals`, `goal_updates`, `goal_check_ins`, `goal_milestones`, `goal_comments`, `goal_alignments`, `goal_templates`, `okrs`, `key_results`, `okr_check_ins`, `okr_checkins`) — 11 tables actually (both `okr_check_ins` and `okr_checkins` exist with distinct semantics; Phase 2 merges them into one target with discriminator)

**Aggregate volume**: 5949 rows (1067 + 1811 + 1000 + 1000 + 856 + 100 + 40 + 20 + 20 + 15 + 10)

---

## §1 — `public.goals` (1067 rows, 27 cols)

### Schema (verified `\d public.goals`)

| Column | Type | NULL | Default | Notes |
|---|---|---|---|---|
| id | uuid PK | NO | gen_random_uuid() | |
| tenant_id | uuid | NO | — | FK→tenants(id) ON DELETE CASCADE |
| employee_id | uuid | YES | — | FK→employees_core(id) ON DELETE CASCADE (266/1067 NULL = 25%) |
| title | varchar(255) | NO | — | |
| description | text | YES | — | (0/1067 NULL — always populated) |
| goal_type | varchar(50) | YES | 'objective' | 13 distinct values: objective, individual, technical, sales, customer, performance, project, financial, security, leadership, development, efficiency, compliance |
| parent_goal_id | uuid | YES | — | self-FK ON DELETE SET NULL (275/1067 NULL = 25.8%) |
| start_date | date | YES | — | range 2025-01-01..2026-12-02 |
| due_date | date | YES | — | range 2025-01-01..2026-12-02 |
| status | varchar(50) | YES | 'not_started' | 5 distinct values: not_started, on_track, in_progress, at_risk, completed |
| progress_percent | integer | YES | 0 | CHECK [0..100] |
| weight | numeric(3,2) | YES | 1.0 | |
| created_at | timestamp WITHOUT TZ | YES | now() | ⚠️ no timezone |
| updated_at | timestamp WITHOUT TZ | YES | now() | CHECK updated_at >= created_at |
| completed_at | timestamp WITHOUT TZ | YES | — | |
| category | varchar(100) | YES | — | 16 distinct including some case-inconsistencies (Operations vs operations, Compliance vs compliance, Leadership) |
| owner_id | uuid | YES | — | FK→employees_core(id) ON DELETE SET NULL (275/1067 NULL = 25.8%) |
| priority | varchar(20) | YES | 'medium' | 3 distinct: low, medium, high |
| tags | jsonb | YES | '[]' | array |
| custom_fields | jsonb | YES | '{}' | object |
| **embedding** | **vector(1536)** | YES | — | **0/1067 populated** — pgvector ext, AI-future |
| embedding_model | varchar(100) | YES | — | (0 populated since embedding=NULL) |
| embedding_generated_at | timestamptz | YES | — | (0) |
| **smart_criteria** | jsonb | YES | — | **0/1067 populated** — SMART validation framework, AI-future |
| is_smart_validated | boolean | YES | false | |
| smart_score | integer | YES | — | |
| template_id | uuid | YES | — | FK→goal_templates(id) ON DELETE SET NULL (1067/1067 NULL = 100% — template_id not used yet) |

### Indexes
9 btree (tenant, employee, owner, parent, template, status combo, type combo, due_date combo, tenant_employee combo) + 1 ivfflat on embedding (unused)

### RLS policy
`tenant_isolation USING (tenant_id = current_tenant_id())` — FORCE ROW SECURITY enabled.

### Triggers
- `set_updated_at` BEFORE UPDATE
- `trg_log_goal_update` AFTER UPDATE OF progress_percent, status → inserts into `goal_updates`

### Tenant distribution
| tenant_id | rows |
|---|---|
| 0c54b84a-... (RTL Bank) | 626 (59%) |
| 1d7bf448-... (SmartFood) | 328 (31%) |
| fb1e866c-... (EcoNova) | 104 (10%) |
| d5855519-... (Heuresys System) | 9 (<1%) |

### Hierarchy
Recursive CTE: max depth = 3, total rows traceable = 821 / 1067 (others are orphan parents or isolated)

### FK integrity (verified live)
- employee_id → employees_core: 0/801 (100% resolved when not NULL)
- owner_id → employees_core: 0/792 dangling
- parent_goal_id → goals: self-FK valid

### Semantic classification
**ENTITY** — first-class HRMS object. Position-centric concern (link to incumbent employee/owner). Hierarchical (parent_goal_id self-FK depth 3). Mixed temporal (creation + status snapshot + completion event).

### Sample rows
```
562562ae | Reduce energy consumption in facilities by 20% | objective | in_progress | sustainability | medium | 45 | 1.00 | 2026-09-03 | 2026-12-02 | 64fe0f6e... | 64fe0f6e... | f0f35807... |
308a3177 | Lanciare 2 nuovi prodotti con NPD success rate >70% | individual | on_track | innovation | high | 2 | 1.00 | 2025-01-01 | 2025-12-31 | bd162ad3... | NULL | NULL |
3bc2c690 | Process 500 loan applications monthly - Q4 2025 | performance | completed | Operations | medium | 100 | 0.29 | 2025-10-01 | 2025-12-31 | dc04d150... | dc04d150... | d692221c... |
```

---

## §2 — `public.goal_updates` (1811 rows, 12 cols)

### Schema
| Column | Type | NULL | Default | Notes |
|---|---|---|---|---|
| id | uuid PK | NO | gen_random_uuid() | |
| tenant_id | uuid | NO | — | FK→tenants CASCADE |
| goal_id | uuid | NO | — | FK→goals CASCADE |
| author_id | uuid | YES | — | FK→employees_core ON DELETE SET NULL (99/1811 NULL = 5.5%) |
| update_type | varchar(30) | YES | 'progress' | 5 values: progress, status_change, milestone, blocker, note |
| previous_progress | numeric(5,2) | YES | — | |
| new_progress | numeric(5,2) | YES | — | (0 NULL) |
| previous_status | varchar(30) | YES | — | (mostly NULL — only used on status_change events) |
| new_status | varchar(30) | YES | — | |
| content | text | YES | — | (0 NULL — always populated) |
| attachments | jsonb | YES | '[]' | |
| created_at | timestamptz | YES | now() | ✓ has timezone |

### RLS
`tenant_isolation USING + tenant_insert WITH CHECK`

### Semantic classification
**EVENT LOG** (append-only) — each row a progress/status update event. 1.7 updates per goal avg. Generated by trigger `trg_log_goal_update` on `goals` UPDATE OF (progress_percent, status).

### Cardinality
1065 distinct goal_id (so every active goal has updates, ratio ~1.7:1)

---

## §3 — `public.goal_check_ins` (1000 rows, 13 cols)

### Schema
| Column | Type | NULL | Default |
|---|---|---|---|
| id | uuid PK | NO | gen_random_uuid() |
| tenant_id | uuid | NO | — |
| goal_id | uuid | NO | — |
| employee_id | uuid | NO | — |
| check_in_date | date | NO | CURRENT_DATE |
| previous_progress | integer | YES | — |
| new_progress | integer | NO | — |
| status_update | varchar(50) | YES | — | 5 vals: on_track, ahead, at_risk, blocked, completed |
| notes | text | YES | — | (803 NULL = 80%) |
| blockers | text | YES | — | |
| next_steps | text | YES | — | |
| confidence_level | integer | YES | — | |
| created_at | timestamptz | YES | now() |

### Semantic classification
**EVENT LOG** scheduled check-in. Date-range 2026-01-02..2026-05-06 (4 months). 314 distinct goal_id (so 3.2 check-ins per goal avg, only ~30% of goals have check-ins).

Note: ≠ `goal_updates` — `goal_updates` is auto-generated by trigger on progress change; `goal_check_ins` is human-driven scheduled checkpoint with richer narrative fields (blockers, next_steps, confidence_level).

---

## §4 — `public.goal_milestones` (1000 rows, 11 cols)

### Schema
| Column | Type | NULL | Default | Notes |
|---|---|---|---|---|
| id | uuid PK | NO | — | |
| tenant_id | uuid | NO | — | |
| goal_id | uuid | NO | — | FK→goals CASCADE |
| title | varchar(255) | NO | — | |
| description | text | YES | — | |
| target_date | date | YES | — | |
| completed_at | timestamptz | YES | — | (782/1000 NULL = 78%) |
| status | varchar(20) | YES | 'pending' | CHECK ∈ {pending, completed, missed, cancelled} (live: only pending+completed observed) |
| weight | numeric(5,2) | YES | 0 | |
| created_at | timestamptz | YES | now() | |
| updated_at | timestamptz | YES | now() | CHECK updated_at >= created_at |

### Semantic classification
**SUB-ENTITY** of goal (composition). 400/1067 goals have milestones (40% have at least 1).

---

## §5 — `public.goal_comments` (856 rows, 9 cols)

### Schema
| Column | Type | NULL | Default |
|---|---|---|---|
| id | uuid PK | NO | — |
| tenant_id | uuid | NO | — |
| goal_id | uuid | NO | — |
| author_id | uuid | YES | — | (0 NULL = 100% authored) |
| parent_comment_id | uuid | YES | — | self-FK (856/856 NULL = 100% — no threading used yet) |
| content | text | NO | — |
| is_private | boolean | YES | false |
| created_at | timestamptz | YES | now() |
| updated_at | timestamptz | YES | now() | CHECK updated_at >= created_at |

### Semantic classification
**SUB-ENTITY** of goal (discussion). 820 distinct goal_id (1.04 comments per goal avg). Threading model defined but unused (parent_comment_id always NULL).

---

## §6 — `public.goal_alignments` (100 rows, 7 cols)

### Schema
| Column | Type | NULL | Default | Notes |
|---|---|---|---|---|
| id | uuid PK | NO | — | |
| tenant_id | uuid | NO | — | |
| goal_id | uuid | NO | — | |
| aligned_goal_id | uuid | NO | — | |
| alignment_type | varchar(50) | YES | 'supports' | CHECK ∈ {supports, contributes_to, derived_from, depends_on} — live: only 'supports' observed (1/4) |
| alignment_weight | numeric(5,2) | YES | 100 | |
| created_at | timestamptz | YES | now() | |

### Constraints
- UQ `(goal_id, aligned_goal_id)` (`unique_goal_alignment`)
- CHECK `goal_id <> aligned_goal_id` (no_self_alignment)

### Cross-tenant integrity
`SELECT COUNT(*) FROM goal_alignments JOIN g1,g2 WHERE g1.tenant != g2.tenant` = **0** (clean tenant isolation)

### Semantic classification
**JUNCTION TABLE** (M:N goals × goals via alignment relationship). 100 rows / 1067 goals = ~9% of goals are aligned.

---

## §7 — `public.goal_templates` (40 rows, 19 cols)

### Schema
| Column | Type | NULL | Default | Notes |
|---|---|---|---|---|
| id | uuid PK | NO | — | |
| tenant_id | uuid | NO | — | FK→tenants CASCADE |
| name | varchar(255) | NO | — | |
| description | text | YES | — | |
| category | varchar(100) | YES | — | |
| goal_type | varchar(50) | YES | 'objective' | |
| **suggested_metrics** | **text[]** | YES | — | array type (not jsonb) |
| suggested_duration_days | integer | YES | — | |
| suggested_weight | numeric(3,2) | YES | 1.0 | |
| difficulty_level | varchar(20) | YES | 'medium' | |
| **role_id** | uuid | YES | — | **40/40 NULL (100%)** — FK undefined |
| is_company_wide | boolean | YES | false | |
| usage_count | integer | YES | 0 | |
| is_active | boolean | YES | true | |
| **created_by** | uuid | YES | — | **40/40 NULL (100%)** — FK→employees_core SET NULL |
| created_at | timestamptz | YES | now() | |
| updated_at | timestamptz | YES | now() | CHECK |
| **deleted_at** | timestamptz | YES | — | **40/40 NULL (100%)** — soft-delete column never used |
| **org_unit_id** | uuid | YES | — | **40/40 NULL (100%)** — FK→org_units CASCADE |

### Tenant distribution
| tenant | rows |
|---|---|
| RTL Bank | 10 |
| SmartFood | 10 |
| EcoNova | 10 |
| Heuresys System | 10 |

10 templates per tenant — likely seeded canonically (no organic creation observed).

### Sample (deduplication observed)
Each tenant has identical 10 template names with `is_company_wide=true`.

### Semantic classification
**REFERENCE/CATALOG** entity (template library). 4 columns 100% NULL → underutilized framework.

### HC-4 note (HC = Human Checkpoint)
4 columns (role_id, created_by, deleted_at, org_unit_id) have 0% population. Decision needed: include as nullable in target or omit entirely. Proposal: INCLUDE as nullable (forward-compat, FKs late-bound).

---

## §8 — `public.okrs` (20 rows, 20 cols)

### Schema
| Column | Type | NULL | Default | Notes |
|---|---|---|---|---|
| id | uuid PK | NO | — | |
| tenant_id | uuid | NO | — | |
| objective | text | NO | — | (free text, not varchar) |
| okr_type | varchar(50) | YES | 'company' | live: only company+department |
| department | varchar(100) | YES | — | |
| period_type | varchar(20) | YES | 'quarterly' | live: only quarterly |
| period_start | date | NO | — | |
| period_end | date | NO | — | |
| status | varchar(50) | YES | 'active' | live: only active |
| overall_progress | numeric(5,2) | YES | 0 | |
| confidence_level | numeric(3,2) | YES | — | range 0-1 |
| owner_id | uuid | YES | — | FK→employees_core SET NULL (20/20 NULL = 100%!) — orphan owners |
| created_by | uuid | YES | — | (20/20 NULL = 100%) |
| created_at | timestamptz | YES | CURRENT_TIMESTAMP | |
| updated_at | timestamptz | YES | CURRENT_TIMESTAMP | CHECK |
| description | text | YES | — | |
| parent_okr_id | uuid | YES | — | self-FK SET NULL (20/20 NULL = 100% — flat OKRs) |
| tags | jsonb | YES | '[]' | |
| **fiscal_year** | integer | YES | — | **20/20 NULL = 100%** |
| **fiscal_quarter** | integer | YES | — | **20/20 NULL = 100%** |

### Tenant distribution
- RTL Bank: 10
- SmartFood: 10

(NO OKRs for EcoNova or Heuresys System)

### Anomalies
- 100% NULL `owner_id` despite the column being indexed (idx_okrs_owner) — indicates seeded data didn't backfill owners
- `fiscal_year`/`fiscal_quarter` 100% NULL but trivially derivable from `period_start` (Q4-2024..Q1-2026 visible in samples)

### Semantic classification
**ENTITY** — first-class OKR framework object. Sibling to `goals` but distinct semantics:
- OKR = Objective + measurable Key Results
- Goal = simpler single-progress objective
- May share employees but separate lifecycle

### HC-2 note
Proposal: keep `sys_okrs` separate from `sys_goals` to preserve methodological distinction. Could be merged with discriminator but loses semantic clarity.

---

## §9 — `public.key_results` (20 rows, 17 cols)

### Schema
| Column | Type | NULL | Default | Notes |
|---|---|---|---|---|
| id | uuid PK | NO | — | |
| okr_id | uuid | NO | — | FK→okrs CASCADE |
| description | text | NO | — | |
| metric_type | varchar(50) | YES | 'percentage' | live: percentage, number |
| start_value | numeric(15,2) | YES | 0 | |
| target_value | numeric(15,2) | NO | — | |
| current_value | numeric(15,2) | YES | 0 | |
| unit | varchar(50) | YES | — | (20/20 NULL = 100% — unit not seeded but metric_type captures part of it) |
| progress_percent | numeric(5,2) | YES | 0 | |
| status | varchar(50) | YES | 'on_track' | live: on_track, behind, at_risk |
| weight | numeric(5,2) | YES | 1.0 | |
| owner_id | uuid | YES | — | NO FK declared (gap) — (0/20 NULL = always populated; verified via SELECT) |
| created_at | timestamptz | YES | CURRENT_TIMESTAMP | |
| updated_at | timestamptz | YES | CURRENT_TIMESTAMP | CHECK |
| tenant_id | uuid | NO | — | FK→tenants CASCADE |
| last_check_in_at | timestamptz | YES | — | |
| confidence_level | integer | YES | 3 | (range 1-5 probably) |

### Triggers
- `trg_key_result_progress` (AFTER INSERT/UPDATE/DELETE) → `fn_trigger_okr_progress()`
- `trg_update_okr_progress` (AFTER INSERT/UPDATE) → `update_okr_progress()`

### Semantic classification
**SUB-ENTITY** of OKR (composition). Exactly 1:1 ratio (20 KRs / 20 OKRs) on this dataset — under-populated relative to typical OKR practice (3-5 KRs per OKR).

### Anomaly
`owner_id` has NO FK constraint defined despite being a uuid column referencing presumably employees_core.

---

## §10 — `public.okr_check_ins` (15 rows, 14 cols) AND `public.okr_checkins` (10 rows, 12 cols)

**Two distinct tables** — verified via `\d` of each.

### `okr_check_ins` (with underscore in middle, 14 cols)
- Granular: per-KR check-in (key_result_id NOT NULL — wait, schema says nullable)
- Fields: previous_value, new_value (numeric 15,2), previous_progress, new_progress (numeric 5,2), confidence_level, notes, blockers
- Sample shows always populated `key_result_id` → effectively per-KR

### `okr_checkins` (no underscore, 12 cols)
- Aggregate: per-OKR check-in
- Fields: overall_progress, confidence_level, status_update (text), blockers, next_steps, **key_result_updates jsonb** (embedded array of {key_result_id, progress})
- Sample shows status narratives ("Raggiunto milestone chiave...") + jsonb KR snapshot

### Decision
**Merge** into single target `sys.sys_okr_check_ins` with discriminator:
- `check_in_scope varchar(32) CHECK ∈ {KEY_RESULT, OKR_AGGREGATE}`
- KEY_RESULT branch: `okr_id`, `key_result_id NOT NULL`, scalar progress fields
- OKR_AGGREGATE branch: `okr_id`, `key_result_id NULL`, `key_result_updates_snapshot jsonb`

Both sources map to ONE target. See mapping card.

### HC-3 note
This merge is a design judgement. Alternative: keep two target tables. Proposal favors merge for taxonomic clarity but accepts Enzo override.

---

## §11 — Cross-tabular relationships (verified)

```
                    ┌──────────┐
                    │ tenants  │ (4 active tenants)
                    └────┬─────┘
                         │ tenant_id (74 FK refs)
                         ▼
   ┌───────────────────────────────────────────┐
   │ employees_core (270 rows)                  │
   └───────┬───────────────────────────────────┘
           │ FK references from goals/okrs/...
           ▼
┌──────────────────┐    parent     ┌─────────────────┐
│ goals (1067)     │◄──────────────┤ goals (self-FK) │
└────┬─────────────┘   self-loop    └─────────────────┘
     │ FK goal_id (CASCADE)
     ├──► goal_updates (1811)
     ├──► goal_check_ins (1000)
     ├──► goal_milestones (1000)
     ├──► goal_comments (856) — self-FK threading unused
     └──► goal_alignments (100) ──► goals (junction self)
     ▲
     │ template_id FK SET NULL
     │ (currently 100% NULL but FK valid)
┌────┴─────────────┐
│ goal_templates(40)│
└──────────────────┘

┌─────────────┐    parent      ┌─────────────┐
│ okrs (20)   │◄───────────────┤ okrs(self-FK)│
└────┬────────┘   self-loop     └─────────────┘
     │ okr_id (CASCADE)
     ├──► key_results (20) ──► okr_check_ins (KR-scoped)
     ├──► okr_check_ins (15) — per-KR
     └──► okr_checkins (10) — per-OKR aggregate
```

### FK target tables NOT in scope (assume already-resolved by Phase 3 seed)
- `tenants` → `sys.sys_tenancies` (resolved via brownfield.tenant_id_mappings, 4 mappings already seeded)
- `employees_core` → `sys.sys_users` (resolved by user_email lookup, Goal 003 pattern proven)
- `org_units` → `sys.sys_organization_units` (only used by goal_templates.org_unit_id, currently 100% NULL — irrelevant for seed)
- `roles` → ??? (only used by goal_templates.role_id, also 100% NULL — irrelevant)

---

## §12 — All NOT NULL constraints enumerated (CW-B18 mitigation)

Total: 38 NOT NULL constraints across the 11 source tables (covered by 10 sys.* targets after merge).

| Source table | NOT NULL columns |
|---|---|
| goals | id, tenant_id, title (3) |
| goal_updates | id, tenant_id, goal_id (3) |
| goal_check_ins | id, tenant_id, goal_id, employee_id, check_in_date, new_progress (6) |
| goal_milestones | id, tenant_id, goal_id, title (4) |
| goal_comments | id, tenant_id, goal_id, content (4) |
| goal_alignments | id, tenant_id, goal_id, aligned_goal_id (4) |
| goal_templates | id, tenant_id, name (3) |
| okrs | id, tenant_id, objective, period_start, period_end (5) |
| key_results | id, okr_id, description, target_value, tenant_id (5) |
| okr_check_ins | id, tenant_id, okr_id, employee_id, check_in_date, new_value (6) |
| okr_checkins | id, tenant_id, okr_id, checkin_date (4) |

Every NOT NULL column has a mapping defined (see mapping cards). Zero implicit-NULL assumptions.

---

## §13 — Source freshness verification (CW-B21 mitigation)

| Anchor | Value | Verified |
|---|---|---|
| `MIN(start_date)` goals | 2025-01-01 | ✓ |
| `MAX(due_date)` goals | 2026-12-02 | ✓ |
| `MIN(check_in_date)` goal_check_ins | 2026-01-02 | ✓ |
| `MAX(check_in_date)` goal_check_ins | 2026-05-06 | ✓ |
| Last `phase18u_rls_null_safe_policies` migration | 2026-05-14 | from `01_DB_PLATFORM_INVENTORY.md` |
| Snapshot timestamp F1 | 2026-05-20T02:10Z | from inventory |
| This DISCOVERY snapshot | 2026-05-20T16:30Z | this session |

Row counts in this discovery match `01_DB_PLATFORM_INVENTORY.md` §3 exactly (1067/1811/1000/1000/856/100/40/20/20). Source is stable + freshness within tolerance.

---

## §14 — Semantic conclusions

| Source table | Semantic type | Target sys.* table (Phase 2 proposal) |
|---|---|---|
| goals | ENTITY (hierarchy) | `sys.sys_goals` |
| goal_updates | EVENT LOG (append-only) | `sys.sys_goal_updates` |
| goal_check_ins | EVENT LOG (scheduled) | `sys.sys_goal_check_ins` |
| goal_milestones | SUB-ENTITY (composition) | `sys.sys_goal_milestones` |
| goal_comments | SUB-ENTITY (discussion, threading-ready) | `sys.sys_goal_comments` |
| goal_alignments | JUNCTION (M:N goals × goals) | `sys.sys_goal_alignments` |
| goal_templates | REFERENCE CATALOG | `sys.sys_goal_templates` |
| okrs | ENTITY | `sys.sys_okrs` |
| key_results | SUB-ENTITY (composition) | `sys.sys_okr_key_results` |
| okr_check_ins + okr_checkins | EVENT LOG (merged with discriminator) | `sys.sys_okr_check_ins` |

**10 target tables.** See `02_TARGET_SCHEMA_PROPOSAL.md` for full design.

---

*End of 01_SOURCE_DISCOVERY.md*
