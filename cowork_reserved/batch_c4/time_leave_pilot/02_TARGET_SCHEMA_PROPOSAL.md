# Phase 2 — TARGET SCHEMA PROPOSAL — Time/Leave/Attendance (Batch C4.2)

**Authored**: 2026-05-21 (Cowork Claude, SDBI supervisor)
**ADR ref**: ADR-0014 §3.1 Phase 2
**Target**: `heuresys_advanced.sys.*` — 3 in-scope tables (+ 3 optional bonus, HC-2)
**Migration file**: `migrations/000040_sys_time_leave_scaffold.sql`

---

## §0 — Scope decision (HC-2)

| Option | Tables | Total rows | Pros | Cons |
|---|---|---:|---|---|
| **A (in-scope)** | sys_attendance, sys_overtime, sys_time_off_balances | 5237+383+501 = 6121 | Minimum surface; ships fast | Balance mutations un-audited; requests workflow un-imported; CCNL catalog absent |
| **B (recommended)** | A + sys_time_off_requests + sys_leave_balance_transactions + sys_leave_accrual_rules | 6121+99+27+20 = 6267 | Complete domain (request→approval→balance→transaction→accrual); CCNL captured | +3 mapping cards + 3 consolidation steps (~+15 min CLI) |

**Default proposal: Option B**. Bonus tables are tiny (146 rows total). The schema completeness gained justifies the marginal cost. Authoring proceeds for all 6 tables; CLI Phase 3 can subset to 3 if Enzo overrides HC-2 to Option A.

## §1 — Conventions applied (per Goals/OKRs pilot)

| Aspect | Rule | Example |
|---|---|---|
| Table name | `sys.sys_<entity>` | `sys.sys_attendance` |
| Column prefix | `<entity>_<field>` | `attendance_id`, `attendance_tenant_id`, `attendance_date` |
| Primary key | `<entity>_id uuid PRIMARY KEY DEFAULT gen_random_uuid()` | |
| Tenant FK (I5) | `<entity>_tenant_id uuid NOT NULL REFERENCES sys.sys_tenancies(tenant_id) ON DELETE RESTRICT` | |
| Audit timestamps | `created_at`, `updated_at` both `timestamptz NOT NULL DEFAULT now()` | uses `sys.sys_set_updated_at()` trigger |
| Audit actor | `<entity>_created_by`, `<entity>_updated_by` uuid nullable FK to `sys.sys_users(user_id)` ON DELETE SET NULL | |
| Natural key | `<entity>_natural_key varchar(512) NOT NULL` + UQ index | format `'<DOMAIN>::<tenant_slug>::<source_uuid>'` |
| Metadata blob | `<entity>_metadata jsonb NOT NULL DEFAULT '{}'::jsonb` | catch-all extension |
| CHECK constraints | `varchar(N) + CHECK` (NEVER ENUM) per RD-08 | |
| Date types | `date` for date-only, `timestamptz` for time-of-day (RD-09) | source `timestamp` cast to `timestamptz` assuming UTC |
| RLS | NEVER — tenant isolation via FK + middleware (I5) | |

Value normalization: source lowercase enums → target `UPPER_SNAKE_CASE` consistent with sys.sys_goals etc.

---

## §1 — `sys.sys_attendance` (target for `public.employee_attendance`, 5237 rows)

### Purpose
Daily attendance fact per (tenant, user, date). Carries 4-component hours breakdown + generated total. Validation lifecycle (`is_validated`, `validated_by`, `validated_at`).

### Schema

