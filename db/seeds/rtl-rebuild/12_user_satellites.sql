-- 12_user_satellites.sql — WS-1 (1b): populate the TRACTABLE empty sys_user_* satellites
-- from the legacy `employees` source, employee-centric (ADR-0024 / I14).
-- Idempotent. Run via psql AFTER 04 (users wired + positions). ADDITIVE only — never DELETE.
--
-- EMPLOYEE-CENTRIC crosswalk: the person is the legacy `employees` row, resolved to its v5 user
-- via EMAIL (`lower(sys_users.user_email) = lower(employees.email)`) — the canonical link used by
-- seeds 04/06. Tenant ALWAYS comes from the resolving sys_users row (tenant isolation = FK, I5),
-- NEVER from the legacy/module tenant.
--
-- POPULATES (deterministic 1:1, MAPPING-CARD RULE — no fabrication):
--   1) sys_user_profiles            <- employees.phone_mobile/phone_work (+ emergency/address -> metadata)
--   2) sys_user_education_records   <- employees.highest_education_level/institution/field/year
--   3) sys_user_learning_evidence   <- legacy module_completions (employee-linked via enrollment),
--                                      ONLY status='completed' rows (real completion evidence),
--                                      module resolved by code OLDDB::module_completions::<id>
--   4) sys_user_assessment_evidence <- PROJECTION of existing v5 sys_assessment_results JOIN
--                                      sys_assessments (already employee-centric, loaded by seed 06).
--                                      Pure in-DB derivation; FK resolves by construction.
--
-- SKIPPED / BLOCKED (documented, NOT fabricated):
--   - sys_user_professional_experiences: NO clean legacy source. The legacy `employees` table has
--     no prior-employment columns and there is no employment_history/work_experience table; the
--     career_* tables are forward-looking aspiration/path data, not past employment. Inserting
--     would require fabricating employer/role_title/start_date (all NOT NULL) -> SKIPPED.
--   - sys_user_kpi_evidence: CROSS-WAVE BLOCKED. Its FK target sys_kpi_definitions is EMPTY (0 rows)
--     and is a WS-2 target, not WS-1. user_kpi_evidence_kpi_id (NOT NULL) cannot resolve -> deferred to WS-2.

BEGIN;

CREATE SCHEMA IF NOT EXISTS staging;

-- ── staging mirrors (employees.csv = 34 cols; module_completions subset = 8 cols) ──────────────
CREATE TABLE IF NOT EXISTS staging.rtl_employees (
  id text, tenant_id text, email text, personal_email text, first_name text, middle_name text,
  last_name text, job_title text, department text, location text, position_id text, org_unit_id text,
  manager_id text, pernr text, hire_date text, seniority_date text, is_active text, employment_status text,
  phone_mobile text, phone_work text, address_street text, address_city text, address_postal_code text,
  address_country text, iban text, swift_bic text, bank_name text, emergency_contact_name text,
  emergency_contact_phone text, emergency_contact_relationship text, highest_education_level text,
  highest_education_field text, highest_education_institution text, highest_education_year text
);
CREATE TABLE IF NOT EXISTS staging.rtl_employee_module_completions (
  completion_id text, employee_id text, status text, score text, completed_at text,
  started_at text, time_spent_minutes text, attempts text
);
TRUNCATE staging.rtl_employees, staging.rtl_employee_module_completions;
\copy staging.rtl_employees                   FROM 'extracted/employees.csv'                   WITH (FORMAT csv, HEADER true)
\copy staging.rtl_employee_module_completions  FROM 'extracted/employee_module_completions.csv' WITH (FORMAT csv, HEADER true)

-- legacy employee -> v5 (user_id + the user's tenant), employee-centric via email (ADR-0024).
DROP TABLE IF EXISTS rtl_emp_user;
CREATE TEMP TABLE rtl_emp_user ON COMMIT DROP AS
SELECT e.id AS legacy_employee_id, u.user_id AS v5_user_id, u.user_tenant_id AS v5_tenant_id
FROM staging.rtl_employees e
JOIN sys.sys_users u ON lower(u.user_email) = lower(e.email);

-- ── 1) sys_user_profiles ───────────────────────────────────────────────────────────────────────
-- phone: prefer mobile, fall back to work. Emergency contact + address routed to metadata
-- (no dedicated v5 columns). UNIQUE (user_profile_user_id) -> ON CONFLICT DO NOTHING (idempotent).
-- NB the 1 pre-existing profile (admin) is untouched; admin has no legacy employee -> not in rtl_emp_user.
INSERT INTO sys.sys_user_profiles (
  user_profile_user_id, user_profile_tenant_id, user_profile_phone, user_profile_metadata)
