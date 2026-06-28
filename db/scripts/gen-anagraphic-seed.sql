-- =============================================================================
-- gen-anagraphic-seed.sql  (GENERATOR — runs against the LEGACY DB)
-- -----------------------------------------------------------------------------
-- Emits the idempotent seed that imports the rich anagraphic/identity/employment
-- data of legacy `employees` into the advanced satellites (000164). Run against
-- the legacy `heuresys_evo_platform_db` container; pipe stdout to a .sql file,
-- then apply that file to `heuresys_advanced`.
--
--   cat db/scripts/gen-anagraphic-seed.sql \
--     | ssh oci 'docker exec -i heuresys_evo_platform_db sh -c "PGPASSWORD=\$POSTGRES_PASSWORD psql -U \$POSTGRES_USER -d \$POSTGRES_DB -tAq"' \
--     > anagraphic-seed.generated.sql
--   psql -h localhost -p 5433 -U heuresys -d heuresys_advanced -1 -f anagraphic-seed.generated.sql
--
-- Match key: sys_users.user_external_code = 'LEGACY_EMP::' || employees.id (ADR-0024).
-- Only advanced users with a matching external_code get populated (INSERT...SELECT).
-- Idempotent: 1:1 + (user,kind) satellites use ON CONFLICT; the pure-1:N family
-- table is delete-then-insert (scoped to LEGACY_EMP users). Data = production
-- (no-PII policy abandoned, ADR-0023/0026). '' is normalized to NULL.
-- =============================================================================
\pset format unaligned
\pset tuples_only on
\set ON_ERROR_STOP on

-- ---- header for the generated seed -----------------------------------------
SELECT '-- GENERATED anagraphic seed — apply to heuresys_advanced. Idempotent.';
SELECT 'BEGIN;';

-- ===== 1. demographics (1:1) =================================================
SELECT format(
$tmpl$INSERT INTO sys.sys_user_demographics (user_demographics_user_id, user_demographics_tenant_id, user_demographics_middle_name, user_demographics_birth_date, user_demographics_birth_place, user_demographics_gender, user_demographics_nationality, user_demographics_marital_status, user_demographics_tax_id, user_demographics_phone_mobile, user_demographics_phone_home, user_demographics_personal_email, user_demographics_emergency_name, user_demographics_emergency_phone, user_demographics_emergency_relationship) SELECT u.user_id, u.user_tenant_id, %L, %L::date, %L, %L, %L, %L, %L, %L, %L, %L, %L, %L, %L FROM sys.sys_users u WHERE u.user_external_code = %L ON CONFLICT (user_demographics_user_id) DO UPDATE SET user_demographics_middle_name=EXCLUDED.user_demographics_middle_name, user_demographics_birth_date=EXCLUDED.user_demographics_birth_date, user_demographics_birth_place=EXCLUDED.user_demographics_birth_place, user_demographics_gender=EXCLUDED.user_demographics_gender, user_demographics_nationality=EXCLUDED.user_demographics_nationality, user_demographics_marital_status=EXCLUDED.user_demographics_marital_status, user_demographics_tax_id=EXCLUDED.user_demographics_tax_id, user_demographics_phone_mobile=EXCLUDED.user_demographics_phone_mobile, user_demographics_phone_home=EXCLUDED.user_demographics_phone_home, user_demographics_personal_email=EXCLUDED.user_demographics_personal_email, user_demographics_emergency_name=EXCLUDED.user_demographics_emergency_name, user_demographics_emergency_phone=EXCLUDED.user_demographics_emergency_phone, user_demographics_emergency_relationship=EXCLUDED.user_demographics_emergency_relationship;$tmpl$,
  nullif(trim(e.middle_name),''), e.birth_date, nullif(trim(e.birth_place),''),
  upper(nullif(trim(e.gender),'')), nullif(trim(e.nationality),''), upper(nullif(trim(e.marital_status),'')),
  nullif(trim(e.tax_id),''), nullif(trim(e.phone_mobile),''), nullif(trim(e.phone_home),''),
  nullif(trim(e.personal_email),''), nullif(trim(e.emergency_contact_name),''),
  nullif(trim(e.emergency_contact_phone),''), nullif(trim(e.emergency_contact_relationship),''),
  'LEGACY_EMP::'||e.id)
FROM employees e WHERE e.deleted_at IS NULL;

-- ===== 2. identity_documents (1:N, ON CONFLICT user+kind) =====================
SELECT format(
$tmpl$INSERT INTO sys.sys_user_identity_documents (user_identity_document_user_id, user_identity_document_tenant_id, user_identity_document_kind, user_identity_document_number, user_identity_document_expiry_date) SELECT u.user_id, u.user_tenant_id, 'NATIONAL_ID', %L, %L::date FROM sys.sys_users u WHERE u.user_external_code = %L ON CONFLICT (user_identity_document_user_id, user_identity_document_kind) DO UPDATE SET user_identity_document_number=EXCLUDED.user_identity_document_number, user_identity_document_expiry_date=EXCLUDED.user_identity_document_expiry_date;$tmpl$,
  nullif(trim(e.national_id),''), e.national_id_expiry, 'LEGACY_EMP::'||e.id)