```sql
CREATE TABLE IF NOT EXISTS sys.sys_attendance (
  -- Identity
  attendance_id                    uuid             PRIMARY KEY DEFAULT gen_random_uuid(),
  attendance_tenant_id             uuid             NOT NULL,
  attendance_natural_key           varchar(512)     NOT NULL,

  -- Subject (HC-3: user-anchored per I1+I7)
  attendance_subject_user_id       uuid             NOT NULL,    -- maps from employee_id

  -- Event coordinates
  attendance_date                  date             NOT NULL,

  -- Time stamps (time-of-day; nullable for absence rows)
  attendance_clock_in              time,
  attendance_clock_out             time,
  attendance_break_start           time,
  attendance_break_end             time,

  -- Hours breakdown (defaults 0; total GENERATED — HC-5)
  attendance_hours_regular         numeric(5,2)     NOT NULL DEFAULT 0,
  attendance_hours_overtime        numeric(5,2)     NOT NULL DEFAULT 0,
  attendance_hours_night           numeric(5,2)     NOT NULL DEFAULT 0,
  attendance_hours_holiday         numeric(5,2)     NOT NULL DEFAULT 0,
  attendance_hours_total           numeric(5,2)     GENERATED ALWAYS AS (
    attendance_hours_regular + attendance_hours_overtime +
    attendance_hours_night + attendance_hours_holiday
  ) STORED,

  -- Classification
  attendance_status                varchar(32)      NOT NULL DEFAULT 'PRESENT',
  attendance_source                varchar(32)      NOT NULL DEFAULT 'MANUAL',
  attendance_source_reference      text,

  -- Validation lifecycle
  attendance_is_validated          boolean          NOT NULL DEFAULT false,
  attendance_validated_by_user_id  uuid,
  attendance_validated_at          timestamptz,

  -- Free text + extension
  attendance_notes                 text,
  attendance_metadata              jsonb            NOT NULL DEFAULT '{}'::jsonb,

  -- Audit
  attendance_created_by            uuid,
  attendance_updated_by            uuid,
  created_at                       timestamptz      NOT NULL DEFAULT now(),
  updated_at                       timestamptz      NOT NULL DEFAULT now(),

  -- Constraints
  CONSTRAINT sys_attendance_status_check     CHECK (attendance_status IN (
    'PRESENT','ABSENT','SICK','HOLIDAY','VACATION','PAID_LEAVE','UNPAID_LEAVE','TRAINING','REMOTE','BUSINESS_TRIP'
  )),
  CONSTRAINT sys_attendance_source_check     CHECK (attendance_source IN (
    'MANUAL','BADGE','MOBILE_APP','BIOMETRIC','IMPORT','SYSTEM','API'
  )),
  CONSTRAINT sys_attendance_hours_non_neg    CHECK (
    attendance_hours_regular >= 0 AND attendance_hours_overtime >= 0
    AND attendance_hours_night >= 0 AND attendance_hours_holiday >= 0
  ),
  CONSTRAINT sys_attendance_updated_after    CHECK (updated_at >= created_at),
  CONSTRAINT sys_attendance_break_ordered    CHECK (
    attendance_break_end IS NULL OR attendance_break_start IS NULL OR attendance_break_end >= attendance_break_start
  ),
  CONSTRAINT sys_attendance_clock_ordered    CHECK (
    attendance_clock_out IS NULL OR attendance_clock_in IS NULL OR attendance_clock_out >= attendance_clock_in
  ),
  CONSTRAINT sys_attendance_validation_coherent CHECK (
    (attendance_is_validated = false)
    OR (attendance_is_validated = true AND attendance_validated_by_user_id IS NOT NULL AND attendance_validated_at IS NOT NULL)
  )
);
```

### Foreign keys
```sql
ALTER TABLE sys.sys_attendance
  ADD CONSTRAINT sys_attendance_tenant_fk           FOREIGN KEY (attendance_tenant_id)            REFERENCES sys.sys_tenancies(tenant_id) ON DELETE RESTRICT,
  ADD CONSTRAINT sys_attendance_subject_user_fk     FOREIGN KEY (attendance_subject_user_id)      REFERENCES sys.sys_users(user_id)       ON DELETE RESTRICT,
  ADD CONSTRAINT sys_attendance_validated_by_fk     FOREIGN KEY (attendance_validated_by_user_id) REFERENCES sys.sys_users(user_id)       ON DELETE SET NULL,
  ADD CONSTRAINT sys_attendance_created_by_fk       FOREIGN KEY (attendance_created_by)           REFERENCES sys.sys_users(user_id)       ON DELETE SET NULL,
  ADD CONSTRAINT sys_attendance_updated_by_fk       FOREIGN KEY (attendance_updated_by)           REFERENCES sys.sys_users(user_id)       ON DELETE SET NULL;
```

