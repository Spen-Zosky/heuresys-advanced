# Mapping Card — `public.employee_time_off_balances` → `sys.sys_time_off_balances`

## Metadata
- mapping_card_id: TIME-LEAVE-PILOT-MAP-03
- source: `heuresys_platform.public.employee_time_off_balances` (501 rows)
- target: `heuresys_advanced.sys.sys_time_off_balances`
- created: 2026-05-21
- author: SDBI AI (Cowork Claude)
- approver: PENDING (Enzo)
- confidence_overall: **0.90 HIGH**
- workflow_phase: 2

## Source semantic analysis
- semantic_type: ACCUMULATOR / STATE-SNAPSHOT
- contains_pii: false
- temporal: mutable state (used_days, accrued_days incremented over time)
- soft_delete: NO
- hierarchy: NONE
- Referenced by: `leave_balance_transactions.balance_id` (event log)

## Field mapping

| source_col | source_type | target_col | target_type | transform | confidence | reasoning |
|---|---|---|---|---|---|---|
| id | uuid | metadata->>'legacy_id' | jsonb | STORE_IN_METADATA | HIGH | |
| employee_id | uuid | balance_subject_user_id | uuid | LOOKUP_USER_BY_LEGACY_EMPLOYEE | HIGH | HC-3 |
| leave_type | varchar(50) | balance_leave_type | varchar(50) | UPPERCASE | HIGH | CHECK covers 10 values |
| total_days | numeric(5,2) | balance_total_days | numeric(5,2) | DIRECT_COPY + COALESCE 0 | HIGH | |
| used_days | numeric(5,2) | balance_used_days | numeric(5,2) | DIRECT_COPY + COALESCE 0 | HIGH | |
| pending_days | numeric(5,2) | balance_pending_days | numeric(5,2) | DIRECT_COPY + COALESCE 0 | HIGH | |
| year | integer | balance_year | integer | DIRECT_COPY | HIGH | CHECK 2000-2100 |
| created_at | timestamp | created_at | timestamptz | CAST UTC | MEDIUM | |
| updated_at | timestamp | updated_at | timestamptz | CAST UTC | MEDIUM | |
| tenant_id | uuid | balance_tenant_id | uuid | LOOKUP_TENANT_ID | HIGH | |
| carryover_days | numeric(5,2) | balance_carryover_days | numeric(5,2) | DIRECT_COPY + COALESCE 0 | HIGH | |
| carryover_expires_at | date | balance_carryover_expires_at | date | DIRECT_COPY | HIGH | nullable |
| accrued_days | numeric(5,2) | balance_accrued_days | numeric(5,2) | DIRECT_COPY + COALESCE 0 | HIGH | |
| adjustment_days | numeric(5,2) | balance_adjustment_days | numeric(5,2) | DIRECT_COPY + COALESCE 0 | HIGH | |
| adjustment_reason | text | balance_adjustment_reason | text | DIRECT_COPY | HIGH | |

## Computed target columns
- `balance_natural_key`: `'TOB::' || tenant_slug || '::' || source_id::text`
- `balance_metadata`:
  ```jsonb
  {
    "legacy_id": "<source.id>",
    "legacy_table": "public.employee_time_off_balances",
    "import_run_id": "<run_uuid>",
    "imported_at": "<timestamp>"
  }
  ```

## FK resolution strategy

| FK | Resolution |
|---|---|
| balance_tenant_id | brownfield.tenant_id_mappings |
| balance_subject_user_id | legacy_mirror.users mediation (NOT NULL) |

## Pre-INSERT validation (CW-B25 follow-up)
```sql
-- Verify leave_type distinct values fit CHECK
SELECT DISTINCT leave_type, COUNT(*) FROM employee_time_off_balances GROUP BY 1;
-- Target CHECK: VACATION, SICK, PERSONAL, MATERNITY, PATERNITY, BEREAVEMENT, STUDY, SABBATICAL, UNPAID, OTHER

-- Verify business UQ not violated in source (composite)
SELECT tenant_id, employee_id, leave_type, year, COUNT(*) c
FROM employee_time_off_balances
GROUP BY 1,2,3,4 HAVING COUNT(*) > 1;
-- If c>1 → source has dup; pick first row or aggregate sums (require Enzo decision)
```

## Post-execution acceptance criteria

| # | Criterion | Check |
|---|---|---|
| A1 | count = 501 | `SELECT COUNT(*) FROM sys.sys_time_off_balances` |
| A2 | 0 NULL on NOT NULL | tenant_id / subject_user_id / leave_type IS NULL = 0 |
| A3 | tenant FK 100% | LEFT JOIN sys_tenancies, NULL = 0 |
| A4 | user FK 100% | LEFT JOIN sys_users, NULL = 0 |
| A5 | Business UQ valid | `(tenant, user, leave_type, year)` unique check passes |
| A6 | days_non_neg | constraint enforced; verify 0 violations |
| A7 | Lineage rows = 501 | `SELECT COUNT(*) FROM sys.sys_source_lineage_records WHERE target_table_name='sys.sys_time_off_balances'` = 501 |

## Confidence breakdown

| Aspect | Confidence | Notes |
|---|---|---|
| Schema/type compat | 0.96 | |
| Value enum mapping | 0.92 | leave_type CHECK covers superset of expected ITLAB values |
| FK resolution | 0.92 | |
| Business UQ design | 0.85 | New composite UQ — verify source non-dup pre-INSERT |
| Audit | 0.90 | |
| Edge cases | 0.85 | |
| **Overall** | **0.90 HIGH** | Auto-approve qualified |

## Human review notes
- [PENDING] HC-2 if Option B (this card always applies)
- [PENDING] HC-3 (user-anchored)
- [PENDING] CLI Phase 1.5 distinct leave_type + business UQ uniqueness pre-check

---
*End mapping_card employee_time_off_balances__sys_time_off_balances.md*
