-- =============================================================================
-- 000041_sys_esco_occupation_mappings_job_role_nullable.sql
-- ADR-0016 — Make sys_esco_occupation_mappings.job_role_id nullable.
-- Rationale: ESCO catalog data lacks canonical FK to internal job_roles
-- (CW-B26 Semantic FK Phantom — confirmed REPORT X4.A §1.A.2: 0/5 pre-flight
-- resolves). Mirror pattern of ADR-0015 (sys_job_roles.family_id nullable).
-- Idempotent: ALTER COLUMN DROP NOT NULL safe to re-run.
-- =============================================================================

BEGIN;

ALTER TABLE sys.sys_esco_occupation_mappings
  ALTER COLUMN esco_occupation_mapping_job_role_id DROP NOT NULL;

COMMENT ON COLUMN sys.sys_esco_occupation_mappings.esco_occupation_mapping_job_role_id IS
  'Optional FK to sys_job_roles. NULL allowed for ESCO catalog entries imported without canonical job_role assignment (ESCO codes != UUID lineage). See ADR-0016 + CW-B26 Semantic FK Phantom. UPDATE when job_role becomes known.';

COMMIT;
