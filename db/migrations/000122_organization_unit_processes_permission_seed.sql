-- ============================================================================
-- 000122_organization_unit_processes_permission_seed.sql — organization_unit_processes RBAC perms + role maps.
-- Mirrors 000114_engagement_feedback_permission_seed.sql verbatim. Idempotent (ON CONFLICT DO NOTHING).
-- Resource is the single-token snake_case `organization_unit_processes` (matching auth_permission_resource
-- style; the module URL prefix /v1/organization-unit-processes is hyphenated, the permission resource +
-- code are snake_case — cf. reference_sync:read for module /v1/reference-sync). The module ships
-- read/create/delete only (no update endpoint), so 3 permissions.
-- read  -> 6 HRMS-read roles; create/delete -> admin + HR write audience.
-- NB PLATFORM_ADMIN is NOT auto-granted later permissions (the 000005 grant was one-time)
--    -> it MUST be listed explicitly. RBAC cache reloads at server boot / first buildTestApp.
-- Authored: 2026-06-15 (T2.5, ESCO/tenant-onboarding workstream).
-- ============================================================================

INSERT INTO sys.sys_auth_permissions (auth_permission_code, auth_permission_name, auth_permission_resource, auth_permission_action)
VALUES
  ('organization_unit_processes:read',   'Read org-unit process assignments',   'organization_unit_processes', 'read'),
  ('organization_unit_processes:create', 'Create org-unit process assignment',  'organization_unit_processes', 'create'),
  ('organization_unit_processes:delete', 'Delete org-unit process assignment',  'organization_unit_processes', 'delete')
ON CONFLICT (auth_permission_code) DO NOTHING;

-- organization_unit_processes:read — standard HRMS-read audience (6 non-leaf roles; excludes USER/READ_ONLY)
INSERT INTO sys.sys_auth_role_permissions (auth_role_id, auth_permission_id)
SELECT r.auth_role_id, p.auth_permission_id
FROM sys.sys_auth_roles r
CROSS JOIN sys.sys_auth_permissions p
WHERE p.auth_permission_code = 'organization_unit_processes:read'
  AND r.auth_role_code IN ('PLATFORM_ADMIN','TENANT_ADMIN','BLUEPRINT_MANAGER','HRMS_MANAGER','PROCESS_OWNER','MANAGER')
ON CONFLICT (auth_role_id, auth_permission_id) DO NOTHING;

-- organization_unit_processes:create/delete — write audience (admins + HR managers)
INSERT INTO sys.sys_auth_role_permissions (auth_role_id, auth_permission_id)
SELECT r.auth_role_id, p.auth_permission_id
FROM sys.sys_auth_roles r
CROSS JOIN sys.sys_auth_permissions p
WHERE p.auth_permission_code IN ('organization_unit_processes:create','organization_unit_processes:delete')
  AND r.auth_role_code IN ('PLATFORM_ADMIN','TENANT_ADMIN','HRMS_MANAGER')
ON CONFLICT (auth_role_id, auth_permission_id) DO NOTHING;

DO $$ DECLARE v int; BEGIN
  SELECT count(*) INTO v FROM sys.sys_auth_permissions WHERE auth_permission_resource = 'organization_unit_processes';
  RAISE NOTICE '000122: organization_unit_processes permissions present: % (expect 3)', v;
  IF v <> 3 THEN RAISE EXCEPTION '000122: expected 3 organization_unit_processes permissions, found %', v; END IF;
END $$;
