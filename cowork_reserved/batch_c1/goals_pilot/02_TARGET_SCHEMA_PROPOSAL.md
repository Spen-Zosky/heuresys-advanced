# Phase 2 — TARGET SCHEMA PROPOSAL — Goals/OKRs (Batch C1.8)

**Authored**: 2026-05-20 (Cowork Claude, SDBI supervisor)
**ADR ref**: ADR-0014 §3.1 Phase 2
**Target**: `heuresys_advanced.sys.*` — 10 new tables
**Migration files**: `migrations/000035_sys_goals_okrs_scaffold.sql` (this proposal compiled into idempotent DDL)

---

## §0 — Conventions applied (verified against existing `sys.*` schema)

Following established patterns from `sys.sys_skills` (000013), `sys.sys_positions` (000011), `sys.sys_learning_modules` (000016):

| Aspect | Rule | Example |
|---|---|---|
| Table name | `sys.sys_<entity_plural>` | `sys.sys_goals` |
| Column prefix | `<entity_singular>_<field>` | `goal_id`, `goal_tenant_id`, `goal_title` |
| Primary key | `<entity>_id uuid PRIMARY KEY DEFAULT gen_random_uuid()` | `goal_id uuid PK` |
| Tenant FK (I5) | `<entity>_tenant_id uuid NOT NULL REFERENCES sys.sys_tenancies(tenant_id) ON DELETE RESTRICT` | (NOT CASCADE — preserve audit trail) |
| Audit timestamps | `created_at`, `updated_at` both `timestamptz NOT NULL DEFAULT now()` | uses `sys.sys_set_updated_at()` trigger |
| Audit actor | `<entity>_created_by`, `<entity>_updated_by` uuid nullable FK to `sys.sys_users(user_id)` ON DELETE SET NULL | |
| Natural key | `<entity>_natural_key varchar(512) NOT NULL` + UQ index | format `'GOAL::<tenant_slug>::<source_uuid>'` for SDBI traceability |
| Metadata blob | `<entity>_metadata jsonb NOT NULL DEFAULT '{}'::jsonb` | catch-all extension point |
| CHECK constraints | `varchar(N) + CHECK` (NEVER ENUM) per RD-08 | `goal_status varchar(32) CHECK (... IN ('NOT_STARTED', 'IN_PROGRESS', 'ON_TRACK', 'AT_RISK', 'COMPLETED', 'CANCELLED'))` |
| Date types | `date` for date-only, `timestamptz` for time-of-day | RD-09 |
| RLS | NEVER — tenant isolation via FK + middleware (I5) | — |
| Indexes | btree on FK targets + status + date filters | per-table list below |

**Value normalization** (source → target):
- Source enum values are lowercase (e.g. `not_started`, `on_track`) → target normalized UPPERCASE_SNAKE (e.g. `NOT_STARTED`, `ON_TRACK`) consistent with `sys.sys_positions` etc.

---

## §1 — `sys.sys_goals` (target for `public.goals`)

### Purpose
First-class HRMS Goal entity. Position-centric semantic: link to incumbent user (subject) and owner user (accountable). Hierarchical via self-FK `parent_goal_id`. Categorical (goal_type, category, priority, status).

### Schema

