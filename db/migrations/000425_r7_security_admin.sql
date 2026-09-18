-- 000425 — Mandato K, R-7: SECURITY_ADMIN (D9=B non si applica: e' un ruolo di CLIENTE,
-- non usa l'asse di R-0 — mandato, sezione 2, conseguenza c).
--
-- IL PERCHE'. Il tenant deve poter amministrare la propria sicurezza (sessioni, MFA,
-- deleghe, concessione di ruoli AI PROPRI dipendenti) senza il pieno potere di
-- HRMS_MANAGER/TENANT_ADMIN sul resto del business. SECURITY_ADMIN riceve SOLO:
--   · auth: role_matrix:read, auth:sessions_read, auth:revoke_user
--   · mfa_policy:read, mfa_policy:manage
--   · delegation:read, delegation:manage
--   · role:assign — entra in CAN_GRANT_ROLES (apps/api/src/lib/scope/mandati.ts) con lo
--     STESSO vincolo di TENANT_ADMIN: grantRole/revokeRole/listRoles distinguono il ramo
--     platform-wide da quello tenant-scoped con `isPlatformAdmin(actor)`, letterale su
--     `roles.includes('PLATFORM_ADMIN')` — SECURITY_ADMIN non lo e', quindi cade da solo
--     nel ramo tenant-scoped: non concede ruoli di piattaforma, non esce dal proprio tenant.
--
-- NESSUN RITIRO: a differenza di R-2 (D3=A), questgli otto permessi restano intatti a
-- PLATFORM_ADMIN/TENANT_ADMIN (e delegation:* a HRMS_MANAGER, I22): SECURITY_ADMIN e' una
-- concessione aggiuntiva, non toglie nulla a nessuno. G-D2 non e' coinvolta.
--
-- is_platform=false (come DPO, BLUEPRINT_MANAGER, PLATFORM_OPERATOR, SALES): PLATFORM_ADMIN
-- resta l'unico is_platform=true.
--
-- Effetto per dove_siamo.py:
--   select 1 from sys.sys_auth_roles where auth_role_code='SECURITY_ADMIN' and retired_at is null
--
\set ON_ERROR_STOP on

BEGIN;

-- 1. Il ruolo, con la famiglia dichiarata subito (000414 la pretende).
INSERT INTO sys.sys_auth_roles
  (auth_role_code, auth_role_name, auth_role_description, auth_role_is_platform, auth_role_category)
VALUES
  ('SECURITY_ADMIN', 'Security Administrator',
   'Amministrazione della sicurezza del tenant: sessioni (auth:sessions_read, auth:revoke_user, role_matrix:read), policy MFA (mfa_policy:read/manage), deleghe (delegation:read/manage), concessione di ruoli AI PROPRI dipendenti (role:assign, con lo stesso vincolo tenant-scoped di TENANT_ADMIN). Nato mandato K, R-7, 2026-09-19. Nessun ritiro: concessione aggiuntiva, non toglie nulla a chi gia'' li ha.',
   false, 'functional')
ON CONFLICT (auth_role_code) DO UPDATE
  SET auth_role_category = EXCLUDED.auth_role_category,
      auth_role_is_platform = EXCLUDED.auth_role_is_platform;

-- 2. Grant a SECURITY_ADMIN: gli otto permessi gia' esistenti (nessuno nuovo).
INSERT INTO sys.sys_auth_role_permissions (auth_role_id, auth_permission_id)
SELECT r.auth_role_id, p.auth_permission_id
  FROM sys.sys_auth_roles r
  CROSS JOIN sys.sys_auth_permissions p
 WHERE r.auth_role_code = 'SECURITY_ADMIN'
   AND p.auth_permission_code IN (
     'role_matrix:read', 'auth:sessions_read', 'auth:revoke_user',
     'mfa_policy:read', 'mfa_policy:manage',
     'delegation:read', 'delegation:manage',
     'role:assign'
   )
ON CONFLICT (auth_role_id, auth_permission_id) DO NOTHING;

-- 3. Le traduzioni inglesi (000255/000272/000300/000404/000422/000423: la guardia della
--    000255 pretende copertura EN totale su sys_auth_roles, nome E descrizione).
INSERT INTO sys.sys_reference_translations (entity_table, entity_id, field, locale, text, source)
SELECT 'sys_auth_roles', r.auth_role_id, x.campo, 'en', x.testo, 'LLM'
  FROM sys.sys_auth_roles r
  JOIN (VALUES
    ('SECURITY_ADMIN', 'name', 'Security Administrator'),
    ('SECURITY_ADMIN', 'description',
     'Tenant security administration: sessions (auth:sessions_read, auth:revoke_user, role_matrix:read), MFA policy (mfa_policy:read/manage), delegations (delegation:read/manage), granting roles to ITS OWN employees (role:assign, same tenant-scoped constraint as TENANT_ADMIN). Born mandato K, R-7, 2026-09-19. No retirement: an additional grant, takes nothing from existing holders.')
  ) AS x(codice, campo, testo) ON x.codice = r.auth_role_code
