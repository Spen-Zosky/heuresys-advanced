-- 000090_me_handbook_ui_interface.sql
-- cap④ CMS P2 · ESS knowledge base: register /me/handbook in the DB-driven sidebar
-- registry (sys.sys_ui_interfaces, U1/mig 000050). Same ESS cluster as the other
-- /me/* pages ('me' group, TALENT perspective), after me-matching(7) at order 8.
--
-- The route GET /v1/me/content enforces requirePermission('me:content:read'), granted
-- to every role by 000089, so any authenticated employee can reach the page. Like all
-- /me/* rows the sidebar entry is ALWAYS-VISIBLE: no permission pair
-- (required_resource/required_action both NULL) + requires_admin=false. The route, not
-- the nav registry, is the enforcement point.
-- Icon 'FileText' is already a key in the layout ICON_MAP.
--
-- IDEMPOTENT: INSERT ... ON CONFLICT (ui_interface_code) DO NOTHING.

INSERT INTO sys.sys_ui_interfaces
  (ui_interface_code, ui_interface_label, ui_interface_route, ui_interface_icon,
   ui_interface_sidebar_group, ui_interface_perspective,
   ui_interface_required_resource, ui_interface_required_action, ui_interface_requires_admin, ui_interface_order)
VALUES
  ('me-handbook', 'Manuale del dipendente', '/me/handbook', 'FileText', 'me', 'PERSONAL', NULL, NULL, false, 8)
ON CONFLICT (ui_interface_code) DO NOTHING;

DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM sys.sys_ui_interfaces WHERE ui_interface_code = 'me-handbook';
  IF n <> 1 THEN
    RAISE EXCEPTION 'cap④ CMS P2: expected 1 me-handbook interface row, got %', n;
  END IF;
  RAISE NOTICE 'cap④ CMS P2: me-handbook sidebar interface registered (me group, TALENT, always-visible).';
END $$;
