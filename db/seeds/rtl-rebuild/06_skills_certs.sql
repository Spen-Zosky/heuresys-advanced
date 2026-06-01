-- 06_skills_certs.sql — D5: complete skill/cert import (v5 targets are empty/near-empty).
-- Idempotent. Run via psql AFTER 04 (users wired). ADDITIVE.
--
-- Imports: tenant_custom_skills -> sys_skills (tenant-scoped); employee_skills -> sys_user_skill_evidence;
-- employee_certifications + certifications -> sys_user_certifications; employee_skill_profiles (KSABA)
-- -> sys_assessments + 5 sys_assessment_results; employee_skill_assessments -> sys_assessments (gap).
-- ESCO crosswalk: legacy esco uri -> v5 sys_skills.skill_esco_uri (verified 905/905 + 312/312 resolvable).
-- Proficiency int -> v5 6-level rank (NOVICE..MASTER).

BEGIN;

CREATE SCHEMA IF NOT EXISTS staging;
-- EMPLOYEE-CENTRIC (ADR-0024 / I14, re-keyed S954): the person link is employees->email->sys_users,
-- not LEGACY:'||users.id. staging.rtl_employees mirrors employees.csv (34 cols, \copy maps by position);
-- only (id,email) are used below. users.csv is no longer needed here.
CREATE TABLE IF NOT EXISTS staging.rtl_employees (
  id text, tenant_id text, email text, personal_email text, first_name text, middle_name text,
  last_name text, job_title text, department text, location text, position_id text, org_unit_id text,
  manager_id text, pernr text, hire_date text, seniority_date text, is_active text, employment_status text,
  phone_mobile text, phone_work text, address_street text, address_city text, address_postal_code text,
  address_country text, iban text, swift_bic text, bank_name text, emergency_contact_name text,
  emergency_contact_phone text, emergency_contact_relationship text, highest_education_level text,
  highest_education_field text, highest_education_institution text, highest_education_year text
);
CREATE TABLE IF NOT EXISTS staging.rtl_employee_skills (
  id text, tenant_id text, employee_id text, esco_skill_id text, esco_uri text, custom_skill_name text,
  proficiency_level text, proficiency_label text, years_experience text, is_primary text, is_verified text,
  source text, confidence_score text);
CREATE TABLE IF NOT EXISTS staging.rtl_employee_skill_profiles (
  id text, tenant_id text, employee_id text, skill_id text, esco_uri text, knowledge_level text, skill_level text,
  ability_level text, behavior_level text, attitude_level text, composite_score text, source text,
  acquired_date text, verification_status text, target_level text);
CREATE TABLE IF NOT EXISTS staging.rtl_employee_skill_assessments (
  id text, employee_id text, esco_skill_uri text, skill_name text, assessed_level text, required_level text,
  gap text, assessment_date text, assessed_by text, assessment_method text, evidence_notes text);
CREATE TABLE IF NOT EXISTS staging.rtl_tenant_custom_skills (
  id text, tenant_id text, code text, name_en text, name_it text, skill_type text, base_esco_skill_id text,
  description_en text, description_it text, is_active text);
CREATE TABLE IF NOT EXISTS staging.rtl_certifications (
  id text, tenant_id text, code text, name text, name_en text, name_it text, issuing_organization text,
  validity_months text, is_internal text, is_active text);
CREATE TABLE IF NOT EXISTS staging.rtl_employee_certifications (
  id text, employee_id text, certification_id text, credential_id text, issued_date text, expiry_date text,
  status text, verification_status text, credential_url text, document_url text);
TRUNCATE staging.rtl_employees, staging.rtl_employee_skills, staging.rtl_employee_skill_profiles,
         staging.rtl_employee_skill_assessments, staging.rtl_tenant_custom_skills,
         staging.rtl_certifications, staging.rtl_employee_certifications;
