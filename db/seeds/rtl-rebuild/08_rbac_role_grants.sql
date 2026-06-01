-- 08_rbac_role_grants.sql — D4 (data half): grant RBAC roles to the real users per the legacy role map.
-- Idempotent. Run via psql AFTER 04. ADDITIVE.
--
-- D4 legacy->v5 role map: SUPERUSER->PLATFORM_ADMIN, TENANT_OWNER->TENANT_ADMIN, IT_ADMIN->TENANT_ADMIN,
-- HR_DIRECTOR->HRMS_MANAGER, HR_MANAGER->HRMS_MANAGER, DEPT_HEAD->MANAGER, LINE_MANAGER->MANAGER, EMPLOYEE->USER.
-- (The /v1/me/permissions endpoint + per-permission sidebar refactor are CODE, authored separately.)
-- VERIFY: confirm legacy users.role holds one of the 8 rbp_roles codes (case-normalized below).

BEGIN;

CREATE SCHEMA IF NOT EXISTS staging;
-- EMPLOYEE-CENTRIC (ADR-0024 / I14, re-keyed S954): the person is driven by `employees` (email link
-- to sys_users); `users` is read here ONLY as the auth shell that carries `role`, joined via
-- users.employee_id = employees.id. An employee with no `users` row still gets a grant (default USER,
-- ADR-0024 §2.3). Was: JOIN sys_users ON user_external_code='LEGACY:'||users.id (user-centric).
CREATE TABLE IF NOT EXISTS staging.rtl_employees (
  id text, tenant_id text, email text, personal_email text, first_name text, middle_name text,
  last_name text, job_title text, department text, location text, position_id text, org_unit_id text,
  manager_id text, pernr text, hire_date text, seniority_date text, is_active text, employment_status text,
  phone_mobile text, phone_work text, address_street text, address_city text, address_postal_code text,
  address_country text, iban text, swift_bic text, bank_name text, emergency_contact_name text,
  emergency_contact_phone text, emergency_contact_relationship text, highest_education_level text,
  highest_education_field text, highest_education_institution text, highest_education_year text);
CREATE TABLE IF NOT EXISTS staging.rtl_users (id text, username text, role text, employee_id text, is_active text);
TRUNCATE staging.rtl_employees, staging.rtl_users;
\copy staging.rtl_employees FROM 'extracted/employees.csv' WITH (FORMAT csv, HEADER true)
\copy staging.rtl_users     FROM 'extracted/users.csv'     WITH (FORMAT csv, HEADER true)

INSERT INTO sys.sys_user_auth_roles (user_auth_role_user_id, user_auth_role_role_id, user_auth_role_tenant_id, user_auth_role_granted_at)
SELECT u.user_id, r.auth_role_id, u.user_tenant_id, now()
FROM staging.rtl_employees e
JOIN sys.sys_users u ON lower(u.user_email) = lower(e.email)        -- employee-centric person link (ADR-0024)
LEFT JOIN staging.rtl_users ru ON ru.employee_id = e.id            -- auth shell (role only); account-less -> NULL -> USER
JOIN sys.sys_auth_roles r ON r.auth_role_code = CASE upper(NULLIF(ru.role,''))
     WHEN 'SUPERUSER'    THEN 'PLATFORM_ADMIN'
     WHEN 'TENANT_OWNER' THEN 'TENANT_ADMIN'
     WHEN 'IT_ADMIN'     THEN 'TENANT_ADMIN'
     WHEN 'HR_DIRECTOR'  THEN 'HRMS_MANAGER'
     WHEN 'HR_MANAGER'   THEN 'HRMS_MANAGER'
     WHEN 'DEPT_HEAD'    THEN 'MANAGER'
     WHEN 'LINE_MANAGER' THEN 'MANAGER'
     WHEN 'EMPLOYEE'     THEN 'USER'
     ELSE 'USER'         -- safe default for any unmapped legacy role
   END
WHERE NOT EXISTS (
  SELECT 1 FROM sys.sys_user_auth_roles x
  WHERE x.user_auth_role_user_id = u.user_id AND x.user_auth_role_role_id = r.auth_role_id
    AND x.user_auth_role_revoked_at IS NULL);

DO $$
DECLARE n int;
BEGIN
  SELECT count(DISTINCT user_auth_role_user_id) INTO n FROM sys.sys_user_auth_roles WHERE user_auth_role_revoked_at IS NULL;
  RAISE NOTICE 'Users with an active RBAC role: % (expect ~163 real + the existing seeded personas)', n;
END $$;

COMMIT;
