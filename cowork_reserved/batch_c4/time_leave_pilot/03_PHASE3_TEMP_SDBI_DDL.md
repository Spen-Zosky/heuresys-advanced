# Phase 3 — `temp_sdbi.*` mirror DDLs (Time/Leave pilot)

**ADR ref**: ADR-0014 §3.1 Phase 3 + §3.2 (Schema locations)
**Purpose**: DDLs for 6 transient staging tables mirroring `sys.*` targets **without FK constraints**. CLI executes these post 000040 migration apply, then INSERT...SELECT from `heuresys_platform.public.*` (cross-DB pipeline or legacy_mirror extract).

**Naming**: `temp_sdbi.<short_name>` — drops `sys_` prefix:
- `sys.sys_attendance` ← mirror → `temp_sdbi.attendance`
- `sys.sys_overtime` ← mirror → `temp_sdbi.overtime`
- `sys.sys_time_off_balances` ← mirror → `temp_sdbi.time_off_balances`
- `sys.sys_time_off_requests` ← mirror → `temp_sdbi.time_off_requests`
- `sys.sys_leave_balance_transactions` ← mirror → `temp_sdbi.leave_balance_transactions`
- `sys.sys_leave_accrual_rules` ← mirror → `temp_sdbi.leave_accrual_rules`

**Design choices**:
- Same columns + types as `sys.*` target (INSERT into sys.* via SELECT * is column-aligned)
- NO FK constraints (TRUNCATE-able, cross-source-table FK resolution done in-pipeline)
- NO triggers (immutable staging)
- NO indexes initially (bulk INSERT; add only if Phase 5 SELECT joins slow)
- 1 extra column `_legacy_source_id uuid NOT NULL` (PK) to track source row identity
- For cross-FK references (e.g. balance_id in transactions), extra `_legacy_source_<fk>_id` cols carry the source FK for pass-2 resolution
- NO GENERATED columns in staging — `attendance_hours_total` becomes plain `numeric(5,2)` (avoids constraint friction during bulk load; target re-generates on INSERT)

---

## §1 — DDL bundle (idempotent, single transaction)

