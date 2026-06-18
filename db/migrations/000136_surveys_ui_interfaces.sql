-- ============================================================================
-- 000136_surveys_ui_interfaces.sql — sidebar nav for Surveys-M2 (2 rows).
-- ----------------------------------------------------------------------------
--   - 'engagement'  : admin Engagement & Surveys track (read-only over the
--       engagement read-model), gated surveys:read + requires_admin, TALENT/workforce.
--   - 'me-surveys'  : ESS "My surveys" self-response page, gated surveys:respond:self
--       (granted to all roles, mig 000135), TALENT/me, requires_admin=false.
-- Icons Activity / FileText already in the layout ICON_MAP. Mirrors 000134.
-- Idempotent (ON CONFLICT DO NOTHING). Authored: 2026-06-18 (Surveys-M2).
-- ============================================================================

INSERT INTO sys.sys_ui_interfaces
  (ui_interface_code, ui_interface_label, ui_interface_route, ui_interface_icon,
   ui_interface_sidebar_group, ui_interface_perspective,
   ui_interface_required_resource, ui_interface_required_action, ui_interface_requires_admin, ui_interface_order)
VALUES
  ('engagement', 'Engagement & Sondaggi', '/engagement', 'Activity', 'workforce', 'TALENT', 'surveys', 'read', true, 15),
  ('me-surveys', 'I miei sondaggi', '/me/surveys', 'FileText', 'me', 'TALENT', 'surveys', 'respond:self', false, 9)
ON CONFLICT (ui_interface_code) DO NOTHING;

DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM sys.sys_ui_interfaces WHERE ui_interface_code IN ('engagement', 'me-surveys');
  IF n <> 2 THEN
    RAISE EXCEPTION '000136: expected 2 surveys interface rows, found %', n;
  END IF;
  RAISE NOTICE '000136: surveys sidebar interfaces registered (engagement admin + me-surveys ESS).';
END $$;
