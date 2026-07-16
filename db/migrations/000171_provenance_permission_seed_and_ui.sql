-- ============================================================================
-- 000171_provenance_permission_seed_and_ui.sql — #28 (S1018) Trust Ledger.
-- Read-API over sys.sys_source_lineage_records (70k+ righe lineage, finora
-- write-only dal wave-executor): perm dedicata `provenance:read` ristretta a
-- PLATFORM_ADMIN + TENANT_ADMIN (metadata di provenienza record — nessun dato
-- personale, ma superficie da amministratori) + riga sidebar /provenance
-- (sezione Panoramica, accanto a Brownfield). Mirrors 000142 + 000143.
-- Idempotent (ON CONFLICT DO NOTHING). Authored: 2026-07-16.
-- ============================================================================

INSERT INTO sys.sys_auth_permissions (auth_permission_code, auth_permission_name, auth_permission_resource, auth_permission_action)
VALUES
  ('provenance:read', 'Read data provenance ledger', 'provenance', 'read')
ON CONFLICT (auth_permission_code) DO NOTHING;

INSERT INTO sys.sys_auth_role_permissions (auth_role_id, auth_permission_id)
SELECT r.auth_role_id, p.auth_permission_id
FROM sys.sys_auth_roles r
CROSS JOIN sys.sys_auth_permissions p
WHERE p.auth_permission_code = 'provenance:read'
  AND r.auth_role_code IN ('PLATFORM_ADMIN','TENANT_ADMIN')
ON CONFLICT (auth_role_id, auth_permission_id) DO NOTHING;

INSERT INTO sys.sys_ui_interfaces
  (ui_interface_code, ui_interface_label, ui_interface_route, ui_interface_icon,
   ui_interface_sidebar_group, ui_interface_perspective,
   ui_interface_required_resource, ui_interface_required_action, ui_interface_requires_admin, ui_interface_order)
VALUES
  ('provenance', 'Provenance ledger', '/provenance', 'ShieldCheck', 'overview', 'OVERVIEW', 'provenance', 'read', true, 8)
ON CONFLICT (ui_interface_code) DO NOTHING;

DO $$ DECLARE v int; n int; BEGIN
  SELECT count(*) INTO v FROM sys.sys_auth_role_permissions rp
    JOIN sys.sys_auth_permissions p ON p.auth_permission_id = rp.auth_permission_id
   WHERE p.auth_permission_code = 'provenance:read';
  -- Floor, not exact census (S1018 doctrine): later additive migrations may extend.
  IF v < 2 THEN RAISE EXCEPTION '000171: expected >=2 provenance:read grants, found %', v; END IF;
  SELECT count(*) INTO n FROM sys.sys_ui_interfaces WHERE ui_interface_code = 'provenance';
  IF n <> 1 THEN RAISE EXCEPTION '000171: expected 1 provenance interface row, found %', n; END IF;
  RAISE NOTICE '000171: provenance:read seeded (% grants) + /provenance sidebar row OK.', v;
END $$;
