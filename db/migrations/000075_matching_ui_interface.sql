-- 000075_matching_ui_interface.sql
-- AI ②·P1b (semantic matching, ESS self-service): register the /me/matching page in the
-- DB-driven sidebar registry (sys.sys_ui_interfaces, U1/mig 000050). Same ESS cluster as the
-- other /me/* pages ('me' group, TALENT perspective). Slots after me-team(6) at order 7.
--
-- The route GET /v1/matching/me/occupations enforces requirePermission('matching:read'), which
-- IS granted to the USER role, so every authenticated ESS employee can reach the page. Like all
-- the other me-* rows the sidebar entry itself is ALWAYS-VISIBLE: it carries NO permission pair
-- (required_resource/required_action both NULL) and requires_admin=false. The route, not the nav
-- registry, is the enforcement point (consistent with me-home..me-team).
--   required_resource=NULL, required_action=NULL  (perm-pair CHECK: both NULL satisfies it)
--   requires_admin=false                          (ESS self-service, not an admin BI page)
-- Icon 'Network' is a key already present in the layout ICON_MAP (apps/web .../layout.tsx).
--
-- IDEMPOTENT: INSERT ... ON CONFLICT (ui_interface_code) DO NOTHING. Second run = no-op.

INSERT INTO sys.sys_ui_interfaces
  (ui_interface_code, ui_interface_label, ui_interface_route, ui_interface_icon,
   ui_interface_sidebar_group, ui_interface_perspective,
   ui_interface_required_resource, ui_interface_required_action, ui_interface_requires_admin, ui_interface_order)
VALUES
  ('me-matching', 'Occupazioni compatibili', '/me/matching', 'Network', 'me', 'PERSONAL', NULL, NULL, false, 7)
ON CONFLICT (ui_interface_code) DO NOTHING;

DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n
  FROM sys.sys_ui_interfaces
  WHERE ui_interface_code = 'me-matching';
  IF n <> 1 THEN
    RAISE EXCEPTION '②·P1b: expected 1 me-matching interface row, got %', n;
  END IF;
  RAISE NOTICE '②·P1b: me-matching sidebar interface registered (me group, TALENT, always-visible).';
END $$;