### Indexes
```sql
CREATE UNIQUE INDEX sys_attendance_natural_key_uq ON sys.sys_attendance (attendance_tenant_id, attendance_natural_key);
CREATE UNIQUE INDEX sys_attendance_business_uq    ON sys.sys_attendance (attendance_tenant_id, attendance_subject_user_id, attendance_date); -- source UQ preserved
CREATE INDEX sys_attendance_user_date_idx          ON sys.sys_attendance (attendance_subject_user_id, attendance_date);
CREATE INDEX sys_attendance_status_idx             ON sys.sys_attendance (attendance_tenant_id, attendance_status);
CREATE INDEX sys_attendance_date_idx               ON sys.sys_attendance (attendance_tenant_id, attendance_date);
CREATE INDEX sys_attendance_unvalidated_idx        ON sys.sys_attendance (attendance_tenant_id) WHERE attendance_is_validated = false;
```

### Trigger
- `sys_set_updated_at` BEFORE UPDATE (existing `sys.sys_set_updated_at()`)
- Note: `attendance_hours_total` is GENERATED STORED → no manual update path.

### Confidence: HIGH (0.90)
All 23 source cols mapped. Status/source CHECK extended to forward-compat values. Validation coherence CHECK adds invariant not enforced in source (small gain). RLS not replicated (I5).

---

## §2 — `sys.sys_overtime` (target for `public.employee_overtime`, 383 rows)

### Purpose
Overtime request+approval workflow per employee+date. Tracks compensation calculation + payroll export linkage.

### Schema

```sql
CREATE TABLE IF NOT EXISTS sys.sys_overtime (
  overtime_id                      uuid             PRIMARY KEY DEFAULT gen_random_uuid(),
  overtime_tenant_id               uuid             NOT NULL,
  overtime_natural_key             varchar(512)     NOT NULL,

  -- Subject
  overtime_subject_user_id         uuid             NOT NULL,

  -- Event
  overtime_date                    date             NOT NULL,
  overtime_type                    varchar(32)      NOT NULL,
  overtime_hours                   numeric(5,2)     NOT NULL,

  -- Compensation
  overtime_rate_multiplier         numeric(3,2),
  overtime_hourly_rate             numeric(8,2),
  overtime_total_compensation      numeric(10,2),

  -- Workflow state
  overtime_status                  varchar(20)      NOT NULL DEFAULT 'PENDING',
  overtime_requested_by_user_id    uuid,
  overtime_requested_at            timestamptz      NOT NULL DEFAULT now(),
  overtime_approved_by_user_id     uuid,
  overtime_approved_at             timestamptz,
  overtime_rejection_reason        text,

  -- Payroll integration (HC-6 — legacy_payroll_job_id in metadata)
  overtime_exported_at             timestamptz,

  -- Free text
  overtime_reason                  text,
  overtime_notes                   text,

  -- Extension
  overtime_metadata                jsonb            NOT NULL DEFAULT '{}'::jsonb,

  -- Audit
  created_at                       timestamptz      NOT NULL DEFAULT now(),
  updated_at                       timestamptz      NOT NULL DEFAULT now(),

  CONSTRAINT sys_overtime_type_check     CHECK (overtime_type IN (
    'WEEKDAY','WEEKEND','NIGHT','HOLIDAY','EMERGENCY','PROJECT','ON_CALL'
  )),
  CONSTRAINT sys_overtime_status_check   CHECK (overtime_status IN (
    'PENDING','APPROVED','REJECTED','EXPORTED','PAID','CANCELLED'
  )),
  CONSTRAINT sys_overtime_hours_positive CHECK (overtime_hours > 0),
  CONSTRAINT sys_overtime_rate_positive  CHECK (overtime_rate_multiplier IS NULL OR overtime_rate_multiplier > 0),
  CONSTRAINT sys_overtime_updated_after  CHECK (updated_at >= created_at),
  CONSTRAINT sys_overtime_approval_coh   CHECK (
    overtime_status NOT IN ('APPROVED','EXPORTED','PAID')
    OR (overtime_approved_by_user_id IS NOT NULL AND overtime_approved_at IS NOT NULL)
  )
);
```

