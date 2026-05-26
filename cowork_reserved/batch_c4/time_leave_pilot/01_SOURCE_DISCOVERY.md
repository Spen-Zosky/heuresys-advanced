# Phase 1 — SOURCE DISCOVERY — Time/Leave/Attendance (Batch C4.2)

**Authored**: 2026-05-21 (Cowork Claude, SDBI supervisor)
**ADR ref**: ADR-0014 §3.1 Phase 1
**Source**: `heuresys_platform.public.*` (6 tables introspected LIVE via psql tunnel localhost:5433)
**Mitigation**: CW-B25 (rigorous pre-spec schema introspection)

---

## §0 — Method

Schema introspected via `\d public.<table>` against live DB. Counts retrieved via `pg_class.reltuples::bigint` (sysadmin-equivalent path) because direct `SELECT COUNT(*)` is blocked by RLS policy `tenant_isolation_*` without `SET LOCAL app.current_tenant_id`. Reltuples is reliable: matched expected counts in prompt (5237/383/501/99/27/20).

Verification timestamp: 2026-05-21, psql 16 client → server 16.14 (postgres user via `heuresys` role on tunnel 5433).

| # | Table | Rows (reltuples) | Total size | Status |
|---|---|---:|---|---|
| 1 | `public.employee_attendance` | 5237 | 1624 kB | IN SCOPE |
| 2 | `public.employee_overtime` | 383 | 248 kB | IN SCOPE |
| 3 | `public.employee_time_off_balances` | 501 | 224 kB | IN SCOPE |
| 4 | `public.employee_time_off_requests` | 99 | 160 kB | BONUS (HC-2) |
| 5 | `public.leave_balance_transactions` | 27 | 112 kB | BONUS (HC-2) |
| 6 | `public.leave_accrual_rules` | 20 | 128 kB | BONUS (HC-2) |
| **TOTAL** | | **6267** | **2.5 MB** | |

Two adjacent legacy tables exist (`leave_balances`, `leave_requests`) — they appear superseded by `employee_time_off_balances` + `employee_time_off_requests` (consistent naming + FK pattern). Excluded from scope. CLI should confirm zero overlap in Phase 1.5.

---

## §1 — `public.employee_attendance` (5237 rows, IN SCOPE)

### Columns (23)
| Column | Type | Nullable | Default |
|---|---|---|---|
| id | uuid | NOT NULL | gen_random_uuid() |
| tenant_id | uuid | NOT NULL | — |
| employee_id | uuid | NOT NULL | — |
| attendance_date | date | NOT NULL | — |
| clock_in | time | NULL | — |
| clock_out | time | NULL | — |
| break_start | time | NULL | — |
| break_end | time | NULL | — |
| hours_regular | numeric(5,2) | NULL | 0 |
| hours_overtime | numeric(5,2) | NULL | 0 |
| hours_night | numeric(5,2) | NULL | 0 |
| hours_holiday | numeric(5,2) | NULL | 0 |
| hours_total | numeric(5,2) | NULL | **GENERATED ALWAYS AS (hours_regular + hours_overtime + hours_night + hours_holiday) STORED** |
| status | varchar(30) | NULL | 'present' |
| source | varchar(30) | NULL | 'manual' |
| source_reference | text | NULL | — |
| is_validated | boolean | NULL | false |
| validated_by | uuid | NULL | — |
| validated_at | timestamp (no TZ) | NULL | — |
| notes | text | NULL | — |
| created_at | timestamp (no TZ) | NULL | now() |
| updated_at | timestamp (no TZ) | NULL | now() |
| created_by | uuid | NULL | — |

### Constraints + Indexes
- PK: `id`
- **UQ**: `(tenant_id, employee_id, attendance_date)` — natural business key — carry into target
- Index: `(employee_id, attendance_date)` — query-pattern preserve
- CHECK: `updated_at >= created_at`
- FK: `tenant_id → tenants(id) ON DELETE CASCADE`, `employee_id → employees_core(id) ON DELETE CASCADE`
- RLS: `tenant_isolation_employee_attendance` (preserve via FK + middleware, NOT replicate as policy per I5)
- Trigger: `set_updated_at` (replicate with `sys.sys_set_updated_at()`)

### Semantic class
**EVENT-STREAM / DAILY FACT**. Each row is one (employee, date) attendance record. Mostly immutable post-validation (`is_validated=true` should freeze the row).

