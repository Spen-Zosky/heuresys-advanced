# Phase 5 — Consolidation plan: `temp_sdbi.*` → `sys.*` (Time/Leave pilot)

**ADR ref**: ADR-0014 §3.1 Phase 5 (CONSOLIDATION REVIEW), ADR-0015 (nullable lineage FK)
**Status**: PLAN ONLY — CLI executes after Phase 3 + mapping card review
**Sequence**: Phase 3 (temp_sdbi populated + user_id resolved pass 1) → Phase 4 (N/A — closed graph) → **PHASE 5** → Phase 6 (cleanup)

---

## §1 — Execution order (FK dependency-driven)

```
1. sys.sys_leave_accrual_rules        ← temp_sdbi.leave_accrual_rules        (no FK deps)
2. sys.sys_time_off_balances          ← temp_sdbi.time_off_balances          (no FK deps post-tenant/user)
3. sys.sys_leave_balance_transactions ← temp_sdbi.leave_balance_transactions (depends on sys_time_off_balances — pass 2 balance_id)
4. sys.sys_time_off_requests          ← temp_sdbi.time_off_requests          (independent)
5. sys.sys_attendance                  ← temp_sdbi.attendance                 (independent; GENERATED hours_total auto-computed)
6. sys.sys_overtime                    ← temp_sdbi.overtime                   (independent)
```

Per-table = one `INSERT ... ON CONFLICT (natural_key) DO UPDATE` + lineage rows + audit row.

---

## §2 — Step 1: `sys.sys_leave_accrual_rules`

```sql
BEGIN;

INSERT INTO sys.sys_leave_accrual_rules (
  accrual_rule_id, accrual_rule_tenant_id, accrual_rule_natural_key,
  accrual_rule_leave_type, accrual_rule_name, accrual_rule_description,
  accrual_rule_method, accrual_rule_amount, accrual_rule_max_accrual,
  accrual_rule_allow_carryover, accrual_rule_max_carryover_days, accrual_rule_carryover_expiry_months,
  accrual_rule_min_tenure_months, accrual_rule_prorated_first_year,
  accrual_rule_ccnl_type, accrual_rule_is_ccnl_default,
  accrual_rule_is_active, accrual_rule_deleted_at,
  accrual_rule_metadata, accrual_rule_created_by, accrual_rule_updated_by,
  created_at, updated_at
)
SELECT
  accrual_rule_id, accrual_rule_tenant_id, accrual_rule_natural_key,
  accrual_rule_leave_type, accrual_rule_name, accrual_rule_description,
  accrual_rule_method, accrual_rule_amount, accrual_rule_max_accrual,
  accrual_rule_allow_carryover, accrual_rule_max_carryover_days, accrual_rule_carryover_expiry_months,
  accrual_rule_min_tenure_months, accrual_rule_prorated_first_year,
  accrual_rule_ccnl_type, accrual_rule_is_ccnl_default,
  accrual_rule_is_active, accrual_rule_deleted_at,
  accrual_rule_metadata, accrual_rule_created_by, accrual_rule_updated_by,
  created_at, updated_at
FROM temp_sdbi.leave_accrual_rules
ON CONFLICT (accrual_rule_tenant_id, accrual_rule_natural_key) DO UPDATE SET
  accrual_rule_metadata   = sys.sys_leave_accrual_rules.accrual_rule_metadata || EXCLUDED.accrual_rule_metadata,
  accrual_rule_updated_by = EXCLUDED.accrual_rule_updated_by,
  updated_at              = now();

-- Lineage rows (ADR-0015: source_table_id is nullable; populate with NULL since we have no sys.sys_source_tables row for public.leave_accrual_rules yet)
INSERT INTO sys.sys_source_lineage_records (
  source_system, source_table, source_record_id,
  target_table_name, target_record_id,
  validation_status,
  source_lineage_sdbi_mapping_card_id,
  source_lineage_sdbi_confidence,
  source_lineage_sdbi_ai_model_id,
  source_lineage_sdbi_human_approver,
  source_table_id  -- NULL per ADR-0015
)
SELECT
  'heuresys_platform', 'public.leave_accrual_rules', t._legacy_source_id::text,
  'sys.sys_leave_accrual_rules', t.accrual_rule_id,
  'VALID',
  'TIME-LEAVE-PILOT-MAP-06-ACCRUAL',
  0.88,
  'cowork-claude-opus-4.7',
  'enzo.spenuso@outlook.com',
  NULL
FROM temp_sdbi.leave_accrual_rules t
ON CONFLICT (source_system, source_table, source_record_id, target_table_name) DO NOTHING;

-- Audit row
INSERT INTO audit.import_validation_results (
  import_run_id, target_table, target_record_id, rule_code, status, message
)
SELECT
  t._import_run_id, 'sys.sys_leave_accrual_rules', t.accrual_rule_id,
  'SDBI_CONSOLIDATION_COMPLETE_V1', 'PASSED',
  'Consolidated 1 row from temp_sdbi.leave_accrual_rules'
FROM temp_sdbi.leave_accrual_rules t;

COMMIT;

-- Verification
SELECT COUNT(*) FROM sys.sys_leave_accrual_rules;  -- expected: 20
SELECT COUNT(*) FROM sys.sys_source_lineage_records WHERE target_table_name='sys.sys_leave_accrual_rules';  -- expected: 20
```

