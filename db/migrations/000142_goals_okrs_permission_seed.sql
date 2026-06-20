-- ============================================================================
-- 000142_goals_okrs_permission_seed.sql — goal/okr RBAC perms + role maps.
-- Mirrors 000114_engagement_feedback_permission_seed.sql. Idempotent (ON CONFLICT DO NOTHING).
-- read  -> 6 HRMS-read roles (incl. PLATFORM_ADMIN explicitly). write -> admins + HR.
-- Authored: 2026-06-20.
-- ============================================================================

INSERT INTO sys.sys_auth_permissions (auth_permission_code, auth_permission_name, auth_permission_resource, auth_permission_action)
VALUES
  ('goal:read',   'Read goals',   'goal', 'read'),
  ('goal:create', 'Create goals', 'goal', 'create'),
  ('goal:update', 'Update goals', 'goal', 'update'),
  ('goal:delete', 'Delete goals', 'goal', 'delete'),
  ('okr:read',    'Read OKRs',    'okr',  'read'),
  ('okr:create',  'Create OKRs',  'okr',  'create'),
  ('okr:update',  'Update OKRs',  'okr',  'update'),
  ('okr:delete',  'Delete OKRs',  'okr',  'delete')
ON CONFLICT (auth_permission_code) DO NOTHING;

-- read audience (6 non-leaf roles; excludes USER/READ_ONLY)
INSERT INTO sys.sys_auth_role_permissions (auth_role_id, auth_permission_id)
SELECT r.auth_role_id, p.auth_permission_id
FROM sys.sys_auth_roles r
CROSS JOIN sys.sys_auth_permissions p
WHERE p.auth_permission_code IN ('goal:read','okr:read')
  AND r.auth_role_code IN ('PLATFORM_ADMIN','TENANT_ADMIN','BLUEPRINT_MANAGER','HRMS_MANAGER','PROCESS_OWNER','MANAGER')
ON CONFLICT (auth_role_id, auth_permission_id) DO NOTHING;

-- write audience (admins + HR managers)
INSERT INTO sys.sys_auth_role_permissions (auth_role_id, auth_permission_id)
SELECT r.auth_role_id, p.auth_permission_id
FROM sys.sys_auth_roles r
CROSS JOIN sys.sys_auth_permissions p
WHERE p.auth_permission_code IN ('goal:create','goal:update','goal:delete','okr:create','okr:update','okr:delete')
  AND r.auth_role_code IN ('PLATFORM_ADMIN','TENANT_ADMIN','HRMS_MANAGER')
ON CONFLICT (auth_role_id, auth_permission_id) DO NOTHING;

DO $$ DECLARE v int; BEGIN
  SELECT count(*) INTO v FROM sys.sys_auth_permissions WHERE auth_permission_resource IN ('goal','okr');
  RAISE NOTICE '000142: goal/okr permissions present: % (expect 8)', v;
  IF v <> 8 THEN RAISE EXCEPTION '000142: expected 8 goal/okr permissions, found %', v; END IF;
END $$;