```sql
BEGIN;

-- ============================================================================
-- temp_sdbi.leave_accrual_rules
-- ============================================================================
CREATE TABLE IF NOT EXISTS temp_sdbi.leave_accrual_rules (
  _legacy_source_id                     uuid             NOT NULL,
  _import_run_id                        uuid             NOT NULL,
  accrual_rule_id                       uuid             NOT NULL DEFAULT gen_random_uuid(),
  accrual_rule_tenant_id                uuid             NOT NULL,
  accrual_rule_natural_key              varchar(512)     NOT NULL,
  accrual_rule_leave_type               varchar(50)      NOT NULL,
  accrual_rule_name                     varchar(100)     NOT NULL,
  accrual_rule_description              text,
  accrual_rule_method                   varchar(20)      NOT NULL,
  accrual_rule_amount                   numeric(5,2)     NOT NULL,
  accrual_rule_max_accrual              numeric(5,2),
  accrual_rule_allow_carryover          boolean          NOT NULL,
  accrual_rule_max_carryover_days       numeric(5,2),
  accrual_rule_carryover_expiry_months  integer,
  accrual_rule_min_tenure_months        integer          NOT NULL,
  accrual_rule_prorated_first_year      boolean          NOT NULL,
  accrual_rule_ccnl_type                varchar(100),
  accrual_rule_is_ccnl_default          boolean          NOT NULL,
  accrual_rule_is_active                boolean          NOT NULL,
  accrual_rule_deleted_at               timestamptz,
  accrual_rule_metadata                 jsonb            NOT NULL DEFAULT '{}'::jsonb,
  accrual_rule_created_by               uuid,
  accrual_rule_updated_by               uuid,
  created_at                            timestamptz      NOT NULL,
  updated_at                            timestamptz      NOT NULL,
  PRIMARY KEY (_legacy_source_id)
);

CREATE INDEX IF NOT EXISTS temp_sdbi_lar_tenant_idx ON temp_sdbi.leave_accrual_rules (accrual_rule_tenant_id);


-- ============================================================================
-- temp_sdbi.time_off_balances
-- ============================================================================
CREATE TABLE IF NOT EXISTS temp_sdbi.time_off_balances (
  _legacy_source_id                uuid             NOT NULL,
  _legacy_source_employee_id       uuid             NOT NULL,    -- raw source.employee_id → resolved to subject_user
  _import_run_id                   uuid             NOT NULL,
  balance_id                       uuid             NOT NULL DEFAULT gen_random_uuid(),
  balance_tenant_id                uuid             NOT NULL,
  balance_natural_key              varchar(512)     NOT NULL,
  balance_subject_user_id          uuid,                            -- resolved Phase 5 pass 1
  balance_leave_type               varchar(50)      NOT NULL,
  balance_year                     integer          NOT NULL,
  balance_total_days               numeric(5,2)     NOT NULL,
  balance_used_days                numeric(5,2)     NOT NULL,
  balance_pending_days             numeric(5,2)     NOT NULL,
  balance_carryover_days           numeric(5,2)     NOT NULL,
  balance_carryover_expires_at     date,
  balance_accrued_days             numeric(5,2)     NOT NULL,
  balance_adjustment_days          numeric(5,2)     NOT NULL,
  balance_adjustment_reason        text,
  balance_metadata                 jsonb            NOT NULL DEFAULT '{}'::jsonb,
  created_at                       timestamptz      NOT NULL,
  updated_at                       timestamptz      NOT NULL,
  PRIMARY KEY (_legacy_source_id)
);

CREATE INDEX IF NOT EXISTS temp_sdbi_tob_legacy_emp_idx ON temp_sdbi.time_off_balances (_legacy_source_employee_id);


-- ============================================================================
-- temp_sdbi.leave_balance_transactions  (self-FK to balances pass 2)
-- ============================================================================
CREATE TABLE IF NOT EXISTS temp_sdbi.leave_balance_transactions (
  _legacy_source_id                uuid             NOT NULL,
  _legacy_source_balance_id        uuid             NOT NULL,    -- raw source.balance_id → resolved pass 2
  _legacy_source_performed_by      uuid,                          -- raw source.performed_by
  _import_run_id                   uuid             NOT NULL,
  transaction_id                   uuid             NOT NULL DEFAULT gen_random_uuid(),
  transaction_tenant_id            uuid             NOT NULL,
  transaction_natural_key          varchar(512)     NOT NULL,
  transaction_balance_id           uuid,                            -- resolved Phase 5 pass 2
  transaction_type                 varchar(50)      NOT NULL,
  transaction_days_amount          numeric(5,2)     NOT NULL,
  transaction_reference_type       varchar(50),
  transaction_reference_id         uuid,
  transaction_description          text,
  transaction_performed_by_user_id uuid,                            -- resolved pass 1
  transaction_metadata             jsonb            NOT NULL DEFAULT '{}'::jsonb,
  created_at                       timestamptz      NOT NULL,
  PRIMARY KEY (_legacy_source_id)
);

CREATE INDEX IF NOT EXISTS temp_sdbi_lbt_legacy_bal_idx ON temp_sdbi.leave_balance_transactions (_legacy_source_balance_id);


-- ============================================================================
-- temp_sdbi.time_off_requests
-- ============================================================================
CREATE TABLE IF NOT EXISTS temp_sdbi.time_off_requests (
  _legacy_source_id                uuid             NOT NULL,
  _legacy_source_employee_id       uuid             NOT NULL,
  _legacy_source_approver_id       uuid,
  _legacy_source_cancelled_by      uuid,
  _import_run_id                   uuid             NOT NULL,
  request_id                       uuid             NOT NULL DEFAULT gen_random_uuid(),
  request_tenant_id                uuid             NOT NULL,
  request_natural_key              varchar(512)     NOT NULL,
  request_subject_user_id          uuid,
  request_leave_type               varchar(50)      NOT NULL,
  request_start_date               date             NOT NULL,
  request_end_date                 date             NOT NULL,
  request_days_requested           numeric(5,2)     NOT NULL,
  request_half_day_start           boolean          NOT NULL,
  request_half_day_end             boolean          NOT NULL,
  request_reason                   text,
  request_status                   varchar(20)      NOT NULL,
  request_approver_user_id         uuid,
  request_approved_at              timestamptz,
  request_rejection_reason         text,
  request_overlap_approved         boolean          NOT NULL,
  request_medical_cert_required    boolean          NOT NULL,
  request_medical_cert_uploaded    boolean          NOT NULL,
  request_cancellation_requested   boolean          NOT NULL,
  request_cancellation_reason      text,
  request_cancelled_at             timestamptz,
  request_cancelled_by_user_id     uuid,
  request_metadata                 jsonb            NOT NULL DEFAULT '{}'::jsonb,
  created_at                       timestamptz      NOT NULL,
  updated_at                       timestamptz      NOT NULL,
  PRIMARY KEY (_legacy_source_id)
);

CREATE INDEX IF NOT EXISTS temp_sdbi_tor_legacy_emp_idx ON temp_sdbi.time_off_requests (_legacy_source_employee_id);


-- ============================================================================
-- temp_sdbi.attendance  (HIGH-VOLUME 5237 — biggest staging table)
-- Note: NO GENERATED column here (target re-derives on INSERT)
-- ============================================================================
CREATE TABLE IF NOT EXISTS temp_sdbi.attendance (
  _legacy_source_id                uuid             NOT NULL,
  _legacy_source_employee_id       uuid             NOT NULL,
  _legacy_source_validated_by      uuid,
  _legacy_source_created_by        uuid,
  _import_run_id                   uuid             NOT NULL,
  attendance_id                    uuid             NOT NULL DEFAULT gen_random_uuid(),
  attendance_tenant_id             uuid             NOT NULL,
  attendance_natural_key           varchar(512)     NOT NULL,
  attendance_subject_user_id       uuid,
  attendance_date                  date             NOT NULL,
  attendance_clock_in              time,
  attendance_clock_out             time,
  attendance_break_start           time,
  attendance_break_end             time,
  attendance_hours_regular         numeric(5,2)     NOT NULL,
  attendance_hours_overtime        numeric(5,2)     NOT NULL,
  attendance_hours_night           numeric(5,2)     NOT NULL,
  attendance_hours_holiday         numeric(5,2)     NOT NULL,
  -- attendance_hours_total deliberately OMITTED (sys.* GENERATED re-derives on consolidation INSERT)
  attendance_status                varchar(32)      NOT NULL,
  attendance_source                varchar(32)      NOT NULL,
  attendance_source_reference      text,
  attendance_is_validated          boolean          NOT NULL,
  attendance_validated_by_user_id  uuid,
  attendance_validated_at          timestamptz,
  attendance_notes                 text,
  attendance_metadata              jsonb            NOT NULL DEFAULT '{}'::jsonb,
  attendance_created_by            uuid,
  attendance_updated_by            uuid,
  created_at                       timestamptz      NOT NULL,
  updated_at                       timestamptz      NOT NULL,
  PRIMARY KEY (_legacy_source_id)
);

CREATE INDEX IF NOT EXISTS temp_sdbi_attendance_legacy_emp_idx ON temp_sdbi.attendance (_legacy_source_employee_id);
CREATE INDEX IF NOT EXISTS temp_sdbi_attendance_tenant_idx     ON temp_sdbi.attendance (attendance_tenant_id);


-- ============================================================================
-- temp_sdbi.overtime
-- ============================================================================
CREATE TABLE IF NOT EXISTS temp_sdbi.overtime (
  _legacy_source_id                uuid             NOT NULL,
  _legacy_source_employee_id       uuid             NOT NULL,
  _legacy_source_requested_by      uuid,
  _legacy_source_approved_by       uuid,
  _legacy_source_payroll_job_id    uuid,                            -- HC-6: kept here for metadata population
  _import_run_id                   uuid             NOT NULL,
  overtime_id                      uuid             NOT NULL DEFAULT gen_random_uuid(),
  overtime_tenant_id               uuid             NOT NULL,
  overtime_natural_key             varchar(512)     NOT NULL,
  overtime_subject_user_id         uuid,
  overtime_date                    date             NOT NULL,
  overtime_type                    varchar(32)      NOT NULL,
  overtime_hours                   numeric(5,2)     NOT NULL,
  overtime_rate_multiplier         numeric(3,2),
  overtime_hourly_rate             numeric(8,2),
  overtime_total_compensation      numeric(10,2),
  overtime_status                  varchar(20)      NOT NULL,
  overtime_requested_by_user_id    uuid,
  overtime_requested_at            timestamptz      NOT NULL,
  overtime_approved_by_user_id     uuid,
  overtime_approved_at             timestamptz,
  overtime_rejection_reason        text,
  overtime_exported_at             timestamptz,
  overtime_reason                  text,
  overtime_notes                   text,
  overtime_metadata                jsonb            NOT NULL DEFAULT '{}'::jsonb,
  created_at                       timestamptz      NOT NULL,
  updated_at                       timestamptz      NOT NULL,
  PRIMARY KEY (_legacy_source_id)
);

CREATE INDEX IF NOT EXISTS temp_sdbi_overtime_legacy_emp_idx ON temp_sdbi.overtime (_legacy_source_employee_id);


COMMIT;
```