SELECT eu.v5_user_id, eu.v5_tenant_id,
  NULLIF(COALESCE(NULLIF(e.phone_mobile,''), NULLIF(e.phone_work,'')), ''),
  jsonb_strip_nulls(jsonb_build_object(
    'legacy_employee_id', e.id,
    'source', 'ws1-rederive',
    'phone_mobile', NULLIF(e.phone_mobile,''),
    'phone_work', NULLIF(e.phone_work,''),
    'emergency_contact_name', NULLIF(e.emergency_contact_name,''),
    'emergency_contact_phone', NULLIF(e.emergency_contact_phone,''),
    'emergency_contact_relationship', NULLIF(e.emergency_contact_relationship,''),
    'address_city', NULLIF(e.address_city,''),
    'address_country', NULLIF(e.address_country,'')))
FROM staging.rtl_employees e
JOIN rtl_emp_user eu ON eu.legacy_employee_id = e.id
ON CONFLICT (user_profile_user_id) DO NOTHING;

-- ── 2) sys_user_education_records ────────────────────────────────────────────────────────────────
-- degree + institution are NOT NULL: insert only rows where BOTH resolve (deterministic). Field/year
-- optional. No natural unique key -> idempotency via WHERE NOT EXISTS on (user, degree, institution).
-- highest_education_year (yyyy) -> a Jan-1 end_date (date, RD-09) when 4-digit; raw value kept in metadata.
INSERT INTO sys.sys_user_education_records (
  user_education_record_user_id, user_education_record_tenant_id, user_education_degree,
  user_education_institution, user_education_field_of_study, user_education_end_date,
  user_education_metadata)
SELECT eu.v5_user_id, eu.v5_tenant_id,
  e.highest_education_level, e.highest_education_institution,
  NULLIF(e.highest_education_field,''),
  CASE WHEN e.highest_education_year ~ '^[0-9]{4}$'
       THEN make_date(e.highest_education_year::int, 1, 1) END,
  jsonb_strip_nulls(jsonb_build_object(
    'legacy_employee_id', e.id, 'source', 'ws1-rederive',
    'highest_education_year', NULLIF(e.highest_education_year,''),
    'is_highest', true))
FROM staging.rtl_employees e
JOIN rtl_emp_user eu ON eu.legacy_employee_id = e.id
WHERE NULLIF(e.highest_education_level,'') IS NOT NULL
  AND NULLIF(e.highest_education_institution,'') IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM sys.sys_user_education_records x
    WHERE x.user_education_record_user_id = eu.v5_user_id
      AND x.user_education_degree         = e.highest_education_level
      AND x.user_education_institution    = e.highest_education_institution);

-- ── 3) sys_user_learning_evidence ─────────────────────────────────────────────────────────────────
-- ONLY genuine completions (status='completed') become "learning evidence" (completed_at NOT NULL).
-- module resolved by code OLDDB::module_completions::<completion_id> -> a real sys_learning_module
-- (FK on module_id). not_started/in_progress legacy rows are NOT evidence -> excluded (honest).
-- No natural unique key -> idempotency via WHERE NOT EXISTS on (user, module).
-- NB the live rtl+heuresys learning footprint is intentionally tiny: the legacy subset holds only
-- 11 module_completions across 1 employee, of which 1 is 'completed'. This is the REAL data, not a stub.
INSERT INTO sys.sys_user_learning_evidence (
  user_learning_evidence_user_id, user_learning_evidence_tenant_id, user_learning_evidence_module_id,
  user_learning_evidence_completed_at, user_learning_evidence_score, user_learning_evidence_metadata)
