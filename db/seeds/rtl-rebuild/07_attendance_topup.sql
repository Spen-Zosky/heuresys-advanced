-- 07_attendance_topup.sql — D6 (Replace, additive half): import the full real legacy attendance.
-- Idempotent. Run via psql AFTER 04. ADDITIVE (the 2924 synthetic SYSTEM rows are removed in 09).
--
-- v5 currently holds 237 IMPORT (real legacy subset, oct'24-oct'25) + 2924 SYSTEM (synthetic, nov-dec'25)
-- per real rtl user. This imports the remaining real legacy rows (dedup on natural-key = legacy id),
-- bringing real users to full legacy attendance fidelity (3161 rtl). 09 then deletes the synthetic set.

BEGIN;

CREATE SCHEMA IF NOT EXISTS staging;
CREATE TABLE IF NOT EXISTS staging.rtl_users (id text, username text, role text, employee_id text, is_active text);
CREATE TABLE IF NOT EXISTS staging.rtl_employee_attendance (
  id text, tenant_id text, employee_id text, attendance_date text, clock_in text, clock_out text,
  break_start text, break_end text, hours_regular text, hours_overtime text, hours_night text,
  hours_holiday text, hours_total text, status text, source text, is_validated text);
TRUNCATE staging.rtl_users, staging.rtl_employee_attendance;
\copy staging.rtl_users               FROM 'extracted/users.csv'               WITH (FORMAT csv, HEADER true)
\copy staging.rtl_employee_attendance FROM 'extracted/employee_attendance.csv' WITH (FORMAT csv, HEADER true)

DROP TABLE IF EXISTS staging.rtl_emp_user;
CREATE TEMP TABLE staging.rtl_emp_user ON COMMIT DROP AS
SELECT ru.employee_id AS legacy_employee_id, u.user_id AS v5_user_id, u.user_tenant_id AS v5_tenant_id
FROM staging.rtl_users ru
JOIN sys.sys_users u ON u.user_external_code = 'LEGACY:' || ru.id;

-- Import real legacy attendance; natural_key part-3 = legacy id (matches existing IMPORT dedup scheme).
INSERT INTO sys.sys_attendance (
  attendance_tenant_id, attendance_natural_key, attendance_subject_user_id, attendance_date,
  attendance_clock_in, attendance_clock_out, attendance_break_start, attendance_break_end,
  attendance_hours_regular, attendance_hours_overtime, attendance_hours_night, attendance_hours_holiday,
  attendance_hours_total, attendance_status, attendance_source, attendance_is_validated, attendance_metadata)
SELECT
  eu.v5_tenant_id,
  'ATTEND::RTL_BANK_REFERENCE::' || a.id,          -- VERIFY: keep existing prefix scheme so dedup matches the 237 already imported
  eu.v5_user_id,
  NULLIF(a.attendance_date,'')::date,
  NULLIF(a.clock_in,'')::timestamptz, NULLIF(a.clock_out,'')::timestamptz,
  NULLIF(a.break_start,'')::timestamptz, NULLIF(a.break_end,'')::timestamptz,
  NULLIF(a.hours_regular,'')::numeric, NULLIF(a.hours_overtime,'')::numeric,
  NULLIF(a.hours_night,'')::numeric, NULLIF(a.hours_holiday,'')::numeric, NULLIF(a.hours_total,'')::numeric,
  COALESCE(NULLIF(a.status,''), 'RECORDED'),
  'IMPORT',
  COALESCE(NULLIF(a.is_validated,'')::boolean, false),
  jsonb_build_object('legacy_attendance_id', a.id, 'rebuild_source', 'rtl-rebuild')
FROM staging.rtl_employee_attendance a
JOIN staging.rtl_emp_user eu ON eu.legacy_employee_id = a.employee_id
WHERE NOT EXISTS (
  SELECT 1 FROM sys.sys_attendance x
  WHERE x.attendance_natural_key = 'ATTEND::RTL_BANK_REFERENCE::' || a.id);

DO $$
DECLARE imp int;
BEGIN
  SELECT count(*) INTO imp FROM sys.sys_attendance WHERE attendance_source='IMPORT';
  RAISE NOTICE 'IMPORT attendance rows after top-up: % (expect ~3161 rtl + ~57 heu once full real set imported)', imp;
END $$;

COMMIT;
