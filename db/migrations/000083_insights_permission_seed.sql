-- ============================================================================
-- 000083_insights_permission_seed.sql — cap③ insights RBAC permissions + role maps.
-- Mirrors 000080_predictionsml_permission_seed.sql. Idempotent (ON CONFLICT DO NOTHING).
-- Two permissions:
--   insights:view  — read flight-risk / data-mining scores. ADMIN/MANAGER ONLY (D-6):
--                    flight-risk is sensitive (a management tool, not ESS content)
--                    -> the standard 6 non-leaf HRMS roles (excludes USER/READ_ONLY).
--   insights:admin — trigger POST /v1/insights/recompute (write-class, mirrors the
--                    matching:reindex / surveys-write gate) -> PLATFORM_ADMIN,
--                    TENANT_ADMIN, HRMS_MANAGER only.
-- NB PLATFORM_ADMIN is NOT auto-granted later permissions -> listed explicitly.
--    RBAC cache reloads at server boot / first buildTestApp.
-- Authored: 2026-06-07 (cap③ P1 flight-risk).
-- ============================================================================

INSERT INTO sys.sys_auth_permissions (auth_permission_code, auth_permission_name, auth_permission_resource, auth_permission_action)
VALUES
  ('insights:view',  'View data-mining insights scores', 'insights', 'view'),
  ('insights:admin', 'Recompute data-mining insights scores', 'insights', 'admin')
ON CONFLICT (auth_permission_code) DO NOTHING;

-- insights:view — standard HRMS-read audience (6 non-leaf roles; excludes USER/READ_ONLY)
INSERT INTO sys.sys_auth_role_permissions (auth_role_id, auth_permission_id)
SELECT r.auth_role_id, p.auth_permission_id
FROM sys.sys_auth_roles r
CROSS JOIN sys.sys_auth_permissions p
WHERE p.auth_permission_code = 'insights:view'
  AND r.auth_role_code IN ('PLATFORM_ADMIN','TENANT_ADMIN','BLUEPRINT_MANAGER','HRMS_MANAGER','PROCESS_OWNER','MANAGER')
ON CONFLICT (auth_role_id, auth_permission_id) DO NOTHING;

-- insights:admin — write-class only (recompute trigger)
INSERT INTO sys.sys_auth_role_permissions (auth_role_id, auth_permission_id)
SELECT r.auth_role_id, p.auth_permission_id
FROM sys.sys_auth_roles r
CROSS JOIN sys.sys_auth_permissions p
WHERE p.auth_permission_code = 'insights:admin'
  AND r.auth_role_code IN ('PLATFORM_ADMIN','TENANT_ADMIN','HRMS_MANAGER')
ON CONFLICT (auth_role_id, auth_permission_id) DO NOTHING;

DO $$ DECLARE v int; BEGIN
  SELECT count(*) INTO v FROM sys.sys_auth_permissions WHERE auth_permission_resource = 'insights';
  RAISE NOTICE '000083: insights permissions present: % (expect 2)', v;
  IF v <> 2 THEN RAISE EXCEPTION '000083: expected 2 insights permissions, found %', v; END IF;
END $$;
