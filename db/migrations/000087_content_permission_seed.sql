-- ============================================================================
-- 000087_content_permission_seed.sql — cap④ CMS RBAC permissions + role maps.
-- Mirrors 000078_engagement_surveys_permission_seed.sql. Idempotent (ON CONFLICT DO NOTHING).
-- Content is TENANT-scoped (not global) → standard tenant audience (TENANT_ADMIN keeps it,
-- correctly, also via the 000005 catch-all). 5 admin permissions (spec §5):
--   content:read   → 6 non-leaf HRMS-read roles (excludes USER/READ_ONLY).
--   content:create / content:update / content:delete → PLATFORM_ADMIN, TENANT_ADMIN, HRMS_MANAGER.
--   content:publish → PLATFORM_ADMIN, TENANT_ADMIN, HRMS_MANAGER (D-6: distinct from create/update,
--     publish-workflow endpoints land in P2 but the permission is seeded now).
-- me:content:read (ESS) is P2 — NOT seeded here.
-- NB PLATFORM_ADMIN is NOT auto-granted later permissions → listed explicitly.
-- Authored: 2026-06-07 (S975, cap④ CMS P1).
-- ============================================================================

INSERT INTO sys.sys_auth_permissions (auth_permission_code, auth_permission_name, auth_permission_resource, auth_permission_action)
VALUES
  ('content:read',    'Read content',          'content', 'read'),
  ('content:create',  'Create content',        'content', 'create'),
  ('content:update',  'Update content',        'content', 'update'),
  ('content:delete',  'Delete content',        'content', 'delete'),
  ('content:publish', 'Publish/unpublish content', 'content', 'publish')
ON CONFLICT (auth_permission_code) DO NOTHING;

-- content:read — 6 non-leaf HRMS-read roles
INSERT INTO sys.sys_auth_role_permissions (auth_role_id, auth_permission_id)
SELECT r.auth_role_id, p.auth_permission_id
FROM sys.sys_auth_roles r
CROSS JOIN sys.sys_auth_permissions p
WHERE p.auth_permission_code = 'content:read'
  AND r.auth_role_code IN ('PLATFORM_ADMIN','TENANT_ADMIN','BLUEPRINT_MANAGER','HRMS_MANAGER','PROCESS_OWNER','MANAGER')
ON CONFLICT (auth_role_id, auth_permission_id) DO NOTHING;

-- content:create / update / delete / publish — write-class (PLATFORM/TENANT_ADMIN/HRMS_MANAGER)
INSERT INTO sys.sys_auth_role_permissions (auth_role_id, auth_permission_id)
SELECT r.auth_role_id, p.auth_permission_id
FROM sys.sys_auth_roles r
CROSS JOIN sys.sys_auth_permissions p
WHERE p.auth_permission_code IN ('content:create','content:update','content:delete','content:publish')
  AND r.auth_role_code IN ('PLATFORM_ADMIN','TENANT_ADMIN','HRMS_MANAGER')
ON CONFLICT (auth_role_id, auth_permission_id) DO NOTHING;

DO $$ DECLARE v int; BEGIN
  SELECT count(*) INTO v FROM sys.sys_auth_permissions WHERE auth_permission_resource = 'content';
  RAISE NOTICE '000087: content permissions present: % (expect 5)', v;
  IF v <> 5 THEN RAISE EXCEPTION '000087: expected 5 content permissions, found %', v; END IF;
END $$;
