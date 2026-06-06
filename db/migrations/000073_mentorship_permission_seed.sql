-- ============================================================================
-- 000073_mentorship_permission_seed.sql — mentorship RBAC permissions + role maps.
-- Mirrors 000057_analytics_permission_seed.sql. Idempotent (ON CONFLICT DO NOTHING).
-- read  -> 6 HRMS-read roles; create/update/delete -> admin+HR write audience.
-- NB PLATFORM_ADMIN is NOT auto-granted later permissions (the 000005 grant was one-time)
--    -> it MUST be listed explicitly. RBAC cache reloads at server boot / first buildTestApp.
-- Authored: 2026-06-06 (S970).
-- ============================================================================

INSERT INTO sys.sys_auth_permissions (auth_permission_code, auth_permission_name, auth_permission_resource, auth_permission_action)
VALUES
  ('mentorship:read',   'Read mentorship',   'mentorship', 'read'),
  ('mentorship:create', 'Create mentorship', 'mentorship', 'create'),
  ('mentorship:update', 'Update mentorship', 'mentorship', 'update'),
  ('mentorship:delete', 'Delete mentorship', 'mentorship', 'delete')
ON CONFLICT (auth_permission_code) DO NOTHING;

-- mentorship:read — standard HRMS-read audience (6 non-leaf roles; excludes USER/READ_ONLY)
INSERT INTO sys.sys_auth_role_permissions (auth_role_id, auth_permission_id)
SELECT r.auth_role_id, p.auth_permission_id
FROM sys.sys_auth_roles r
CROSS JOIN sys.sys_auth_permissions p
WHERE p.auth_permission_code = 'mentorship:read'
  AND r.auth_role_code IN ('PLATFORM_ADMIN','TENANT_ADMIN','BLUEPRINT_MANAGER','HRMS_MANAGER','PROCESS_OWNER','MANAGER')
ON CONFLICT (auth_role_id, auth_permission_id) DO NOTHING;

-- mentorship:create/update/delete — write audience (admins + HR managers)
INSERT INTO sys.sys_auth_role_permissions (auth_role_id, auth_permission_id)
SELECT r.auth_role_id, p.auth_permission_id
FROM sys.sys_auth_roles r
CROSS JOIN sys.sys_auth_permissions p
WHERE p.auth_permission_code IN ('mentorship:create','mentorship:update','mentorship:delete')
  AND r.auth_role_code IN ('PLATFORM_ADMIN','TENANT_ADMIN','HRMS_MANAGER')
ON CONFLICT (auth_role_id, auth_permission_id) DO NOTHING;

DO $$ DECLARE v int; BEGIN
  SELECT count(*) INTO v FROM sys.sys_auth_permissions WHERE auth_permission_resource = 'mentorship';
  RAISE NOTICE '000073: mentorship permissions present: % (expect 4)', v;
  IF v <> 4 THEN RAISE EXCEPTION '000073: expected 4 mentorship permissions, found %', v; END IF;
END $$;