---

## §3 — Step 2 + 3: `sys.sys_time_off_balances` + `sys.sys_leave_balance_transactions` (two-pass for balance_id self-FK)

**Pass 1 — INSERT balances first** (no FK to transactions; transactions wait for resolution):

```sql
BEGIN;

INSERT INTO sys.sys_time_off_balances (
  balance_id, balance_tenant_id, balance_natural_key,
  balance_subject_user_id, balance_leave_type, balance_year,
  balance_total_days, balance_used_days, balance_pending_days,
  balance_carryover_days, balance_carryover_expires_at,
  balance_accrued_days, balance_adjustment_days, balance_adjustment_reason,
  balance_metadata, created_at, updated_at
)
SELECT
  balance_id, balance_tenant_id, balance_natural_key,
  balance_subject_user_id, balance_leave_type, balance_year,
  balance_total_days, balance_used_days, balance_pending_days,
  balance_carryover_days, balance_carryover_expires_at,
  balance_accrued_days, balance_adjustment_days, balance_adjustment_reason,
  balance_metadata, created_at, updated_at
FROM temp_sdbi.time_off_balances
WHERE balance_subject_user_id IS NOT NULL  -- skip unresolved (audit row to follow)
ON CONFLICT (balance_tenant_id, balance_natural_key) DO UPDATE SET
  balance_total_days       = EXCLUDED.balance_total_days,
  balance_used_days        = EXCLUDED.balance_used_days,
  balance_pending_days     = EXCLUDED.balance_pending_days,
  balance_carryover_days   = EXCLUDED.balance_carryover_days,
  balance_accrued_days     = EXCLUDED.balance_accrued_days,
  balance_adjustment_days  = EXCLUDED.balance_adjustment_days,
  balance_metadata         = sys.sys_time_off_balances.balance_metadata || EXCLUDED.balance_metadata,
  updated_at               = now();

-- Lineage + audit rows for balances (same pattern as §2)
INSERT INTO sys.sys_source_lineage_records (
  source_system, source_table, source_record_id, target_table_name, target_record_id,
  validation_status, source_lineage_sdbi_mapping_card_id,
  source_lineage_sdbi_confidence, source_lineage_sdbi_ai_model_id, source_lineage_sdbi_human_approver, source_table_id
)
SELECT
  'heuresys_platform', 'public.employee_time_off_balances', t._legacy_source_id::text,
  'sys.sys_time_off_balances', t.balance_id, 'VALID', 'TIME-LEAVE-PILOT-MAP-03',
  0.90, 'cowork-claude-opus-4.7', 'enzo.spenuso@outlook.com', NULL
FROM temp_sdbi.time_off_balances t WHERE t.balance_subject_user_id IS NOT NULL
ON CONFLICT (source_system, source_table, source_record_id, target_table_name) DO NOTHING;

-- Audit rows (PASSED for inserted, SKIPPED with reason for unresolved)
INSERT INTO audit.import_validation_results (import_run_id, target_table, target_record_id, rule_code, status, message)
SELECT t._import_run_id, 'sys.sys_time_off_balances', t.balance_id, 'SDBI_CONSOLIDATION_COMPLETE_V1',
       CASE WHEN t.balance_subject_user_id IS NOT NULL THEN 'PASSED' ELSE 'SKIPPED' END,
       CASE WHEN t.balance_subject_user_id IS NOT NULL
            THEN 'Consolidated from temp_sdbi.time_off_balances'
            ELSE 'SKIPPED: subject_user_id unresolved (legacy employee_id ' || t._legacy_source_employee_id::text || ' not in legacy_mirror.users)' END
FROM temp_sdbi.time_off_balances t;

COMMIT;
```

