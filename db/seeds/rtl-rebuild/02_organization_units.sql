-- 02_organization_units.sql — D7: import the 32 rtl-bank + 8 heuresys real OUs from legacy.
-- Idempotent. Run via psql AFTER 00 (extraction) + 01 (tenancies).
--
-- D7: COLLAPSE legacy org_type onto the v5 8-type CHECK-constrained catalog; preserve the
-- original org_type + localized names in metadata jsonb. Exclude the spurious TEST-AUTH root
-- per tenant and the 4 heuresys PROTO-* template nodes. Manager link bridged
-- legacy manager_id(employee) -> employees.email -> sys_users.email -> sys_users.id.
-- This file is ADDITIVE: it inserts the real OUs alongside the 6 synthetic ones (the synthetic
-- OUs are removed later in 09_collapse_delete.sql, after their positions/assignments are gone).

BEGIN;

CREATE SCHEMA IF NOT EXISTS staging;

-- staging mirrors the 00 extraction column order (psql \copy maps by POSITION; header skipped).
CREATE TABLE IF NOT EXISTS staging.rtl_org_units (
  id text, tenant_id text, code text, name text, name_it text, name_en text,
  parent_id text, org_type text, org_level text, manager_id text, deputy_manager_id text,
  headcount_budget text, sort_order text, is_active text, valid_from text, valid_to text,
  description text, color text, icon text
);
CREATE TABLE IF NOT EXISTS staging.rtl_employees (
  id text, tenant_id text, email text, personal_email text, first_name text, middle_name text,
  last_name text, job_title text, department text, location text, position_id text, org_unit_id text,
  manager_id text, pernr text, hire_date text, seniority_date text, is_active text, employment_status text,
  phone_mobile text, phone_work text, address_street text, address_city text, address_postal_code text,
  address_country text, iban text, swift_bic text, bank_name text, emergency_contact_name text,
  emergency_contact_phone text, emergency_contact_relationship text, highest_education_level text,
  highest_education_field text, highest_education_institution text, highest_education_year text
);

TRUNCATE staging.rtl_org_units;
TRUNCATE staging.rtl_employees;
\copy staging.rtl_org_units FROM 'extracted/org_units.csv' WITH (FORMAT csv, HEADER true)
\copy staging.rtl_employees FROM 'extracted/employees.csv' WITH (FORMAT csv, HEADER true)

-- legacy tenant -> v5 tenant crosswalk
DROP TABLE IF EXISTS rtl_tenant_map;
CREATE TEMP TABLE rtl_tenant_map (legacy_tenant uuid, v5_tenant uuid) ON COMMIT DROP;
INSERT INTO rtl_tenant_map VALUES
  ('0c54b84a-db6e-4da4-bc91-af5d480d524e', '86ba7a65-217f-48ba-8ce5-5c09b40a66b0'),
  ('d5855519-3ed1-4427-865f-fe75f1e42c4c', (SELECT tenant_id FROM sys.sys_tenancies WHERE tenant_code = 'HEURESYS'));

-- 1) Insert OUs (parent + manager set NULL here; resolved in passes 2 and 3).
INSERT INTO sys.sys_organization_units (
  organization_unit_tenant_id, organization_unit_code, organization_unit_name,
  organization_unit_type_id, organization_unit_type,
  organization_unit_effective_from, organization_unit_effective_to,
  organization_unit_is_active, organization_unit_metadata)
SELECT
  tm.v5_tenant,
  s.code,
  s.name,
  t.organization_unit_type_id,
  t.organization_unit_type_code,
  COALESCE(NULLIF(s.valid_from,'')::date, CURRENT_DATE),
  NULLIF(s.valid_to,'')::date,
  COALESCE(NULLIF(s.is_active,'')::boolean, true),
  jsonb_strip_nulls(jsonb_build_object(
    'legacy_org_unit_id', s.id,
    'legacy_org_type',    s.org_type,
    'name_it',            NULLIF(s.name_it,''),
    'name_en',            NULLIF(s.name_en,''),
    'org_level',          NULLIF(s.org_level,''),
    'headcount_budget',   NULLIF(s.headcount_budget,''),
    'sort_order',         NULLIF(s.sort_order,''),
    'description',        NULLIF(s.description,''),
    'color',              NULLIF(s.color,''),
    'icon',               NULLIF(s.icon,'')))
FROM staging.rtl_org_units s
JOIN rtl_tenant_map tm ON tm.legacy_tenant = s.tenant_id::uuid
JOIN sys.sys_organization_unit_types t
     ON t.organization_unit_type_code = CASE lower(s.org_type)
          WHEN 'company'   THEN 'HEADQUARTERS'
          WHEN 'division'  THEN 'DIVISION'
          WHEN 'direction' THEN 'DIVISION'
          WHEN 'group'     THEN 'DEPARTMENT'
          WHEN 'office'    THEN 'OFFICE'
          WHEN 'team'      THEN 'TEAM'
          ELSE 'DEPARTMENT'   -- safe fallback (only the excluded TEST-AUTH rows have NULL type)
        END
WHERE s.code <> 'TEST-AUTH'          -- drop the spurious test-pollution root per tenant
  AND s.code NOT LIKE 'PROTO-%'      -- drop the 4 heuresys template-generated nodes
ON CONFLICT (organization_unit_tenant_id, organization_unit_code) DO NOTHING;

-- 2) Resolve parent_id via the legacy id stored in metadata (two-pass).
UPDATE sys.sys_organization_units ou
SET organization_unit_parent_id = parent.organization_unit_id, updated_at = now()
FROM staging.rtl_org_units s
JOIN sys.sys_organization_units parent
     ON parent.organization_unit_metadata->>'legacy_org_unit_id' = s.parent_id
WHERE ou.organization_unit_metadata->>'legacy_org_unit_id' = s.id
  AND NULLIF(s.parent_id,'') IS NOT NULL;

-- 3) Bridge manager: legacy manager_id(employee) -> employees.email -> sys_users.email.
UPDATE sys.sys_organization_units ou
SET organization_unit_manager_user_id = u.user_id, updated_at = now()
FROM staging.rtl_org_units s
JOIN staging.rtl_employees e ON e.id = s.manager_id
JOIN sys.sys_users u ON lower(u.user_email) = lower(e.email)
WHERE ou.organization_unit_metadata->>'legacy_org_unit_id' = s.id
  AND NULLIF(s.manager_id,'') IS NOT NULL;

DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM sys.sys_organization_units
   WHERE organization_unit_metadata ? 'legacy_org_unit_id';
  RAISE NOTICE 'Imported real OUs (with legacy lineage): % (expect ~38 = 31 rtl + 7 heuresys after exclusions)', n;
END $$;

COMMIT;
