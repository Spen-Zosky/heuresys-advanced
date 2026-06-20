-- ============================================================================
-- 000144_okrs_ui_interface.sql — sidebar nav row for OKRs.
-- Registers the "OKRs" track in the DB-driven sidebar (U1 epic,
-- sys_ui_interfaces). Gated on okr:read; perspective ENTERPRISE; group
-- intelligence (alongside KPIs, Goals). Icon TrendingUp already in ICON_MAP.
-- Mirrors 000143. Idempotent (ON CONFLICT DO NOTHING).
-- Authored: 2026-06-20 (Task 12 — OKR web UI read-only list).
-- ============================================================================

INSERT INTO sys.sys_ui_interfaces
  (ui_interface_code, ui_interface_label, ui_interface_route, ui_interface_icon,
   ui_interface_sidebar_group, ui_interface_perspective,
   ui_interface_required_resource, ui_interface_required_action, ui_interface_requires_admin, ui_interface_order)
VALUES
  ('okrs', 'OKR', '/okrs', 'TrendingUp', 'intelligence', 'ENTERPRISE', 'okr', 'read', true, 53)
ON CONFLICT (ui_interface_code) DO NOTHING;

DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM sys.sys_ui_interfaces WHERE ui_interface_code = 'okrs';
  IF n <> 1 THEN
    RAISE EXCEPTION '000144: expected 1 okrs interface row, found %', n;
  END IF;
  RAISE NOTICE '000144: okrs sidebar interface registered (intelligence/ENTERPRISE, okr:read).';
END $$;
