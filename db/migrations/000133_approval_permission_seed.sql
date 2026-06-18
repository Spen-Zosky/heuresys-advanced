-- ============================================================================
-- 000133_approval_permission_seed.sql — approval runtime RBAC perms + role maps.
-- Mirrors 000122 verbatim. Idempotent (ON CONFLICT DO NOTHING). Sibling of 000132
-- (table-vs-perms split). Resource is the single-token `approval`; module URL
-- prefix /v1/approvals.
--   read   -> 6 HRMS-read roles (excludes USER/READ_ONLY).
--   create -> admin + HR write audience + MANAGER (a manager initiates an approval
--             flow for their team — the canonical requester; matches the spec E2E
--             where paolo.caputo/MANAGER opens a request).
--   decide -> BROAD: any role that can be named an approver. Decision authority is
--             ALSO gated at the data layer (you can only decide YOUR OWN pending
--             step), so the permission is necessary-not-sufficient. READ_ONLY +
--             the pure-subordinate roles (USER/TEAM_MEMBER) excluded.
-- NB PLATFORM_ADMIN is NOT auto-granted later permissions (the 000005 grant was
--    one-time) -> it MUST be listed explicitly. RBAC cache reloads at server boot
--    / first buildTestApp.
-- Authored: 2026-06-18 (3.3 slice-D BPM approval runtime).
-- ============================================================================

INSERT INTO sys.sys_auth_permissions (auth_permission_code, auth_permission_name, auth_permission_resource, auth_permission_action)
VALUES
  ('approval:create', 'Create approval request', 'approval', 'create'),
  ('approval:decide', 'Decide an approval step',  'approval', 'decide'),
  ('approval:read',   'Read approval requests',    'approval', 'read')
ON CONFLICT (auth_permission_code) DO NOTHING;

-- approval:read — standard HRMS-read audience (6 non-leaf roles; excludes USER/READ_ONLY)
INSERT INTO sys.sys_auth_role_permissions (auth_role_id, auth_permission_id)
SELECT r.auth_role_id, p.auth_permission_id
FROM sys.sys_auth_roles r
CROSS JOIN sys.sys_auth_permissions p
WHERE p.auth_permission_code = 'approval:read'
  AND r.auth_role_code IN ('PLATFORM_ADMIN','TENANT_ADMIN','BLUEPRINT_MANAGER','HRMS_MANAGER','PROCESS_OWNER','MANAGER')
ON CONFLICT (auth_role_id, auth_permission_id) DO NOTHING;

-- approval:create — write audience (admins + HR managers + process owners + managers)
INSERT INTO sys.sys_auth_role_permissions (auth_role_id, auth_permission_id)
SELECT r.auth_role_id, p.auth_permission_id
FROM sys.sys_auth_roles r
CROSS JOIN sys.sys_auth_permissions p
WHERE p.auth_permission_code = 'approval:create'
  AND r.auth_role_code IN ('PLATFORM_ADMIN','TENANT_ADMIN','HRMS_MANAGER','PROCESS_OWNER','MANAGER')
ON CONFLICT (auth_role_id, auth_permission_id) DO NOTHING;

-- approval:decide — BROAD approver audience (data-layer pins to own step; READ_ONLY +
-- pure subordinates USER/TEAM_MEMBER excluded)
INSERT INTO sys.sys_auth_role_permissions (auth_role_id, auth_permission_id)
SELECT r.auth_role_id, p.auth_permission_id
FROM sys.sys_auth_roles r
CROSS JOIN sys.sys_auth_permissions p
WHERE p.auth_permission_code = 'approval:decide'
  AND r.auth_role_code IN ('PLATFORM_ADMIN','TENANT_ADMIN','BLUEPRINT_MANAGER','HRMS_MANAGER','PROCESS_OWNER','MANAGER','CEO','TEAM_LEADER')
ON CONFLICT (auth_role_id, auth_permission_id) DO NOTHING;

DO $$ DECLARE v int; BEGIN
  SELECT count(*) INTO v FROM sys.sys_auth_permissions WHERE auth_permission_resource = 'approval';
  RAISE NOTICE '000133: approval permissions present: % (expect 3)', v;
  IF v <> 3 THEN RAISE EXCEPTION '000133: expected 3 approval permissions, found %', v; END IF;
END $$;
