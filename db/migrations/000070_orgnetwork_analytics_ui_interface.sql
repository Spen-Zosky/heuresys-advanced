-- 000070_orgnetwork_analytics_ui_interface.sql
-- BI analytics P3 (org-network metrics): register the org-network analytics page in
-- the DB-driven sidebar registry (sys.sys_ui_interfaces, U1/mig 000050). Same admin BI
-- cluster ('intelligence' group, ENTERPRISE perspective) and the same `analytics:view`
-- gate the route enforces (GET /v1/analytics/org-network, permission seeded in 000057).
-- Slots after analytics-skills(38) at order 39.
--
-- Gating mirrors the route's requirePermission('analytics:view'):
--   required_resource='analytics', required_action='view'  (perm-pair CHECK satisfied)
--   requires_admin=true                                    (replicates the layout ADMIN_ROLES gate)
-- Icon 'Network' is a key already present in the layout ICON_MAP.
--
-- IDEMPOTENT: INSERT ... ON CONFLICT (ui_interface_code) DO NOTHING. Second run = no-op.

INSERT INTO sys.sys_ui_interfaces
  (ui_interface_code, ui_interface_label, ui_interface_route, ui_interface_icon,
   ui_interface_sidebar_group, ui_interface_perspective,
   ui_interface_required_resource, ui_interface_required_action, ui_interface_requires_admin, ui_interface_order)
VALUES
  ('analytics-org-network', 'Rete organizzativa', '/analytics/org-network', 'Network', 'intelligence', 'ENTERPRISE', 'analytics', 'view', true, 39)
ON CONFLICT (ui_interface_code) DO NOTHING;

DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n
  FROM sys.sys_ui_interfaces
  WHERE ui_interface_code = 'analytics-org-network';
  IF n <> 1 THEN
    RAISE EXCEPTION 'P3: expected 1 org-network interface row, got %', n;
  END IF;
  RAISE NOTICE 'P3: org-network sidebar interface registered (intelligence group, ENTERPRISE).';
END $$;
