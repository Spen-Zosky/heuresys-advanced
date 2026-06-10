-- 000107_mfa_policy_ui_interface.sql
-- MVP-4 §2.5 mandatory-MFA: register the /admin/mfa-policy admin editor in the
-- DB-driven sidebar (sys.sys_ui_interfaces, U1/mig 000050). First per-tenant
-- config editor: PLATFORM_ADMIN sees every tenant, TENANT_ADMIN its own row.
--
-- Gate mirrors the API surface (mig 000104): perm-pair mfa_policy/read is
-- granted ONLY to PLATFORM_ADMIN + TENANT_ADMIN (deliberately not
-- HRMS_MANAGER) + requires_admin=true. Group 'governance' (security/authority
-- surface), order 51 (next free after content=50). Icon 'ShieldCheck' is an
-- existing layout ICON_MAP key.
--
-- IDEMPOTENT: INSERT ... ON CONFLICT (ui_interface_code) DO NOTHING.

INSERT INTO sys.sys_ui_interfaces
  (ui_interface_code, ui_interface_label, ui_interface_route, ui_interface_icon,
   ui_interface_sidebar_group, ui_interface_perspective,
   ui_interface_required_resource, ui_interface_required_action, ui_interface_requires_admin, ui_interface_order)
VALUES
  ('admin-mfa-policy', 'Policy MFA', '/admin/mfa-policy', 'ShieldCheck',
   'governance', 'ENTERPRISE', 'mfa_policy', 'read', true, 51)
ON CONFLICT (ui_interface_code) DO NOTHING;

DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM sys.sys_ui_interfaces WHERE ui_interface_code = 'admin-mfa-policy';
  IF n <> 1 THEN
    RAISE EXCEPTION 'mfa-policy UI: expected 1 interface row, got %', n;
  END IF;
  RAISE NOTICE 'mfa-policy UI: /admin/mfa-policy sidebar interface registered (governance, ENTERPRISE, admin gate mfa_policy:read).';
END $$;