**Pass 2 — RESOLVE balance_id in transactions, then INSERT**:

```sql
BEGIN;

-- Resolve transaction.balance_id from staging via balance natural_key chain
UPDATE temp_sdbi.leave_balance_transactions tlbt
SET transaction_balance_id = (
  SELECT sys_b.balance_id
  FROM sys.sys_time_off_balances sys_b
  JOIN temp_sdbi.time_off_balances tb_b ON tb_b.balance_id = sys_b.balance_id
  WHERE tb_b._legacy_source_id = tlbt._legacy_source_balance_id
  LIMIT 1
);

-- Sanity: how many unresolved balance_id?
-- If > 0, transactions for missing balances are skipped (already CASCADE-protected at sys.* level)

INSERT INTO sys.sys_leave_balance_transactions (
  transaction_id, transaction_tenant_id, transaction_natural_key, transaction_balance_id,
  transaction_type, transaction_days_amount,
  transaction_reference_type, transaction_reference_id, transaction_description,
  transaction_performed_by_user_id, transaction_metadata,
  created_at
)
SELECT
  transaction_id, transaction_tenant_id, transaction_natural_key, transaction_balance_id,
  transaction_type, transaction_days_amount,
  transaction_reference_type, transaction_reference_id, transaction_description,
  transaction_performed_by_user_id, transaction_metadata,
  created_at
FROM temp_sdbi.leave_balance_transactions
WHERE transaction_balance_id IS NOT NULL  -- skip unresolved (rare)
ON CONFLICT (transaction_tenant_id, transaction_natural_key) DO NOTHING;  -- event-log immutable

-- Lineage + audit (same pattern; SKIPPED message for unresolved balance_id)
INSERT INTO sys.sys_source_lineage_records (
  source_system, source_table, source_record_id, target_table_name, target_record_id,
  validation_status, source_lineage_sdbi_mapping_card_id,
  source_lineage_sdbi_confidence, source_lineage_sdbi_ai_model_id, source_lineage_sdbi_human_approver, source_table_id
)
SELECT 'heuresys_platform', 'public.leave_balance_transactions', t._legacy_source_id::text,
       'sys.sys_leave_balance_transactions', t.transaction_id, 'VALID', 'TIME-LEAVE-PILOT-MAP-05-TRANSACTION',
       0.92, 'cowork-claude-opus-4.7', 'enzo.spenuso@outlook.com', NULL
FROM temp_sdbi.leave_balance_transactions t WHERE t.transaction_balance_id IS NOT NULL
ON CONFLICT (source_system, source_table, source_record_id, target_table_name) DO NOTHING;

INSERT INTO audit.import_validation_results (import_run_id, target_table, target_record_id, rule_code, status, message)
SELECT t._import_run_id, 'sys.sys_leave_balance_transactions', t.transaction_id, 'SDBI_CONSOLIDATION_COMPLETE_V1',
       CASE WHEN t.transaction_balance_id IS NOT NULL THEN 'PASSED' ELSE 'SKIPPED' END,
       CASE WHEN t.transaction_balance_id IS NOT NULL THEN 'Consolidated from temp_sdbi.leave_balance_transactions'
            ELSE 'SKIPPED: balance_id unresolved (legacy balance_id ' || t._legacy_source_balance_id::text || ' not in sys.sys_time_off_balances)' END
FROM temp_sdbi.leave_balance_transactions t;

COMMIT;
```

---

## §4 — Step 4: `sys.sys_time_off_requests`

