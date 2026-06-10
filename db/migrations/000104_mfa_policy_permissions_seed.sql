-- ============================================================================
-- 000104_mfa_policy_permissions_seed.sql — MVP-4 §2.5 #4: mandatory-MFA policy.
--
-- mfa_policy:read   — view the policy (PLATFORM_ADMIN any tenant; TENANT_ADMIN own).
-- mfa_policy:manage — upsert the policy (same two roles; per-tenant scope is
--                     enforced in the service, mirroring content/surveys writes).
-- Deliberately NOT granted to HRMS_MANAGER: forcing MFA on a whole tenant is a
-- security-administration act, not HR data management.
-- Idempotent (ON CONFLICT DO NOTHING). Authored: 2026-06-10 (S981, MVP-4 §2.5 #4).
-- ============================================================================

INSERT INTO sys.sys_auth_permissions (auth_permission_code, auth_permission_name, auth_permission_resource, auth_permission_action)
VALUES
  ('mfa_policy:read',   'View the tenant mandatory-MFA policy',   'mfa_policy', 'read'),
  ('mfa_policy:manage', 'Manage the tenant mandatory-MFA policy', 'mfa_policy', 'manage')
ON CONFLICT (auth_permission_code) DO NOTHING;

INSERT INTO sys.sys_auth_role_permissions (auth_role_id, auth_permission_id)
SELECT r.auth_role_id, p.auth_permission_id
FROM sys.sys_auth_roles r
JOIN sys.sys_auth_permissions p
  ON p.auth_permission_code IN ('mfa_policy:read', 'mfa_policy:manage')
WHERE r.auth_role_code IN ('PLATFORM_ADMIN', 'TENANT_ADMIN')
ON CONFLICT (auth_role_id, auth_permission_id) DO NOTHING;

DO $$
DECLARE v int;
BEGIN
  SELECT count(*) INTO v
    FROM sys.sys_auth_role_permissions rp
    JOIN sys.sys_auth_permissions p ON p.auth_permission_id = rp.auth_permission_id
    JOIN sys.sys_auth_roles r       ON r.auth_role_id       = rp.auth_role_id
   WHERE p.auth_permission_code IN ('mfa_policy:read', 'mfa_policy:manage')
     AND r.auth_role_code IN ('PLATFORM_ADMIN', 'TENANT_ADMIN');
  IF v <> 4 THEN
    RAISE EXCEPTION '000104: expected 4 mfa_policy grants (2 perms × 2 roles), found %', v;
  END IF;
  RAISE NOTICE '000104: mfa_policy:read/manage seeded for PLATFORM_ADMIN + TENANT_ADMIN.';
END $$;
