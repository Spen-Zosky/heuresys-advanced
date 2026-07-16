-- ============================================================================
-- 000172_evidence_permission_seed.sql — #27 (S1018) evidence layer RBAC.
-- `evidence:read` (per-subject / per-score drill-down, SENSITIVE org-gated) →
-- the 6-role HRMS read audience; `evidence:read:self` (ESS I17 floor) → the
-- self-scope roles. Mirrors 000142 + the ESS self grants. Idempotent.
-- Authored: 2026-07-16.
-- ============================================================================

INSERT INTO sys.sys_auth_permissions (auth_permission_code, auth_permission_name, auth_permission_resource, auth_permission_action)
VALUES
  ('evidence:read',      'Read evidence layer',       'evidence', 'read'),
  ('evidence:read:self', 'Read own evidence (ESS)',   'evidence', 'read')
ON CONFLICT (auth_permission_code) DO NOTHING;

-- read audience: 6 non-leaf roles (matches goal/okr read, 000142)
INSERT INTO sys.sys_auth_role_permissions (auth_role_id, auth_permission_id)
SELECT r.auth_role_id, p.auth_permission_id
FROM sys.sys_auth_roles r
CROSS JOIN sys.sys_auth_permissions p
WHERE p.auth_permission_code = 'evidence:read'
  AND r.auth_role_code IN ('PLATFORM_ADMIN','TENANT_ADMIN','BLUEPRINT_MANAGER','HRMS_MANAGER','PROCESS_OWNER','MANAGER')
ON CONFLICT (auth_role_id, auth_permission_id) DO NOTHING;

-- self audience: every employee holds USER (I17); include the functional + read-only roles
INSERT INTO sys.sys_auth_role_permissions (auth_role_id, auth_permission_id)
SELECT r.auth_role_id, p.auth_permission_id
FROM sys.sys_auth_roles r
CROSS JOIN sys.sys_auth_permissions p
WHERE p.auth_permission_code = 'evidence:read:self'
  AND r.auth_role_code IN ('USER','READ_ONLY','TEAM_MEMBER','TEAM_LEADER','MANAGER','HRMS_MANAGER','TENANT_ADMIN','PLATFORM_ADMIN')
ON CONFLICT (auth_role_id, auth_permission_id) DO NOTHING;

DO $$ DECLARE v int; s int; BEGIN
  SELECT count(*) INTO v FROM sys.sys_auth_role_permissions rp
    JOIN sys.sys_auth_permissions p ON p.auth_permission_id = rp.auth_permission_id
   WHERE p.auth_permission_code = 'evidence:read';
  SELECT count(*) INTO s FROM sys.sys_auth_role_permissions rp
    JOIN sys.sys_auth_permissions p ON p.auth_permission_id = rp.auth_permission_id
   WHERE p.auth_permission_code = 'evidence:read:self';
  IF v < 6 THEN RAISE EXCEPTION '000172: expected >=6 evidence:read grants, found %', v; END IF;
  IF s < 1 THEN RAISE EXCEPTION '000172: expected >=1 evidence:read:self grants, found %', s; END IF;
  RAISE NOTICE '000172: evidence:read (% grants) + evidence:read:self (% grants) seeded.', v, s;
END $$;
