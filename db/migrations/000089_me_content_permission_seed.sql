-- ============================================================================
-- 000089_me_content_permission_seed.sql — cap④ CMS P2: ESS read permission.
-- Deferred from 000087 ("me:content:read is P2 — NOT seeded here").
--
-- me:content:read lets any authenticated user read the PUBLISHED content of their
-- own tenant via GET /v1/me/content (ESS knowledge base, ADR-0011). The knowledge
-- base is for every employee, so it is granted to ALL roles (mirrors the me:* self
-- convention: resource='me', action='<sub>:read', cf. me:preferences in 000053).
-- A PLATFORM_ADMIN's null tenant simply yields a 403 at the route (they use the
-- admin /content surface instead) — the grant is harmless.
-- Idempotent (ON CONFLICT DO NOTHING). Authored: 2026-06-07 (cap④ CMS P2).
-- ============================================================================

INSERT INTO sys.sys_auth_permissions (auth_permission_code, auth_permission_name, auth_permission_resource, auth_permission_action)
VALUES ('me:content:read', 'Read published content (ESS)', 'me', 'content:read')
ON CONFLICT (auth_permission_code) DO NOTHING;

-- Grant to every role (the ESS knowledge base is universal within a tenant).
INSERT INTO sys.sys_auth_role_permissions (auth_role_id, auth_permission_id)
SELECT r.auth_role_id, p.auth_permission_id
FROM sys.sys_auth_roles r
CROSS JOIN sys.sys_auth_permissions p
WHERE p.auth_permission_code = 'me:content:read'
ON CONFLICT (auth_role_id, auth_permission_id) DO NOTHING;

DO $$
DECLARE v int; nr int;
BEGIN
  SELECT count(*) INTO nr FROM sys.sys_auth_roles;
  SELECT count(*) INTO v
    FROM sys.sys_auth_role_permissions rp
    JOIN sys.sys_auth_permissions p ON p.auth_permission_id = rp.auth_permission_id
   WHERE p.auth_permission_code = 'me:content:read';
  IF v <> nr THEN
    RAISE EXCEPTION '000089: expected % role grants for me:content:read, found %', nr, v;
  END IF;
  RAISE NOTICE '000089: me:content:read present + granted to all % roles.', nr;
END $$;
