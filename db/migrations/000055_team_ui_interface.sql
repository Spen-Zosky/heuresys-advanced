-- 000055_team_ui_interface.sql
-- WS-4 R1b: register the "Il mio team" ESS page (/me/team) in the DB-driven sidebar registry
-- (sys.sys_ui_interfaces, U1/mig 000050). TALENT perspective, "me" group, always visible to an
-- authenticated user (NULL permission pair + requires_admin=false — like the other ESS /me items;
-- the team:read:self gate is enforced on the route, and the page renders an honest empty-state
-- when the caller has no team).
--
-- IDEMPOTENT: INSERT ... ON CONFLICT (code) DO NOTHING. Second run = no-op.

INSERT INTO sys.sys_ui_interfaces
  (ui_interface_code, ui_interface_label, ui_interface_route, ui_interface_icon,
   ui_interface_sidebar_group, ui_interface_perspective,
   ui_interface_required_resource, ui_interface_required_action, ui_interface_requires_admin, ui_interface_order)
VALUES
  ('me-team', 'Il mio team', '/me/team', 'Users', 'me', 'TALENT', NULL, NULL, false, 6)
ON CONFLICT (ui_interface_code) DO NOTHING;

DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM sys.sys_ui_interfaces WHERE ui_interface_code = 'me-team';
  IF n <> 1 THEN
    RAISE EXCEPTION 'R1b: expected 1 me-team interface row, got %', n;
  END IF;
  RAISE NOTICE 'R1b: me-team sidebar interface registered (%).', n;
END $$;
