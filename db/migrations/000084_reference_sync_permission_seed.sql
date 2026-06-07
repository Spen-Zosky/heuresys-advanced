-- ============================================================================
-- 000084_reference_sync_permission_seed.sql — cap⑤ reference-sync RBAC permissions.
-- Mirrors 000080_predictionsml_permission_seed.sql. Idempotent (ON CONFLICT DO NOTHING).
-- Reference taxonomies (ESCO/ISTAT/…) are GLOBAL platform infra (scraping spec §3.5/§4)
-- -> PLATFORM_ADMIN only (no tenant ESS surface):
--   reference_sync:read    — list official sources + sync runs.
--   reference_sync:trigger — POST a sync run (refresh the reference data; CSRF-guarded).
-- NB PLATFORM_ADMIN is NOT auto-granted later permissions -> listed explicitly.
--    RBAC cache reloads at server boot / first buildTestApp.
-- Authored: 2026-06-07 (cap⑤ P1 ESCO reference-sync).
-- ============================================================================

INSERT INTO sys.sys_auth_permissions (auth_permission_code, auth_permission_name, auth_permission_resource, auth_permission_action)
VALUES
  ('reference_sync:read',    'Read reference-data sources + sync runs', 'reference_sync', 'read'),
  ('reference_sync:trigger', 'Trigger a reference-data sync run',       'reference_sync', 'trigger')
ON CONFLICT (auth_permission_code) DO NOTHING;

-- Global reference data is platform infra -> PLATFORM_ADMIN only.
INSERT INTO sys.sys_auth_role_permissions (auth_role_id, auth_permission_id)
SELECT r.auth_role_id, p.auth_permission_id
FROM sys.sys_auth_roles r
CROSS JOIN sys.sys_auth_permissions p
WHERE p.auth_permission_code IN ('reference_sync:read', 'reference_sync:trigger')
  AND r.auth_role_code = 'PLATFORM_ADMIN'
ON CONFLICT (auth_role_id, auth_permission_id) DO NOTHING;

DO $$ DECLARE v int; BEGIN
  SELECT count(*) INTO v FROM sys.sys_auth_permissions WHERE auth_permission_resource = 'reference_sync';
  RAISE NOTICE '000084: reference_sync permissions present: % (expect 2)', v;
  IF v <> 2 THEN RAISE EXCEPTION '000084: expected 2 reference_sync permissions, found %', v; END IF;
END $$;
