-- =============================================================================
-- 000028_dashboard_permission_seed.sql
-- Heuresys Advanced — dashboard:view permission + role mappings (MVP-2a 1.5.2).
-- -----------------------------------------------------------------------------
-- Adds a single admin permission `dashboard:view` used by GET /v1/dashboard/widgets
-- and maps it to all roles that have access to the admin landing dashboard.
--
-- Idempotent: INSERT ... ON CONFLICT DO NOTHING for both tables.
-- =============================================================================

INSERT INTO sys.sys_auth_permissions (auth_permission_code, auth_permission_name, auth_permission_resource, auth_permission_action)
VALUES ('dashboard:view', 'View admin dashboard widgets', 'dashboard', 'view')
ON CONFLICT (auth_permission_code) DO NOTHING;

INSERT INTO sys.sys_auth_role_permissions (auth_role_id, auth_permission_id)
SELECT r.auth_role_id, p.auth_permission_id
FROM sys.sys_auth_roles r
CROSS JOIN sys.sys_auth_permissions p
WHERE p.auth_permission_code = 'dashboard:view'
  AND r.auth_role_code IN (
    'PLATFORM_ADMIN',
    'TENANT_ADMIN',
    'BLUEPRINT_MANAGER',
    'HRMS_MANAGER',
    'PROCESS_OWNER',
    'MANAGER'
  )
ON CONFLICT (auth_role_id, auth_permission_id) DO NOTHING;