```sql
CREATE TABLE IF NOT EXISTS sys.sys_goals (
  -- Identity
  goal_id                          uuid             PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_tenant_id                   uuid             NOT NULL,
  goal_natural_key                 varchar(512)     NOT NULL,

  -- Linkage (I1 position-centric concern via subject user; HC-6 awaits Enzo)
  goal_subject_user_id             uuid,                 -- "employee_id" in source → user (FK sys_users)
  goal_owner_user_id               uuid,                 -- accountable user
  goal_parent_goal_id              uuid,                 -- self-FK hierarchy
  goal_template_id                 uuid,                 -- FK sys_goal_templates SET NULL

  -- Identity content
  goal_title                       varchar(255)     NOT NULL,
  goal_description                 text,

  -- Classification (varchar + CHECK per RD-08)
  goal_type                        varchar(32)      NOT NULL DEFAULT 'OBJECTIVE',
  goal_category                    varchar(100),         -- free text; source had 16 distinct + case variants
  goal_priority                    varchar(16)      NOT NULL DEFAULT 'MEDIUM',
  goal_status                      varchar(32)      NOT NULL DEFAULT 'NOT_STARTED',

  -- Progress
  goal_progress_percent            integer          NOT NULL DEFAULT 0,
  goal_weight                      numeric(5,2)     NOT NULL DEFAULT 1.00,

  -- Temporal
  goal_start_date                  date,
  goal_due_date                    date,
  goal_completed_at                timestamptz,

  -- Tags / extension
  goal_tags                        jsonb            NOT NULL DEFAULT '[]'::jsonb,
  goal_custom_fields               jsonb            NOT NULL DEFAULT '{}'::jsonb,
  goal_metadata                    jsonb            NOT NULL DEFAULT '{}'::jsonb,

  -- Audit
  goal_created_by                  uuid,
  goal_updated_by                  uuid,
  created_at                       timestamptz      NOT NULL DEFAULT now(),
  updated_at                       timestamptz      NOT NULL DEFAULT now(),

  -- Constraints
  CONSTRAINT sys_goals_type_check     CHECK (goal_type IN ('OBJECTIVE','INDIVIDUAL','TECHNICAL','SALES','CUSTOMER','PERFORMANCE','PROJECT','FINANCIAL','SECURITY','LEADERSHIP','DEVELOPMENT','EFFICIENCY','COMPLIANCE')),
  CONSTRAINT sys_goals_priority_check CHECK (goal_priority IN ('LOW','MEDIUM','HIGH','CRITICAL')),
  CONSTRAINT sys_goals_status_check   CHECK (goal_status IN ('NOT_STARTED','IN_PROGRESS','ON_TRACK','AT_RISK','BLOCKED','COMPLETED','CANCELLED')),
  CONSTRAINT sys_goals_progress_check CHECK (goal_progress_percent BETWEEN 0 AND 100),
  CONSTRAINT sys_goals_updated_after  CHECK (updated_at >= created_at),
  CONSTRAINT sys_goals_dates_ordered  CHECK (goal_due_date IS NULL OR goal_start_date IS NULL OR goal_due_date >= goal_start_date)
);
```

### Foreign keys

```sql
ALTER TABLE sys.sys_goals
  ADD CONSTRAINT sys_goals_tenant_fk        FOREIGN KEY (goal_tenant_id)        REFERENCES sys.sys_tenancies(tenant_id)   ON DELETE RESTRICT,
  ADD CONSTRAINT sys_goals_subject_user_fk  FOREIGN KEY (goal_subject_user_id)  REFERENCES sys.sys_users(user_id)         ON DELETE SET NULL,
  ADD CONSTRAINT sys_goals_owner_user_fk    FOREIGN KEY (goal_owner_user_id)    REFERENCES sys.sys_users(user_id)         ON DELETE SET NULL,
  ADD CONSTRAINT sys_goals_parent_goal_fk   FOREIGN KEY (goal_parent_goal_id)   REFERENCES sys.sys_goals(goal_id)         ON DELETE SET NULL,
  ADD CONSTRAINT sys_goals_template_fk      FOREIGN KEY (goal_template_id)      REFERENCES sys.sys_goal_templates(template_id) ON DELETE SET NULL,
  ADD CONSTRAINT sys_goals_created_by_fk    FOREIGN KEY (goal_created_by)       REFERENCES sys.sys_users(user_id)         ON DELETE SET NULL,
  ADD CONSTRAINT sys_goals_updated_by_fk    FOREIGN KEY (goal_updated_by)       REFERENCES sys.sys_users(user_id)         ON DELETE SET NULL;
```

