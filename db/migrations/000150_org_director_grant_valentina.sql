-- ============================================================================
-- 000150_org_director_grant_valentina.sql — name the real ORG_DIRECTOR holder.
-- Gap#1 follow-up (D1-A): the functional ORG_DIRECTOR role (mig 000145) was seeded
-- HOLDERLESS by design (D1-B). This names its real holder-of-record on the RTL_BANK
-- reference tenant: Valentina Conti (HR Director, manager of "Divisione Human
-- Resources") — the best-fit by the live org structure (the capability/maturity
-- oversight of org-units is the HR Director's remit).
--
-- NB: this is a SEMANTIC/registry grant, NOT an access change. Valentina already
-- reads the Org-Director console via HRMS_MANAGER (org_director:read is mapped to
-- HRMS_MANAGER + TENANT_ADMIN + PLATFORM_ADMIN + ORG_DIRECTOR, mig 000145). The
-- value is that the dedicated functional role now has a real holder of record.
--
-- Resilient (joins by email + role_code, not hard-coded UUIDs) + idempotent
-- (NOT-EXISTS guard on the active (user,role,tenant) grant; fixed granted_at for an
-- empty twice-run diff). Authored: 2026-06-21 (Gap#1 follow-up).
-- ============================================================================

INSERT INTO sys.sys_user_auth_roles
  (user_auth_role_user_id, user_auth_role_role_id, user_auth_role_tenant_id, user_auth_role_granted_at)
SELECT u.user_id, r.auth_role_id, u.user_tenant_id, '2026-06-21T00:00:00Z'::timestamptz
FROM sys.sys_users u
JOIN sys.sys_auth_roles r ON r.auth_role_code = 'ORG_DIRECTOR'
WHERE lower(u.user_email) = lower('valentina.conti@rtl-bank.org')
  AND NOT EXISTS (
    SELECT 1 FROM sys.sys_user_auth_roles ex
    WHERE ex.user_auth_role_user_id = u.user_id
      AND ex.user_auth_role_role_id = r.auth_role_id
      AND COALESCE(ex.user_auth_role_tenant_id, '00000000-0000-0000-0000-000000000000'::uuid)
          = COALESCE(u.user_tenant_id, '00000000-0000-0000-0000-000000000000'::uuid)
      AND ex.user_auth_role_revoked_at IS NULL
  );

DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n
  FROM sys.sys_user_auth_roles uar
  JOIN sys.sys_users u ON u.user_id = uar.user_auth_role_user_id
  JOIN sys.sys_auth_roles r ON r.auth_role_id = uar.user_auth_role_role_id
  WHERE lower(u.user_email) = lower('valentina.conti@rtl-bank.org')
    AND r.auth_role_code = 'ORG_DIRECTOR'
    AND uar.user_auth_role_revoked_at IS NULL;
  IF n <> 1 THEN
    RAISE EXCEPTION '000150: expected exactly 1 active ORG_DIRECTOR grant for valentina.conti@rtl-bank.org, found %', n;
  END IF;
  RAISE NOTICE '000150: ORG_DIRECTOR holder-of-record = valentina.conti@rtl-bank.org (RTL_BANK).';
END $$;
