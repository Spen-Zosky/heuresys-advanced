-- ============================================================================
-- Migration 000127 — 3.4 Notification center: SYSTEM broadcast permission
-- ----------------------------------------------------------------------------
-- Seeds notification:create (the admin-only permission gating POST /v1/notifications,
-- which emits SYSTEM notifications to a target user list) + maps it to the two
-- admin roles. Mirrors the seeding pattern of 000122. Idempotent (ON CONFLICT).
-- Authored: 2026-06-16.
-- ============================================================================

INSERT INTO sys.sys_auth_permissions (auth_permission_code, auth_permission_name, auth_permission_resource, auth_permission_action)
VALUES ('notification:create', 'Broadcast a SYSTEM notification', 'notification', 'create')
ON CONFLICT (auth_permission_code) DO NOTHING;

-- Admin audience: PLATFORM_ADMIN (cross-tenant) + TENANT_ADMIN (own tenant).
INSERT INTO sys.sys_auth_role_permissions (auth_role_id, auth_permission_id)
SELECT r.auth_role_id, p.auth_permission_id
FROM sys.sys_auth_roles r
CROSS JOIN sys.sys_auth_permissions p
WHERE p.auth_permission_code = 'notification:create'
  AND r.auth_role_code IN ('PLATFORM_ADMIN', 'TENANT_ADMIN')
ON CONFLICT DO NOTHING;
