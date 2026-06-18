-- ============================================================================
-- 000078_engagement_surveys_permission_seed.sql — surveys RBAC permissions + role maps.
-- Mirrors 000073_mentorship_permission_seed.sql verbatim. Idempotent (ON CONFLICT DO NOTHING).
-- read  -> 6 HRMS-read roles; create/update/delete -> admin+HR write audience.
-- NB PLATFORM_ADMIN is NOT auto-granted later permissions (the 000005 grant was one-time)
--    -> it MUST be listed explicitly. RBAC cache reloads at server boot / first buildTestApp.
-- Authored: 2026-06-07 (S971).
-- ============================================================================

INSERT INTO sys.sys_auth_permissions (auth_permission_code, auth_permission_name, auth_permission_resource, auth_permission_action)
VALUES
  ('surveys:read',   'Read surveys',   'surveys', 'read'),
  ('surveys:create', 'Create surveys', 'surveys', 'create'),
  ('surveys:update', 'Update surveys', 'surveys', 'update'),
  ('surveys:delete', 'Delete surveys', 'surveys', 'delete')
ON CONFLICT (auth_permission_code) DO NOTHING;

-- surveys:read — standard HRMS-read audience (6 non-leaf roles; excludes USER/READ_ONLY)
INSERT INTO sys.sys_auth_role_permissions (auth_role_id, auth_permission_id)
SELECT r.auth_role_id, p.auth_permission_id
FROM sys.sys_auth_roles r
CROSS JOIN sys.sys_auth_permissions p
WHERE p.auth_permission_code = 'surveys:read'
  AND r.auth_role_code IN ('PLATFORM_ADMIN','TENANT_ADMIN','BLUEPRINT_MANAGER','HRMS_MANAGER','PROCESS_OWNER','MANAGER')
ON CONFLICT (auth_role_id, auth_permission_id) DO NOTHING;

-- surveys:create/update/delete — write audience (admins + HR managers)
INSERT INTO sys.sys_auth_role_permissions (auth_role_id, auth_permission_id)
SELECT r.auth_role_id, p.auth_permission_id
FROM sys.sys_auth_roles r
CROSS JOIN sys.sys_auth_permissions p
WHERE p.auth_permission_code IN ('surveys:create','surveys:update','surveys:delete')
  AND r.auth_role_code IN ('PLATFORM_ADMIN','TENANT_ADMIN','HRMS_MANAGER')
ON CONFLICT (auth_role_id, auth_permission_id) DO NOTHING;

DO $$ DECLARE v int; BEGIN
  -- Count ONLY the 4 permission codes this migration owns (scope by code, NOT by resource):
  -- later migrations legitimately add more surveys:* perms (e.g. surveys:respond:self, mig
  -- 000135 / S995) — a resource-wide count breaks the twice-run idempotency invariant once
  -- they exist (D-12/D-22 class; surfaced at the first post-S995 deploy, S996).
  SELECT count(*) INTO v FROM sys.sys_auth_permissions
   WHERE auth_permission_code IN ('surveys:read', 'surveys:create', 'surveys:update', 'surveys:delete');
  RAISE NOTICE '000078: surveys base permissions present: % (expect 4)', v;
  IF v <> 4 THEN RAISE EXCEPTION '000078: expected 4 surveys base permissions, found %', v; END IF;
END $$;
