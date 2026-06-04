-- 000068_skills_analytics_ui_interface.sql
-- BI analytics P2 (view 3/3 — Skills coverage): register the skills coverage analytics page in
-- the DB-driven sidebar registry (sys.sys_ui_interfaces, U1/mig 000050). Same admin BI cluster
-- ('intelligence' group, ENTERPRISE perspective) and the same `analytics:view` gate the route
-- enforces (GET /v1/analytics/skills, permission seeded in 000057). Slots after
-- analytics-compensation(37) at order 38.
--
-- Gating mirrors the route's requirePermission('analytics:view'):
--   required_resource='analytics', required_action='view'  (perm-pair CHECK satisfied)
--   requires_admin=true                                    (replicates the layout ADMIN_ROLES gate)
-- Icon 'GraduationCap' is a key already present in the layout ICON_MAP.
--
-- IDEMPOTENT: INSERT ... ON CONFLICT (ui_interface_code) DO NOTHING. Second run = no-op.

INSERT INTO sys.sys_ui_interfaces
  (ui_interface_code, ui_interface_label, ui_interface_route, ui_interface_icon,
   ui_interface_sidebar_group, ui_interface_perspective,
   ui_interface_required_resource, ui_interface_required_action, ui_interface_requires_admin, ui_interface_order)
VALUES
  ('analytics-skills', 'Copertura competenze', '/analytics/skills', 'GraduationCap', 'intelligence', 'ENTERPRISE', 'analytics', 'view', true, 38)
ON CONFLICT (ui_interface_code) DO NOTHING;

DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n
  FROM sys.sys_ui_interfaces
  WHERE ui_interface_code = 'analytics-skills';
  IF n <> 1 THEN
    RAISE EXCEPTION 'P2: expected 1 skills interface row, got %', n;
  END IF;
  RAISE NOTICE 'P2: skills-coverage sidebar interface registered (intelligence group, ENTERPRISE).';
END $$;
