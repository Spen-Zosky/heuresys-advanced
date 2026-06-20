-- ============================================================================
-- 000143_goals_ui_interface.sql — sidebar nav row for Goals/OKR.
-- Registers the "Goals" track in the DB-driven sidebar (U1 epic,
-- sys_ui_interfaces). Gated on goal:read; perspective ENTERPRISE; group
-- intelligence (alongside KPIs, Insights). Icon TrendingUp already exists in
-- the layout ICON_MAP. Mirrors 000134. Idempotent (ON CONFLICT DO NOTHING).
-- Authored: 2026-06-20 (Task 6 — Goals web UI read-only list).
-- ============================================================================

INSERT INTO sys.sys_ui_interfaces
  (ui_interface_code, ui_interface_label, ui_interface_route, ui_interface_icon,
   ui_interface_sidebar_group, ui_interface_perspective,
   ui_interface_required_resource, ui_interface_required_action, ui_interface_requires_admin, ui_interface_order)
VALUES
  ('goals', 'Obiettivi', '/goals', 'TrendingUp', 'intelligence', 'ENTERPRISE', 'goal', 'read', true, 52)
ON CONFLICT (ui_interface_code) DO NOTHING;

DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM sys.sys_ui_interfaces WHERE ui_interface_code = 'goals';
  IF n <> 1 THEN
    RAISE EXCEPTION '000143: expected 1 goals interface row, found %', n;
  END IF;
  RAISE NOTICE '000143: goals sidebar interface registered (intelligence/ENTERPRISE, goal:read).';
END $$;
