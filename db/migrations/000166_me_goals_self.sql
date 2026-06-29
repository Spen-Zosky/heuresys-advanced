-- ============================================================================
-- 000166_me_goals_self.sql
-- S1011 F3b — wire the Obiettivi sub-tab of /me/career to REAL data.
--
-- sys.sys_goals carried 1067 rows imported from the legacy DB, but every
-- user-link column (goal_subject_user_id / goal_owner_user_id / goal_created_by)
-- was NULL — the only person reference is goal_metadata->>'legacy_employee_id'.
-- Backfill goal_subject_user_id via the canonical employee-centric crosswalk
-- (ADR-0024 / I14): sys_users.user_external_code = 'LEGACY_EMP::' || <legacy
-- employees.id>. 632/1067 goals resolve to 159 advanced users (the rest belong
-- to legacy employees not carried into the advanced tenant — left NULL, i.e.
-- not surfaced to any /me/goals caller).
--
-- Also seed the ESS self-permission goal:read:self (the only goal perms today
-- are the tenant-scoped CRUD set) and grant it to the same self-service roles
-- as the other :read:self perms (PLATFORM_ADMIN, TENANT_ADMIN, READ_ONLY, USER).
--
-- IDEMPOTENT: the backfill UPDATE is guarded on goal_subject_user_id IS NULL
-- (2nd run touches 0 rows); the perm/grant inserts use NOT EXISTS guards.
-- ============================================================================

-- 1. Backfill the subject user from the legacy-employee crosswalk.
UPDATE sys.sys_goals g
   SET goal_subject_user_id = u.user_id
  FROM sys.sys_users u
 WHERE g.goal_subject_user_id IS NULL
   AND g.goal_metadata ? 'legacy_employee_id'
   AND u.user_external_code = 'LEGACY_EMP::' || (g.goal_metadata->>'legacy_employee_id');

-- 2. Seed the goal:read:self ESS permission.
INSERT INTO sys.sys_auth_permissions
  (auth_permission_code, auth_permission_name, auth_permission_resource, auth_permission_action)
SELECT 'goal:read:self', 'Read own goals (ESS)', 'goal', 'read:self'
WHERE NOT EXISTS (
  SELECT 1 FROM sys.sys_auth_permissions WHERE auth_permission_code = 'goal:read:self'
);

-- 3. Grant it to the ESS self-service roles (mirror career_succession:read:self).
INSERT INTO sys.sys_auth_role_permissions (auth_role_id, auth_permission_id)
SELECT r.auth_role_id, p.auth_permission_id
  FROM sys.sys_auth_roles r
  CROSS JOIN sys.sys_auth_permissions p
 WHERE p.auth_permission_code = 'goal:read:self'
   AND r.auth_role_code IN ('PLATFORM_ADMIN', 'TENANT_ADMIN', 'READ_ONLY', 'USER')
   AND NOT EXISTS (
     SELECT 1 FROM sys.sys_auth_role_permissions rp
      WHERE rp.auth_role_id = r.auth_role_id
        AND rp.auth_permission_id = p.auth_permission_id
   );

-- Verification (NOTICE only).
DO $$
DECLARE bridged int; granted int;
BEGIN
  SELECT count(*) INTO bridged FROM sys.sys_goals WHERE goal_subject_user_id IS NOT NULL;
  SELECT count(*) INTO granted
    FROM sys.sys_auth_role_permissions rp
    JOIN sys.sys_auth_permissions p ON p.auth_permission_id = rp.auth_permission_id
   WHERE p.auth_permission_code = 'goal:read:self';
  RAISE NOTICE 'F3b: % goals linked to a subject user; goal:read:self granted to % roles (expect 4)', bridged, granted;
END $$;
