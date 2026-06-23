-- ============================================================================
-- 000155_grant_user_role_to_functional_employees.sql
-- Fix B-03 (audit S1006): employees holding only FUNCTIONAL/ORG roles
-- (MANAGER / TEAM_LEADER / TEAM_MEMBER / CEO / HRMS_MANAGER / ORG_DIRECTOR /
-- PROCESS_OWNER / BLUEPRINT_MANAGER) but NOT the base `USER` role were locked
-- out of their OWN Employee Self-Service: the self-scope permissions
-- (user_profile:read:self, skill:read:self, kpi:read:self, learning:read:self,
-- career_succession:read:self, certification:read:self, document:read:self, ...)
-- are granted to USER / TENANT_ADMIN / READ_ONLY / PLATFORM_ADMIN only — NOT to
-- the functional roles. So a manager got 403 on /me/profile, /me/skills, etc.
--
-- Decision (Enzo, 2026-06-23): roles are ADDITIVE — every employee also carries
-- `USER`. This grants USER to every user holding >=1 functional/org role who
-- lacks an active USER grant. The pure platform system account (admin@heuresys.com,
-- PLATFORM_ADMIN-only) is intentionally NOT an employee and is excluded by the
-- functional-role discriminator (PLATFORM_ADMIN already carries self-scope anyway).
--
-- Additive only (never removes/changes a permission); the RBAC effective set is a
-- union of role perms, so adding USER only ADDS the missing self-scope.
-- Resilient (joins by role_code, no hard-coded UUIDs) + idempotent (NOT-EXISTS
-- guard on the active (user,role,tenant) grant; fixed granted_at for an empty
-- twice-run diff). Authored: 2026-06-23 (audit S1006 fix B-03).
-- ============================================================================

INSERT INTO sys.sys_user_auth_roles
  (user_auth_role_user_id, user_auth_role_role_id, user_auth_role_tenant_id, user_auth_role_granted_at)
SELECT DISTINCT u.user_id, ur.auth_role_id, u.user_tenant_id, '2026-06-23T00:00:00Z'::timestamptz
FROM sys.sys_users u
JOIN sys.sys_auth_roles ur ON ur.auth_role_code = 'USER'
WHERE EXISTS (
        -- holds at least one active FUNCTIONAL / ORG role => is an employee
        SELECT 1
        FROM sys.sys_user_auth_roles fx
        JOIN sys.sys_auth_roles fr ON fr.auth_role_id = fx.user_auth_role_role_id
        WHERE fx.user_auth_role_user_id = u.user_id
          AND fx.user_auth_role_revoked_at IS NULL
          AND fr.auth_role_code IN (
            'CEO','TEAM_LEADER','TEAM_MEMBER','MANAGER',
            'HRMS_MANAGER','ORG_DIRECTOR','PROCESS_OWNER','BLUEPRINT_MANAGER'
          )
      )
  AND NOT EXISTS (
        -- does not already hold an active USER grant
        SELECT 1
        FROM sys.sys_user_auth_roles ex
        WHERE ex.user_auth_role_user_id = u.user_id
          AND ex.user_auth_role_role_id = ur.auth_role_id
          AND ex.user_auth_role_revoked_at IS NULL
      );

DO $$
DECLARE missing int;
BEGIN
  -- every employee (>=1 active functional/org role) must now hold an active USER grant
  SELECT count(*) INTO missing
  FROM sys.sys_users u
  WHERE EXISTS (
          SELECT 1 FROM sys.sys_user_auth_roles fx
          JOIN sys.sys_auth_roles fr ON fr.auth_role_id = fx.user_auth_role_role_id
          WHERE fx.user_auth_role_user_id = u.user_id
            AND fx.user_auth_role_revoked_at IS NULL
            AND fr.auth_role_code IN ('CEO','TEAM_LEADER','TEAM_MEMBER','MANAGER',
                                      'HRMS_MANAGER','ORG_DIRECTOR','PROCESS_OWNER','BLUEPRINT_MANAGER')
        )
    AND NOT EXISTS (
          SELECT 1 FROM sys.sys_user_auth_roles ex
          JOIN sys.sys_auth_roles er ON er.auth_role_id = ex.user_auth_role_role_id
          WHERE ex.user_auth_role_user_id = u.user_id
            AND er.auth_role_code = 'USER'
            AND ex.user_auth_role_revoked_at IS NULL
        );
  IF missing <> 0 THEN
    RAISE EXCEPTION '000155: % functional-role employee(s) still lack the USER role', missing;
  END IF;
  RAISE NOTICE '000155: every functional-role employee now carries the USER role (B-03 fixed).';
END $$;
