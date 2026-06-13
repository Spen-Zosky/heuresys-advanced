-- 000111_import_chiara_spenuso_heuresys.sql
-- #8b Wave-3 L1 (S988) — import the real HEURESYS person chiara.spenuso WITH login.
--
-- Context (programma post-v1.0 Fase 3, decision in memory project_post_v1_program_s987):
-- legacy employee chiara.spenuso@heuresys.com (id 2b1cc664-…, "Head of Product") is
-- soft-deleted in the legacy source (deleted_at 2026-05-09), which is why the RTL rebuild
-- filtered her out of v5. Carrying her into the HEURESYS tenant is an intentional override
-- of that legacy soft-delete (Enzo's decision: "import solo chiara.spenuso"). spen.zosky was
-- evaluated and is NOT imported: it is a stale-doc homonym (the README rtl-rebuild:37
-- spen.zosky@gmail exclusion no longer exists in the live legacy snapshot; the only surviving
-- zosky row is spen.zosky@heuresys.com, itself soft-deleted) — out of scope, verified S988.
--
-- Employee-centric crosswalk (I14 / ADR-0024): user_external_code = LEGACY_EMP::<employees.id>,
-- NEVER LEGACY:<users.id>. Tenant HEURESYS = 8bc5bc59-… (resolved by code, not hard-coded).
--
-- Idempotent: every INSERT is guarded WHERE NOT EXISTS → a second run touches 0 rows
-- (twice-run empty-diff invariant). Safe on a DB that already has chiara.
-- No BEGIN/COMMIT: migrate.sh runs each file with `psql -1` (single-transaction wrapper).

-- 1) The person (sys_users) — HEURESYS tenant, employee-centric key, real (not synthetic) row.
INSERT INTO sys.sys_users
  (user_tenant_id, user_external_code, user_email, user_display_name,
   user_first_name, user_last_name, user_status, user_type, user_is_synthetic, user_metadata)
SELECT
  t.tenant_id,
  'LEGACY_EMP::2b1cc664-5631-45d8-a82d-cc05d9b028f3',
  'chiara.spenuso@heuresys.com',
  'Chiara Spenuso', 'Chiara', 'Spenuso',
  'ACTIVE', 'STANDARD', false,
  jsonb_build_object(
    'source', 's988-fase3-8b-import',
    'legacy_employee_id', '2b1cc664-5631-45d8-a82d-cc05d9b028f3',
    'legacy_job_title', 'Head of Product',
    'legacy_soft_deleted_at', '2026-05-09T16:06:02+00:00',
    'import_note', 'carried over a legacy soft-delete by explicit decision (S988 Fase 3 #8b)')
FROM sys.sys_tenancies t
WHERE t.tenant_code = 'HEURESYS'
  AND NOT EXISTS (
    SELECT 1 FROM sys.sys_users u
     WHERE lower(u.user_email) = lower('chiara.spenuso@heuresys.com')
  );

-- 2) Baseline login role: USER on the HEURESYS tenant (a higher role is a later PM call).
INSERT INTO sys.sys_user_auth_roles
  (user_auth_role_user_id, user_auth_role_role_id, user_auth_role_tenant_id)
SELECT u.user_id, r.auth_role_id, u.user_tenant_id
FROM sys.sys_users u
JOIN sys.sys_auth_roles r ON r.auth_role_code = 'USER'
WHERE lower(u.user_email) = lower('chiara.spenuso@heuresys.com')
  AND NOT EXISTS (
    SELECT 1 FROM sys.sys_user_auth_roles ur
     WHERE ur.user_auth_role_user_id = u.user_id
       AND ur.user_auth_role_role_id = r.auth_role_id
       AND COALESCE(ur.user_auth_role_tenant_id, '00000000-0000-0000-0000-000000000000'::uuid)
           = COALESCE(u.user_tenant_id, '00000000-0000-0000-0000-000000000000'::uuid)
       AND ur.user_auth_role_revoked_at IS NULL
  );

-- 3) LOCAL auth identity (login-capable; email pre-verified for a carried-over real person).
INSERT INTO sys.sys_auth_identities
  (auth_identity_user_id, auth_identity_provider, auth_identity_email_verified, auth_identity_is_active)
SELECT u.user_id, 'LOCAL', true, true
FROM sys.sys_users u
WHERE lower(u.user_email) = lower('chiara.spenuso@heuresys.com')
  AND NOT EXISTS (
    SELECT 1 FROM sys.sys_auth_identities i
     WHERE i.auth_identity_user_id = u.user_id AND i.auth_identity_provider = 'LOCAL'
  );

-- 4) Current ARGON2ID credential = the project-standard demo password (see CLAUDE.md
--    "Security model"; the same password every seeded persona uses — synthetic case-study
--    data, ADR-0023). The literal below is a one-way argon2id hash (params m=65536,t=3,p=4,
--    len=32; embedded salt makes it a stable/idempotent literal), NOT the password. HEURESYS
--    has mandatory-MFA enabled (S984) → first login still forces MFA enrollment; this only
--    seeds the first (password) factor.
INSERT INTO sys.sys_auth_credentials
  (auth_credential_identity_id, auth_credential_algorithm, auth_credential_hash,
   auth_credential_is_current, auth_credential_must_rotate)
SELECT i.auth_identity_id, 'ARGON2ID',
  '$argon2id$v=19$m=65536,t=3,p=4$dxIL7FV4a1i6VHnREGnW5Q$Xat9EV1FBUTWr8j5yw2KUg+kOtOst+TmAhvAr49HBSI',
  true, false
FROM sys.sys_auth_identities i
JOIN sys.sys_users u ON u.user_id = i.auth_identity_user_id
WHERE lower(u.user_email) = lower('chiara.spenuso@heuresys.com')
  AND i.auth_identity_provider = 'LOCAL'
  AND NOT EXISTS (
    SELECT 1 FROM sys.sys_auth_credentials c
     WHERE c.auth_credential_identity_id = i.auth_identity_id
       AND c.auth_credential_is_current = true
  );

-- Verification (informational; does not abort).
DO $$
DECLARE n_user int; n_role int; n_idt int; n_cred int;
BEGIN
  SELECT count(*) INTO n_user FROM sys.sys_users
    WHERE lower(user_email) = lower('chiara.spenuso@heuresys.com');
  SELECT count(*) INTO n_role FROM sys.sys_user_auth_roles ur
    JOIN sys.sys_users u ON u.user_id = ur.user_auth_role_user_id
    WHERE lower(u.user_email) = lower('chiara.spenuso@heuresys.com') AND ur.user_auth_role_revoked_at IS NULL;
  SELECT count(*) INTO n_idt FROM sys.sys_auth_identities i
    JOIN sys.sys_users u ON u.user_id = i.auth_identity_user_id
    WHERE lower(u.user_email) = lower('chiara.spenuso@heuresys.com');
  SELECT count(*) INTO n_cred FROM sys.sys_auth_credentials c
    JOIN sys.sys_auth_identities i ON i.auth_identity_id = c.auth_credential_identity_id
    JOIN sys.sys_users u ON u.user_id = i.auth_identity_user_id
    WHERE lower(u.user_email) = lower('chiara.spenuso@heuresys.com') AND c.auth_credential_is_current;
  RAISE NOTICE '000111 chiara import: users=% roles=% identities=% current_creds=% (expect 1 / >=1 / 1 / 1)',
    n_user, n_role, n_idt, n_cred;
END $$;