```sql
BEGIN;

INSERT INTO sys.sys_time_off_requests (
  request_id, request_tenant_id, request_natural_key,
  request_subject_user_id, request_leave_type,
  request_start_date, request_end_date, request_days_requested,
  request_half_day_start, request_half_day_end,
  request_reason, request_status, request_approver_user_id, request_approved_at, request_rejection_reason,
  request_overlap_approved,
  request_medical_cert_required, request_medical_cert_uploaded,
  request_cancellation_requested, request_cancellation_reason, request_cancelled_at, request_cancelled_by_user_id,
  request_metadata, created_at, updated_at
)
SELECT
  request_id, request_tenant_id, request_natural_key,
  request_subject_user_id, request_leave_type,
  request_start_date, request_end_date, request_days_requested,
  request_half_day_start, request_half_day_end,
  request_reason, request_status, request_approver_user_id, request_approved_at, request_rejection_reason,
  request_overlap_approved,
  request_medical_cert_required, request_medical_cert_uploaded,
  request_cancellation_requested, request_cancellation_reason, request_cancelled_at, request_cancelled_by_user_id,
  request_metadata, created_at, updated_at
FROM temp_sdbi.time_off_requests
WHERE request_subject_user_id IS NOT NULL
ON CONFLICT (request_tenant_id, request_natural_key) DO UPDATE SET
  request_status         = EXCLUDED.request_status,
  request_approved_at    = EXCLUDED.request_approved_at,
  request_metadata       = sys.sys_time_off_requests.request_metadata || EXCLUDED.request_metadata,
  updated_at             = now();

-- Lineage + audit (same pattern, MAP-04)
INSERT INTO sys.sys_source_lineage_records (
  source_system, source_table, source_record_id, target_table_name, target_record_id,
  validation_status, source_lineage_sdbi_mapping_card_id,
  source_lineage_sdbi_confidence, source_lineage_sdbi_ai_model_id, source_lineage_sdbi_human_approver, source_table_id
)
SELECT 'heuresys_platform', 'public.employee_time_off_requests', t._legacy_source_id::text,
       'sys.sys_time_off_requests', t.request_id, 'VALID', 'TIME-LEAVE-PILOT-MAP-04-REQUEST',
       0.88, 'cowork-claude-opus-4.7', 'enzo.spenuso@outlook.com', NULL
FROM temp_sdbi.time_off_requests t WHERE t.request_subject_user_id IS NOT NULL
ON CONFLICT (source_system, source_table, source_record_id, target_table_name) DO NOTHING;

INSERT INTO audit.import_validation_results (import_run_id, target_table, target_record_id, rule_code, status, message)
SELECT t._import_run_id, 'sys.sys_time_off_requests', t.request_id, 'SDBI_CONSOLIDATION_COMPLETE_V1',
       CASE WHEN t.request_subject_user_id IS NOT NULL THEN 'PASSED' ELSE 'SKIPPED' END,
       CASE WHEN t.request_subject_user_id IS NOT NULL THEN 'Consolidated request'
            ELSE 'SKIPPED: subject_user_id unresolved' END
FROM temp_sdbi.time_off_requests t;

COMMIT;
```

---

## §5 — Step 5: `sys.sys_attendance` (HIGH-VOLUME 5237)

```sql
BEGIN;

-- INSERT — note: attendance_hours_total is GENERATED, not specified in column list
INSERT INTO sys.sys_attendance (
  attendance_id, attendance_tenant_id, attendance_natural_key,
  attendance_subject_user_id, attendance_date,
  attendance_clock_in, attendance_clock_out, attendance_break_start, attendance_break_end,
  attendance_hours_regular, attendance_hours_overtime, attendance_hours_night, attendance_hours_holiday,
  attendance_status, attendance_source, attendance_source_reference,
  attendance_is_validated, attendance_validated_by_user_id, attendance_validated_at,
  attendance_notes, attendance_metadata,
  attendance_created_by, attendance_updated_by,
  created_at, updated_at
)
SELECT
  attendance_id, attendance_tenant_id, attendance_natural_key,
  attendance_subject_user_id, attendance_date,
  attendance_clock_in, attendance_clock_out, attendance_break_start, attendance_break_end,
  attendance_hours_regular, attendance_hours_overtime, attendance_hours_night, attendance_hours_holiday,
  attendance_status, attendance_source, attendance_source_reference,
  attendance_is_validated, attendance_validated_by_user_id, attendance_validated_at,
  attendance_notes, attendance_metadata,
  attendance_created_by, attendance_updated_by,
  created_at, updated_at
FROM temp_sdbi.attendance
WHERE attendance_subject_user_id IS NOT NULL
ON CONFLICT (attendance_tenant_id, attendance_natural_key) DO UPDATE SET
  attendance_is_validated         = EXCLUDED.attendance_is_validated,
  attendance_validated_at         = EXCLUDED.attendance_validated_at,
  attendance_validated_by_user_id = EXCLUDED.attendance_validated_by_user_id,
  attendance_notes                = COALESCE(EXCLUDED.attendance_notes, sys.sys_attendance.attendance_notes),
  attendance_metadata             = sys.sys_attendance.attendance_metadata || EXCLUDED.attendance_metadata,
  updated_at                      = now();

-- Lineage in bulk (5237 rows expected)
INSERT INTO sys.sys_source_lineage_records (
  source_system, source_table, source_record_id, target_table_name, target_record_id,
  validation_status, source_lineage_sdbi_mapping_card_id,
  source_lineage_sdbi_confidence, source_lineage_sdbi_ai_model_id, source_lineage_sdbi_human_approver, source_table_id
)
SELECT 'heuresys_platform', 'public.employee_attendance', t._legacy_source_id::text,
       'sys.sys_attendance', t.attendance_id, 'VALID', 'TIME-LEAVE-PILOT-MAP-01',
       0.90, 'cowork-claude-opus-4.7', 'enzo.spenuso@outlook.com', NULL
FROM temp_sdbi.attendance t WHERE t.attendance_subject_user_id IS NOT NULL
ON CONFLICT (source_system, source_table, source_record_id, target_table_name) DO NOTHING;

INSERT INTO audit.import_validation_results (import_run_id, target_table, target_record_id, rule_code, status, message)
SELECT t._import_run_id, 'sys.sys_attendance', t.attendance_id, 'SDBI_CONSOLIDATION_COMPLETE_V1',
       CASE WHEN t.attendance_subject_user_id IS NOT NULL THEN 'PASSED' ELSE 'SKIPPED' END,
       CASE WHEN t.attendance_subject_user_id IS NOT NULL THEN 'Consolidated attendance row'
            ELSE 'SKIPPED: subject_user_id unresolved' END
FROM temp_sdbi.attendance t;

COMMIT;

-- Verification
SELECT COUNT(*) FROM sys.sys_attendance;                                                                    -- expected: 5237 (minus skipped)
SELECT COUNT(*) FROM sys.sys_attendance WHERE attendance_hours_total IS NULL;                               -- expected: 0
SELECT COUNT(*) FROM sys.sys_source_lineage_records WHERE target_table_name='sys.sys_attendance';           -- expected: 5237
```