### Indexes
```sql
CREATE UNIQUE INDEX sys_goals_natural_key_uq ON sys.sys_goals (goal_tenant_id, goal_natural_key);
CREATE INDEX sys_goals_tenant_idx           ON sys.sys_goals (goal_tenant_id);
CREATE INDEX sys_goals_subject_user_idx     ON sys.sys_goals (goal_subject_user_id) WHERE goal_subject_user_id IS NOT NULL;
CREATE INDEX sys_goals_owner_user_idx       ON sys.sys_goals (goal_owner_user_id)   WHERE goal_owner_user_id   IS NOT NULL;
CREATE INDEX sys_goals_parent_idx           ON sys.sys_goals (goal_parent_goal_id)  WHERE goal_parent_goal_id  IS NOT NULL;
CREATE INDEX sys_goals_template_idx         ON sys.sys_goals (goal_template_id)     WHERE goal_template_id     IS NOT NULL;
CREATE INDEX sys_goals_status_idx           ON sys.sys_goals (goal_tenant_id, goal_status);
CREATE INDEX sys_goals_due_date_idx         ON sys.sys_goals (goal_tenant_id, goal_due_date);
```

### Trigger
- `sys_set_updated_at` BEFORE UPDATE (using existing `sys.sys_set_updated_at()` function)

### Excluded columns (from source)
- `embedding`, `embedding_model`, `embedding_generated_at` — 100% NULL, pgvector dependency deferred
- `smart_criteria`, `is_smart_validated`, `smart_score` — 100% NULL, SMART validation framework deferred to future migration (can be re-added when AI workflow active)

These are **intentionally excluded** to keep the target schema lean. If/when needed, a separate migration adds them.

### HC-2 + HC-6 notes
- HC-6: `goal_subject_user_id` (FK sys_users) maps from `employee_id` (FK employees_core) — semantic shift from employee-anchored to user-anchored. Default proposal: keep user (per I1 invariant + I7 separation). Position linkage (if needed later) goes via `goal_metadata` → `position_id` or separate `sys_goal_position_links` junction table (future).

### Confidence: HIGH (0.90)
All 27 source columns either mapped, intentionally omitted (3 embedding + 3 SMART = 6 cols), or pass-through (tags/custom_fields/metadata). Type compat verified. RD-08 normalization applied.

---

## §2 — `sys.sys_goal_milestones` (target for `public.goal_milestones`)

```sql
CREATE TABLE IF NOT EXISTS sys.sys_goal_milestones (
  milestone_id                     uuid             PRIMARY KEY DEFAULT gen_random_uuid(),
  milestone_tenant_id              uuid             NOT NULL,
  milestone_goal_id                uuid             NOT NULL,
  milestone_natural_key            varchar(512)     NOT NULL,

  milestone_title                  varchar(255)     NOT NULL,
  milestone_description            text,

  milestone_target_date            date,
  milestone_completed_at           timestamptz,
  milestone_status                 varchar(32)      NOT NULL DEFAULT 'PENDING',
  milestone_weight                 numeric(5,2)     NOT NULL DEFAULT 0,

  milestone_metadata               jsonb            NOT NULL DEFAULT '{}'::jsonb,
  milestone_created_by             uuid,
  milestone_updated_by             uuid,
  created_at                       timestamptz      NOT NULL DEFAULT now(),
  updated_at                       timestamptz      NOT NULL DEFAULT now(),

  CONSTRAINT sys_gm_status_check    CHECK (milestone_status IN ('PENDING','IN_PROGRESS','COMPLETED','MISSED','CANCELLED')),
  CONSTRAINT sys_gm_updated_after   CHECK (updated_at >= created_at)
);
```

FKs: tenant→`sys_tenancies`, goal→`sys_goals` (ON DELETE CASCADE — milestones are owned by goal), created_by/updated_by→`sys_users`.
Indexes: natural_key UQ per tenant, goal_id, target_date.
Confidence: **HIGH** (0.95) — straightforward composition.

---

## §3 — `sys.sys_goal_check_ins` (target for `public.goal_check_ins`)