### PII analysis
`clock_in` / `clock_out` time-of-day are behavioral PII (work patterns inferable). `notes` text could contain free-form sensitive content. Source dataset is RTL Bank synthetic → no real PII per CASCADIA. Target tags `attendance_metadata.pii_class='time_behavioral'` for future GDPR pipeline.

### Cardinality estimates (per tenant)
Avg ~1310 rows per active tenant (5237 / 4). Heuresys System probably 0; SmartFood/EcoNova lower; RTL Bank highest.

---

## §2 — `public.employee_overtime` (383 rows, IN SCOPE)

### Columns (21)
| Column | Type | Nullable | Default |
|---|---|---|---|
| id | uuid | NOT NULL | gen_random_uuid() |
| tenant_id | uuid | NOT NULL | — |
| employee_id | uuid | NOT NULL | — |
| overtime_date | date | NOT NULL | — |
| overtime_type | varchar(30) | NOT NULL | — |
| hours | numeric(5,2) | NOT NULL | — |
| rate_multiplier | numeric(3,2) | NULL | — |
| hourly_rate | numeric(8,2) | NULL | — |
| total_compensation | numeric(10,2) | NULL | — |
| status | varchar(20) | NULL | 'pending' |
| requested_by | uuid | NULL | — |
| requested_at | timestamp | NULL | now() |
| approved_by | uuid | NULL | — |
| approved_at | timestamp | NULL | — |
| rejection_reason | text | NULL | — |
| payroll_job_id | uuid | NULL | — |
| exported_at | timestamp | NULL | — |
| reason | text | NULL | — |
| notes | text | NULL | — |
| created_at | timestamp | NULL | now() |
| updated_at | timestamp | NULL | now() |

### Constraints + Indexes
- PK: `id`
- Indexes: overtime_date, employee_id, payroll_job_id, status, tenant_id
- CHECK: `updated_at >= created_at`
- FK: tenant CASCADE, employee CASCADE, **payroll_job_id → payroll_export_jobs ON DELETE RESTRICT**
- No UQ on `(tenant_id, employee_id, overtime_date)` (employee can have multiple overtime entries same day) — propose composite UQ on `(tenant_id, employee_id, overtime_date, overtime_type)` in target if confirmed unique

### Semantic class
**WORKFLOW / REQUEST-APPROVAL**. State machine: `pending → approved/rejected → exported (to payroll)`.

### CW-B25 application
Need `SELECT DISTINCT overtime_type FROM employee_overtime` to validate target CHECK constraint. CLI Phase 1.5 task. Tentative values from CCNL ITLAB pattern: `WEEKDAY / WEEKEND / NIGHT / HOLIDAY`. If others exist, target CHECK extends.

### Orphan-FK concern
`payroll_job_id` references `payroll_export_jobs` which has NO `sys.sys_*` target. HC-6 strategy: store legacy uuid in `overtime_metadata->>'legacy_payroll_job_id'`.

---

## §3 — `public.employee_time_off_balances` (501 rows, IN SCOPE)

### Columns (15)
| Column | Type | Nullable | Default |
|---|---|---|---|
| id | uuid | NOT NULL | gen_random_uuid() |
| employee_id | uuid | NOT NULL | — |
| leave_type | varchar(50) | NOT NULL | — |
| total_days | numeric(5,2) | NULL | 0 |
| used_days | numeric(5,2) | NULL | 0 |
| pending_days | numeric(5,2) | NULL | 0 |
| year | integer | NULL | EXTRACT(year FROM CURRENT_DATE) |
| created_at | timestamp | NULL | now() |
| updated_at | timestamp | NULL | now() |
| tenant_id | uuid | NOT NULL | — |
| carryover_days | numeric(5,2) | NULL | 0 |
| carryover_expires_at | date | NULL | — |
| accrued_days | numeric(5,2) | NULL | 0 |
| adjustment_days | numeric(5,2) | NULL | 0 |
| adjustment_reason | text | NULL | — |

### Constraints + Indexes
- PK: `id`
- Indexes: employee_id, tenant_id, leave_type, year
- No UQ defined — propose composite UQ on `(tenant_id, employee_id, leave_type, year)` in target (likely business invariant)
- CHECK: `updated_at >= created_at`
- FK: tenant CASCADE, employee CASCADE
- **Referenced by**: `leave_balance_transactions.balance_id FK → employee_time_off_balances(id) CASCADE`