### Foreign keys
```sql
ALTER TABLE sys.sys_overtime
  ADD CONSTRAINT sys_overtime_tenant_fk        FOREIGN KEY (overtime_tenant_id)            REFERENCES sys.sys_tenancies(tenant_id) ON DELETE RESTRICT,
  ADD CONSTRAINT sys_overtime_subject_user_fk  FOREIGN KEY (overtime_subject_user_id)      REFERENCES sys.sys_users(user_id)       ON DELETE RESTRICT,
  ADD CONSTRAINT sys_overtime_requested_by_fk  FOREIGN KEY (overtime_requested_by_user_id) REFERENCES sys.sys_users(user_id)       ON DELETE SET NULL,
  ADD CONSTRAINT sys_overtime_approved_by_fk   FOREIGN KEY (overtime_approved_by_user_id)  REFERENCES sys.sys_users(user_id)       ON DELETE SET NULL;
-- NOTE: payroll_job_id FK deferred (HC-6) — value stored in overtime_metadata->>'legacy_payroll_job_id'
```

### Indexes
```sql
CREATE UNIQUE INDEX sys_overtime_natural_key_uq ON sys.sys_overtime (overtime_tenant_id, overtime_natural_key);
CREATE INDEX sys_overtime_user_date_idx          ON sys.sys_overtime (overtime_subject_user_id, overtime_date);
CREATE INDEX sys_overtime_status_idx             ON sys.sys_overtime (overtime_tenant_id, overtime_status);
CREATE INDEX sys_overtime_date_idx               ON sys.sys_overtime (overtime_tenant_id, overtime_date);
CREATE INDEX sys_overtime_approval_pending_idx   ON sys.sys_overtime (overtime_tenant_id) WHERE overtime_status = 'PENDING';
```

### Confidence: HIGH (0.85)
21 source cols mapped. CHECK constraint for `overtime_type` requires Phase 1.5 distinct-values verification (CW-B25 follow-up). Conservative 7-value list covers common ITLAB cases.

---

## §3 — `sys.sys_time_off_balances` (target for `public.employee_time_off_balances`, 501 rows)

### Purpose
Per (tenant, user, leave_type, year) leave balance accumulator. Mutated by accruals, requests, transactions.

### Schema

```sql
CREATE TABLE IF NOT EXISTS sys.sys_time_off_balances (
  balance_id                       uuid             PRIMARY KEY DEFAULT gen_random_uuid(),
  balance_tenant_id                uuid             NOT NULL,
  balance_natural_key              varchar(512)     NOT NULL,

  -- Subject
  balance_subject_user_id          uuid             NOT NULL,

  -- Classification
  balance_leave_type               varchar(50)      NOT NULL,
  balance_year                     integer          NOT NULL DEFAULT EXTRACT(year FROM CURRENT_DATE),

  -- Days breakdown
  balance_total_days               numeric(5,2)     NOT NULL DEFAULT 0,
  balance_used_days                numeric(5,2)     NOT NULL DEFAULT 0,
  balance_pending_days             numeric(5,2)     NOT NULL DEFAULT 0,
  balance_carryover_days           numeric(5,2)     NOT NULL DEFAULT 0,
  balance_carryover_expires_at     date,
  balance_accrued_days             numeric(5,2)     NOT NULL DEFAULT 0,
  balance_adjustment_days          numeric(5,2)     NOT NULL DEFAULT 0,
  balance_adjustment_reason        text,

  -- Derived (computed at read; not stored)
  -- available = total + carryover + accrued + adjustment - used - pending

  -- Extension
  balance_metadata                 jsonb            NOT NULL DEFAULT '{}'::jsonb,

  -- Audit
  created_at                       timestamptz      NOT NULL DEFAULT now(),
  updated_at                       timestamptz      NOT NULL DEFAULT now(),

  CONSTRAINT sys_tob_leave_type_check   CHECK (balance_leave_type IN (
    'VACATION','SICK','PERSONAL','MATERNITY','PATERNITY','BEREAVEMENT','STUDY','SABBATICAL','UNPAID','OTHER'
  )),
  CONSTRAINT sys_tob_year_check         CHECK (balance_year BETWEEN 2000 AND 2100),
  CONSTRAINT sys_tob_days_non_neg       CHECK (
    balance_total_days >= 0 AND balance_used_days >= 0 AND balance_pending_days >= 0
    AND balance_carryover_days >= 0 AND balance_accrued_days >= 0
  ),
  CONSTRAINT sys_tob_updated_after      CHECK (updated_at >= created_at)
);
```

