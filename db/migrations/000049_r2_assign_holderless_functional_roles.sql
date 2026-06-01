-- 000049_r2_assign_holderless_functional_roles.sql
-- R2 (S955, 2026-06-01): grant the 4 holderless auth-roles to real RTL_BANK users, chosen
-- BY FUNCTION from the real B-51 position titles (mig 000048). NO test fixtures.
--
-- DOCTRINE (RBAC_UIX_PERSPECTIVES_PLAN locked decision 4): auth-roles are a FUNCTIONAL grant
-- layer (sys_user_auth_roles) ORTHOGONAL to org placement (sys_user_position_assignments).
-- Granting a functional role does NOT change org structure — assigning to real users is clean.
--
-- Picks (evidence-based, by function; plain-USER holders preferred for a clean verify matrix):
--   PROCESS_OWNER     -> luca.bianchi@rtl-bank.org      (Operations Director — owns BPM/processes)
--   BLUEPRINT_MANAGER -> quintino.bellini@rtl-bank.org  (IT Director — enterprise architecture/blueprints)
--   READ_ONLY         -> alberto.rossetti@rtl-bank.org  (Compliance Officer — read-only oversight/audit)
--   CEO               -> federica.marchetti@rtl-bank.org (the real RTL CEO; keeps TENANT_ADMIN — multi-role)
--
-- Tenant scope = RTL_BANK (mirrors the existing TENANT_ADMIN/MANAGER grant pattern). Logins
-- (LOCAL identity + ARGON2ID credential) are provisioned separately by
-- db/scripts/seed-r2-personas.ts (argon2 cannot run in SQL).
--
-- IDEMPOTENT: WHERE NOT EXISTS on the active-grant unique key (user, role, COALESCE(tenant))
-- WHERE revoked_at IS NULL. Second run = 0 inserts = empty pg_dump diff. Applied by migrate.sh
-- under `psql -1 -f`.

INSERT INTO sys.sys_user_auth_roles
  (user_auth_role_user_id, user_auth_role_role_id, user_auth_role_tenant_id)
SELECT u.user_id, r.auth_role_id, t.tenant_id
FROM (VALUES
  ('luca.bianchi@rtl-bank.org',      'PROCESS_OWNER'),
  ('quintino.bellini@rtl-bank.org',  'BLUEPRINT_MANAGER'),
  ('alberto.rossetti@rtl-bank.org',  'READ_ONLY'),
  ('federica.marchetti@rtl-bank.org','CEO')
) AS pick(email, role_code)
JOIN sys.sys_users      u ON lower(u.user_email)    = lower(pick.email)
JOIN sys.sys_auth_roles r ON r.auth_role_code       = pick.role_code
JOIN sys.sys_tenancies  t ON t.tenant_code          = 'RTL_BANK'
WHERE NOT EXISTS (
  SELECT 1 FROM sys.sys_user_auth_roles ex
  WHERE ex.user_auth_role_user_id = u.user_id
    AND ex.user_auth_role_role_id = r.auth_role_id
    AND COALESCE(ex.user_auth_role_tenant_id, '00000000-0000-0000-0000-000000000000'::uuid)
        = COALESCE(t.tenant_id, '00000000-0000-0000-0000-000000000000'::uuid)
    AND ex.user_auth_role_revoked_at IS NULL
);

-- Verification + integrity guard (fail loud if a pick email failed to resolve).
DO $$
DECLARE granted int;
BEGIN
  SELECT count(*) INTO granted
  FROM sys.sys_user_auth_roles ur
  JOIN sys.sys_auth_roles r ON r.auth_role_id = ur.user_auth_role_role_id
  WHERE r.auth_role_code IN ('PROCESS_OWNER','BLUEPRINT_MANAGER','READ_ONLY','CEO')
    AND ur.user_auth_role_revoked_at IS NULL;
  IF granted < 4 THEN
    RAISE EXCEPTION 'R2: expected >=4 active grants on the 4 holderless roles, got % (a pick email may not resolve)', granted;
  END IF;
  RAISE NOTICE 'R2: % active grants on PROCESS_OWNER/BLUEPRINT_MANAGER/READ_ONLY/CEO (expect 4)', granted;
END $$;
