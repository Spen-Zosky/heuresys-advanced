-- 000071_overtime_analytics_ui_interface.sql
-- BI analytics P2 extension (overtime requests): register the overtime analytics page in the
-- DB-driven sidebar registry (sys.sys_ui_interfaces, U1/mig 000050). Same admin BI cluster
-- ('intelligence' group, ENTERPRISE perspective) and the same `analytics:view` gate the route
-- enforces (GET /v1/analytics/overtime, permission seeded in 000057). Slots after
-- analytics-org-network(39) at order 40.
--
-- Distinct from analytics-attendance (worked overtime HOURS): this surfaces the overtime
-- REQUEST/approval lifecycle over sys_overtime (status/type/month/OU). The two are disjoint.
--
-- Gating mirrors the route's requirePermission('analytics:view'):
--   required_resource='analytics', required_action='view'  (perm-pair CHECK satisfied)
--   requires_admin=true                                    (replicates the layout ADMIN_ROLES gate)
-- Icon 'Clock' is a key present in the layout ICON_MAP (added alongside this migration).
--
-- IDEMPOTENT: INSERT ... ON CONFLICT (ui_interface_code) DO NOTHING. Second run = no-op.

INSERT INTO sys.sys_ui_interfaces
  (ui_interface_code, ui_interface_label, ui_interface_route, ui_interface_icon,
   ui_interface_sidebar_group, ui_interface_perspective,
   ui_interface_required_resource, ui_interface_required_action, ui_interface_requires_admin, ui_interface_order)
VALUES
  ('analytics-overtime', 'Richieste di straordinario', '/analytics/overtime', 'Clock', 'intelligence', 'ENTERPRISE', 'analytics', 'view', true, 40)
ON CONFLICT (ui_interface_code) DO NOTHING;

DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n
  FROM sys.sys_ui_interfaces
  WHERE ui_interface_code = 'analytics-overtime';
  IF n <> 1 THEN
    RAISE EXCEPTION 'P2-ext: expected 1 overtime interface row, got %', n;
  END IF;
  RAISE NOTICE 'P2-ext: overtime sidebar interface registered (intelligence group, ENTERPRISE).';
END $$;