### Foreign keys
```sql
ALTER TABLE sys.sys_time_off_balances
  ADD CONSTRAINT sys_tob_tenant_fk        FOREIGN KEY (balance_tenant_id)       REFERENCES sys.sys_tenancies(tenant_id) ON DELETE RESTRICT,
  ADD CONSTRAINT sys_tob_subject_user_fk  FOREIGN KEY (balance_subject_user_id) REFERENCES sys.sys_users(user_id)       ON DELETE RESTRICT;
```

### Indexes
```sql
CREATE UNIQUE INDEX sys_tob_natural_key_uq ON sys.sys_time_off_balances (balance_tenant_id, balance_natural_key);
CREATE UNIQUE INDEX sys_tob_business_uq    ON sys.sys_time_off_balances (balance_tenant_id, balance_subject_user_id, balance_leave_type, balance_year);
CREATE INDEX sys_tob_user_year_idx          ON sys.sys_time_off_balances (balance_subject_user_id, balance_year);
CREATE INDEX sys_tob_leave_type_idx         ON sys.sys_time_off_balances (balance_tenant_id, balance_leave_type);
```

### Confidence: HIGH (0.90)
15 source cols mapped. Composite business UQ added (not present in source) to enforce invariant. `balance_leave_type` CHECK ~ 10 values covers ITLAB superset.

---

## §4 — `sys.sys_time_off_requests` (BONUS — target for `public.employee_time_off_requests`, 99 rows)

### Schema

```sql
CREATE TABLE IF NOT EXISTS sys.sys_time_off_requests (
  request_id                       uuid             PRIMARY KEY DEFAULT gen_random_uuid(),
  request_tenant_id                uuid             NOT NULL,
  request_natural_key              varchar(512)     NOT NULL,

  request_subject_user_id          uuid             NOT NULL,
  request_leave_type               varchar(50)      NOT NULL,

  request_start_date               date             NOT NULL,
  request_end_date                 date             NOT NULL,
  request_days_requested           numeric(5,2)     NOT NULL,
  request_half_day_start           boolean          NOT NULL DEFAULT false,
  request_half_day_end             boolean          NOT NULL DEFAULT false,

  request_reason                   text,
  request_status                   varchar(20)      NOT NULL DEFAULT 'PENDING',
  request_approver_user_id         uuid,
  request_approved_at              timestamptz,
  request_rejection_reason         text,
  request_overlap_approved         boolean          NOT NULL DEFAULT false,

  -- Medical certificate tracking
  request_medical_cert_required    boolean          NOT NULL DEFAULT false,
  request_medical_cert_uploaded    boolean          NOT NULL DEFAULT false,

  -- Cancellation sub-workflow
  request_cancellation_requested   boolean          NOT NULL DEFAULT false,
  request_cancellation_reason      text,
  request_cancelled_at             timestamptz,
  request_cancelled_by_user_id     uuid,

  request_metadata                 jsonb            NOT NULL DEFAULT '{}'::jsonb,
  created_at                       timestamptz      NOT NULL DEFAULT now(),
  updated_at                       timestamptz      NOT NULL DEFAULT now(),

  CONSTRAINT sys_tor_leave_type_check  CHECK (request_leave_type IN (
    'VACATION','SICK','PERSONAL','MATERNITY','PATERNITY','BEREAVEMENT','STUDY','SABBATICAL','UNPAID','OTHER'
  )),
  CONSTRAINT sys_tor_status_check      CHECK (request_status IN (
    'PENDING','APPROVED','REJECTED','CANCELLED','EXPIRED'
  )),
  CONSTRAINT sys_tor_dates_ordered     CHECK (request_end_date >= request_start_date),
  CONSTRAINT sys_tor_days_positive     CHECK (request_days_requested > 0),
  CONSTRAINT sys_tor_updated_after     CHECK (updated_at >= created_at),
  CONSTRAINT sys_tor_cancel_coh        CHECK (
    request_cancellation_requested = false
    OR (request_cancellation_requested = true)  -- soft requirement (cancelled_at may be null pending)
  )
);
```