---

## §2 — Seeding strategy (CLI runtime)

**Option A — direct cross-DB INSERT via dblink** (if dblink extension available in heuresys_advanced):

```sql
-- Example for attendance (run inside heuresys_advanced)
INSERT INTO temp_sdbi.attendance (
  _legacy_source_id, _legacy_source_employee_id, _legacy_source_validated_by, _legacy_source_created_by, _import_run_id,
  attendance_tenant_id, attendance_natural_key, attendance_subject_user_id,
  attendance_date, attendance_clock_in, attendance_clock_out, attendance_break_start, attendance_break_end,
  attendance_hours_regular, attendance_hours_overtime, attendance_hours_night, attendance_hours_holiday,
  attendance_status, attendance_source, attendance_source_reference,
  attendance_is_validated, attendance_validated_by_user_id, attendance_validated_at,
  attendance_notes, attendance_metadata, attendance_created_by, attendance_updated_by,
  created_at, updated_at
)
SELECT
  src.id, src.employee_id, src.validated_by, src.created_by, :run_uuid,
  tm.canonical_tenant_id,
  'ATTEND::' || COALESCE(tm.tenant_slug, 'unknown') || '::' || src.id::text,
  NULL::uuid,                                                       -- resolved pass 1 below
  src.attendance_date, src.clock_in, src.clock_out, src.break_start, src.break_end,
  COALESCE(src.hours_regular, 0), COALESCE(src.hours_overtime, 0), COALESCE(src.hours_night, 0), COALESCE(src.hours_holiday, 0),
  UPPER(COALESCE(src.status, 'PRESENT')), UPPER(COALESCE(src.source, 'MANUAL')), src.source_reference,
  COALESCE(src.is_validated, false), NULL::uuid, src.validated_at::timestamptz,
  src.notes,
  jsonb_build_object(
    'legacy_id', src.id::text,
    'legacy_table', 'public.employee_attendance',
    'import_run_id', :run_uuid::text,
    'imported_at', now()::text,
    'pii_class', 'time_behavioral'
  ),
  NULL::uuid, NULL::uuid,
  src.created_at::timestamptz, src.updated_at::timestamptz
FROM dblink(:dblink_conn,
  'SELECT id, tenant_id, employee_id, attendance_date, clock_in, clock_out, break_start, break_end,
          hours_regular, hours_overtime, hours_night, hours_holiday,
          status, source, source_reference, is_validated, validated_by, validated_at,
          notes, created_at, updated_at, created_by
   FROM public.employee_attendance')
   AS src(id uuid, tenant_id uuid, employee_id uuid, attendance_date date, clock_in time, clock_out time,
          break_start time, break_end time, hours_regular numeric(5,2), hours_overtime numeric(5,2),
          hours_night numeric(5,2), hours_holiday numeric(5,2), status varchar(30), source varchar(30),
          source_reference text, is_validated boolean, validated_by uuid, validated_at timestamp,
          notes text, created_at timestamp, updated_at timestamp, created_by uuid)
LEFT JOIN brownfield.tenant_id_mappings tm ON tm.legacy_id = src.tenant_id::text;
```

