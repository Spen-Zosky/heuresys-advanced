-- 000045_rekey_external_code_employee_centric.sql
-- ADR-0024 / I14 — re-key sys_users.user_external_code from the deprecated user-centric
-- 'LEGACY:'||legacy.users.id to the employee-centric 'LEGACY_EMP::'||legacy.employees.id.
--
-- WHY: the legacy Docker DB is employee-centric (207 FK -> employees vs 45 -> users; the person
-- is `employees`, `users` is a subordinate auth shell). The S950 RTL rebuild wired the correct
-- PERSONS but stored the wrong provenance key (the auth-user id). This migration relabels the
-- provenance field only.
--
-- SAFE: user_external_code is referenced by 0 foreign keys (all 163 FK to sys_users target the
-- user_id UUID PK). This is a pure provenance relabel — it does NOT touch assignments, skill
-- evidence, role grants, credentials, or login. Verified live (S954): qa_artifacts/_f3_fkcheck.txt.
--
-- SELF-CONTAINED: the legacy employees.id is already on the bare-metal, stored by seed 04 in
-- sys_user_position_assignments.metadata->>'legacy_employee_id'. We derive the new key from that
-- — no dependency on the legacy Docker DB or hardcoded VALUES. Verified 160/160 resolvable,
-- 0 unresolvable, 160 distinct emp ids (qa_artifacts/_f3_selfcontained.txt).
--
-- IDEMPOTENT: WHERE user_external_code LIKE 'LEGACY:%' (the old prefix). Re-running is a no-op
-- once rows carry 'LEGACY_EMP::'. The legacy auth-user id is preserved in metadata for lineage.

BEGIN;

-- Resolve each LEGACY:<users.id> user to its legacy employees.id via the assignment metadata
-- that seed 04 already populated. One distinct employee_id per user (verified).
WITH emp_resolution AS (
  SELECT DISTINCT
    a.user_position_assignment_user_id                      AS user_id,
    a.user_position_assignment_metadata->>'legacy_employee_id' AS legacy_employee_id
  FROM sys.sys_user_position_assignments a
  WHERE a.user_position_assignment_metadata ? 'legacy_employee_id'
)
UPDATE sys.sys_users u
SET
  user_external_code = 'LEGACY_EMP::' || er.legacy_employee_id,
  user_metadata = COALESCE(u.user_metadata, '{}'::jsonb)
                  || jsonb_build_object(
                       'legacy_auth_user_id', replace(u.user_external_code, 'LEGACY:', ''),
                       'rekey_source', 'ADR-0024',
                       'rekey_migration', '000045'),
  updated_at = now()
FROM emp_resolution er
WHERE er.user_id = u.user_id
  AND u.user_external_code LIKE 'LEGACY:%';          -- idempotent: only the old prefix

-- Verification (raises NOTICE; does not fail the migration — pure observability).
DO $$
DECLARE old_prefix int; new_prefix int;
BEGIN
  SELECT count(*) INTO old_prefix FROM sys.sys_users WHERE user_external_code LIKE 'LEGACY:%';
  SELECT count(*) INTO new_prefix FROM sys.sys_users WHERE user_external_code LIKE 'LEGACY_EMP::%';
  RAISE NOTICE 'After re-key: old LEGACY:%% prefix = % (expect 0), new LEGACY_EMP:: prefix = % (expect 160)', old_prefix, new_prefix;
END $$;

COMMIT;