FKs: tenant→sys_tenancies, subject_user→sys_users, approver→sys_users SET NULL, cancelled_by→sys_users SET NULL.
Indexes: natural_key UQ, (user, start_date), status, tenant. Composite UQ on (tenant, user, start_date, leave_type) — optional, source has no UQ.
Confidence: **HIGH (0.88)**.

---

## §5 — `sys.sys_leave_balance_transactions` (BONUS — target for `public.leave_balance_transactions`, 27 rows)

### Schema

```sql
CREATE TABLE IF NOT EXISTS sys.sys_leave_balance_transactions (
  transaction_id                   uuid             PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_tenant_id            uuid             NOT NULL,
  transaction_natural_key          varchar(512)     NOT NULL,
  transaction_balance_id           uuid             NOT NULL,   -- self-cluster FK to sys_time_off_balances

  transaction_type                 varchar(50)      NOT NULL,
  transaction_days_amount          numeric(5,2)     NOT NULL,
  transaction_reference_type       varchar(50),
  transaction_reference_id         uuid,                          -- polymorphic (request_id, accrual_rule_id, etc.) — NOT FK
  transaction_description          text,
  transaction_performed_by_user_id uuid,
  transaction_metadata             jsonb            NOT NULL DEFAULT '{}'::jsonb,

  created_at                       timestamptz      NOT NULL DEFAULT now(),

  CONSTRAINT sys_lbt_type_check  CHECK (transaction_type IN (
    'ACCRUAL','USAGE','ADJUSTMENT','CARRYOVER','EXPIRY','RESET','TRANSFER'
  ))
);
```

FKs: tenant→sys_tenancies, balance_id→sys_time_off_balances CASCADE (preserve self-cluster semantics), performed_by→sys_users SET NULL.
Indexes: natural_key UQ, balance_id, created_at desc, tenant. No `updated_at` (event-log immutable).
Confidence: **HIGH (0.92)**.

---

## §6 — `sys.sys_leave_accrual_rules` (BONUS — target for `public.leave_accrual_rules`, 20 rows)

### Schema

```sql
CREATE TABLE IF NOT EXISTS sys.sys_leave_accrual_rules (
  accrual_rule_id                  uuid             PRIMARY KEY DEFAULT gen_random_uuid(),
  accrual_rule_tenant_id           uuid             NOT NULL,
  accrual_rule_natural_key         varchar(512)     NOT NULL,

  accrual_rule_leave_type          varchar(50)      NOT NULL,
  accrual_rule_name                varchar(100)     NOT NULL,
  accrual_rule_description         text,

  -- Accrual configuration
  accrual_rule_method              varchar(20)      NOT NULL DEFAULT 'MONTHLY',
  accrual_rule_amount              numeric(5,2)     NOT NULL,
  accrual_rule_max_accrual         numeric(5,2),

  -- Carryover policy
  accrual_rule_allow_carryover     boolean          NOT NULL DEFAULT true,
  accrual_rule_max_carryover_days  numeric(5,2),
  accrual_rule_carryover_expiry_months integer,

  -- Eligibility
  accrual_rule_min_tenure_months   integer          NOT NULL DEFAULT 0,
  accrual_rule_prorated_first_year boolean          NOT NULL DEFAULT true,

  -- CCNL (Italian labor) — HC-7 keeps varchar
  accrual_rule_ccnl_type           varchar(100),
  accrual_rule_is_ccnl_default     boolean          NOT NULL DEFAULT false,

  -- Lifecycle
  accrual_rule_is_active           boolean          NOT NULL DEFAULT true,
  accrual_rule_deleted_at          timestamptz,
  accrual_rule_metadata            jsonb            NOT NULL DEFAULT '{}'::jsonb,

  accrual_rule_created_by          uuid,
  accrual_rule_updated_by          uuid,
  created_at                       timestamptz      NOT NULL DEFAULT now(),
  updated_at                       timestamptz      NOT NULL DEFAULT now(),

  CONSTRAINT sys_lar_leave_type_check  CHECK (accrual_rule_leave_type IN (
    'VACATION','SICK','PERSONAL','MATERNITY','PATERNITY','BEREAVEMENT','STUDY','SABBATICAL','UNPAID','OTHER'
  )),
  CONSTRAINT sys_lar_method_check      CHECK (accrual_rule_method IN (
    'MONTHLY','QUARTERLY','SEMIANNUAL','ANNUAL','PER_PAY_PERIOD','LUMP_SUM'
  )),
  CONSTRAINT sys_lar_amount_positive   CHECK (accrual_rule_amount >= 0),
  CONSTRAINT sys_lar_updated_after     CHECK (updated_at >= created_at)
);
```

