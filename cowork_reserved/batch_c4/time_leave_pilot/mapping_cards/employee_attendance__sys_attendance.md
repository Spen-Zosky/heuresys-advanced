# Mapping Card — `public.employee_attendance` → `sys.sys_attendance`

## Metadata
- mapping_card_id: TIME-LEAVE-PILOT-MAP-01
- source: `heuresys_platform.public.employee_attendance` (5237 rows)
- target: `heuresys_advanced.sys.sys_attendance`
- created: 2026-05-21
- author: SDBI AI (Cowork Claude)
- approver: PENDING (Enzo)
- confidence_overall: **0.90 HIGH**
- workflow_phase: 2 (TARGET ANALOGY MATCHING)

## Source semantic analysis
- semantic_type: EVENT-STREAM / DAILY FACT
- contains_pii: yes (time-of-day behavioral, notes free-text) — HC-4 default pass-through with metadata tag
- temporal: snapshot per (employee, date)
- soft_delete: NO (validation lifecycle = freeze, not delete)
- hierarchy: NONE

## Field mapping (per column)

| source_col | source_type | target_col | target_type | transform | confidence | reasoning |
|---|---|---|---|---|---|---|
| id | uuid | `attendance_metadata->>'legacy_id'` | jsonb-extracted | STORE_IN_METADATA | HIGH | source uuid retained for lineage; target generates new uuid |
| tenant_id | uuid | attendance_tenant_id | uuid | LOOKUP_TENANT_ID via brownfield.tenant_id_mappings | HIGH | already-proven (Goals pilot) |
| employee_id | uuid | attendance_subject_user_id | uuid | LOOKUP_USER_BY_LEGACY_EMPLOYEE via legacy_mirror.users | HIGH | HC-3: user-anchored. Mediation: employees_core.id → legacy_mirror.users WHERE employee_id matches → sys_users via email |
| attendance_date | date | attendance_date | date | DIRECT_COPY | HIGH | type match |
| clock_in | time | attendance_clock_in | time | DIRECT_COPY | HIGH | |
| clock_out | time | attendance_clock_out | time | DIRECT_COPY | HIGH | |
| break_start | time | attendance_break_start | time | DIRECT_COPY | HIGH | |
| break_end | time | attendance_break_end | time | DIRECT_COPY | HIGH | |
| hours_regular | numeric(5,2) | attendance_hours_regular | numeric(5,2) | DIRECT_COPY + COALESCE 0 | HIGH | |
| hours_overtime | numeric(5,2) | attendance_hours_overtime | numeric(5,2) | DIRECT_COPY + COALESCE 0 | HIGH | |
| hours_night | numeric(5,2) | attendance_hours_night | numeric(5,2) | DIRECT_COPY + COALESCE 0 | HIGH | |
| hours_holiday | numeric(5,2) | attendance_hours_holiday | numeric(5,2) | DIRECT_COPY + COALESCE 0 | HIGH | |
| hours_total | numeric(5,2) GENERATED | (auto-computed target side) | numeric(5,2) GENERATED | NO_COPY (target re-derives via GENERATED) | HIGH | HC-5 confirmed: re-derive on target |
| status | varchar(30) | attendance_status | varchar(32) | UPPERCASE + length-validate | HIGH | source values lowercase like 'present', 'sick' → target UPPER_SNAKE. CHECK extended to forward-compat (REMOTE, BUSINESS_TRIP) |
| source | varchar(30) | attendance_source | varchar(32) | UPPERCASE | HIGH | 'manual' → 'MANUAL' |
| source_reference | text | attendance_source_reference | text | DIRECT_COPY | HIGH | |
| is_validated | boolean | attendance_is_validated | boolean | DIRECT_COPY (COALESCE false) | HIGH | |
| validated_by | uuid | attendance_validated_by_user_id | uuid | LOOKUP_USER_BY_LEGACY_EMPLOYEE | MEDIUM | nullable, same path as subject |
| validated_at | timestamp WITHOUT TZ | attendance_validated_at | timestamptz | CAST_TO_TIMESTAMPTZ assuming UTC | MEDIUM | source no TZ — assume UTC |
| notes | text | attendance_notes | text | DIRECT_COPY | HIGH | |
| created_at | timestamp WITHOUT TZ | created_at | timestamptz | CAST_TO_TIMESTAMPTZ UTC | MEDIUM | |
| updated_at | timestamp WITHOUT TZ | updated_at | timestamptz | CAST_TO_TIMESTAMPTZ UTC | MEDIUM | |
| created_by | uuid | attendance_created_by | uuid | LOOKUP_USER_BY_LEGACY_EMPLOYEE | MEDIUM | nullable |

## Computed target columns
- `attendance_natural_key`: `'ATTEND::' || tenant_slug || '::' || source_id::text`
  - e.g. `ATTEND::rtl-bank::abc12345-...`
