-- db/seeds/reconciliation/06_user_career_plans.sql
-- F2 bucket-A import #2: sys.sys_user_career_plans from legacy public.employee_career_paths.
-- EMPLOYEE-CENTRIC (I14/ADR-0024): driver is legacy employees, NOT users.
--
-- PREREQUISITE staging (supervised COPY pipe):
--   CREATE TABLE IF NOT EXISTS staging.tmp_f2_user_career_plans
--     (id uuid, employee_id uuid, path_id uuid, status text, started_at timestamp, target_completion date, notes text);
--   TRUNCATE staging.tmp_f2_user_career_plans;
--   ssh oracle-vm-default 'sudo -u postgres psql -d heuresys_platform -c "\copy (SELECT id, employee_id,
--     path_id, status, started_at, target_completion, notes FROM employee_career_paths) TO STDOUT WITH (FORMAT csv)"' \
--     | psql … -c "\copy staging.tmp_f2_user_career_plans FROM STDIN WITH (FORMAT csv)"
--
-- FK resolution (measured S960):
--   user_id : LEGACY_EMP::<employee_id> -> sys_users (113/128 resolve; 15 skip = out-of-scope employees).
--   tenant  : taken from the resolved sys_user (user_tenant_id) — guarantees user/tenant coherence (I5).
--   path_id : LEGACY_CP::<path_id> -> sys_career_paths within the user's tenant (113/113 resolve, LEFT JOIN).
--   status  : active->ACTIVE, completed->COMPLETED, paused->PAUSED, changed->CANCELLED (CHECK-aligned).
-- IDEMPOTENT: anti-join on (user_id, legacy source_id in metadata). 2nd run inserts 0.

BEGIN;

INSERT INTO sys.sys_user_career_plans (
  user_career_plan_tenant_id, user_career_plan_user_id, user_career_plan_path_id,
  user_career_plan_status, user_career_plan_metadata
)
SELECT
  u.user_tenant_id,
  u.user_id,
  cp.career_path_id,
  CASE s.status
    WHEN 'active'    THEN 'ACTIVE'
    WHEN 'completed' THEN 'COMPLETED'
    WHEN 'paused'    THEN 'PAUSED'
    WHEN 'changed'   THEN 'CANCELLED'
    ELSE 'ACTIVE' END,
  jsonb_build_object('legacy', jsonb_strip_nulls(jsonb_build_object(
    'source_table', 'employee_career_paths', 'source_id', s.id, 'status', s.status,
    'notes', s.notes, 'target_completion', s.target_completion, 'started_at', s.started_at)))
FROM staging.tmp_f2_user_career_plans s
JOIN sys.sys_users u
  ON u.user_external_code = 'LEGACY_EMP::' || s.employee_id::text
 AND u.user_tenant_id IS NOT NULL
LEFT JOIN sys.sys_career_paths cp
  ON cp.career_path_code = 'LEGACY_CP::' || s.path_id::text
 AND cp.career_path_tenant_id = u.user_tenant_id
WHERE NOT EXISTS (
  SELECT 1 FROM sys.sys_user_career_plans p
  WHERE p.user_career_plan_user_id = u.user_id
    AND p.user_career_plan_metadata -> 'legacy' ->> 'source_id' = s.id::text
);

DO $$
DECLARE v_total int; v_with_path int;
BEGIN
  SELECT count(*), count(user_career_plan_path_id) INTO v_total, v_with_path FROM sys.sys_user_career_plans;
  RAISE NOTICE 'user_career_plans: % rows (% with path_id)', v_total, v_with_path;
  IF v_total = 0 THEN RAISE EXCEPTION 'user_career_plans: 0 rows imported'; END IF;
END $$;

COMMIT;
