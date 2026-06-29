-- 000066_attendance_analytics_ui_interface.sql
-- BI analytics P2 (view 1/3 — Attendance): register the attendance analytics page in the
-- DB-driven sidebar registry (sys.sys_ui_interfaces, U1/mig 000050). Same admin BI cluster
-- ('intelligence' group, ENTERPRISE perspective) and the same `analytics:view` gate the route
-- enforces (GET /v1/analytics/attendance, permission seeded in 000057). Slots after
-- analytics-kpi(35) at order 36.
--
-- Gating mirrors the route's requirePermission('analytics:view'):
--   required_resource='analytics', required_action='view'  (perm-pair CHECK satisfied)
--   requires_admin=true                                    (replicates the layout ADMIN_ROLES gate)
-- Icon 'Activity' is a key already present in the layout ICON_MAP.
--
-- IDEMPOTENT: INSERT ... ON CONFLICT (ui_interface_code) DO NOTHING. Second run = no-op.

INSERT INTO sys.sys_ui_interfaces
  (ui_interface_code, ui_interface_label, ui_interface_route, ui_interface_icon,
   ui_interface_sidebar_group, ui_interface_perspective,
   ui_interface_required_resource, ui_interface_required_action, ui_interface_requires_admin, ui_interface_order)
VALUES
  ('analytics-attendance', 'Analisi presenze', '/analytics/attendance', 'Activity', 'intelligence', 'WORKFORCE', 'analytics', 'view', true, 36)
ON CONFLICT (ui_interface_code) DO NOTHING;

DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n
  FROM sys.sys_ui_interfaces
  WHERE ui_interface_code = 'analytics-attendance';
  IF n <> 1 THEN
    RAISE EXCEPTION 'P2: expected 1 attendance interface row, got %', n;
  END IF;
  RAISE NOTICE 'P2: attendance sidebar interface registered (intelligence group, ENTERPRISE).';
END $$;