\copy staging.rtl_employees                 FROM 'extracted/employees.csv'                 WITH (FORMAT csv, HEADER true)
\copy staging.rtl_employee_skills           FROM 'extracted/employee_skills.csv'           WITH (FORMAT csv, HEADER true)
\copy staging.rtl_employee_skill_profiles   FROM 'extracted/employee_skill_profiles.csv'   WITH (FORMAT csv, HEADER true)
\copy staging.rtl_employee_skill_assessments FROM 'extracted/employee_skill_assessments.csv' WITH (FORMAT csv, HEADER true)
\copy staging.rtl_tenant_custom_skills      FROM 'extracted/tenant_custom_skills.csv'      WITH (FORMAT csv, HEADER true)
\copy staging.rtl_certifications            FROM 'extracted/certifications.csv'            WITH (FORMAT csv, HEADER true)
\copy staging.rtl_employee_certifications   FROM 'extracted/employee_certifications.csv'   WITH (FORMAT csv, HEADER true)

-- legacy employee_id -> v5 user (id + tenant), EMPLOYEE-CENTRIC via email (ADR-0024 / I14).
-- Was: JOIN staging.rtl_users ON user_external_code='LEGACY:'||users.id (user-centric, deprecated).
DROP TABLE IF EXISTS rtl_emp_user;
CREATE TEMP TABLE rtl_emp_user ON COMMIT DROP AS
SELECT e.id AS legacy_employee_id, u.user_id AS v5_user_id, u.user_tenant_id AS v5_tenant_id
FROM staging.rtl_employees e
JOIN sys.sys_users u ON lower(u.user_email) = lower(e.email);

DROP TABLE IF EXISTS rtl_tenant_map;
CREATE TEMP TABLE rtl_tenant_map (legacy_tenant uuid, v5_tenant uuid) ON COMMIT DROP;
INSERT INTO rtl_tenant_map VALUES
  ('0c54b84a-db6e-4da4-bc91-af5d480d524e', '86ba7a65-217f-48ba-8ce5-5c09b40a66b0'),
  ('d5855519-3ed1-4427-865f-fe75f1e42c4c', (SELECT tenant_id FROM sys.sys_tenancies WHERE tenant_code = 'HEURESYS'));

-- reusable int -> rank mapping
-- 1->NOVICE 2->BASIC 3->COMPETENT 4->PROFICIENT 5->EXPERT >=6->MASTER (legacy 0/null -> NOVICE)

-- 1) tenant_custom_skills -> sys_skills (tenant-scoped, non-global)
INSERT INTO sys.sys_skills (skill_tenant_id, skill_code, skill_name, skill_description, skill_is_global, skill_metadata)
SELECT tm.v5_tenant, 'CUSTOM::' || s.code, COALESCE(NULLIF(s.name_en,''), NULLIF(s.name_it,''), s.code),
       NULLIF(s.description_en,''), false,
       jsonb_strip_nulls(jsonb_build_object('legacy_custom_skill_id', s.id, 'base_esco_skill_id',
         NULLIF(s.base_esco_skill_id,''), 'skill_type', NULLIF(s.skill_type,''), 'name_it', NULLIF(s.name_it,'')))
FROM staging.rtl_tenant_custom_skills s
JOIN rtl_tenant_map tm ON tm.legacy_tenant = s.tenant_id::uuid
WHERE NOT EXISTS (SELECT 1 FROM sys.sys_skills k WHERE k.skill_tenant_id = tm.v5_tenant AND k.skill_code = 'CUSTOM::' || s.code);

-- 2) employee_skills -> sys_user_skill_evidence (skill resolved by esco uri)
INSERT INTO sys.sys_user_skill_evidence (
  user_skill_evidence_user_id, user_skill_evidence_tenant_id, user_skill_evidence_skill_id,
  user_skill_evidence_declared_proficiency, user_skill_evidence_source, user_skill_evidence_score,
  user_skill_evidence_metadata)