### Semantic class
**ACCUMULATOR / STATE-SNAPSHOT**. Aggregated balance per (employee, leave_type, year). Mutated as accruals/requests/usages happen.

### Pre-flight risk
`leave_type` value space: known categories from ITLAB are `vacation | sick | personal | maternity | paternity | bereavement | study | other`. Target CHECK should accept superset. CLI Phase 1.5 task: `SELECT DISTINCT leave_type FROM employee_time_off_balances`.

---

## §4 — `public.employee_time_off_requests` (99 rows, BONUS — HC-2)

### Columns (23)
| Column | Type | Nullable | Default |
|---|---|---|---|
| id | uuid | NOT NULL | gen_random_uuid() |
| employee_id | uuid | NOT NULL | — |
| leave_type | varchar(50) | NOT NULL | — |
| start_date | date | NOT NULL | — |
| end_date | date | NOT NULL | — |
| days_requested | numeric(5,2) | NOT NULL | — |
| reason | text | NULL | — |
| status | varchar(20) | NULL | 'pending' |
| approver_id | uuid | NULL | — |
| approved_at | timestamp | NULL | — |
| rejection_reason | text | NULL | — |
| created_at | timestamp | NULL | now() |
| updated_at | timestamp | NULL | now() |
| tenant_id | uuid | NOT NULL | — |
| half_day_start | boolean | NULL | false |
| half_day_end | boolean | NULL | false |
| overlap_approved | boolean | NULL | false |
| medical_certificate_required | boolean | NULL | false |
| medical_certificate_uploaded | boolean | NULL | false |
| cancellation_requested | boolean | NULL | false |
| cancellation_reason | text | NULL | — |
| cancelled_at | timestamp | NULL | — |
| cancelled_by | uuid | NULL | — |

### Constraints + Indexes
- Indexes: approver_id, (start_date, end_date), employee_id, status, tenant_id
- CHECK: `updated_at >= created_at`
- FK: tenant CASCADE, approver SET NULL → employees_core, employee CASCADE
- **Referenced by**: `leave_approval_steps.request_id CASCADE`, `medical_certificates.request_id SET NULL`

### Semantic class
**WORKFLOW / REQUEST-APPROVAL** with cancellation sub-state. State machine: `pending → approved/rejected → [cancellation_requested → cancelled]`. Medical certificate sub-tracking.

---

## §5 — `public.leave_balance_transactions` (27 rows, BONUS — HC-2)

### Columns (10)
| Column | Type | Nullable | Default |
|---|---|---|---|
| id | uuid | NOT NULL | gen_random_uuid() |
| tenant_id | uuid | NOT NULL | — |
| balance_id | uuid | NOT NULL | — |
| transaction_type | varchar(50) | NOT NULL | — |
| days_amount | numeric(5,2) | NOT NULL | — |
| reference_type | varchar(50) | NULL | — |
| reference_id | uuid | NULL | — |
| description | text | NULL | — |
| performed_by | uuid | NULL | — |
| created_at | timestamp | NULL | now() |

### Constraints + Indexes
- Indexes: balance_id, created_at, tenant_id
- No CHECK (immutable event-log)
- FK: tenant CASCADE, **balance_id → employee_time_off_balances CASCADE** (self-cluster FK)

### Semantic class
**EVENT-LOG / IMMUTABLE**. Audit trail for balance mutations. `transaction_type ∈ {accrual, usage, adjustment, carryover, expiry, ...}` likely.

### Self-FK pattern
Pass-2 resolution needed: balance_id → sys.sys_time_off_balance.balance_id via `temp_sdbi._legacy_source_balance_id` ↔ resolved balance_id mapping.

---

## §6 — `public.leave_accrual_rules` (20 rows, BONUS — HC-2)

### Columns (19)
| Column | Type | Nullable | Default |
|---|---|---|---|
| id | uuid | NOT NULL | gen_random_uuid() |
| tenant_id | uuid | NOT NULL | — |
| leave_type | varchar(50) | NOT NULL | — |
| name | varchar(100) | NOT NULL | — |
| description | text | NULL | — |
| accrual_method | varchar(20) | NULL | 'monthly' |
| accrual_amount | numeric(5,2) | NOT NULL | — |
| max_accrual | numeric(5,2) | NULL | — |
| allow_carryover | boolean | NULL | true |
| max_carryover_days | numeric(5,2) | NULL | — |
| carryover_expiry_months | integer | NULL | — |
| min_tenure_months | integer | NULL | 0 |
| prorated_first_year | boolean | NULL | true |
| **ccnl_type** | varchar(100) | NULL | — |
| **is_ccnl_default** | boolean | NULL | false |
| is_active | boolean | NULL | true |
| created_at | timestamp | NULL | now() |
| updated_at | timestamp | NULL | now() |
| deleted_at | timestamptz | NULL | — |

