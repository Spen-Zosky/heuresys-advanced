-- 04_assignments.sql — wire each real user to their synthesized position (PRIMARY/ACTIVE).
-- Idempotent. Run via psql AFTER 03. ADDITIVE.
--
-- Crosswalk employee -> v5 user: legacy users.employee_id links the employee to a legacy auth
-- user; v5 sys_users.user_external_code = 'LEGACY:'||legacy users.id. Position: resolved via the
-- legacy_employee_id stored on sys_positions in 03. One PRIMARY assignment per user.

BEGIN;

CREATE SCHEMA IF NOT EXISTS staging;
CREATE TABLE IF NOT EXISTS staging.rtl_employees (
  id text, tenant_id text, email text, personal_email text, first_name text, middle_name text,
  last_name text, job_title text, department text, location text, position_id text, org_unit_id text,
  manager_id text, pernr text, hire_date text, seniority_date text, is_active text, employment_status text,
  phone_mobile text, phone_work text, address_street text, address_city text, address_postal_code text,
  address_country text, iban text, swift_bic text, bank_name text, emergency_contact_name text,
  emergency_contact_phone text, emergency_contact_relationship text, highest_education_level text,
  highest_education_field text, highest_education_institution text, highest_education_year text
);
CREATE TABLE IF NOT EXISTS staging.rtl_users (
  id text, username text, role text, employee_id text, is_active text
);
TRUNCATE staging.rtl_employees;
TRUNCATE staging.rtl_users;
\copy staging.rtl_employees FROM 'extracted/employees.csv' WITH (FORMAT csv, HEADER true)
\copy staging.rtl_users     FROM 'extracted/users.csv'     WITH (FORMAT csv, HEADER true)

INSERT INTO sys.sys_user_position_assignments (
  user_position_assignment_tenant_id, user_position_assignment_user_id,
  user_position_assignment_position_id, user_position_assignment_kind,
  user_position_assignment_fte, user_position_assignment_start_date,
  user_position_assignment_status, user_position_assignment_metadata)
SELECT
  u.user_tenant_id, u.user_id, p.position_id, 'PRIMARY', 1.0,
  COALESCE(NULLIF(e.hire_date,'')::date, CURRENT_DATE), 'ACTIVE',
  jsonb_build_object('legacy_employee_id', e.id, 'source', 'rtl-rebuild')
FROM staging.rtl_employees e
JOIN staging.rtl_users ru ON ru.employee_id = e.id
JOIN sys.sys_users u      ON u.user_external_code = 'LEGACY:' || ru.id
JOIN sys.sys_positions p  ON p.position_metadata->>'legacy_employee_id' = e.id
WHERE NOT EXISTS (
  SELECT 1 FROM sys.sys_user_position_assignments a
  WHERE a.user_position_assignment_user_id = u.user_id
    AND a.user_position_assignment_kind   = 'PRIMARY'
    AND a.user_position_assignment_status = 'ACTIVE');

DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n
  FROM sys.sys_user_position_assignments a
  JOIN sys.sys_users u ON u.user_id = a.user_position_assignment_user_id
  WHERE split_part(u.user_email,'@',2) IN ('rtl-bank.org','heuresys.com')
    AND a.user_position_assignment_kind = 'PRIMARY';
  RAISE NOTICE 'Real users with a PRIMARY position assignment: % (expect ~161 = 158 rtl + 3 heuresys)', n;
END $$;

COMMIT;
