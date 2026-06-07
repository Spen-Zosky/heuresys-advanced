-- ============================================================================
-- 000080_predictionsml_permission_seed.sql — predictions RBAC permissions + role maps.
-- Mirrors 000078_engagement_surveys_permission_seed.sql. Idempotent (ON CONFLICT DO NOTHING).
-- PredictionsML is a READ-ONLY read-model (legacy precomputed values imported as-is, no
--   in-platform ML, no user-facing writes) -> read-only permission surface only:
--   predictions:read -> the standard 6 HRMS-read roles (excludes leaf USER/READ_ONLY).
-- NB PLATFORM_ADMIN is NOT auto-granted later permissions (the 000005 grant was one-time)
--    -> it MUST be listed explicitly. RBAC cache reloads at server boot / first buildTestApp.
-- Authored: 2026-06-07 (S973).
-- ============================================================================

INSERT INTO sys.sys_auth_permissions (auth_permission_code, auth_permission_name, auth_permission_resource, auth_permission_action)
VALUES
  ('predictions:read', 'Read predictions', 'predictions', 'read')
ON CONFLICT (auth_permission_code) DO NOTHING;

-- predictions:read — standard HRMS-read audience (6 non-leaf roles; excludes USER/READ_ONLY)
INSERT INTO sys.sys_auth_role_permissions (auth_role_id, auth_permission_id)
SELECT r.auth_role_id, p.auth_permission_id
FROM sys.sys_auth_roles r
CROSS JOIN sys.sys_auth_permissions p
WHERE p.auth_permission_code = 'predictions:read'
  AND r.auth_role_code IN ('PLATFORM_ADMIN','TENANT_ADMIN','BLUEPRINT_MANAGER','HRMS_MANAGER','PROCESS_OWNER','MANAGER')
ON CONFLICT (auth_role_id, auth_permission_id) DO NOTHING;

DO $$ DECLARE v int; BEGIN
  SELECT count(*) INTO v FROM sys.sys_auth_permissions WHERE auth_permission_resource = 'predictions';
  RAISE NOTICE '000080: predictions permissions present: % (expect 1)', v;
  IF v <> 1 THEN RAISE EXCEPTION '000080: expected 1 predictions permission, found %', v; END IF;
END $$;