FROM employees e WHERE e.deleted_at IS NULL AND nullif(trim(e.national_id),'') IS NOT NULL;

SELECT format(
$tmpl$INSERT INTO sys.sys_user_identity_documents (user_identity_document_user_id, user_identity_document_tenant_id, user_identity_document_kind, user_identity_document_number, user_identity_document_expiry_date) SELECT u.user_id, u.user_tenant_id, 'PASSPORT', %L, %L::date FROM sys.sys_users u WHERE u.user_external_code = %L ON CONFLICT (user_identity_document_user_id, user_identity_document_kind) DO UPDATE SET user_identity_document_number=EXCLUDED.user_identity_document_number, user_identity_document_expiry_date=EXCLUDED.user_identity_document_expiry_date;$tmpl$,
  nullif(trim(e.passport_number),''), e.passport_expiry, 'LEGACY_EMP::'||e.id)
FROM employees e WHERE e.deleted_at IS NULL AND nullif(trim(e.passport_number),'') IS NOT NULL;

SELECT format(
$tmpl$INSERT INTO sys.sys_user_identity_documents (user_identity_document_user_id, user_identity_document_tenant_id, user_identity_document_kind, user_identity_document_number, user_identity_document_expiry_date) SELECT u.user_id, u.user_tenant_id, 'DRIVER_LICENSE', %L, %L::date FROM sys.sys_users u WHERE u.user_external_code = %L ON CONFLICT (user_identity_document_user_id, user_identity_document_kind) DO UPDATE SET user_identity_document_number=EXCLUDED.user_identity_document_number, user_identity_document_expiry_date=EXCLUDED.user_identity_document_expiry_date;$tmpl$,
  nullif(trim(e.driver_license),''), e.driver_license_expiry, 'LEGACY_EMP::'||e.id)
FROM employees e WHERE e.deleted_at IS NULL AND nullif(trim(e.driver_license),'') IS NOT NULL;

-- ===== 3. addresses (1:N, ON CONFLICT user+kind) =============================
SELECT format(
$tmpl$INSERT INTO sys.sys_user_addresses (user_address_user_id, user_address_tenant_id, user_address_kind, user_address_street, user_address_city, user_address_postal_code, user_address_country, user_address_region, user_address_is_primary) SELECT u.user_id, u.user_tenant_id, 'PERMANENT', %L, %L, %L, %L, %L, true FROM sys.sys_users u WHERE u.user_external_code = %L ON CONFLICT (user_address_user_id, user_address_kind) DO UPDATE SET user_address_street=EXCLUDED.user_address_street, user_address_city=EXCLUDED.user_address_city, user_address_postal_code=EXCLUDED.user_address_postal_code, user_address_country=EXCLUDED.user_address_country, user_address_region=EXCLUDED.user_address_region;$tmpl$,
  nullif(trim(e.address_street),''), nullif(trim(e.address_city),''), nullif(trim(e.address_postal_code),''),
  nullif(trim(e.address_country),''), nullif(trim(e.address_region),''), 'LEGACY_EMP::'||e.id)
FROM employees e WHERE e.deleted_at IS NULL AND nullif(trim(e.address_street),'') IS NOT NULL;

SELECT format(
$tmpl$INSERT INTO sys.sys_user_addresses (user_address_user_id, user_address_tenant_id, user_address_kind, user_address_street, user_address_city, user_address_postal_code, user_address_country, user_address_region, user_address_is_primary) SELECT u.user_id, u.user_tenant_id, 'TEMPORARY', %L, %L, %L, %L, NULL, false FROM sys.sys_users u WHERE u.user_external_code = %L ON CONFLICT (user_address_user_id, user_address_kind) DO UPDATE SET user_address_street=EXCLUDED.user_address_street, user_address_city=EXCLUDED.user_address_city, user_address_postal_code=EXCLUDED.user_address_postal_code, user_address_country=EXCLUDED.user_address_country;$tmpl$,
  nullif(trim(e.temp_address_street),''), nullif(trim(e.temp_address_city),''), nullif(trim(e.temp_address_postal_code),''),
  nullif(trim(e.temp_address_country),''), 'LEGACY_EMP::'||e.id)
FROM employees e WHERE e.deleted_at IS NULL AND nullif(trim(e.temp_address_street),'') IS NOT NULL;

-- ===== 4. bank_details (1:1) =================================================
SELECT format(
$tmpl$INSERT INTO sys.sys_user_bank_details (user_bank_user_id, user_bank_tenant_id, user_bank_iban, user_bank_swift_bic, user_bank_bank_name, user_bank_account_number) SELECT u.user_id, u.user_tenant_id, %L, %L, %L, %L FROM sys.sys_users u WHERE u.user_external_code = %L ON CONFLICT (user_bank_user_id) DO UPDATE SET user_bank_iban=EXCLUDED.user_bank_iban, user_bank_swift_bic=EXCLUDED.user_bank_swift_bic, user_bank_bank_name=EXCLUDED.user_bank_bank_name, user_bank_account_number=EXCLUDED.user_bank_account_number;$tmpl$,
  nullif(trim(e.iban),''), nullif(trim(e.swift_bic),''), nullif(trim(e.bank_name),''), nullif(trim(e.bank_account_number),''),
  'LEGACY_EMP::'||e.id)