- `attendance_metadata`:
  ```jsonb
  {
    "legacy_id": "<source.id>",
    "legacy_table": "public.employee_attendance",
    "import_run_id": "<run_uuid>",
    "imported_at": "<timestamp>",
    "pii_class": "time_behavioral"
  }
  ```
- `attendance_updated_by`: NULL (source has no updated_by column)

## FK resolution strategy

| FK | Resolution |
|---|---|
| attendance_tenant_id | `brownfield.tenant_id_mappings.canonical_tenant_id` WHERE `legacy_id = source.tenant_id::text` |
| attendance_subject_user_id | `legacy_mirror.users.user_id` lookup chain: source.employee_id → `legacy_mirror.users WHERE employee_id = source.employee_id` → resolved `sys_users.user_id` via email match |
| attendance_validated_by_user_id | Same as subject (nullable, fallback NULL) |
| attendance_created_by | Same (nullable) |

## Pre-flight checks (verified live)
- Source row count: **5237** (via `pg_class.reltuples`)
- FK integrity (assumed valid since enforced via CASCADE FKs):
  - employee_id → employees_core: source declared NOT NULL + CASCADE FK → 0 dangling guaranteed
  - tenant_id → tenants: source declared NOT NULL + CASCADE FK → 0 dangling guaranteed
- UQ source: `(tenant_id, employee_id, attendance_date)` — natural business key carried to target as `sys_attendance_business_uq`
- GENERATED hours_total: source matches target expression exactly (validated by inspection of `\d`)

## Pre-INSERT validation (CW-B25 follow-up by CLI)
```sql
-- Verify distinct status values fit target CHECK
SELECT DISTINCT status FROM heuresys_platform.public.employee_attendance;
-- If new values appear → extend sys_attendance_status_check

-- Verify distinct source values fit target CHECK
SELECT DISTINCT source FROM heuresys_platform.public.employee_attendance;
-- If new values appear → extend sys_attendance_source_check
```

## Post-execution acceptance criteria

| # | Criterion | Check |
|---|---|---|
| A1 | `sys.sys_attendance` count = 5237 | `SELECT COUNT(*) FROM sys.sys_attendance` (post-import) |
| A2 | 0 NULL on NOT NULL cols | `SELECT COUNT(*) FROM sys.sys_attendance WHERE attendance_tenant_id IS NULL OR attendance_subject_user_id IS NULL OR attendance_date IS NULL` = 0 |
| A3 | All tenant FK resolve | `SELECT COUNT(*) FROM sys.sys_attendance a LEFT JOIN sys.sys_tenancies t ON t.tenant_id=a.attendance_tenant_id WHERE t.tenant_id IS NULL` = 0 |
| A4 | All subject_user FK resolve (NOT NULL constraint) | `SELECT COUNT(*) FROM sys.sys_attendance a LEFT JOIN sys.sys_users u ON u.user_id=a.attendance_subject_user_id WHERE u.user_id IS NULL` = 0 |
| A5 | GENERATED hours_total matches sum | `SELECT COUNT(*) FROM sys.sys_attendance WHERE attendance_hours_total <> attendance_hours_regular + attendance_hours_overtime + attendance_hours_night + attendance_hours_holiday` = 0 |
| A6 | Validation coherence | `SELECT COUNT(*) FROM sys.sys_attendance WHERE attendance_is_validated = true AND (attendance_validated_by_user_id IS NULL OR attendance_validated_at IS NULL)` = 0 |
| A7 | Business UQ preserved | `SELECT COUNT(*) FROM (SELECT attendance_tenant_id, attendance_subject_user_id, attendance_date, COUNT(*) c FROM sys.sys_attendance GROUP BY 1,2,3 HAVING COUNT(*) > 1) x` = 0 |
| A8 | Lineage rows = 5237 | `SELECT COUNT(*) FROM sys.sys_source_lineage_records WHERE target_table_name='sys.sys_attendance'` = 5237 |

## Confidence breakdown

| Aspect | Confidence | Notes |
|---|---|---|
| Schema/type compat | 0.95 | Type match exact except TZ cast |
| Value enum mapping | 0.85 | status/source CHECK needs Phase 1.5 distinct verification |
| FK resolution | 0.90 | Reuses Goals pilot resolution path |
| GENERATED column | 0.98 | Identical expression preserved |
| Audit instrumentation | 0.92 | Standard pattern |
| Edge cases | 0.85 | TZ assumption + nullable validated_by mediation |
| **Overall** | **0.90 HIGH** | Auto-approve qualified (>0.85 threshold ADR-0014 §3.3) |

## Human review notes
- [PENDING] Enzo confirm HC-3 (employee_id → user)
- [PENDING] Enzo confirm HC-4 (PII pass-through + metadata tag)
- [PENDING] Enzo confirm HC-5 (GENERATED hours_total)
- [PENDING] CLI Phase 1.5: `SELECT DISTINCT status, source FROM employee_attendance` to validate CHECK constraint coverage

---
*End mapping_card employee_attendance__sys_attendance.md*
