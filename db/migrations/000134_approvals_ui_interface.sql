-- ============================================================================
-- 000134_approvals_ui_interface.sql — sidebar nav row for the approval runtime.
-- Registers the admin "Approvals" track in the DB-driven sidebar (U1 epic,
-- sys_ui_interfaces). Gated on approval:read (+ requires_admin) so only the
-- approval-read audience sees it; perspective PROCESS / group operations (the
-- BPM cluster, alongside blueprints/processes). Icon ShieldCheck already exists
-- in the layout ICON_MAP. Mirrors 000125. Idempotent (ON CONFLICT DO NOTHING).
-- Authored: 2026-06-18 (3.3 slice-D BPM approval runtime — frontend).
-- ============================================================================

INSERT INTO sys.sys_ui_interfaces
  (ui_interface_code, ui_interface_label, ui_interface_route, ui_interface_icon,
   ui_interface_sidebar_group, ui_interface_perspective,
   ui_interface_required_resource, ui_interface_required_action, ui_interface_requires_admin, ui_interface_order)
VALUES
  ('approvals', 'Approvazioni', '/approvals', 'ShieldCheck', 'operations', 'PROCESS', 'approval', 'read', true, 24)
ON CONFLICT (ui_interface_code) DO NOTHING;

DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM sys.sys_ui_interfaces WHERE ui_interface_code = 'approvals';
  IF n <> 1 THEN
    RAISE EXCEPTION '000134: expected 1 approvals interface row, found %', n;
  END IF;
  RAISE NOTICE '000134: approvals sidebar interface registered (operations/PROCESS, approval:read).';
END $$;
