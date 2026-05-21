-- =============================================================================
-- 000038_sys_job_roles_family_nullable.sql
-- ADR-0015 — Make sys_job_roles.job_role_family_id nullable.
-- Rationale: legacy job_templates lacks canonical FK to job_families (CW-B26
-- Semantic FK Phantom surfaced in CLI REPORT X2). Nullable FK respects
-- CARD-4 NO_MOCK directive + I1 Position-centric invariant + legacy fidelity.
-- Idempotent: ALTER COLUMN DROP NOT NULL is safe to re-run (PG no-op if
-- already nullable).
-- =============================================================================

BEGIN;

ALTER TABLE sys.sys_job_roles
  ALTER COLUMN job_role_family_id DROP NOT NULL;

COMMENT ON COLUMN sys.sys_job_roles.job_role_family_id IS
  'Optional FK to sys_job_families. NULL allowed for job_roles imported from legacy sources lacking canonical family assignment (see ADR-0015 + CW-B26). UPDATE when family becomes known.';

COMMIT;
