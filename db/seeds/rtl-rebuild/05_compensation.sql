-- 05_compensation.sql — import salary bands + position compensation profiles (position-centric, I1).
-- Idempotent. Run via psql AFTER 03 (positions). ADDITIVE.
--
-- salary_bands -> sys_compensation_bands (per tenant, by code). employee_contracts +
-- salary_band_assignments -> sys_position_compensation_profiles, attached to the employee's
-- POSITION (not the user), per I1. Band crosswalk is by code (legacy band_code = v5 band code).

BEGIN;

CREATE SCHEMA IF NOT EXISTS staging;
CREATE TABLE IF NOT EXISTS staging.rtl_salary_bands (
  id text, tenant_id text, band_code text, band_name text, job_level text, job_family text,
  currency text, min_salary text, mid_salary text, max_salary text, geo_region text, is_active text
);
CREATE TABLE IF NOT EXISTS staging.rtl_salary_band_assignments (
  id text, employee_id text, band_id text, current_salary text, compa_ratio text,
  range_penetration text, assigned_at text
);
CREATE TABLE IF NOT EXISTS staging.rtl_employee_contracts (
  id text, tenant_id text, employee_id text, contract_type text, start_date text, end_date text,
  ccnl_code text, level text, annual_salary text, monthly_salary text, num_monthly_payments text,
  currency text, fte_percentage text, pay_scale_area text, is_current text
);
TRUNCATE staging.rtl_salary_bands, staging.rtl_salary_band_assignments, staging.rtl_employee_contracts;
\copy staging.rtl_salary_bands            FROM 'extracted/salary_bands.csv'            WITH (FORMAT csv, HEADER true)
\copy staging.rtl_salary_band_assignments FROM 'extracted/salary_band_assignments.csv' WITH (FORMAT csv, HEADER true)
\copy staging.rtl_employee_contracts      FROM 'extracted/employee_contracts.csv'      WITH (FORMAT csv, HEADER true)

DROP TABLE IF EXISTS staging.rtl_tenant_map;
CREATE TEMP TABLE staging.rtl_tenant_map (legacy_tenant uuid, v5_tenant uuid) ON COMMIT DROP;
INSERT INTO staging.rtl_tenant_map VALUES
  ('0c54b84a-db6e-4da4-bc91-af5d480d524e', '86ba7a65-217f-48ba-8ce5-5c09b40a66b0'),
  ('d5855519-3ed1-4427-865f-fe75f1e42c4c', (SELECT tenant_id FROM sys.sys_tenancies WHERE tenant_code = 'HEURESYS'));

-- 1) Compensation bands (dedup by tenant+code; keep legacy id in metadata).
INSERT INTO sys.sys_compensation_bands (
  compensation_band_tenant_id, compensation_band_code, compensation_band_name,
  compensation_band_min_eur, compensation_band_mid_eur, compensation_band_max_eur,
  compensation_band_is_global, compensation_band_metadata)
SELECT tm.v5_tenant, s.band_code, s.band_name,
       NULLIF(s.min_salary,'')::numeric, NULLIF(s.mid_salary,'')::numeric, NULLIF(s.max_salary,'')::numeric,
       false,
       jsonb_strip_nulls(jsonb_build_object(
         'legacy_band_id', s.id, 'job_level', NULLIF(s.job_level,''),
         'job_family', NULLIF(s.job_family,''), 'currency', COALESCE(NULLIF(s.currency,''),'EUR'),
         'geo_region', NULLIF(s.geo_region,'')))
FROM staging.rtl_salary_bands s
JOIN staging.rtl_tenant_map tm ON tm.legacy_tenant = s.tenant_id::uuid
WHERE NOT EXISTS (
  SELECT 1 FROM sys.sys_compensation_bands b
  WHERE b.compensation_band_tenant_id = tm.v5_tenant
    AND b.compensation_band_code = s.band_code);
-- VERIFY: confirm sys_compensation_bands amounts are EUR (legacy currency assumed EUR; non-EUR would need conversion).

-- 2) Position compensation profiles (one per position; band via assignment->band_code crosswalk).
INSERT INTO sys.sys_position_compensation_profiles (
  position_id, position_compensation_profile_tenant_id, compensation_band_id,
  position_compensation_profile_metadata)
SELECT
  p.position_id,
  p.position_tenant_id,
  vb.compensation_band_id,
  jsonb_strip_nulls(jsonb_build_object(
    'legacy_employee_id', e.id,
    'ccnl_code',   NULLIF(c.ccnl_code,''),
    'level',       NULLIF(c.level,''),
    'annual_salary', NULLIF(c.annual_salary,''),
    'fte_percentage', NULLIF(c.fte_percentage,''),
    'current_salary', NULLIF(sba.current_salary,''),
    'compa_ratio',    NULLIF(sba.compa_ratio,'')))
FROM staging.rtl_employee_contracts c
JOIN staging.rtl_tenant_map tm ON tm.legacy_tenant = c.tenant_id::uuid
JOIN sys.sys_positions p ON p.position_metadata->>'legacy_employee_id' = c.employee_id
LEFT JOIN staging.rtl_salary_band_assignments sba ON sba.employee_id = c.employee_id
LEFT JOIN staging.rtl_salary_bands lb ON lb.id = sba.band_id
LEFT JOIN sys.sys_compensation_bands vb
       ON vb.compensation_band_tenant_id = tm.v5_tenant AND vb.compensation_band_code = lb.band_code
JOIN staging.rtl_employee_contracts e2 ON e2.id = c.id          -- alias guard
JOIN LATERAL (SELECT c.employee_id AS id) e ON true
WHERE COALESCE(NULLIF(c.is_current,'')::boolean, true)
  AND NOT EXISTS (
    SELECT 1 FROM sys.sys_position_compensation_profiles x WHERE x.position_id = p.position_id);
-- VERIFY: sys_position_compensation_profiles uniqueness is per position_id (one profile/position) — confirm the unique index.

DO $$
DECLARE nb int; np int;
BEGIN
  SELECT count(*) INTO nb FROM sys.sys_compensation_bands WHERE compensation_band_metadata ? 'legacy_band_id';
  SELECT count(*) INTO np FROM sys.sys_position_compensation_profiles WHERE position_compensation_profile_metadata ? 'legacy_employee_id';
  RAISE NOTICE 'Comp bands imported: % (expect ~12); position comp profiles: % (expect ~158)', nb, np;
END $$;

COMMIT;
