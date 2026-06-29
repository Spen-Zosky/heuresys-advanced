-- ============================================================================
-- 000168_me_f5_personal_area.sql
-- S1011 F5 — complete the Personal area /me: 3 new ESS pages reach the DB-driven
-- sidebar (PERSONAL section) + the approval:read:self permission for the
-- track-only /me/approvals view.
--
--   /me/analytics  — personal analytics (own attendance trend + KPIs)
--   /me/org-chart  — personal org-chart (own position highlighted)
--   /me/approvals  — own approval requests (track-only)
--
-- The sidebar nav is DB-driven (GET /v1/me/interfaces -> sys_ui_interfaces); a new
-- /me page is unreachable from the sidebar without a registry row. These are ESS
-- pages → NULL permission pair + requires_admin=false (always visible to an
-- authenticated user), like the other /me rows seeded in 000050. perspective =
-- PERSONAL (this runs AFTER 000163's remap, so the value persists; passes the
-- 5-section CHECK from D-46/S1011).
--
-- IDEMPOTENT: NOT EXISTS guards (perm/grant) + ON CONFLICT (code) DO NOTHING (nav).
-- ============================================================================

-- 1. approval:read:self ESS permission (only approval CRUD perms exist today).
INSERT INTO sys.sys_auth_permissions
  (auth_permission_code, auth_permission_name, auth_permission_resource, auth_permission_action)
SELECT 'approval:read:self', 'Read own approval requests (ESS)', 'approval', 'read:self'
WHERE NOT EXISTS (
  SELECT 1 FROM sys.sys_auth_permissions WHERE auth_permission_code = 'approval:read:self'
);

-- 2. Grant to the ESS self-service roles (mirror career_succession:read:self / goal:read:self).
INSERT INTO sys.sys_auth_role_permissions (auth_role_id, auth_permission_id)
SELECT r.auth_role_id, p.auth_permission_id
  FROM sys.sys_auth_roles r
  CROSS JOIN sys.sys_auth_permissions p
 WHERE p.auth_permission_code = 'approval:read:self'
   AND r.auth_role_code IN ('PLATFORM_ADMIN', 'TENANT_ADMIN', 'READ_ONLY', 'USER')
   AND NOT EXISTS (
     SELECT 1 FROM sys.sys_auth_role_permissions rp
      WHERE rp.auth_role_id = r.auth_role_id AND rp.auth_permission_id = p.auth_permission_id
   );

-- 3. Sidebar registry rows for the 3 new ESS pages (PERSONAL section, ESS-visible).
INSERT INTO sys.sys_ui_interfaces
  (ui_interface_code, ui_interface_label, ui_interface_route, ui_interface_icon,
   ui_interface_sidebar_group, ui_interface_perspective,
   ui_interface_required_resource, ui_interface_required_action, ui_interface_requires_admin, ui_interface_order)
VALUES
  ('me-analytics', 'Le mie analisi',  '/me/analytics', 'Activity',    'personal', 'PERSONAL', NULL, NULL, false, 49),
  ('me-org-chart', 'Organigramma',    '/me/org-chart', 'Network',     'personal', 'PERSONAL', NULL, NULL, false, 50),
  ('me-approvals', 'Approvazioni',    '/me/approvals', 'ShieldCheck', 'personal', 'PERSONAL', NULL, NULL, false, 51)
ON CONFLICT (ui_interface_code) DO NOTHING;

-- Verification (NOTICE only).
DO $$
DECLARE g int; n int;
BEGIN
  SELECT count(*) INTO g FROM sys.sys_auth_role_permissions rp
    JOIN sys.sys_auth_permissions p ON p.auth_permission_id = rp.auth_permission_id
   WHERE p.auth_permission_code = 'approval:read:self';
  SELECT count(*) INTO n FROM sys.sys_ui_interfaces WHERE ui_interface_code IN ('me-analytics','me-org-chart','me-approvals');
  RAISE NOTICE 'F5: approval:read:self granted to % roles (expect 4); % new PERSONAL nav rows (expect 3)', g, n;
END $$;