SELECT eu.v5_user_id, eu.v5_tenant_id, lm.learning_module_id,
  COALESCE(NULLIF(mc.completed_at,'')::timestamptz, now()),
  NULLIF(mc.score,'')::numeric,
  jsonb_strip_nulls(jsonb_build_object(
    'legacy_completion_id', mc.completion_id, 'source', 'ws1-rederive',
    'legacy_status', NULLIF(mc.status,''),
    'time_spent_minutes', NULLIF(mc.time_spent_minutes,''),
    'attempts', NULLIF(mc.attempts,'')))
FROM staging.rtl_employee_module_completions mc
JOIN rtl_emp_user eu ON eu.legacy_employee_id = mc.employee_id
JOIN sys.sys_learning_modules lm
  ON lm.learning_module_code = 'OLDDB::module_completions::' || mc.completion_id
WHERE lower(NULLIF(mc.status,'')) = 'completed'
  AND NOT EXISTS (
    SELECT 1 FROM sys.sys_user_learning_evidence x
    WHERE x.user_learning_evidence_user_id   = eu.v5_user_id
      AND x.user_learning_evidence_module_id = lm.learning_module_id);

-- ── 4) sys_user_assessment_evidence ────────────────────────────────────────────────────────────────
-- Deterministic PROJECTION of the v5 assessment data already loaded by seed 06 (employee-centric):
-- one evidence row per (assessment, dimension) from sys_assessment_results. user_id = the assessment
-- subject; tenant_id from the assessment (already the subject's tenant). assessment_id resolves by
-- construction (it IS an existing assessment). dimension copied verbatim (KNOWLEDGE/SKILL/ABILITY/
-- BEHAVIOR/ATTITUDE — no CHECK). No natural unique key -> idempotency via WHERE NOT EXISTS on
-- (user, assessment, dimension).
INSERT INTO sys.sys_user_assessment_evidence (
  user_assessment_evidence_user_id, user_assessment_evidence_tenant_id,
  user_assessment_evidence_assessment_id, user_assessment_evidence_dimension,
  user_assessment_evidence_score, user_assessment_evidence_narrative,
  user_assessment_evidence_assessor_user_id, user_assessment_evidence_metadata)
SELECT a.assessment_subject_user_id, a.assessment_tenant_id, a.assessment_id,
  r.assessment_result_dimension, r.assessment_result_score, r.assessment_result_narrative,
  r.assessment_result_assessor_user_id,
  jsonb_strip_nulls(jsonb_build_object(
    'source', 'ws1-rederive',
    'assessment_kind', a.assessment_kind,
    'assessment_subtype', a.assessment_metadata->>'assessment_subtype',
    'legacy_profile_id', a.assessment_metadata->>'legacy_profile_id',
    'legacy_assessment_id', a.assessment_metadata->>'legacy_assessment_id'))
FROM sys.sys_assessment_results r
JOIN sys.sys_assessments a ON a.assessment_id = r.assessment_result_assessment_id
WHERE NOT EXISTS (
  SELECT 1 FROM sys.sys_user_assessment_evidence x
  WHERE x.user_assessment_evidence_user_id       = a.assessment_subject_user_id
    AND x.user_assessment_evidence_assessment_id = a.assessment_id
    AND x.user_assessment_evidence_dimension     = r.assessment_result_dimension);

-- ── verification (fail loud is not required; this is informational like the other seeds) ───────────
DO $$
DECLARE pr int; ed int; le int; ae int;
BEGIN
  SELECT count(*) INTO pr FROM sys.sys_user_profiles            WHERE user_profile_metadata->>'source' = 'ws1-rederive';
  SELECT count(*) INTO ed FROM sys.sys_user_education_records   WHERE user_education_metadata->>'source' = 'ws1-rederive';
  SELECT count(*) INTO le FROM sys.sys_user_learning_evidence   WHERE user_learning_evidence_metadata->>'source' = 'ws1-rederive';
  SELECT count(*) INTO ae FROM sys.sys_user_assessment_evidence WHERE user_assessment_evidence_metadata->>'source' = 'ws1-rederive';
  RAISE NOTICE 'WS-1 1b: profiles:% (~159) · education:% (~159) · learning_evidence:% (~1, real footprint) · assessment_evidence:% (~1560)', pr, ed, le, ae;
END $$;

COMMIT;