SELECT eu.v5_user_id, eu.v5_tenant_id, k.skill_id,
  CASE COALESCE(NULLIF(s.proficiency_level,'')::int, 1)
    WHEN 1 THEN 'NOVICE' WHEN 2 THEN 'BASIC' WHEN 3 THEN 'COMPETENT'
    WHEN 4 THEN 'PROFICIENT' WHEN 5 THEN 'EXPERT' ELSE 'MASTER' END,
  CASE lower(NULLIF(s.source,''))
    WHEN 'self_declaration' THEN 'SELF_ASSESSMENT'
    WHEN 'manager_override' THEN 'MANAGER_ASSESSMENT'
    ELSE 'AI_INFERRED' END,                          -- map legacy source onto the v5 source CHECK
  NULLIF(s.confidence_score,'')::numeric,
  jsonb_strip_nulls(jsonb_build_object('legacy_skill_id', s.id, 'legacy_source', NULLIF(s.source,''),
    'years_experience', NULLIF(s.years_experience,''),
    'is_primary', NULLIF(s.is_primary,''), 'proficiency_label', NULLIF(s.proficiency_label,'')))
FROM staging.rtl_employee_skills s
JOIN rtl_emp_user eu ON eu.legacy_employee_id = s.employee_id
JOIN sys.sys_skills k ON k.skill_esco_uri = s.esco_uri          -- esco crosswalk (905/905 resolvable)
WHERE NULLIF(s.esco_uri,'') IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM sys.sys_user_skill_evidence x
                  WHERE x.user_skill_evidence_user_id = eu.v5_user_id AND x.user_skill_evidence_skill_id = k.skill_id);

-- 3) employee_certifications + certifications catalog -> sys_user_certifications (denormalized)
INSERT INTO sys.sys_user_certifications (
  user_certification_user_id, user_certification_tenant_id, user_certification_name, user_certification_issuer,
  user_certification_issued_date, user_certification_expires_date, user_certification_credential_id,
  user_certification_document_uri, user_certification_metadata)
SELECT eu.v5_user_id, eu.v5_tenant_id,
  COALESCE(NULLIF(cat.name,''), NULLIF(cat.name_en,''), 'Certification'),
  NULLIF(cat.issuing_organization,''),
  NULLIF(ec.issued_date,'')::date, NULLIF(ec.expiry_date,'')::date, NULLIF(ec.credential_id,''),
  COALESCE(NULLIF(ec.document_url,''), NULLIF(ec.credential_url,'')),
  jsonb_strip_nulls(jsonb_build_object('legacy_employee_certification_id', ec.id, 'status', NULLIF(ec.status,''),
    'verification_status', NULLIF(ec.verification_status,''), 'validity_months', NULLIF(cat.validity_months,''),
    'is_internal', NULLIF(cat.is_internal,'')))
FROM staging.rtl_employee_certifications ec
JOIN rtl_emp_user eu ON eu.legacy_employee_id = ec.employee_id
LEFT JOIN staging.rtl_certifications cat ON cat.id = ec.certification_id
WHERE NOT EXISTS (SELECT 1 FROM sys.sys_user_certifications x
  WHERE x.user_certification_user_id = eu.v5_user_id
    AND x.user_certification_credential_id IS NOT DISTINCT FROM NULLIF(ec.credential_id,'')
    AND x.user_certification_name = COALESCE(NULLIF(cat.name,''), NULLIF(cat.name_en,''), 'Certification'))
ON CONFLICT (user_certification_tenant_id, user_certification_user_id, user_certification_name,
             user_certification_issuer, COALESCE(user_certification_issued_date, '0001-01-01'::date))
  DO NOTHING;  -- B7: legacy dup (same name+issuer+date, diff credential_id); column-inference matches the unique INDEX

-- 4) employee_skill_profiles (KSABA) -> one sys_assessments + 5 sys_assessment_results per profile
-- assessment_method_id is nullable (omitted). assessment_kind CHECK = {MANAGER,THREE_SIXTY,PEER,SELF,EXTERNAL}:
-- KSABA self-competency profile -> 'SELF'; the real subtype is preserved in metadata.assessment_subtype.
INSERT INTO sys.sys_assessments (assessment_tenant_id, assessment_subject_user_id, assessment_kind,
  assessment_status, assessment_metadata)
