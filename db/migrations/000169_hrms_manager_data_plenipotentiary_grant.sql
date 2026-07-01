-- ============================================================================
-- 000169_hrms_manager_data_plenipotentiary_grant.sql
-- I21 (ADR-0027 §2.7) — HRMS_MANAGER = plenipotentiary over BUSINESS DATA.
-- Grants the non-self, business-data write/delete/admin perms it still lacked vs
-- TENANT_ADMIN, WITHOUT the technological/platform-administration perms (those stay
-- on the PLATFORM_ADMIN plane): mfa_policy:*, tenant:*, role:*, auth:revoke_user,
-- blueprint:activate/override, brownfield_adaptation:*, seed_acquisition:*, process_owner:read.
-- Read-side tenant-wide access is already enforced at runtime via HR_MANDATED_ROLES
-- (apps/api/src/lib/scope/resolver.ts); this closes the write/delete parity.
-- Pattern mirrors 000142_goals_okrs_permission_seed.sql. Idempotent (ON CONFLICT DO NOTHING).
-- Authored: 2026-07-01 (Enzo: "tutti i dato-business, esclusi i tecnologici").
-- ============================================================================

INSERT INTO sys.sys_auth_role_permissions (auth_role_id, auth_permission_id)
SELECT r.auth_role_id, p.auth_permission_id
FROM sys.sys_auth_roles r
CROSS JOIN sys.sys_auth_permissions p
WHERE r.auth_role_code = 'HRMS_MANAGER'
  AND p.auth_permission_code IN (
    -- clear business-data perms
    'compensation_intelligence:update',
    'user:delete',
    'organization_unit:delete',
    'enterprise_typing:create',
    'enterprise_typing:update',
    'notification:create',
    -- borderline data/config perms (Enzo: include)
    'bpm_process:update',
    'capability:admin',
    'matching:admin'
  )
ON CONFLICT (auth_role_id, auth_permission_id) DO NOTHING;

-- Verify all 9 grants are present for HRMS_MANAGER (fail loud if a permission code drifted).
DO $$ DECLARE v int; BEGIN
  SELECT count(*) INTO v
  FROM sys.sys_auth_role_permissions rp
  JOIN sys.sys_auth_roles r       ON r.auth_role_id = rp.auth_role_id AND r.auth_role_code = 'HRMS_MANAGER'
  JOIN sys.sys_auth_permissions p ON p.auth_permission_id = rp.auth_permission_id
  WHERE p.auth_permission_code IN (
    'compensation_intelligence:update','user:delete','organization_unit:delete',
    'enterprise_typing:create','enterprise_typing:update','notification:create',
    'bpm_process:update','capability:admin','matching:admin');
  RAISE NOTICE '000169: HRMS_MANAGER data-plenipotentiary grants present: % (expect 9)', v;
  IF v <> 9 THEN RAISE EXCEPTION '000169: expected 9 HRMS_MANAGER grants, found %', v; END IF;
END $$;