FROM employees e WHERE e.deleted_at IS NULL AND nullif(trim(e.iban),'') IS NOT NULL;

-- ===== 5. employment (1:1) compensation + SAP + lifecycle ====================
SELECT format(
$tmpl$INSERT INTO sys.sys_user_employment (user_employment_user_id, user_employment_tenant_id, user_employment_salary, user_employment_currency, user_employment_pay_scale_area, user_employment_pay_scale_type, user_employment_pay_scale_group, user_employment_pay_scale_level, user_employment_pay_periods_per_year, user_employment_work_schedule_pct, user_employment_pernr, user_employment_company_code, user_employment_personnel_area, user_employment_personnel_subarea, user_employment_hire_date, user_employment_seniority_date, user_employment_probation_end_date, user_employment_contract_end_date, user_employment_termination_date, user_employment_termination_reason, user_employment_status) SELECT u.user_id, u.user_tenant_id, %L::numeric, %L, %L, %L, %L, %L, %L::smallint, %L::numeric, %L, %L, %L, %L, %L::date, %L::date, %L::date, %L::date, %L::date, %L, %L FROM sys.sys_users u WHERE u.user_external_code = %L ON CONFLICT (user_employment_user_id) DO UPDATE SET user_employment_salary=EXCLUDED.user_employment_salary, user_employment_currency=EXCLUDED.user_employment_currency, user_employment_pay_scale_area=EXCLUDED.user_employment_pay_scale_area, user_employment_pay_scale_type=EXCLUDED.user_employment_pay_scale_type, user_employment_pay_scale_group=EXCLUDED.user_employment_pay_scale_group, user_employment_pay_scale_level=EXCLUDED.user_employment_pay_scale_level, user_employment_pay_periods_per_year=EXCLUDED.user_employment_pay_periods_per_year, user_employment_work_schedule_pct=EXCLUDED.user_employment_work_schedule_pct, user_employment_pernr=EXCLUDED.user_employment_pernr, user_employment_company_code=EXCLUDED.user_employment_company_code, user_employment_personnel_area=EXCLUDED.user_employment_personnel_area, user_employment_personnel_subarea=EXCLUDED.user_employment_personnel_subarea, user_employment_hire_date=EXCLUDED.user_employment_hire_date, user_employment_seniority_date=EXCLUDED.user_employment_seniority_date, user_employment_probation_end_date=EXCLUDED.user_employment_probation_end_date, user_employment_contract_end_date=EXCLUDED.user_employment_contract_end_date, user_employment_termination_date=EXCLUDED.user_employment_termination_date, user_employment_termination_reason=EXCLUDED.user_employment_termination_reason, user_employment_status=EXCLUDED.user_employment_status;$tmpl$,
  e.salary, nullif(trim(e.currency),''), nullif(trim(e.pay_scale_area),''), nullif(trim(e.pay_scale_type),''),
  nullif(trim(e.pay_scale_group),''), nullif(trim(e.pay_scale_level),''), e.pay_periods_per_year, e.work_schedule_percentage,
  nullif(trim(e.pernr),''), nullif(trim(e.company_code),''), nullif(trim(e.personnel_area),''), nullif(trim(e.personnel_subarea),''),
  e.hire_date, e.seniority_date, e.probation_end_date, e.contract_end_date, e.termination_date,
  nullif(trim(e.termination_reason),''), nullif(trim(e.employment_status),''), 'LEGACY_EMP::'||e.id)
FROM employees e WHERE e.deleted_at IS NULL;

-- ===== 6. family_members (pure 1:N — delete-then-insert, scoped) =============
SELECT 'DELETE FROM sys.sys_user_family_members WHERE user_family_member_user_id IN (SELECT user_id FROM sys.sys_users WHERE user_external_code LIKE ''LEGACY_EMP::%'');';

SELECT format(
$tmpl$INSERT INTO sys.sys_user_family_members (user_family_member_user_id, user_family_member_tenant_id, user_family_member_first_name, user_family_member_last_name, user_family_member_relationship, user_family_member_birth_date, user_family_member_gender, user_family_member_is_dependent) SELECT u.user_id, u.user_tenant_id, %L, %L, %L, %L::date, %L, %L::boolean FROM sys.sys_users u WHERE u.user_external_code = %L;$tmpl$,
  nullif(trim(fm->>'first_name'),''), nullif(trim(fm->>'last_name'),''), nullif(trim(fm->>'type'),''),
  nullif(trim(fm->>'birth_date'),''), upper(nullif(trim(fm->>'gender'),'')), nullif(trim(fm->>'is_dependent'),''),
  'LEGACY_EMP::'||e.id)
FROM employees e, lateral jsonb_array_elements(e.family_members) fm
WHERE e.deleted_at IS NULL AND jsonb_typeof(e.family_members) = 'array';

SELECT 'COMMIT;';