**Option B — pg_dump/psql pipeline** (if dblink unavailable):

```bash
# Snapshot source table to local CSV
psql -h localhost -p 5433 -U heuresys -d heuresys_platform \
  -c "\\COPY (SELECT * FROM public.employee_attendance) TO STDOUT WITH CSV HEADER" \
  > /tmp/attendance.csv

# Load to staging via temp table in heuresys_advanced
psql -h localhost -p 5433 -U heuresys -d heuresys_advanced -v ON_ERROR_STOP=1 <<EOF
CREATE TEMP TABLE _stage_attendance (LIKE public.employee_attendance);  -- replicate source schema
\\COPY _stage_attendance FROM '/tmp/attendance.csv' WITH CSV HEADER;
INSERT INTO temp_sdbi.attendance (...) SELECT ... FROM _stage_attendance JOIN brownfield.tenant_id_mappings ...;
EOF
```

**Recommended**: Option B (more portable cross-OS, no dblink dependency). Each table snapshot ≤ 2 MB, fits in memory comfortably.

---

## §3 — Pass-1 / Pass-2 user-id resolution (after bulk load)

After all 6 temp_sdbi tables seeded:

```sql
BEGIN;

-- Pass 1: resolve subject_user_id from legacy employee_id via legacy_mirror.users
UPDATE temp_sdbi.attendance ta
SET attendance_subject_user_id = (
  SELECT u.user_id FROM sys.sys_users u
  JOIN legacy_mirror.users lu ON LOWER(lu.email) = LOWER(u.user_email)
  WHERE lu.employee_id = ta._legacy_source_employee_id
  LIMIT 1
);

-- Same pattern for attendance_validated_by_user_id, attendance_created_by, etc.
UPDATE temp_sdbi.attendance ta
SET attendance_validated_by_user_id = (
  SELECT u.user_id FROM sys.sys_users u
  JOIN legacy_mirror.users lu ON LOWER(lu.email) = LOWER(u.user_email)
  WHERE lu.employee_id = ta._legacy_source_validated_by
  LIMIT 1
)
WHERE ta._legacy_source_validated_by IS NOT NULL;

-- Repeat per table:
--   temp_sdbi.overtime: subject_user_id + requested_by + approved_by
--   temp_sdbi.time_off_balances: subject_user_id
--   temp_sdbi.time_off_requests: subject_user_id + approver_user_id + cancelled_by_user_id
--   temp_sdbi.leave_balance_transactions: performed_by_user_id (Pass 1)
--   temp_sdbi.leave_accrual_rules: created_by + updated_by

-- Sanity: count unresolved NOT NULL subjects (should be 0 for tables with NOT NULL user FK)
SELECT 'attendance' src, COUNT(*) unresolved FROM temp_sdbi.attendance WHERE attendance_subject_user_id IS NULL
UNION ALL SELECT 'overtime', COUNT(*) FROM temp_sdbi.overtime WHERE overtime_subject_user_id IS NULL
UNION ALL SELECT 'time_off_balances', COUNT(*) FROM temp_sdbi.time_off_balances WHERE balance_subject_user_id IS NULL
UNION ALL SELECT 'time_off_requests', COUNT(*) FROM temp_sdbi.time_off_requests WHERE request_subject_user_id IS NULL;
-- If unresolved > 0 → abort consolidation; surface to Enzo (likely legacy_mirror gap)

COMMIT;
```

Pass-2 (self-FK balance_id resolution) happens in Phase 5 (after balances are in `sys.sys_time_off_balances`) — see `04_PHASE5_CONSOLIDATION_PLAN.md` §3.

---

## §4 — Tenant slug lookup

The natural_key pattern uses `tenant_slug`. Resolve via `sys.sys_tenancies.tenant_slug` (or `brownfield.tenant_id_mappings.tenant_slug`):

```sql
-- Convenience CTE for INSERT into sys.* during Phase 5
WITH tenant_slugs AS (
  SELECT tenant_id, tenant_slug FROM sys.sys_tenancies
)
INSERT INTO sys.sys_attendance (...) SELECT ... FROM temp_sdbi.attendance ta JOIN tenant_slugs ts ON ts.tenant_id = ta.attendance_tenant_id;
```

---

*End of 03_PHASE3_TEMP_SDBI_DDL.md*
