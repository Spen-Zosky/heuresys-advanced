-- ============================================================================
-- 000148_org_director_ui_interface.sql — sidebar nav for the Org-Director console.
-- Gap#1 Porta 2. DB-driven sidebar (sys_ui_interfaces, U1 epic). Gated on
-- org_director:read; perspective ENTERPRISE; group intelligence (alongside Goals/
-- KPIs/Insights). Icon Network already in the layout ICON_MAP. requires_admin =
-- true → the hybrid gate (UI_ADMIN_ROLES incl. ORG_DIRECTOR, mig 000145) + the
-- per-item permission. Mirrors 000143. Idempotent (ON CONFLICT DO NOTHING).
-- Authored: 2026-06-20 (Gap#1 Step 5).
-- ============================================================================

INSERT INTO sys.sys_ui_interfaces
  (ui_interface_code, ui_interface_label, ui_interface_route, ui_interface_icon,
   ui_interface_sidebar_group, ui_interface_perspective,
   ui_interface_required_resource, ui_interface_required_action, ui_interface_requires_admin, ui_interface_order)
VALUES
  ('org-director-console', 'Console Org Director', '/org-director', 'Network', 'intelligence', 'OVERVIEW', 'org_director', 'read', true, 34)
ON CONFLICT (ui_interface_code) DO NOTHING;

DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM sys.sys_ui_interfaces WHERE ui_interface_code = 'org-director-console';
  IF n <> 1 THEN RAISE EXCEPTION '000148: expected 1 org-director-console interface, found %', n; END IF;
  RAISE NOTICE '000148: org-director-console sidebar interface registered (intelligence/ENTERPRISE, org_director:read).';
END $$;
