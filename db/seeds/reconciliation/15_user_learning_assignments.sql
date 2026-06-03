-- db/seeds/reconciliation/15_user_learning_assignments.sql
-- F3 PARTIAL import: sys.sys_user_learning_assignments from legacy course_enrollments + learning_path_enrollments.
-- EMPLOYEE-CENTRIC. Survives the learning-catalog wall because the target's OR-CHECK accepts path_id
-- (FK to sys_learning_paths, where the legacy course/path catalog actually landed) — the dead module_id
-- leg is sidestepped. ~59% cap = the employee->sys_user materialization ceiling (160/270, I14), not a wall.
--
-- PREREQUISITE staging (supervised, UNION of both enrollment sources with resolved path code):
--   CREATE TABLE IF NOT EXISTS staging.tmp_f3c_ula (source_id uuid, employee_id uuid, path_code text, status text, source_table text);
--   (loaded via: course_enrollments JOIN courses(code) UNION ALL learning_path_enrollments JOIN learning_paths(code))
--
-- Bridge (measured S960, 1990 distinct user-path resolve): user LEGACY_EMP::employee_id -> sys_users;
--   path path_code -> sys_learning_paths.learning_path_code (within user tenant). tenant from sys_user.
-- status: completed->COMPLETED, in_progress->IN_PROGRESS, enrolled->ASSIGNED (most-advanced wins per user-path).
-- IDEMPOTENT: DISTINCT ON (user, path) + anti-join (user_id, path_id).
BEGIN;
INSERT INTO sys.sys_user_learning_assignments (
  user_learning_assignment_tenant_id, user_learning_assignment_user_id, user_learning_assignment_path_id,
  user_learning_assignment_is_mandatory, user_learning_assignment_status, user_learning_assignment_metadata)
SELECT DISTINCT ON (u.user_id, lp.learning_path_id)
  u.user_tenant_id, u.user_id, lp.learning_path_id, true,
  CASE s.status WHEN 'completed' THEN 'COMPLETED' WHEN 'in_progress' THEN 'IN_PROGRESS' ELSE 'ASSIGNED' END,
  jsonb_build_object('legacy', jsonb_strip_nulls(jsonb_build_object(
    'source_table', s.source_table, 'source_id', s.source_id, 'path_code', s.path_code, 'status', s.status)))
FROM staging.tmp_f3c_ula s
JOIN sys.sys_users u ON u.user_external_code = 'LEGACY_EMP::' || s.employee_id::text AND u.user_tenant_id IS NOT NULL
JOIN sys.sys_learning_paths lp ON lp.learning_path_code = s.path_code AND lp.learning_path_tenant_id = u.user_tenant_id
WHERE NOT EXISTS (SELECT 1 FROM sys.sys_user_learning_assignments a
  WHERE a.user_learning_assignment_user_id = u.user_id AND a.user_learning_assignment_path_id = lp.learning_path_id)
ORDER BY u.user_id, lp.learning_path_id,
  CASE s.status WHEN 'completed' THEN 1 WHEN 'in_progress' THEN 2 ELSE 3 END;
DO $$ DECLARE v int; BEGIN SELECT count(*) INTO v FROM sys.sys_user_learning_assignments;
  RAISE NOTICE 'user_learning_assignments: % rows', v; IF v=0 THEN RAISE EXCEPTION 'ula: 0 imported'; END IF; END $$;
COMMIT;