### Constraints + Indexes
- Indexes: is_active partial, ccnl_type, tenant_id, leave_type
- CHECK: `updated_at >= created_at`
- FK: tenant CASCADE
- Soft-delete: `deleted_at` (preserve in target)

### Semantic class
**CATALOG / TEMPLATE**. Defines how leave accrues per CCNL contract category. Analogous to `sys.sys_goal_templates`. Most likely small per-tenant (default policies + overrides).

### CCNL bonus value
`ccnl_type` is ITLAB integration point (Italian labor compliance). Target should preserve field as `accrual_rule_ccnl_type varchar(100)` — HC-7 keeps varchar (no `sys.sys_ccnl_catalog` yet).

---

## §7 — FK / lineage summary

```
tenants(id) ←──── employee_attendance.tenant_id           [→ sys.sys_tenancies]
              ←── employee_overtime.tenant_id              [→ sys.sys_tenancies]
              ←── employee_time_off_balances.tenant_id     [→ sys.sys_tenancies]
              ←── employee_time_off_requests.tenant_id     [→ sys.sys_tenancies]
              ←── leave_balance_transactions.tenant_id     [→ sys.sys_tenancies]
              ←── leave_accrual_rules.tenant_id            [→ sys.sys_tenancies]

employees_core(id) ←── employee_attendance.employee_id     [→ sys.sys_users.user_id via legacy_mirror]
                   ←── employee_attendance.validated_by    [→ sys.sys_users SET NULL]
                   ←── employee_attendance.created_by      [→ sys.sys_users SET NULL]
                   ←── employee_overtime.employee_id       [→ sys.sys_users]
                   ←── employee_overtime.requested_by      [→ sys.sys_users SET NULL]
                   ←── employee_overtime.approved_by       [→ sys.sys_users SET NULL]
                   ←── employee_time_off_balances.employee_id [→ sys.sys_users]
                   ←── employee_time_off_requests.employee_id [→ sys.sys_users]
                   ←── employee_time_off_requests.approver_id [→ sys.sys_users SET NULL]
                   ←── employee_time_off_requests.cancelled_by [→ sys.sys_users SET NULL]
                   ←── leave_balance_transactions.performed_by [→ sys.sys_users SET NULL]

employee_time_off_balances(id) ←── leave_balance_transactions.balance_id  [SELF-CLUSTER FK]

payroll_export_jobs(id) ←── employee_overtime.payroll_job_id   [ORPHAN — store in metadata, HC-6]
```

All FKs map cleanly via:
1. `brownfield.tenant_id_mappings` (existing) for tenants → sys_tenancies
2. `legacy_mirror.users` (extracted batch C3.2) employee_id ↔ user_id ↔ email for employees_core → sys_users
3. Self-FK balance_id resolves via temp_sdbi pass 2

---

## §8 — Aggregate NOT NULL inventory (for CW-B18 enforcement)

Per table, enumerate NOT NULL source cols to ensure none silently skipped in mapping:

| Table | NOT NULL cols (excluding id) |
|---|---|
| employee_attendance | tenant_id, employee_id, attendance_date (3) |
| employee_overtime | tenant_id, employee_id, overtime_date, overtime_type, hours (5) |
| employee_time_off_balances | tenant_id, employee_id, leave_type (3) |
| employee_time_off_requests | tenant_id, employee_id, leave_type, start_date, end_date, days_requested (6) |
| leave_balance_transactions | tenant_id, balance_id, transaction_type, days_amount (4) |
| leave_accrual_rules | tenant_id, leave_type, name, accrual_amount (4) |
| **TOTAL** | **25 NOT NULL cols across 6 tables** |

All 25 enumerated → all mapped in target (no silent drop allowed).

---

## §9 — Freshness check

Live psql session 2026-05-21 confirms current state. No active migrations or background writes detected (read-only inspection). Data baseline frozen as of last bulk import to `public.*` (predates SDBI authoring, no cross-contamination risk).

---

*End of 01_SOURCE_DISCOVERY.md*