FKs: tenant→sys_tenancies, created_by/updated_by→sys_users.
Indexes: natural_key UQ, (tenant, leave_type), ccnl_type, active partial.
Confidence: **HIGH (0.88)** — analogous to sys_goal_templates pattern. HC-7 documents CCNL FK deferral.

---

## §11 — Aggregate properties

| # | Target table | Source rows | Expected post-import | Confidence |
|---|---|---:|---:|---|
| 1 | sys_attendance | 5237 | 5237 | HIGH (0.90) |
| 2 | sys_overtime | 383 | 383 | HIGH (0.85) |
| 3 | sys_time_off_balances | 501 | 501 | HIGH (0.90) |
| 4 | sys_time_off_requests (HC-2) | 99 | 99 | HIGH (0.88) |
| 5 | sys_leave_balance_transactions (HC-2) | 27 | 27 | HIGH (0.92) |
| 6 | sys_leave_accrual_rules (HC-2) | 20 | 20 | HIGH (0.88) |
| **TOTAL** | | **6267** | **6267** | **HIGH avg 0.89** |

---

## §12 — RLS / tenant isolation strategy

Per I5 invariant: NO RLS policies on `sys.*` tables. Tenant isolation enforced via:
1. FK `<entity>_tenant_id REFERENCES sys.sys_tenancies(tenant_id) ON DELETE RESTRICT`
2. API middleware filter (`tenantContext` plugin, step 10 in chain — `apps/api/src/app.ts`)
3. Service-layer scope authorization based on `ActorContext`

Source `RLS_FORCED` policies in `public.*` are **NOT** replicated.

PII handling (HC-4): attendance time-of-day and notes carry behavioral metadata. Pass-through approved for synthetic dataset; tag `attendance_metadata->>'pii_class' = 'time_behavioral'` for future audit pipeline detection.

---

## §13 — Migration ordering

`000040_sys_time_leave_scaffold.sql` creates tables in FK dependency order:

```
1. sys_leave_accrual_rules            (no FK to time-leave tables)
2. sys_time_off_balances              (no FK to time-leave tables)
3. sys_leave_balance_transactions     (FK to sys_time_off_balances)
4. sys_time_off_requests              (no FK to time-leave tables; transaction.reference_id polymorphic, not enforced)
5. sys_attendance                     (independent)
6. sys_overtime                       (independent)
```

Clean topological order; no deferred FK required (transactions.reference_id is polymorphic uuid, not FK).

---

## §14 — Decisions requiring Enzo (HC summary)

| HC | Decision | Default proposal |
|---|---|---|
| HC-1 | Naming `sys.sys_attendance` (singular) | ACCEPT (event-table convention) |
| HC-2 | Scope 3 vs 6 tables | **6 (recommended)** |
| HC-3 | employee_id → user vs position | **USER** per I1+I7 |
| HC-4 | PII attendance pass-through | **PASS-THROUGH + metadata tag** |
| HC-5 | `attendance_hours_total` GENERATED STORED | **RE-DERIVE GENERATED** |
| HC-6 | `payroll_job_id` orphan FK | **STORE_IN_METADATA** |
| HC-7 | `ccnl_type` FK normalization | **KEEP varchar (no catalog yet)** |
| HC-8 | Migration number 000040 | **No conflict expected** |

---

*End of 02_TARGET_SCHEMA_PROPOSAL.md*
