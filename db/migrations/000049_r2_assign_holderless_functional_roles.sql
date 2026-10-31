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
-- IDEMPOTENT: WHERE NOT EXISTS on (user, role, COALESCE(tenant)) over EVERY grant, revoked
-- ones included. Second run = 0 inserts = empty pg_dump diff. Applied by migrate.sh
-- under `psql -1 -f`.
--
-- EMENDATA il 2026-10-31 (regola «il ruolo segue il lavoro», decisione di Enzo del
-- 2026-10-31): la catena si riapplica a ogni deploy, e con il vecchio NOT EXISTS sulle sole
-- concessioni ATTIVE questa migrazione ridava da sola un ruolo appena revocato (READ_ONLY ad
-- alberto.rossetti, BLUEPRINT_MANAGER a quintino.bellini). Ora concede solo a chi quel ruolo
-- non l'ha MAI avuto: su un database nuovo il comportamento non cambia, su uno vivo una revoca
-- resta una revoca. La guardia conta le concessioni fatte, revocate comprese, per la stessa
-- ragione: «la scelta e' stata risolta», non «e' ancora in vigore».

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
);

-- Verification + integrity guard (fail loud if a pick email failed to resolve).
-- Conta le quattro scelte risolte (una concessione, attiva o revocata, per ciascuna coppia):
-- una revoca decisa dopo non e' una scelta che non si e' risolta.
DO $$
DECLARE granted int; active int;
BEGIN
  SELECT count(DISTINCT (ur.user_auth_role_user_id, ur.user_auth_role_role_id)),
         count(*) FILTER (WHERE ur.user_auth_role_revoked_at IS NULL)
    INTO granted, active
  FROM sys.sys_user_auth_roles ur
  JOIN sys.sys_auth_roles r ON r.auth_role_id = ur.user_auth_role_role_id
  JOIN sys.sys_users      u ON u.user_id      = ur.user_auth_role_user_id
  WHERE (lower(u.user_email), r.auth_role_code) IN (
          ('luca.bianchi@rtl-bank.org',      'PROCESS_OWNER'),
          ('quintino.bellini@rtl-bank.org',  'BLUEPRINT_MANAGER'),
          ('alberto.rossetti@rtl-bank.org',  'READ_ONLY'),
          ('federica.marchetti@rtl-bank.org','CEO'));
  IF granted < 4 THEN
    RAISE EXCEPTION 'R2: expected the 4 picks resolved (granted at least once), got % (a pick email may not resolve)', granted;
  END IF;
  RAISE NOTICE 'R2: % picks resolved on PROCESS_OWNER/BLUEPRINT_MANAGER/READ_ONLY/CEO, % still active', granted, active;
END $$;