```sql
CREATE TABLE IF NOT EXISTS sys.sys_goal_check_ins (
  check_in_id                      uuid             PRIMARY KEY DEFAULT gen_random_uuid(),
  check_in_tenant_id               uuid             NOT NULL,
  check_in_goal_id                 uuid             NOT NULL,
  check_in_subject_user_id         uuid             NOT NULL,  -- maps from source employee_id
  check_in_natural_key             varchar(512)     NOT NULL,

  check_in_date                    date             NOT NULL DEFAULT CURRENT_DATE,
  check_in_previous_progress       integer,
  check_in_new_progress            integer          NOT NULL,
  check_in_status_update           varchar(32),
  check_in_notes                   text,
  check_in_blockers                text,
  check_in_next_steps              text,
  check_in_confidence_level        integer,

  check_in_metadata                jsonb            NOT NULL DEFAULT '{}'::jsonb,
  created_at                       timestamptz      NOT NULL DEFAULT now(),

  CONSTRAINT sys_gci_progress_check    CHECK (check_in_new_progress BETWEEN 0 AND 100),
  CONSTRAINT sys_gci_prev_progress_chk CHECK (check_in_previous_progress IS NULL OR check_in_previous_progress BETWEEN 0 AND 100),
  CONSTRAINT sys_gci_status_check      CHECK (check_in_status_update IS NULL OR check_in_status_update IN ('ON_TRACK','AHEAD','AT_RISK','BLOCKED','COMPLETED')),
  CONSTRAINT sys_gci_confidence_check  CHECK (check_in_confidence_level IS NULL OR check_in_confidence_level BETWEEN 1 AND 5)
);
```

FKs: tenant→`sys_tenancies`, goal→`sys_goals` (CASCADE), subject_user→`sys_users` ON DELETE RESTRICT (event log integrity).
Indexes: natural_key UQ, goal_id, subject_user_id, date.
Confidence: **HIGH** (0.90) — event-log pattern stable. Note: `created_at` is event time (no `updated_at` because event-log is immutable).

---

## §4 — `sys.sys_goal_updates` (target for `public.goal_updates`)

```sql
CREATE TABLE IF NOT EXISTS sys.sys_goal_updates (
  update_id                        uuid             PRIMARY KEY DEFAULT gen_random_uuid(),
  update_tenant_id                 uuid             NOT NULL,
  update_goal_id                   uuid             NOT NULL,
  update_author_user_id            uuid,
  update_natural_key               varchar(512)     NOT NULL,

  update_type                      varchar(32)      NOT NULL DEFAULT 'PROGRESS',
  update_previous_progress         numeric(5,2),
  update_new_progress              numeric(5,2),
  update_previous_status           varchar(32),
  update_new_status                varchar(32),
  update_content                   text,
  update_attachments               jsonb            NOT NULL DEFAULT '[]'::jsonb,
  update_metadata                  jsonb            NOT NULL DEFAULT '{}'::jsonb,

  created_at                       timestamptz      NOT NULL DEFAULT now(),

  CONSTRAINT sys_gu_type_check      CHECK (update_type IN ('PROGRESS','STATUS_CHANGE','MILESTONE','BLOCKER','NOTE'))
);
```

FKs: tenant→`sys_tenancies`, goal→`sys_goals` CASCADE, author→`sys_users` SET NULL.
Indexes: natural_key UQ, goal_id, author_id, created_at DESC.
Confidence: **HIGH** (0.92).

---

## §5 — `sys.sys_goal_comments` (target for `public.goal_comments`)

```sql
CREATE TABLE IF NOT EXISTS sys.sys_goal_comments (
  comment_id                       uuid             PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_tenant_id                uuid             NOT NULL,
  comment_goal_id                  uuid             NOT NULL,
  comment_author_user_id           uuid,
  comment_parent_comment_id        uuid,   -- threading (currently 100% NULL in source)
  comment_natural_key              varchar(512)     NOT NULL,

  comment_content                  text             NOT NULL,
  comment_is_private               boolean          NOT NULL DEFAULT false,

  comment_metadata                 jsonb            NOT NULL DEFAULT '{}'::jsonb,
  created_at                       timestamptz      NOT NULL DEFAULT now(),
  updated_at                       timestamptz      NOT NULL DEFAULT now(),

  CONSTRAINT sys_gc_updated_after   CHECK (updated_at >= created_at)
);
```