---

## §6 — Step 6: `sys.sys_overtime`

```sql
BEGIN;

INSERT INTO sys.sys_overtime (
  overtime_id, overtime_tenant_id, overtime_natural_key,
  overtime_subject_user_id, overtime_date, overtime_type, overtime_hours,
  overtime_rate_multiplier, overtime_hourly_rate, overtime_total_compensation,
  overtime_status,
  overtime_requested_by_user_id, overtime_requested_at,
  overtime_approved_by_user_id, overtime_approved_at, overtime_rejection_reason,
  overtime_exported_at, overtime_reason, overtime_notes,
  overtime_metadata, created_at, updated_at
)
SELECT
  overtime_id, overtime_tenant_id, overtime_natural_key,
  overtime_subject_user_id, overtime_date, overtime_type, overtime_hours,
  overtime_rate_multiplier, overtime_hourly_rate, overtime_total_compensation,
  overtime_status,
  overtime_requested_by_user_id, overtime_requested_at,
  overtime_approved_by_user_id, overtime_approved_at, overtime_rejection_reason,
  overtime_exported_at, overtime_reason, overtime_notes,
  overtime_metadata, created_at, updated_at
FROM temp_sdbi.overtime
WHERE overtime_subject_user_id IS NOT NULL
ON CONFLICT (overtime_tenant_id, overtime_natural_key) DO UPDATE SET
  overtime_status              = EXCLUDED.overtime_status,
  overtime_approved_at         = EXCLUDED.overtime_approved_at,
  overtime_approved_by_user_id = EXCLUDED.overtime_approved_by_user_id,
  overtime_exported_at         = EXCLUDED.overtime_exported_at,
  overtime_metadata            = sys.sys_overtime.overtime_metadata || EXCLUDED.overtime_metadata,
  updated_at                   = now();

INSERT INTO sys.sys_source_lineage_records (
  source_system, source_table, source_record_id, target_table_name, target_record_id,
  validation_status, source_lineage_sdbi_mapping_card_id,
  source_lineage_sdbi_confidence, source_lineage_sdbi_ai_model_id, source_lineage_sdbi_human_approver, source_table_id
)
SELECT 'heuresys_platform', 'public.employee_overtime', t._legacy_source_id::text,
       'sys.sys_overtime', t.overtime_id, 'VALID', 'TIME-LEAVE-PILOT-MAP-02',
       0.85, 'cowork-claude-opus-4.7', 'enzo.spenuso@outlook.com', NULL
FROM temp_sdbi.overtime t WHERE t.overtime_subject_user_id IS NOT NULL
ON CONFLICT (source_system, source_table, source_record_id, target_table_name) DO NOTHING;

INSERT INTO audit.import_validation_results (import_run_id, target_table, target_record_id, rule_code, status, message)
SELECT t._import_run_id, 'sys.sys_overtime', t.overtime_id, 'SDBI_CONSOLIDATION_COMPLETE_V1',
       CASE WHEN t.overtime_subject_user_id IS NOT NULL THEN 'PASSED' ELSE 'SKIPPED' END,
       CASE WHEN t.overtime_subject_user_id IS NOT NULL THEN 'Consolidated overtime row'
            ELSE 'SKIPPED: subject_user_id unresolved' END
FROM temp_sdbi.overtime t;

COMMIT;
```

