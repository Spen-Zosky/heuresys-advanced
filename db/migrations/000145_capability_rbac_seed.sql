-- ============================================================================
-- 000145_capability_rbac_seed.sql — Gap#1 RBAC slice (Step 1).
-- Adds the ORG_DIRECTOR functional role (holderless — D1-B: Porta-2 demo runs as
-- federica/TENANT_ADMIN; a real holder is a follow-up grant, 000049-style) and the
-- 4 permissions that gate the two new consoles + the MLCE/Maturity engines:
--   process_owner:read  -> Porta-1 Process-Owner console (read)
--   org_director:read   -> Porta-2 Org-Director console (read)
--   capability:read     -> MLCE/Maturity GET endpoints (Step 3-4)
--   capability:admin    -> MLCE/Maturity POST .../recompute (Step 3-4)
-- House-style: multi-word resource = snake_case (mirrors mfa_policy /
-- organization_unit_processes); the URL routes stay hyphenated (D5).
-- Mirrors 000045 (role) + 000142 (perms+maps). Idempotent (ON CONFLICT). Sidebar
-- nav rows ship WITH their pages (Porta-1 / Porta-2 migrations) to avoid dead links.
-- Authored: 2026-06-20 (Gap#1 Step 1).
-- ============================================================================

-- 1. ORG_DIRECTOR role (functional, holderless). DO UPDATE keeps re-run an empty diff.
INSERT INTO sys.sys_auth_roles
  (auth_role_code, auth_role_name, auth_role_description, auth_role_is_platform, auth_role_category)
VALUES
  ('ORG_DIRECTOR', 'Organization Director',
   'Org-Director console: reads the structure -> position -> PIP graph and the capability/maturity scorecard for the tenant. No system administration, no mutations.',
   false, 'functional')
ON CONFLICT (auth_role_code)
  DO UPDATE SET auth_role_category = EXCLUDED.auth_role_category;

-- 2. Permissions (4).
INSERT INTO sys.sys_auth_permissions (auth_permission_code, auth_permission_name, auth_permission_resource, auth_permission_action)
VALUES
  ('process_owner:read', 'Read Process-Owner console', 'process_owner', 'read'),
  ('org_director:read',  'Read Org-Director console',  'org_director',  'read'),
  ('capability:read',    'Read capability scores',     'capability',    'read'),
  ('capability:admin',   'Recompute capability scores','capability',    'admin')
ON CONFLICT (auth_permission_code) DO NOTHING;

-- 3a. process_owner:read -> platform/tenant admins + process/blueprint owners.
INSERT INTO sys.sys_auth_role_permissions (auth_role_id, auth_permission_id)
SELECT r.auth_role_id, p.auth_permission_id
FROM sys.sys_auth_roles r
CROSS JOIN sys.sys_auth_permissions p
WHERE p.auth_permission_code = 'process_owner:read'
  AND r.auth_role_code IN ('PLATFORM_ADMIN','TENANT_ADMIN','PROCESS_OWNER','BLUEPRINT_MANAGER')
ON CONFLICT (auth_role_id, auth_permission_id) DO NOTHING;

-- 3b. org_director:read + capability:read -> platform/tenant admins + ORG_DIRECTOR + HR.
INSERT INTO sys.sys_auth_role_permissions (auth_role_id, auth_permission_id)
SELECT r.auth_role_id, p.auth_permission_id
FROM sys.sys_auth_roles r
CROSS JOIN sys.sys_auth_permissions p
WHERE p.auth_permission_code IN ('org_director:read','capability:read')
  AND r.auth_role_code IN ('PLATFORM_ADMIN','TENANT_ADMIN','ORG_DIRECTOR','HRMS_MANAGER')
ON CONFLICT (auth_role_id, auth_permission_id) DO NOTHING;

-- 3c. capability:admin (recompute) -> platform/tenant admins only.
INSERT INTO sys.sys_auth_role_permissions (auth_role_id, auth_permission_id)
SELECT r.auth_role_id, p.auth_permission_id
FROM sys.sys_auth_roles r
CROSS JOIN sys.sys_auth_permissions p
WHERE p.auth_permission_code = 'capability:admin'
  AND r.auth_role_code IN ('PLATFORM_ADMIN','TENANT_ADMIN')
ON CONFLICT (auth_role_id, auth_permission_id) DO NOTHING;

-- 4. Verify (fail loud).
DO $$
DECLARE roles int; perms int; maps int;
BEGIN
  SELECT count(*) INTO roles FROM sys.sys_auth_roles WHERE auth_role_code = 'ORG_DIRECTOR';
  IF roles <> 1 THEN RAISE EXCEPTION '000145: expected ORG_DIRECTOR role, found %', roles; END IF;

  SELECT count(*) INTO perms FROM sys.sys_auth_permissions
   WHERE auth_permission_code IN ('process_owner:read','org_director:read','capability:read','capability:admin');
  IF perms <> 4 THEN RAISE EXCEPTION '000145: expected 4 capability/console permissions, found %', perms; END IF;

  SELECT count(*) INTO maps FROM sys.sys_auth_role_permissions rp
    JOIN sys.sys_auth_permissions p ON p.auth_permission_id = rp.auth_permission_id
   WHERE p.auth_permission_code IN ('process_owner:read','org_director:read','capability:read','capability:admin');
  -- 4 + 8 + 2 = 14 expected mappings
  IF maps <> 14 THEN RAISE EXCEPTION '000145: expected 14 capability/console role-mappings, found %', maps; END IF;

  RAISE NOTICE '000145: ORG_DIRECTOR role + 4 perms + 14 mappings OK.';
END $$;