ON CONFLICT DO NOTHING;

-- 4. Post-condizione: la migrazione fallisce se qualcosa non torna.
DO $$
DECLARE
  n_perm int; n_senza_cat int; n_platform_true int;
  n_plat_holder int; n_ta_holder int; n_hrms_deleg int;
BEGIN
  SELECT count(*) INTO n_perm
    FROM sys.sys_auth_role_permissions rp
    JOIN sys.sys_auth_roles r ON r.auth_role_id = rp.auth_role_id
    JOIN sys.sys_auth_permissions p ON p.auth_permission_id = rp.auth_permission_id
   WHERE r.auth_role_code = 'SECURITY_ADMIN' AND rp.revoked_at IS NULL
     AND p.auth_permission_code IN (
       'role_matrix:read', 'auth:sessions_read', 'auth:revoke_user',
       'mfa_policy:read', 'mfa_policy:manage',
       'delegation:read', 'delegation:manage',
       'role:assign'
     );
  IF n_perm <> 8 THEN
    RAISE EXCEPTION '000425: SECURITY_ADMIN deve avere 8 permessi, ne ha %', n_perm;
  END IF;

  -- Nessun ritiro: PLATFORM_ADMIN e TENANT_ADMIN restano titolari di tutti e otto.
  SELECT count(DISTINCT p.auth_permission_code) INTO n_plat_holder
    FROM sys.sys_auth_role_permissions rp
    JOIN sys.sys_auth_roles r ON r.auth_role_id = rp.auth_role_id
    JOIN sys.sys_auth_permissions p ON p.auth_permission_id = rp.auth_permission_id
   WHERE r.auth_role_code = 'PLATFORM_ADMIN' AND rp.revoked_at IS NULL
     AND p.auth_permission_code IN (
       'role_matrix:read', 'auth:sessions_read', 'auth:revoke_user',
       'mfa_policy:read', 'mfa_policy:manage',
       'delegation:read', 'delegation:manage', 'role:assign'
     );
  IF n_plat_holder <> 8 THEN
    RAISE EXCEPTION '000425: PLATFORM_ADMIN ha perso qualcosa degli otto permessi (ne ha %, attesi 8) — nessun ritiro previsto qui', n_plat_holder;
  END IF;

  SELECT count(DISTINCT p.auth_permission_code) INTO n_ta_holder
    FROM sys.sys_auth_role_permissions rp
    JOIN sys.sys_auth_roles r ON r.auth_role_id = rp.auth_role_id
    JOIN sys.sys_auth_permissions p ON p.auth_permission_id = rp.auth_permission_id
   WHERE r.auth_role_code = 'TENANT_ADMIN' AND rp.revoked_at IS NULL
     AND p.auth_permission_code IN (
       'role_matrix:read', 'auth:sessions_read', 'auth:revoke_user',
       'mfa_policy:read', 'mfa_policy:manage',
       'delegation:read', 'delegation:manage', 'role:assign'
     );
  IF n_ta_holder <> 8 THEN
    RAISE EXCEPTION '000425: TENANT_ADMIN ha perso qualcosa degli otto permessi (ne ha %, attesi 8) — nessun ritiro previsto qui', n_ta_holder;
  END IF;

  SELECT count(DISTINCT p.auth_permission_code) INTO n_hrms_deleg
    FROM sys.sys_auth_role_permissions rp
    JOIN sys.sys_auth_roles r ON r.auth_role_id = rp.auth_role_id
    JOIN sys.sys_auth_permissions p ON p.auth_permission_id = rp.auth_permission_id
   WHERE r.auth_role_code = 'HRMS_MANAGER' AND rp.revoked_at IS NULL
     AND p.auth_permission_code IN ('delegation:read', 'delegation:manage');
  IF n_hrms_deleg <> 2 THEN
    RAISE EXCEPTION '000425: HRMS_MANAGER ha perso delegation:read/manage (I22) — nessun ritiro previsto qui, ne ha %', n_hrms_deleg;
  END IF;

  SELECT count(*) INTO n_senza_cat FROM sys.sys_auth_roles
   WHERE auth_role_category IS NULL OR btrim(auth_role_category) = '';
  IF n_senza_cat <> 0 THEN
    RAISE EXCEPTION '000425: % ruoli senza famiglia dichiarata dopo questa migrazione', n_senza_cat;
  END IF;

  SELECT count(*) INTO n_platform_true FROM sys.sys_auth_roles WHERE auth_role_is_platform;
  IF n_platform_true <> 1 THEN
    RAISE EXCEPTION '000425: auth_role_is_platform=true deve restare su UN solo ruolo (PLATFORM_ADMIN), ne ha %', n_platform_true;
  END IF;

  RAISE NOTICE '000425: SECURITY_ADMIN creato con 8 permessi; nessun ritiro (PLATFORM_ADMIN/TENANT_ADMIN/HRMS_MANAGER invariati); 0 ruoli senza famiglia; is_platform invariato su PLATFORM_ADMIN.';
END $$;

COMMIT;

-- FINE 000425