---

## §7 — Phase 6 cleanup

```sql
BEGIN;

DROP TABLE IF EXISTS temp_sdbi.leave_accrual_rules;
DROP TABLE IF EXISTS temp_sdbi.time_off_balances;
DROP TABLE IF EXISTS temp_sdbi.leave_balance_transactions;
DROP TABLE IF EXISTS temp_sdbi.time_off_requests;
DROP TABLE IF EXISTS temp_sdbi.attendance;
DROP TABLE IF EXISTS temp_sdbi.overtime;

-- Audit cleanup marker
INSERT INTO audit.import_validation_results (import_run_id, target_table, target_record_id, rule_code, status, message)
VALUES (
  :run_uuid, 'temp_sdbi.*', NULL, 'SDBI_TEMP_CLEANUP_V1', 'PASSED',
  '6 temp_sdbi.* tables dropped post-consolidation (Time/Leave pilot batch C4.2)'
);

COMMIT;
```

---

## §8 — Final verification queries

```sql
-- Per-table count vs source
SELECT 'sys.sys_attendance'                   tgt, COUNT(*) n, 5237 expected FROM sys.sys_attendance
UNION ALL SELECT 'sys.sys_overtime',                COUNT(*),  383 FROM sys.sys_overtime
UNION ALL SELECT 'sys.sys_time_off_balances',       COUNT(*),  501 FROM sys.sys_time_off_balances
UNION ALL SELECT 'sys.sys_time_off_requests',       COUNT(*),   99 FROM sys.sys_time_off_requests
UNION ALL SELECT 'sys.sys_leave_balance_transactions', COUNT(*), 27 FROM sys.sys_leave_balance_transactions
UNION ALL SELECT 'sys.sys_leave_accrual_rules',     COUNT(*),   20 FROM sys.sys_leave_accrual_rules;

-- Lineage coverage
SELECT target_table_name, COUNT(*) lineage_rows
FROM sys.sys_source_lineage_records
WHERE source_system = 'heuresys_platform' AND source_table LIKE 'public.employee_attendance%'
   OR source_table LIKE 'public.employee_overtime%' OR source_table LIKE 'public.employee_time_off%'
   OR source_table LIKE 'public.leave_%'
GROUP BY 1 ORDER BY 1;

-- Audit row roll-up
SELECT target_table, status, COUNT(*) n FROM audit.import_validation_results
WHERE rule_code = 'SDBI_CONSOLIDATION_COMPLETE_V1'
  AND target_table LIKE 'sys.sys_%' AND (target_table LIKE '%attendance' OR target_table LIKE '%overtime' OR target_table LIKE '%balance%' OR target_table LIKE '%time_off%')
GROUP BY 1, 2 ORDER BY 1, 2;
-- Expected: PASSED counts match per-table import counts; SKIPPED counts narrow to legacy_mirror user-resolution failures
```

---

## §9 — Rollback strategy

If CLI Phase 5 detects unexpected SKIPPED rate (> 5% of any table), abort and surface to Enzo:

```sql
-- Check skip rate per source table
WITH per_table AS (
  SELECT target_table, COUNT(*) FILTER (WHERE status='SKIPPED')::float / NULLIF(COUNT(*), 0) skip_pct
  FROM audit.import_validation_results
  WHERE rule_code = 'SDBI_CONSOLIDATION_COMPLETE_V1'
  GROUP BY 1
)
SELECT * FROM per_table WHERE skip_pct > 0.05;
```

If any > 0.05 → revoke commit (the COMMIT statements per step allow this granularity), investigate `legacy_mirror.users` gap, re-run extract, retry Phase 5.

---

*End of 04_PHASE5_CONSOLIDATION_PLAN.md*
