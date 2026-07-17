-- ============================================================================
-- 000174_talent_review_permission_seed_and_ui.sql — A/L3 (#29) talent-review read.
-- Exposes six dormant talent-intelligence tables (sys_talent_scores /
-- sys_employee_position_fit_scores / sys_readiness_scores / sys_succession_scores /
-- sys_critical_positions / sys_critical_role_coverage_status) via /v1/talent-review/*.
-- Talent = EVALUATION, org-gated for the person-level reads:
--   `talent:read` (org-gated admin/manager list) → the 6-role management audience.
-- NO `:self` — talent is a management surface (self-view OFF by product decision).
-- + a /talent-review sidebar row (Workforce). Mirrors 000173. Idempotent. Authored 2026-07-17.
-- ============================================================================

INSERT INTO sys.sys_auth_permissions (auth_permission_code, auth_permission_name, auth_permission_resource, auth_permission_action)
VALUES
  ('talent:read', 'Read talent review (9-box)', 'talent', 'read')
ON CONFLICT (auth_permission_code) DO NOTHING;

-- read audience: 6 non-leaf management roles (matches evidence/goal/okr/leave read)
INSERT INTO sys.sys_auth_role_permissions (auth_role_id, auth_permission_id)
SELECT r.auth_role_id, p.auth_permission_id
FROM sys.sys_auth_roles r
CROSS JOIN sys.sys_auth_permissions p
WHERE p.auth_permission_code = 'talent:read'
  AND r.auth_role_code IN ('PLATFORM_ADMIN','TENANT_ADMIN','BLUEPRINT_MANAGER','HRMS_MANAGER','PROCESS_OWNER','MANAGER')
ON CONFLICT (auth_role_id, auth_permission_id) DO NOTHING;

-- admin sidebar row (Workforce section, next to /time-off)
INSERT INTO sys.sys_ui_interfaces
  (ui_interface_code, ui_interface_label, ui_interface_route, ui_interface_icon,
   ui_interface_sidebar_group, ui_interface_perspective,
   ui_interface_required_resource, ui_interface_required_action, ui_interface_requires_admin, ui_interface_order)
VALUES
  ('talent-review', 'Talent review', '/talent-review', 'Grid3x3', 'workforce', 'WORKFORCE', 'talent', 'read', true, 24)
ON CONFLICT (ui_interface_code) DO NOTHING;

DO $$ DECLARE v int; n int; BEGIN
  SELECT count(*) INTO v FROM sys.sys_auth_role_permissions rp
    JOIN sys.sys_auth_permissions p ON p.auth_permission_id = rp.auth_permission_id
   WHERE p.auth_permission_code = 'talent:read';
  SELECT count(*) INTO n FROM sys.sys_ui_interfaces WHERE ui_interface_code = 'talent-review';
  -- Floor, not exact census (S1018 doctrine): later additive migrations may extend.
  IF v < 6 THEN RAISE EXCEPTION '000174: expected >=6 talent:read grants, found %', v; END IF;
  IF n <> 1 THEN RAISE EXCEPTION '000174: expected 1 talent-review interface row, found %', n; END IF;
  RAISE NOTICE '000174: talent:read (% grants) + /talent-review sidebar OK.', v;
END $$;
