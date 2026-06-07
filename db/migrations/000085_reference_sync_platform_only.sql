-- ============================================================================
-- 000085_reference_sync_platform_only.sql — cap⑤: strict PLATFORM_ADMIN-only.
-- ----------------------------------------------------------------------------
-- reference_sync:{read,trigger} expose/MUTATE GLOBAL reference data (an ESCO
-- refresh affects ALL tenants), so per scraping spec §3.5 they are
-- PLATFORM_ADMIN-only — consistent with the platform's own denylist pattern
-- (000005 already excludes the analogous platform-global op
-- 'brownfield_adaptation:approve' from the TENANT_ADMIN catch-all).
--
-- 000005's TENANT_ADMIN catch-all now lists reference_sync:{read,trigger} in its
-- NOT IN denylist (so a fresh DB never grants them). This migration REVOKEs any
-- grant that the catch-all already produced on a RE-RUN before that fix landed
-- (the 000005 catch-all CROSS JOINs all perms existing at run time; on a second
-- migrate pass reference_sync existed → TENANT_ADMIN got it). Runs AFTER 000005
-- in every chain, so the end state is always strict PLATFORM_ADMIN-only.
-- Idempotent: the DELETE is a no-op once the grants are gone.
-- Authored: 2026-06-07 (S975 — decision: reference_sync strict PLATFORM_ADMIN-only).
-- ============================================================================

DELETE FROM sys.sys_auth_role_permissions rp
USING sys.sys_auth_roles r, sys.sys_auth_permissions p
WHERE rp.auth_role_id = r.auth_role_id
  AND rp.auth_permission_id = p.auth_permission_id
  AND r.auth_role_code = 'TENANT_ADMIN'
  AND p.auth_permission_resource = 'reference_sync';

DO $$ DECLARE v int; BEGIN
  SELECT count(*) INTO v
  FROM sys.sys_auth_role_permissions rp
  JOIN sys.sys_auth_roles r ON r.auth_role_id = rp.auth_role_id
  JOIN sys.sys_auth_permissions p ON p.auth_permission_id = rp.auth_permission_id
  WHERE r.auth_role_code = 'TENANT_ADMIN' AND p.auth_permission_resource = 'reference_sync';
  IF v <> 0 THEN
    RAISE EXCEPTION '000085: expected 0 TENANT_ADMIN reference_sync grants, found %', v;
  END IF;
  RAISE NOTICE '000085: reference_sync is now strict PLATFORM_ADMIN-only (TENANT_ADMIN revoked).';
END $$;
