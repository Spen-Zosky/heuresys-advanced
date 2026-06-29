-- 000091_insights_ui_interface.sql
-- cap③ data-mining · P1b frontend: register /insights (flight-risk) in the DB-driven
-- sidebar registry (sys.sys_ui_interfaces, U1/mig 000050). BI/intelligence surface →
-- ENTERPRISE perspective, 'intelligence' group (with analytics/*), after
-- analytics-skills-by-category(41) at order 42.
--
-- Admin/manager-only (D-6 — flight-risk is sensitive, no ESS): requires_admin=true +
-- perm-pair insights/view (mirrors GET /v1/insights/flight-risk requirePermission
-- ('insights:view'), granted to the 6 non-leaf roles by mig 000083). Icon 'TriangleAlert'
-- is already a key in the layout ICON_MAP.
--
-- IDEMPOTENT: INSERT ... ON CONFLICT (ui_interface_code) DO NOTHING.

INSERT INTO sys.sys_ui_interfaces
  (ui_interface_code, ui_interface_label, ui_interface_route, ui_interface_icon,
   ui_interface_sidebar_group, ui_interface_perspective,
   ui_interface_required_resource, ui_interface_required_action, ui_interface_requires_admin, ui_interface_order)
VALUES
  ('insights', 'Insights (flight-risk)', '/insights', 'TriangleAlert', 'intelligence', 'INTELLIGENCE', 'insights', 'view', true, 42)
ON CONFLICT (ui_interface_code) DO NOTHING;

DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM sys.sys_ui_interfaces WHERE ui_interface_code = 'insights';
  IF n <> 1 THEN
    RAISE EXCEPTION 'cap③ insights: expected 1 insights interface row, got %', n;
  END IF;
  RAISE NOTICE 'cap③ insights: insights sidebar interface registered (ENTERPRISE, intelligence, admin gate insights:view).';
END $$;
