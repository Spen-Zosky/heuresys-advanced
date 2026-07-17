-- ============================================================================
-- 000173_time_off_leave_permission_seed_and_ui.sql — A/L8 (#33) time-off/leave read.
-- Exposes three dormant leave tables (sys_time_off_requests / sys_leave_accrual_rules
-- / sys_leave_balance_transactions) via /v1/time-off/*. Leave = PERSONAL, org-gated:
--   `leave:read`      (org-gated admin/manager list) → the 6-role HRMS read audience
--   `leave:read:self` (ESS I17 floor, /v1/me/time-off) → the self-scope roles
-- + a /time-off sidebar row (Workforce). Mirrors 000172. Idempotent. Authored 2026-07-17.
-- ============================================================================

INSERT INTO sys.sys_auth_permissions (auth_permission_code, auth_permission_name, auth_permission_resource, auth_permission_action)
VALUES
  ('leave:read',      'Read time-off / leave',      'leave', 'read'),
  ('leave:read:self', 'Read own time-off (ESS)',    'leave', 'read')
ON CONFLICT (auth_permission_code) DO NOTHING;

-- read audience: 6 non-leaf roles (matches evidence/goal/okr read, 000142/000172)
INSERT INTO sys.sys_auth_role_permissions (auth_role_id, auth_permission_id)
SELECT r.auth_role_id, p.auth_permission_id
FROM sys.sys_auth_roles r
CROSS JOIN sys.sys_auth_permissions p
WHERE p.auth_permission_code = 'leave:read'
  AND r.auth_role_code IN ('PLATFORM_ADMIN','TENANT_ADMIN','BLUEPRINT_MANAGER','HRMS_MANAGER','PROCESS_OWNER','MANAGER')
ON CONFLICT (auth_role_id, auth_permission_id) DO NOTHING;

-- self audience: every employee holds USER (I17); include functional + read-only roles
INSERT INTO sys.sys_auth_role_permissions (auth_role_id, auth_permission_id)
SELECT r.auth_role_id, p.auth_permission_id
FROM sys.sys_auth_roles r
CROSS JOIN sys.sys_auth_permissions p
WHERE p.auth_permission_code = 'leave:read:self'
  AND r.auth_role_code IN ('USER','READ_ONLY','TEAM_MEMBER','TEAM_LEADER','MANAGER','HRMS_MANAGER','TENANT_ADMIN','PLATFORM_ADMIN')
ON CONFLICT (auth_role_id, auth_permission_id) DO NOTHING;

-- admin sidebar row (Workforce section, next to /analytics/attendance)
INSERT INTO sys.sys_ui_interfaces
  (ui_interface_code, ui_interface_label, ui_interface_route, ui_interface_icon,
   ui_interface_sidebar_group, ui_interface_perspective,
   ui_interface_required_resource, ui_interface_required_action, ui_interface_requires_admin, ui_interface_order)
VALUES
  ('time-off', 'Time-off & leave', '/time-off', 'CalendarDays', 'workforce', 'WORKFORCE', 'leave', 'read', true, 23)
ON CONFLICT (ui_interface_code) DO NOTHING;

DO $$ DECLARE v int; s int; n int; BEGIN
  SELECT count(*) INTO v FROM sys.sys_auth_role_permissions rp
    JOIN sys.sys_auth_permissions p ON p.auth_permission_id = rp.auth_permission_id
   WHERE p.auth_permission_code = 'leave:read';
  SELECT count(*) INTO s FROM sys.sys_auth_role_permissions rp
    JOIN sys.sys_auth_permissions p ON p.auth_permission_id = rp.auth_permission_id
   WHERE p.auth_permission_code = 'leave:read:self';
  SELECT count(*) INTO n FROM sys.sys_ui_interfaces WHERE ui_interface_code = 'time-off';
  -- Floor, not exact census (S1018 doctrine): later additive migrations may extend.
  IF v < 6 THEN RAISE EXCEPTION '000173: expected >=6 leave:read grants, found %', v; END IF;
  IF s < 1 THEN RAISE EXCEPTION '000173: expected >=1 leave:read:self grants, found %', s; END IF;
  IF n <> 1 THEN RAISE EXCEPTION '000173: expected 1 time-off interface row, found %', n; END IF;
  RAISE NOTICE '000173: leave:read (% grants) + leave:read:self (% grants) + /time-off sidebar OK.', v, s;
END $$;