FKs: tenant→`sys_tenancies`, goal→`sys_goals` CASCADE, author→`sys_users` SET NULL, parent_comment→self CASCADE.
Indexes: natural_key UQ, goal_id, author_id, parent_comment_id (partial).
Confidence: **HIGH** (0.93).

---

## §6 — `sys.sys_goal_alignments` (target for `public.goal_alignments`)

```sql
CREATE TABLE IF NOT EXISTS sys.sys_goal_alignments (
  alignment_id                     uuid             PRIMARY KEY DEFAULT gen_random_uuid(),
  alignment_tenant_id              uuid             NOT NULL,
  alignment_source_goal_id         uuid             NOT NULL,
  alignment_aligned_goal_id        uuid             NOT NULL,
  alignment_natural_key            varchar(512)     NOT NULL,

  alignment_type                   varchar(32)      NOT NULL DEFAULT 'SUPPORTS',
  alignment_weight                 numeric(5,2)     NOT NULL DEFAULT 100,

  alignment_metadata               jsonb            NOT NULL DEFAULT '{}'::jsonb,
  created_at                       timestamptz      NOT NULL DEFAULT now(),

  CONSTRAINT sys_ga_type_check     CHECK (alignment_type IN ('SUPPORTS','CONTRIBUTES_TO','DERIVED_FROM','DEPENDS_ON')),
  CONSTRAINT sys_ga_no_self        CHECK (alignment_source_goal_id <> alignment_aligned_goal_id)
);
```

FKs: tenant→`sys_tenancies`, source_goal→`sys_goals` CASCADE, aligned_goal→`sys_goals` CASCADE.
Indexes: natural_key UQ, `(source_goal_id, aligned_goal_id)` UQ (preserve source `unique_goal_alignment`), each FK btree.
Confidence: **HIGH** (0.95) — simple junction.

---

## §7 — `sys.sys_goal_templates` (target for `public.goal_templates`)

```sql
CREATE TABLE IF NOT EXISTS sys.sys_goal_templates (
  template_id                      uuid             PRIMARY KEY DEFAULT gen_random_uuid(),
  template_tenant_id               uuid             NOT NULL,
  template_role_id                 uuid,    -- HC-4: 100% NULL in source; FK→sys_job_roles late-bound
  template_org_unit_id             uuid,    -- HC-4: 100% NULL in source; FK→sys_organization_units
  template_natural_key             varchar(512)     NOT NULL,

  template_name                    varchar(255)     NOT NULL,
  template_description             text,
  template_category                varchar(100),
  template_goal_type               varchar(32)      NOT NULL DEFAULT 'OBJECTIVE',
  template_suggested_metrics       text[],            -- preserve text[] from source (NOT jsonb)
  template_suggested_duration_days integer,
  template_suggested_weight        numeric(5,2)     NOT NULL DEFAULT 1.00,
  template_difficulty_level        varchar(32)      NOT NULL DEFAULT 'MEDIUM',
  template_is_company_wide         boolean          NOT NULL DEFAULT false,
  template_usage_count             integer          NOT NULL DEFAULT 0,
  template_is_active               boolean          NOT NULL DEFAULT true,
  template_deleted_at              timestamptz,                -- 100% NULL in source; preserve for soft-delete future

  template_metadata                jsonb            NOT NULL DEFAULT '{}'::jsonb,
  template_created_by              uuid,
  template_updated_by              uuid,
  created_at                       timestamptz      NOT NULL DEFAULT now(),
  updated_at                       timestamptz      NOT NULL DEFAULT now(),

  CONSTRAINT sys_gt_type_check        CHECK (template_goal_type IN ('OBJECTIVE','INDIVIDUAL','TECHNICAL','SALES','CUSTOMER','PERFORMANCE','PROJECT','FINANCIAL','SECURITY','LEADERSHIP','DEVELOPMENT','EFFICIENCY','COMPLIANCE')),
  CONSTRAINT sys_gt_difficulty_check  CHECK (template_difficulty_level IN ('EASY','MEDIUM','HARD','STRETCH')),
  CONSTRAINT sys_gt_updated_after     CHECK (updated_at >= created_at)
);
```

