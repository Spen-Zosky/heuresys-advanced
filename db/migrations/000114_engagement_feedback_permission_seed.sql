-- ============================================================================
-- 000114_engagement_feedback_permission_seed.sql — engagement_feedback RBAC perms + role maps.
-- Mirrors 000078_engagement_surveys_permission_seed.sql verbatim. Idempotent (ON CONFLICT DO NOTHING).
-- Resource is the single-token `engagement_feedback` (matching auth_permission_resource style; the
-- module URL prefix /v1/engagement-feedback is hyphenated, the permission resource is snake_case).
-- read  -> 6 HRMS-read roles; create/update/delete -> admin + HR write audience.
-- NB PLATFORM_ADMIN is NOT auto-granted later permissions (the 000005 grant was one-time)
--    -> it MUST be listed explicitly. RBAC cache reloads at server boot / first buildTestApp.
-- Authored: 2026-06-13 (S988).
-- ============================================================================

INSERT INTO sys.sys_auth_permissions (auth_permission_code, auth_permission_name, auth_permission_resource, auth_permission_action)
VALUES
  ('engagement_feedback:read',   'Read engagement feedback',   'engagement_feedback', 'read'),
  ('engagement_feedback:create', 'Create engagement feedback', 'engagement_feedback', 'create'),
  ('engagement_feedback:update', 'Update engagement feedback', 'engagement_feedback', 'update'),
  ('engagement_feedback:delete', 'Delete engagement feedback', 'engagement_feedback', 'delete')
ON CONFLICT (auth_permission_code) DO NOTHING;

-- engagement_feedback:read — standard HRMS-read audience (6 non-leaf roles; excludes USER/READ_ONLY)
INSERT INTO sys.sys_auth_role_permissions (auth_role_id, auth_permission_id)
SELECT r.auth_role_id, p.auth_permission_id
FROM sys.sys_auth_roles r
CROSS JOIN sys.sys_auth_permissions p
WHERE p.auth_permission_code = 'engagement_feedback:read'
  AND r.auth_role_code IN ('PLATFORM_ADMIN','TENANT_ADMIN','BLUEPRINT_MANAGER','HRMS_MANAGER','PROCESS_OWNER','MANAGER')
ON CONFLICT (auth_role_id, auth_permission_id) DO NOTHING;

-- engagement_feedback:create/update/delete — write audience (admins + HR managers)
INSERT INTO sys.sys_auth_role_permissions (auth_role_id, auth_permission_id)
SELECT r.auth_role_id, p.auth_permission_id
FROM sys.sys_auth_roles r
CROSS JOIN sys.sys_auth_permissions p
WHERE p.auth_permission_code IN ('engagement_feedback:create','engagement_feedback:update','engagement_feedback:delete')
  AND r.auth_role_code IN ('PLATFORM_ADMIN','TENANT_ADMIN','HRMS_MANAGER')
ON CONFLICT (auth_role_id, auth_permission_id) DO NOTHING;

DO $$ DECLARE v int; BEGIN
  SELECT count(*) INTO v FROM sys.sys_auth_permissions WHERE auth_permission_resource = 'engagement_feedback';
  RAISE NOTICE '000114: engagement_feedback permissions present: % (expect 4)', v;
  IF v <> 4 THEN RAISE EXCEPTION '000114: expected 4 engagement_feedback permissions, found %', v; END IF;
END $$;