SELECT eu.v5_tenant_id, eu.v5_user_id, 'SELF', 'COMPLETED',
  jsonb_build_object('legacy_profile_id', p.id, 'assessment_subtype', 'SKILL_PROFILE', 'esco_uri', NULLIF(p.esco_uri,''),
    'composite_score', NULLIF(p.composite_score,''), 'acquired_date', NULLIF(p.acquired_date,''))
FROM staging.rtl_employee_skill_profiles p
JOIN rtl_emp_user eu ON eu.legacy_employee_id = p.employee_id
WHERE NOT EXISTS (SELECT 1 FROM sys.sys_assessments a
  WHERE a.assessment_subject_user_id = eu.v5_user_id AND a.assessment_metadata->>'legacy_profile_id' = p.id);

INSERT INTO sys.sys_assessment_results (assessment_result_assessment_id, assessment_result_tenant_id,
  assessment_result_dimension, assessment_result_score)
SELECT a.assessment_id, a.assessment_tenant_id, d.dim, d.score::numeric
FROM sys.sys_assessments a
JOIN staging.rtl_employee_skill_profiles p ON p.id = a.assessment_metadata->>'legacy_profile_id'
CROSS JOIN LATERAL (VALUES
  ('KNOWLEDGE', p.knowledge_level), ('SKILL', p.skill_level), ('ABILITY', p.ability_level),
  ('BEHAVIOR', p.behavior_level), ('ATTITUDE', p.attitude_level)) AS d(dim, score)
WHERE a.assessment_metadata ? 'legacy_profile_id' AND NULLIF(d.score,'') IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM sys.sys_assessment_results r
    WHERE r.assessment_result_assessment_id = a.assessment_id AND r.assessment_result_dimension = d.dim);

-- 5) employee_skill_assessments (gap) -> sys_assessments (manager-assessed gap; subtype in metadata)
INSERT INTO sys.sys_assessments (assessment_tenant_id, assessment_subject_user_id, assessment_kind,
  assessment_status, assessment_period_end, assessment_metadata)
SELECT eu.v5_tenant_id, eu.v5_user_id, 'MANAGER', 'COMPLETED', NULLIF(sa.assessment_date,'')::date,
  jsonb_strip_nulls(jsonb_build_object('legacy_assessment_id', sa.id, 'assessment_subtype', 'SKILL_GAP', 'skill_name', NULLIF(sa.skill_name,''),
    'esco_uri', NULLIF(sa.esco_skill_uri,''), 'assessed_level', NULLIF(sa.assessed_level,''),
    'required_level', NULLIF(sa.required_level,''), 'gap', NULLIF(sa.gap,''), 'method', NULLIF(sa.assessment_method,'')))
FROM staging.rtl_employee_skill_assessments sa
JOIN rtl_emp_user eu ON eu.legacy_employee_id = sa.employee_id
WHERE NOT EXISTS (SELECT 1 FROM sys.sys_assessments a
  WHERE a.assessment_subject_user_id = eu.v5_user_id AND a.assessment_metadata->>'legacy_assessment_id' = sa.id);

DO $$
DECLARE cs int; se int; uc int; ap int; ag int;
BEGIN
  SELECT count(*) INTO cs FROM sys.sys_skills WHERE skill_code LIKE 'CUSTOM::%';
  SELECT count(*) INTO se FROM sys.sys_user_skill_evidence WHERE user_skill_evidence_metadata ? 'legacy_skill_id';
  SELECT count(*) INTO uc FROM sys.sys_user_certifications WHERE user_certification_metadata ? 'legacy_employee_certification_id';
  SELECT count(*) INTO ap FROM sys.sys_assessments WHERE assessment_metadata ? 'legacy_profile_id';
  SELECT count(*) INTO ag FROM sys.sys_assessments WHERE assessment_metadata ? 'legacy_assessment_id';
  RAISE NOTICE 'custom skills:% (~25) · skill evidence:% (~905) · certs:% (~729) · KSABA assessments:% (~312) · gap assessments:% (~299)', cs, se, uc, ap, ag;
END $$;

COMMIT;