FKs:
- tenant→`sys_tenancies` RESTRICT
- role_id→`sys_job_roles(job_role_id)` ON DELETE SET NULL (deferred FK if role table empty)
- org_unit_id→`sys_organization_units(organization_unit_id)` ON DELETE SET NULL
- created_by/updated_by→`sys_users`

Indexes: natural_key UQ, active partial, category, role_id partial, org_unit_id partial.
Confidence: **HIGH (0.85)** — 4 cols are 100% NULL placeholders, kept for forward-compat (HC-4).

---

## §8 — `sys.sys_okrs` (target for `public.okrs`)

```sql
CREATE TABLE IF NOT EXISTS sys.sys_okrs (
  okr_id                           uuid             PRIMARY KEY DEFAULT gen_random_uuid(),
  okr_tenant_id                    uuid             NOT NULL,
  okr_owner_user_id                uuid,    -- 100% NULL in source but column real
  okr_created_by_user_id           uuid,    -- 100% NULL in source
  okr_parent_okr_id                uuid,    -- 100% NULL in source (no hierarchy used)
  okr_natural_key                  varchar(512)     NOT NULL,

  okr_objective                    text             NOT NULL,
  okr_description                  text,
  okr_okr_type                     varchar(32)      NOT NULL DEFAULT 'COMPANY',
  okr_department                   varchar(100),
  okr_period_type                  varchar(16)      NOT NULL DEFAULT 'QUARTERLY',
  okr_period_start                 date             NOT NULL,
  okr_period_end                   date             NOT NULL,
  okr_fiscal_year                  integer,                              -- derived from period_start in transform
  okr_fiscal_quarter               integer,                              -- derived (1..4)
  okr_status                       varchar(32)      NOT NULL DEFAULT 'ACTIVE',
  okr_overall_progress             numeric(5,2)     NOT NULL DEFAULT 0,
  okr_confidence_level             numeric(3,2),
  okr_tags                         jsonb            NOT NULL DEFAULT '[]'::jsonb,
  okr_metadata                     jsonb            NOT NULL DEFAULT '{}'::jsonb,

  created_at                       timestamptz      NOT NULL DEFAULT now(),
  updated_at                       timestamptz      NOT NULL DEFAULT now(),

  CONSTRAINT sys_okrs_type_check       CHECK (okr_okr_type IN ('COMPANY','DEPARTMENT','TEAM','INDIVIDUAL')),
  CONSTRAINT sys_okrs_period_check     CHECK (okr_period_type IN ('QUARTERLY','MONTHLY','YEARLY','CUSTOM')),
  CONSTRAINT sys_okrs_status_check     CHECK (okr_status IN ('DRAFT','ACTIVE','ACHIEVED','MISSED','CANCELLED','ARCHIVED')),
  CONSTRAINT sys_okrs_period_ordered   CHECK (okr_period_end >= okr_period_start),
  CONSTRAINT sys_okrs_fiscal_q_check   CHECK (okr_fiscal_quarter IS NULL OR okr_fiscal_quarter BETWEEN 1 AND 4),
  CONSTRAINT sys_okrs_updated_after    CHECK (updated_at >= created_at)
);
```

FKs: tenant, owner_user, created_by_user, parent_okr (self SET NULL).
Indexes: natural_key UQ, owner partial, period combo, status combo, type combo, parent partial.
Confidence: **HIGH (0.88)** — well-defined entity; fiscal_year/quarter derived in transform.

---

## §9 — `sys.sys_okr_key_results` (target for `public.key_results`)

