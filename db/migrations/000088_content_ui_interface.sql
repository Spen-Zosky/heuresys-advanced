-- 000088_content_ui_interface.sql
-- cap④ CMS · P1 frontend: register the /content admin authoring page in the
-- DB-driven sidebar registry (sys.sys_ui_interfaces, U1/mig 000050).
--
-- ENTERPRISE perspective, NEW 'content' sidebar group (label via i18n
-- shell:nav.groups.content), slotted after governance (orders 40-43) at order 50.
-- This is an ADMIN authoring surface, so unlike the always-visible /me/* rows it
-- carries the hybrid admin gate:
--   requires_admin=true                       (admin/manager-only page)
--   required_resource='content'/required_action='read'
--     → mirrors the GET /v1/content requirePermission('content:read') gate, which
--       is granted to the 6 non-leaf roles (PLATFORM_ADMIN, TENANT_ADMIN,
--       BLUEPRINT_MANAGER, HRMS_MANAGER, PROCESS_OWNER, MANAGER) by mig 000087.
-- Icon 'FileText' is already a key in the layout ICON_MAP (apps/web .../layout.tsx).
--
-- IDEMPOTENT: INSERT ... ON CONFLICT (ui_interface_code) DO NOTHING. Second run = no-op.

INSERT INTO sys.sys_ui_interfaces
  (ui_interface_code, ui_interface_label, ui_interface_route, ui_interface_icon,
   ui_interface_sidebar_group, ui_interface_perspective,
   ui_interface_required_resource, ui_interface_required_action, ui_interface_requires_admin, ui_interface_order)
VALUES
  ('content', 'Contenuti', '/content', 'FileText', 'content', 'ENTERPRISE', 'content', 'read', true, 50)
ON CONFLICT (ui_interface_code) DO NOTHING;

DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n
  FROM sys.sys_ui_interfaces
  WHERE ui_interface_code = 'content';
  IF n <> 1 THEN
    RAISE EXCEPTION 'cap④ CMS: expected 1 content interface row, got %', n;
  END IF;
  RAISE NOTICE 'cap④ CMS: content sidebar interface registered (ENTERPRISE, content group, admin gate content:read).';
END $$;
