-- 07_attendance_relabel.sql — D6 (full real fidelity): the real legacy attendance is ALREADY in v5.
-- Idempotent. Run via psql AFTER 04. ADDITIVE (UPDATE of a source label; NO deletes).
--
-- FINDING (verified 2026-05-30, data-identical to legacy by natural_key): v5 already holds the FULL real
-- legacy attendance for the kept real users — 237 rows tagged source='IMPORT' (oct'24-oct'25) + 2943 rows
-- tagged source='SYSTEM' (nov-dec'25). The 2943 SYSTEM rows are NOT synthetic: their date/hours/status
-- match the legacy source 1:1. The original RTL seed simply mislabeled them. So D6 ("real users have full
-- history") is met by RELABELing those real rows SYSTEM->IMPORT — NOT by deleting them (09 no longer does).

BEGIN;

CREATE SCHEMA IF NOT EXISTS staging;
-- EMPLOYEE-CENTRIC (ADR-0024 / I14, re-keyed S954): person link = employees->email->sys_users.
-- staging.rtl_employees mirrors employees.csv (34 cols, \copy by position); only (id,email) used.
CREATE TABLE IF NOT EXISTS staging.rtl_employees (
  id text, tenant_id text, email text, personal_email text, first_name text, middle_name text,
  last_name text, job_title text, department text, location text, position_id text, org_unit_id text,
  manager_id text, pernr text, hire_date text, seniority_date text, is_active text, employment_status text,
  phone_mobile text, phone_work text, address_street text, address_city text, address_postal_code text,
  address_country text, iban text, swift_bic text, bank_name text, emergency_contact_name text,
  emergency_contact_phone text, emergency_contact_relationship text, highest_education_level text,
  highest_education_field text, highest_education_institution text, highest_education_year text);
CREATE TABLE IF NOT EXISTS staging.rtl_employee_attendance (
  id text, tenant_id text, employee_id text, attendance_date text, clock_in text, clock_out text,
  break_start text, break_end text, hours_regular text, hours_overtime text, hours_night text,
  hours_holiday text, hours_total text, status text, source text, is_validated text);
TRUNCATE staging.rtl_employees, staging.rtl_employee_attendance;
\copy staging.rtl_employees           FROM 'extracted/employees.csv'           WITH (FORMAT csv, HEADER true)
\copy staging.rtl_employee_attendance FROM 'extracted/employee_attendance.csv' WITH (FORMAT csv, HEADER true)

-- Was: JOIN staging.rtl_users ON user_external_code='LEGACY:'||users.id (user-centric, deprecated).
DROP TABLE IF EXISTS rtl_emp_user;
CREATE TEMP TABLE rtl_emp_user ON COMMIT DROP AS
SELECT e.id AS legacy_employee_id, u.user_id AS v5_user_id, u.user_tenant_id AS v5_tenant_id
FROM staging.rtl_employees e
JOIN sys.sys_users u ON lower(u.user_email) = lower(e.email);

-- RELABEL (the operative step): kept real users' SYSTEM rows that match a real legacy attendance id -> IMPORT.
-- These rows are verified data-identical to the legacy source — real history, not synthetic.
UPDATE sys.sys_attendance x
SET attendance_source   = 'IMPORT',
    attendance_metadata = x.attendance_metadata
                          || jsonb_build_object('rebuild_relabel','SYSTEM->IMPORT','rebuild_source','rtl-rebuild'),
    updated_at          = now()
FROM rtl_emp_user eu
WHERE x.attendance_subject_user_id = eu.v5_user_id
  AND x.attendance_source = 'SYSTEM'
  AND EXISTS (SELECT 1 FROM staging.rtl_employee_attendance l
              WHERE 'ATTEND::RTL_BANK_REFERENCE::' || l.id = x.attendance_natural_key);

-- Defensive INSERT: any legacy attendance row not already present in v5 (currently 0 — all present).
INSERT INTO sys.sys_attendance (
  attendance_tenant_id, attendance_natural_key, attendance_subject_user_id, attendance_date,
  attendance_clock_in, attendance_clock_out, attendance_break_start, attendance_break_end,
  attendance_hours_regular, attendance_hours_overtime, attendance_hours_night, attendance_hours_holiday,
  attendance_status, attendance_source, attendance_metadata)  -- B8: hours_total is GENERATED, omitted
SELECT
  eu.v5_tenant_id,
  'ATTEND::RTL_BANK_REFERENCE::' || a.id,          -- VERIFY: keep existing prefix scheme so dedup matches the 237 already imported
  eu.v5_user_id,
  NULLIF(a.attendance_date,'')::date,
  NULLIF(a.clock_in,'')::timestamptz, NULLIF(a.clock_out,'')::timestamptz,
  NULLIF(a.break_start,'')::timestamptz, NULLIF(a.break_end,'')::timestamptz,
  NULLIF(a.hours_regular,'')::numeric, NULLIF(a.hours_overtime,'')::numeric,
  NULLIF(a.hours_night,'')::numeric, NULLIF(a.hours_holiday,'')::numeric,
  CASE lower(NULLIF(a.status,''))
    WHEN 'present' THEN 'PRESENT'
    WHEN 'remote'  THEN 'REMOTE'
    WHEN 'absent'  THEN 'ABSENT'
    ELSE 'PRESENT' END,                              -- map legacy lowercase onto the attendance_status CHECK
  'IMPORT',
  -- attendance_is_validated rimossa dalla migrazione 000234 (la validazione delle
  -- presenze non fa parte del prodotto). Il flag legacy resta nei metadata sotto,
  -- come tracciabilita' della sorgente.
  jsonb_build_object('legacy_attendance_id', a.id, 'rebuild_source', 'rtl-rebuild',
                     'legacy_is_validated', NULLIF(a.is_validated,''), 'legacy_status', NULLIF(a.status,''))
FROM staging.rtl_employee_attendance a
JOIN rtl_emp_user eu ON eu.legacy_employee_id = a.employee_id
WHERE NOT EXISTS (
  SELECT 1 FROM sys.sys_attendance x
  WHERE x.attendance_natural_key = 'ATTEND::RTL_BANK_REFERENCE::' || a.id)
-- B5: a kept real user may already have a SYNTHETIC SYSTEM row on this (tenant,user,date) (nov-dec'25
-- overlaps the real legacy window). Replace the synthetic row in place with the real legacy one (D6).
-- The WHERE guard means we NEVER overwrite an existing real IMPORT row, and duplicate-date legacy rows
-- are silently skipped (the predicate is false for an already-IMPORT row).
ON CONFLICT (attendance_tenant_id, attendance_subject_user_id, attendance_date) DO UPDATE SET
  attendance_natural_key    = EXCLUDED.attendance_natural_key,
  attendance_clock_in       = EXCLUDED.attendance_clock_in,
  attendance_clock_out      = EXCLUDED.attendance_clock_out,
  attendance_break_start    = EXCLUDED.attendance_break_start,
  attendance_break_end      = EXCLUDED.attendance_break_end,
  attendance_hours_regular  = EXCLUDED.attendance_hours_regular,
  attendance_hours_overtime = EXCLUDED.attendance_hours_overtime,
  attendance_hours_night    = EXCLUDED.attendance_hours_night,
  attendance_hours_holiday  = EXCLUDED.attendance_hours_holiday,
  attendance_status         = EXCLUDED.attendance_status,
  attendance_source         = 'IMPORT',
  attendance_metadata       = sys_attendance.attendance_metadata || EXCLUDED.attendance_metadata,
  updated_at                = now()
WHERE sys_attendance.attendance_source = 'SYSTEM';

DO $$
DECLARE imp int;
BEGIN
  SELECT count(*) INTO imp FROM sys.sys_attendance WHERE attendance_source='IMPORT';
  RAISE NOTICE 'IMPORT attendance rows after relabel: % (expect ~3180 for kept rtl+heu users)', imp;
END $$;

COMMIT;