```sql
CREATE TABLE IF NOT EXISTS sys.sys_okr_key_results (
  key_result_id                    uuid             PRIMARY KEY DEFAULT gen_random_uuid(),
  key_result_tenant_id             uuid             NOT NULL,
  key_result_okr_id                uuid             NOT NULL,
  key_result_owner_user_id         uuid,
  key_result_natural_key           varchar(512)     NOT NULL,

  key_result_description           text             NOT NULL,
  key_result_metric_type           varchar(32)      NOT NULL DEFAULT 'PERCENTAGE',
  key_result_start_value           numeric(15,2)    NOT NULL DEFAULT 0,
  key_result_target_value          numeric(15,2)    NOT NULL,
  key_result_current_value         numeric(15,2)    NOT NULL DEFAULT 0,
  key_result_unit                  varchar(50),
  key_result_progress_percent      numeric(5,2)     NOT NULL DEFAULT 0,
  key_result_status                varchar(32)      NOT NULL DEFAULT 'ON_TRACK',
  key_result_weight                numeric(5,2)     NOT NULL DEFAULT 1.00,
  key_result_confidence_level      integer          NOT NULL DEFAULT 3,
  key_result_last_check_in_at      timestamptz,

  key_result_metadata              jsonb            NOT NULL DEFAULT '{}'::jsonb,
  created_at                       timestamptz      NOT NULL DEFAULT now(),
  updated_at                       timestamptz      NOT NULL DEFAULT now(),

  CONSTRAINT sys_okr_kr_metric_check     CHECK (key_result_metric_type IN ('PERCENTAGE','NUMBER','CURRENCY','BOOLEAN','MILESTONE')),
  CONSTRAINT sys_okr_kr_status_check     CHECK (key_result_status IN ('ON_TRACK','AT_RISK','BEHIND','COMPLETED','ABANDONED')),
  CONSTRAINT sys_okr_kr_confidence_check CHECK (key_result_confidence_level BETWEEN 1 AND 5),
  CONSTRAINT sys_okr_kr_updated_after    CHECK (updated_at >= created_at)
);
```

FKs: tenant, okr→`sys_okrs` CASCADE, owner_user→`sys_users` SET NULL.
Indexes: natural_key UQ, okr_id, owner partial, status.
Confidence: **HIGH (0.92)**.

---

## §10 — `sys.sys_okr_check_ins` (merged target for `public.okr_check_ins` + `public.okr_checkins`)

```sql
CREATE TABLE IF NOT EXISTS sys.sys_okr_check_ins (
  check_in_id                      uuid             PRIMARY KEY DEFAULT gen_random_uuid(),
  check_in_tenant_id               uuid             NOT NULL,
  check_in_okr_id                  uuid             NOT NULL,
  check_in_key_result_id           uuid,                              -- nullable: NULL = OKR_AGGREGATE scope, NOT NULL = KEY_RESULT scope
  check_in_subject_user_id         uuid,                              -- maps from source employee_id OR author_id
  check_in_natural_key             varchar(512)     NOT NULL,

  check_in_scope                   varchar(32)      NOT NULL,         -- 'KEY_RESULT' | 'OKR_AGGREGATE'
  check_in_date                    date             NOT NULL DEFAULT CURRENT_DATE,

  -- KEY_RESULT scope fields (NULL when OKR_AGGREGATE)
  check_in_previous_value          numeric(15,2),
  check_in_new_value               numeric(15,2),
  check_in_previous_progress       numeric(5,2),
  check_in_new_progress            numeric(5,2),

  -- OKR_AGGREGATE scope fields (NULL when KEY_RESULT)
  check_in_overall_progress        numeric(5,2),
  check_in_status_update           text,
  check_in_next_steps              text,
  check_in_key_result_updates_snapshot jsonb,                         -- copies source `key_result_updates` jsonb

  -- Common fields
  check_in_confidence_level        numeric(5,2),
  check_in_notes                   text,
  check_in_blockers                text,

  check_in_metadata                jsonb            NOT NULL DEFAULT '{}'::jsonb,
  created_at                       timestamptz      NOT NULL DEFAULT now(),

  CONSTRAINT sys_okr_ci_scope_check        CHECK (check_in_scope IN ('KEY_RESULT','OKR_AGGREGATE')),
  CONSTRAINT sys_okr_ci_scope_kr_coherent  CHECK (
    (check_in_scope = 'KEY_RESULT' AND check_in_key_result_id IS NOT NULL)
    OR
    (check_in_scope = 'OKR_AGGREGATE' AND check_in_key_result_id IS NULL)
  )
);
```

