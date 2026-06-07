-- 000093_insights_p2_ui_interfaces.sql
-- cap③ data-mining · P2 frontend: register /insights/succession-readiness (slice B)
-- and /insights/skill-gap (slice C) in the DB-driven sidebar (sys.sys_ui_interfaces,
-- U1/mig 000050). Same surface as /insights (mig 000091): ENTERPRISE perspective,
-- 'intelligence' group, after insights(order 42) at orders 43/44.
--
-- Admin/manager-only (D-6 — these are sensitive analytics, no ESS): requires_admin=true
-- + perm-pair insights/view (mirrors the GET requirePermission('insights:view') on
-- /v1/insights/{succession-readiness,skill-gap}, granted to the 6 non-leaf roles by
-- mig 000083). Icons 'TrendingUp' / 'Gauge' are already keys in the layout ICON_MAP.
--
-- IDEMPOTENT: INSERT ... ON CONFLICT (ui_interface_code) DO NOTHING.

INSERT INTO sys.sys_ui_interfaces
  (ui_interface_code, ui_interface_label, ui_interface_route, ui_interface_icon,
   ui_interface_sidebar_group, ui_interface_perspective,
   ui_interface_required_resource, ui_interface_required_action, ui_interface_requires_admin, ui_interface_order)
VALUES
  ('insights-succession-readiness', 'Succession readiness', '/insights/succession-readiness', 'TrendingUp',
   'intelligence', 'ENTERPRISE', 'insights', 'view', true, 43),
  ('insights-skill-gap', 'Skill gap', '/insights/skill-gap', 'Gauge',
   'intelligence', 'ENTERPRISE', 'insights', 'view', true, 44)
ON CONFLICT (ui_interface_code) DO NOTHING;

DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM sys.sys_ui_interfaces
   WHERE ui_interface_code IN ('insights-succession-readiness', 'insights-skill-gap');
  IF n <> 2 THEN
    RAISE EXCEPTION 'cap③ insights P2: expected 2 P2 insights interface rows, got %', n;
  END IF;
  RAISE NOTICE 'cap③ insights P2: succession-readiness + skill-gap sidebar interfaces registered (ENTERPRISE, intelligence, admin gate insights:view).';
END $$;
