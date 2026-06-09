-- ============================================================================
-- 000101_me_sessions_permission_seed.sql — MVP-4 §2.5: ESS session management.
--
-- me:sessions:manage lets any authenticated user list AND revoke their OWN active
-- sessions (refresh-token families) via /v1/me/security/sessions (ADR-0011). For
-- one's own sessions viewing and revoking are inseparable, so a single permission
-- covers both — mirroring the admin path which reuses auth:revoke_user for the
-- equivalent admin surface. Granted to ALL roles (managing your own sessions is
-- universal, like me:content:read in 000089 / me:preferences in 000053).
-- No schema change: ip/user_agent + family timestamps already exist on
-- sys.sys_auth_refresh_tokens. No new reconciliation table.
-- Idempotent (ON CONFLICT DO NOTHING). Authored: 2026-06-09 (S980, MVP-4 §2.5).
-- ============================================================================

INSERT INTO sys.sys_auth_permissions (auth_permission_code, auth_permission_name, auth_permission_resource, auth_permission_action)
VALUES ('me:sessions:manage', 'List and revoke own sessions (ESS)', 'me', 'sessions:manage')
ON CONFLICT (auth_permission_code) DO NOTHING;

-- Grant to every role (self-session management is universal).
INSERT INTO sys.sys_auth_role_permissions (auth_role_id, auth_permission_id)
SELECT r.auth_role_id, p.auth_permission_id
FROM sys.sys_auth_roles r
CROSS JOIN sys.sys_auth_permissions p
WHERE p.auth_permission_code = 'me:sessions:manage'
ON CONFLICT (auth_role_id, auth_permission_id) DO NOTHING;

DO $$
DECLARE v int; nr int;
BEGIN
  SELECT count(*) INTO nr FROM sys.sys_auth_roles;
  SELECT count(*) INTO v
    FROM sys.sys_auth_role_permissions rp
    JOIN sys.sys_auth_permissions p ON p.auth_permission_id = rp.auth_permission_id
   WHERE p.auth_permission_code = 'me:sessions:manage';
  IF v <> nr THEN
    RAISE EXCEPTION '000101: expected % role grants for me:sessions:manage, found %', nr, v;
  END IF;
  RAISE NOTICE '000101: me:sessions:manage present + granted to all % roles.', nr;
END $$;