FKs: tenant, okr→`sys_okrs` CASCADE, key_result→`sys_okr_key_results` CASCADE (nullable FK), subject_user→`sys_users` SET NULL.
Indexes: natural_key UQ, okr_id, key_result_id partial, subject_user partial, date.
Confidence: **HIGH (0.85)** — merge design tested via mapping cards. HC-3 awaits Enzo override.

---

## §11 — Aggregate properties

| # | Target table | Source row count | Estimated post-import | Confidence |
|---|---|---|---|---|
| 1 | sys_goals | 1067 | 1067 | HIGH (0.90) |
| 2 | sys_goal_milestones | 1000 | 1000 | HIGH (0.95) |
| 3 | sys_goal_check_ins | 1000 | 1000 | HIGH (0.90) |
| 4 | sys_goal_updates | 1811 | 1811 | HIGH (0.92) |
| 5 | sys_goal_comments | 856 | 856 | HIGH (0.93) |
| 6 | sys_goal_alignments | 100 | 100 | HIGH (0.95) |
| 7 | sys_goal_templates | 40 | 40 | HIGH (0.85) |
| 8 | sys_okrs | 20 | 20 | HIGH (0.88) |
| 9 | sys_okr_key_results | 20 | 20 | HIGH (0.92) |
| 10 | sys_okr_check_ins | 15 + 10 | 25 | HIGH (0.85) |
| **TOTAL** | | **5939** | **5939** | **HIGH avg 0.90** |

**Note**: aggregate row count is 5939 (not 5949 mentioned earlier; corrected by re-counting: 1067+1811+1000+1000+856+100+40+20+20+15+10 = 5939). Updated downstream consistently.

---

## §12 — RLS / tenant isolation strategy

Per I5 invariant: NO RLS policies on `sys.*` tables. Tenant isolation enforced via:
1. FK `<entity>_tenant_id REFERENCES sys.sys_tenancies(tenant_id)` (declared on every table)
2. API middleware filter (`tenantContext` plugin, step 10 in plugin chain — `apps/api/src/app.ts`)
3. Service layer scope authorization based on `ActorContext`

No `ENABLE ROW LEVEL SECURITY` statements in migration 000035.

---

## §13 — Migration ordering

`000035_sys_goals_okrs_scaffold.sql` creates the 10 tables in this order (FK dependency order):

```
1. sys_goal_templates       (no FK to other goals/okrs tables)
2. sys_goals                (template_id FK to sys_goal_templates; self-FK parent)
3. sys_goal_milestones      (FK to sys_goals)
4. sys_goal_check_ins       (FK to sys_goals)
5. sys_goal_updates         (FK to sys_goals)
6. sys_goal_comments        (FK to sys_goals)
7. sys_goal_alignments      (FK to sys_goals x2)
8. sys_okrs                 (no FK to goals; self-FK parent)
9. sys_okr_key_results      (FK to sys_okrs)
10. sys_okr_check_ins       (FK to sys_okrs + sys_okr_key_results)
```

Late-binding FK pattern not needed (clean topological order possible).

---

## §14 — Decisions requiring Enzo (HC summary)

| HC | Decision | Default proposal |
|---|---|---|
| HC-1 | Naming convention | Accept (consistent with sys.sys_*) |
| HC-2 | sys_okrs vs sys_goals merge | KEEP SEPARATE |
| HC-3 | okr_check_ins + okr_checkins merge | MERGE with discriminator |
| HC-4 | goal_templates NULL cols | INCLUDE as nullable (forward-compat) |
| HC-5 | embedding + smart_criteria | OMIT entirely from target |
| HC-6 | goals.employee_id → user vs position | USER (`goal_subject_user_id`) per I1+I7 |
| HC-7 | LOW/MEDIUM confidence fields | None flagged at this level — see mapping cards |
| HC-8 | Migration numbering | 000034 + 000035 (no conflict expected) |

---

*End of 02_TARGET_SCHEMA_PROPOSAL.md*
