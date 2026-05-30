-- 03_positions.sql — D1: synthesize ~158 positions, one per real employee.
-- Idempotent. Run via psql AFTER 02. ADDITIVE (no deletes; synthetic positions removed in 09).
--
-- D1: legacy has no positions table; the spine is employees.position_id (free-text) +
-- org_unit_id + manager_id. One sys_position per employee. reports_to derived from the
-- incumbent's manager (two-pass). I1 invariant: owner_user_id is left NULL here (it is the
-- accountable owner, NOT the incumbent — incumbents are wired as assignments in 04).

BEGIN;

-- staging.rtl_employees is (re)loaded here so 03 can run standalone.
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
TRUNCATE staging.rtl_employees;
\copy staging.rtl_employees FROM 'extracted/employees.csv' WITH (FORMAT csv, HEADER true)

-- legacy tenant -> v5 tenant (same crosswalk as 02)
DROP TABLE IF EXISTS rtl_tenant_map;
CREATE TEMP TABLE rtl_tenant_map (legacy_tenant uuid, v5_tenant uuid) ON COMMIT DROP;
INSERT INTO rtl_tenant_map VALUES
  ('0c54b84a-db6e-4da4-bc91-af5d480d524e', '86ba7a65-217f-48ba-8ce5-5c09b40a66b0'),
  ('d5855519-3ed1-4427-865f-fe75f1e42c4c', (SELECT tenant_id FROM sys.sys_tenancies WHERE tenant_code = 'HEURESYS'));

-- 1) One position per employee. Stable code from pernr (fallback to id prefix).
--    org_unit resolved via the legacy_org_unit_id stored on sys_organization_units in 02.
-- VERIFY: employees.org_unit_id references legacy org_units.id (assumed) — if it points at
--         tenant_org_units instead, the OU join below resolves NULL and must be re-pointed.
INSERT INTO sys.sys_positions (
  position_tenant_id, position_code, position_title, position_organization_unit_id,
  position_criticality, position_is_active, position_effective_from, position_metadata)
SELECT
  tm.v5_tenant,
  'POS-' || COALESCE(NULLIF(e.pernr,''), substring(e.id from 1 for 8)),
  COALESCE(NULLIF(e.position_id,''), NULLIF(e.job_title,''), 'Unspecified'),
  ou.organization_unit_id,
  'MEDIUM',                                   -- CHECK: CRITICAL/HIGH/MEDIUM/LOW; refined for C-suite in a later pass via critical_roles
  COALESCE(NULLIF(e.is_active,'')::boolean, true),
  COALESCE(NULLIF(e.hire_date,'')::date, CURRENT_DATE),
  jsonb_strip_nulls(jsonb_build_object(
    'legacy_employee_id',   e.id,
    'legacy_position_text', NULLIF(e.position_id,''),
    'legacy_org_unit_id',   NULLIF(e.org_unit_id,''),
    'legacy_manager_id',    NULLIF(e.manager_id,'')))
FROM staging.rtl_employees e
JOIN rtl_tenant_map tm ON tm.legacy_tenant = e.tenant_id::uuid
LEFT JOIN sys.sys_organization_units ou
     ON ou.organization_unit_metadata->>'legacy_org_unit_id' = e.org_unit_id
    AND ou.organization_unit_tenant_id = tm.v5_tenant
ON CONFLICT (position_tenant_id, position_code) DO NOTHING;

-- 2) reports_to: each employee's position reports to the position of that employee's manager.
UPDATE sys.sys_positions p
SET position_reports_to_position_id = mgr.position_id, updated_at = now()
FROM (
  SELECT p2.position_id, p2.position_metadata->>'legacy_manager_id' AS legacy_manager_id
  FROM sys.sys_positions p2
  WHERE p2.position_metadata ? 'legacy_employee_id'
) src
JOIN sys.sys_positions mgr
     ON mgr.position_metadata->>'legacy_employee_id' = src.legacy_manager_id
WHERE p.position_id = src.position_id
  AND src.legacy_manager_id IS NOT NULL
  AND mgr.position_id <> p.position_id;     -- no self-report

-- VERIFY (refinement passes, not yet authored): (a) cycle-detection on reports_to before trusting
--   the graph; (b) position_job_role_id via job-title -> sys_job_roles match + ESCO via
--   sys_esco_occupation_mappings; (c) owner_user_id = the manager position's incumbent (I1).

DO $$
DECLARE n int; ro int;
BEGIN
  SELECT count(*) INTO n  FROM sys.sys_positions WHERE position_metadata ? 'legacy_employee_id';
  SELECT count(*) INTO ro FROM sys.sys_positions WHERE position_metadata ? 'legacy_employee_id' AND position_reports_to_position_id IS NOT NULL;
  RAISE NOTICE 'Real positions created: % (expect ~162 = 158 rtl + 4 heuresys); with reports_to: %', n, ro;
END $$;

COMMIT;
