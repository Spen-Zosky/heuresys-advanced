# Mapping Card — `public.employee_overtime` → `sys.sys_overtime`

## Metadata
- mapping_card_id: TIME-LEAVE-PILOT-MAP-02
- source: `heuresys_platform.public.employee_overtime` (383 rows)
- target: `heuresys_advanced.sys.sys_overtime`
- created: 2026-05-21
- author: SDBI AI (Cowork Claude)
- approver: PENDING (Enzo)
- confidence_overall: **0.85 HIGH**
- workflow_phase: 2

## Source semantic analysis
- semantic_type: WORKFLOW / REQUEST-APPROVAL
- contains_pii: false (compensation amounts visible but no SSN)
- temporal: state-machine with timestamps
- soft_delete: NO
- hierarchy: NONE
- state machine: `pending → approved/rejected → exported (payroll)`

## Field mapping

| source_col | source_type | target_col | target_type | transform | confidence | reasoning |
|---|---|---|---|---|---|---|
| id | uuid | metadata->>'legacy_id' | jsonb | STORE_IN_METADATA | HIGH | |
| tenant_id | uuid | overtime_tenant_id | uuid | LOOKUP_TENANT_ID | HIGH | |
| employee_id | uuid | overtime_subject_user_id | uuid | LOOKUP_USER_BY_LEGACY_EMPLOYEE | HIGH | HC-3 user-anchored |
| overtime_date | date | overtime_date | date | DIRECT_COPY | HIGH | |
| overtime_type | varchar(30) | overtime_type | varchar(32) | UPPERCASE | MEDIUM | CHECK needs Phase 1.5 verification |
| hours | numeric(5,2) | overtime_hours | numeric(5,2) | DIRECT_COPY | HIGH | |
| rate_multiplier | numeric(3,2) | overtime_rate_multiplier | numeric(3,2) | DIRECT_COPY | HIGH | nullable |
| hourly_rate | numeric(8,2) | overtime_hourly_rate | numeric(8,2) | DIRECT_COPY | HIGH | nullable |
| total_compensation | numeric(10,2) | overtime_total_compensation | numeric(10,2) | DIRECT_COPY | HIGH | nullable |
| status | varchar(20) | overtime_status | varchar(20) | UPPERCASE | HIGH | 'pending' → 'PENDING' |
| requested_by | uuid | overtime_requested_by_user_id | uuid | LOOKUP_USER_BY_LEGACY_EMPLOYEE | MEDIUM | nullable |
| requested_at | timestamp | overtime_requested_at | timestamptz | CAST_TO_TIMESTAMPTZ UTC | MEDIUM | |
| approved_by | uuid | overtime_approved_by_user_id | uuid | LOOKUP_USER_BY_LEGACY_EMPLOYEE | MEDIUM | nullable |
| approved_at | timestamp | overtime_approved_at | timestamptz | CAST_TO_TIMESTAMPTZ UTC | MEDIUM | |
| rejection_reason | text | overtime_rejection_reason | text | DIRECT_COPY | HIGH | |
| payroll_job_id | uuid | metadata->>'legacy_payroll_job_id' | jsonb | STORE_IN_METADATA | HIGH | **HC-6**: no sys.sys_payroll_* target. Retain raw for future binding. |
| exported_at | timestamp | overtime_exported_at | timestamptz | CAST_TO_TIMESTAMPTZ UTC | HIGH | |
| reason | text | overtime_reason | text | DIRECT_COPY | HIGH | |
| notes | text | overtime_notes | text | DIRECT_COPY | HIGH | |
| created_at | timestamp | created_at | timestamptz | CAST UTC | MEDIUM | |
| updated_at | timestamp | updated_at | timestamptz | CAST UTC | MEDIUM | |

## Computed target columns
- `overtime_natural_key`: `'OVERTIME::' || tenant_slug || '::' || source_id::text`
- `overtime_metadata`:
  ```jsonb
  {
    "legacy_id": "<source.id>",
    "legacy_table": "public.employee_overtime",
    "legacy_payroll_job_id": "<source.payroll_job_id>",
    "import_run_id": "<run_uuid>",
    "imported_at": "<timestamp>"
  }
  ```

## FK resolution strategy

| FK | Resolution |
|---|---|
| overtime_tenant_id | brownfield.tenant_id_mappings |
| overtime_subject_user_id | legacy_mirror.users mediation (NOT NULL) |
| overtime_requested_by_user_id | legacy_mirror.users mediation (nullable, fallback NULL) |
| overtime_approved_by_user_id | Same (nullable) |
| payroll_job_id | **NOT bound as FK** — stored in metadata per HC-6 |

## Pre-INSERT validation (CW-B25 follow-up by CLI)
```sql
-- CRITICAL: verify overtime_type distinct values fit target CHECK
SELECT DISTINCT overtime_type, COUNT(*) c
FROM heuresys_platform.public.employee_overtime
GROUP BY 1 ORDER BY 2 DESC;
-- Target CHECK: WEEKDAY, WEEKEND, NIGHT, HOLIDAY, EMERGENCY, PROJECT, ON_CALL
-- If source has unexpected values → either UPPERCASE-map them or extend CHECK
```

## Post-execution acceptance criteria

| # | Criterion | Check |
|---|---|---|
| A1 | count = 383 | `SELECT COUNT(*) FROM sys.sys_overtime` |
| A2 | 0 NULL on NOT NULL | `... WHERE overtime_tenant_id IS NULL OR overtime_subject_user_id IS NULL OR overtime_date IS NULL OR overtime_type IS NULL OR overtime_hours IS NULL` = 0 |
| A3 | tenant FK 100% resolved | LEFT JOIN sys_tenancies, NULL = 0 |
| A4 | subject_user FK 100% resolved | LEFT JOIN sys_users, NULL = 0 |
| A5 | overtime_hours > 0 | CHECK already enforced; no violation |
| A6 | approval coherence | `WHERE overtime_status IN ('APPROVED','EXPORTED','PAID') AND (overtime_approved_by_user_id IS NULL OR overtime_approved_at IS NULL)` = 0 |
| A7 | legacy_payroll_job_id preserved | `SELECT COUNT(*) FROM sys.sys_overtime WHERE overtime_metadata ? 'legacy_payroll_job_id'` = (count source.payroll_job_id IS NOT NULL) |
| A8 | Lineage rows = 383 | `SELECT COUNT(*) FROM sys.sys_source_lineage_records WHERE target_table_name='sys.sys_overtime'` = 383 |

## Confidence breakdown

| Aspect | Confidence | Notes |
|---|---|---|
| Schema/type compat | 0.95 | |
| Value enum mapping | 0.75 | overtime_type CHECK needs distinct verification |
| FK resolution | 0.88 | |
| Payroll orphan strategy | 0.95 | HC-6 metadata fallback documented |
| Audit | 0.90 | |
| Edge cases | 0.80 | approval coherence CHECK is new invariant |
| **Overall** | **0.85 HIGH** | Auto-approve qualified post Phase 1.5 verification |

## Human review notes
- [PENDING] HC-3 (user-anchored)
- [PENDING] HC-6 (payroll_job_id metadata fallback)
- [PENDING] CLI Phase 1.5 distinct overtime_type verification

---
*End mapping_card employee_overtime__sys_overtime.md*
