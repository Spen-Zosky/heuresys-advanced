-- ============================================================================
-- 000149_process_owner_ui_interface.sql — sidebar nav for the Process-Owner console.
-- Gap#1 Porta 1. DB-driven sidebar (sys_ui_interfaces, U1 epic). Gated on
-- process_owner:read; perspective PROCESS; group operations. Icon GitBranch already
-- in the layout ICON_MAP. requires_admin = true → hybrid gate (UI_ADMIN_ROLES incl.
-- PROCESS_OWNER) + the per-item permission. Mirrors 000143. Idempotent.
-- Authored: 2026-06-20 (Gap#1 Step 2).
-- ============================================================================

INSERT INTO sys.sys_ui_interfaces
  (ui_interface_code, ui_interface_label, ui_interface_route, ui_interface_icon,
   ui_interface_sidebar_group, ui_interface_perspective,
   ui_interface_required_resource, ui_interface_required_action, ui_interface_requires_admin, ui_interface_order)
VALUES
  ('process-owner-console', 'Console Process Owner', '/process-owner', 'GitBranch', 'operations', 'OVERVIEW', 'process_owner', 'read', true, 25)
ON CONFLICT (ui_interface_code) DO NOTHING;

DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM sys.sys_ui_interfaces WHERE ui_interface_code = 'process-owner-console';
  IF n <> 1 THEN RAISE EXCEPTION '000149: expected 1 process-owner-console interface, found %', n; END IF;
  RAISE NOTICE '000149: process-owner-console sidebar interface registered (operations/PROCESS, process_owner:read).';
END $$;
