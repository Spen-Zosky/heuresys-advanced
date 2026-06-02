-- 000053_sys_user_preferences.sql
-- WS-4 P1 (RBAC_UIX_PERSPECTIVES_PLAN locked decision 3c): per-user theme + palette
-- preference, SERVER = source of truth (localStorage is a client cache, re-applied every
-- session incl. new device). One 1:1 satellite row per user.
--
-- Mirrors the sys_user_* satellite DDL convention (000006): column prefix user_preference_*,
-- tenant FK -> sys.sys_tenancies(tenant_id) ON DELETE RESTRICT (NOT a non-existent sys_tenants),
-- user FK -> sys.sys_users(user_id) ON DELETE CASCADE (here also UNIQUE: 1 prefs row per user),
-- full audit cols + guarded updated_at trigger.
--
-- RD-08: categorical fields = varchar(N) + CHECK, NEVER PostgreSQL ENUM.
--   - theme   : 'dark' | 'light'  (default 'dark' — the post-S924 brand default)
--   - palette : 4 stable slugs that map 1:1 to @heuresys/ui PALETTES indices (PaletteIdx 0|1|2|3):
--                 balanced=0 (Default · balanced, the real default), cool-ocean=1 (Cool ocean),
--                 warm-sunset=2 (Warm sunset), brand-mono=3 (Brand mono).
--               The set is small + stable (the lib pins exactly 4) so a CHECK is correct here —
--               the frontend maps slug<->idx for applyPalette(). Default 'balanced' = PALETTES[0].
--
-- Also seeds the 2 ESS self permissions (me:preferences:read / me:preferences:update) and grants
-- them to ALL 9 roles (every authenticated user manages their own UI prefs). Grant pattern mirrors
-- 000028 (CROSS JOIN over roles + ON CONFLICT DO NOTHING) but with no role filter (all roles).
--
-- IDEMPOTENT: CREATE TABLE IF NOT EXISTS + guarded trigger + INSERT ... ON CONFLICT DO NOTHING.
-- Second run = empty pg_dump diff. Applied by migrate.sh under `psql -1 -f`.

CREATE TABLE IF NOT EXISTS sys.sys_user_preferences (
  user_preference_id         uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_preference_user_id    uuid         NOT NULL REFERENCES sys.sys_users(user_id) ON DELETE CASCADE,
  user_preference_tenant_id  uuid         REFERENCES sys.sys_tenancies(tenant_id) ON DELETE RESTRICT,
  user_preference_theme      varchar(16)  NOT NULL DEFAULT 'dark',
  user_preference_palette    varchar(64)  NOT NULL DEFAULT 'balanced',
  created_at                 timestamptz  NOT NULL DEFAULT now(),
  created_by                 uuid         REFERENCES sys.sys_users(user_id) ON DELETE SET NULL,
  updated_at                 timestamptz  NOT NULL DEFAULT now(),
  updated_by                 uuid         REFERENCES sys.sys_users(user_id) ON DELETE SET NULL,
  CONSTRAINT sys_user_preferences_user_uq UNIQUE (user_preference_user_id)
);

-- RD-08 CHECK constraints (drop+add guarded so re-run / value-set evolution is safe).
ALTER TABLE sys.sys_user_preferences
  DROP CONSTRAINT IF EXISTS sys_user_preferences_theme_check;
ALTER TABLE sys.sys_user_preferences
  ADD CONSTRAINT sys_user_preferences_theme_check
  CHECK (user_preference_theme IN ('dark', 'light'));

ALTER TABLE sys.sys_user_preferences
  DROP CONSTRAINT IF EXISTS sys_user_preferences_palette_check;
ALTER TABLE sys.sys_user_preferences
  ADD CONSTRAINT sys_user_preferences_palette_check
  CHECK (user_preference_palette IN ('balanced', 'cool-ocean', 'warm-sunset', 'brand-mono'));

CREATE INDEX IF NOT EXISTS sys_user_preferences_tenant_idx
  ON sys.sys_user_preferences (user_preference_tenant_id);

DO $trg$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'sys_user_preferences_set_updated_at' AND tgrelid = 'sys.sys_user_preferences'::regclass) THEN
    CREATE TRIGGER sys_user_preferences_set_updated_at BEFORE UPDATE ON sys.sys_user_preferences FOR EACH ROW EXECUTE FUNCTION sys.sys_set_updated_at();
  END IF;
END $trg$;

-- -----------------------------------------------------------------------------
-- ESS self permissions for the preferences endpoints + grant to ALL 9 roles.
-- -----------------------------------------------------------------------------
INSERT INTO sys.sys_auth_permissions (auth_permission_code, auth_permission_name, auth_permission_resource, auth_permission_action)
VALUES
  ('me:preferences:read',   'Read own UI preferences (ESS)',   'me', 'preferences:read'),
  ('me:preferences:update', 'Update own UI preferences (ESS)', 'me', 'preferences:update')
ON CONFLICT (auth_permission_code) DO NOTHING;

-- Grant both to every role (each authenticated user manages its own theme/palette).
INSERT INTO sys.sys_auth_role_permissions (auth_role_id, auth_permission_id)
SELECT r.auth_role_id, p.auth_permission_id
FROM sys.sys_auth_roles r
CROSS JOIN sys.sys_auth_permissions p
WHERE p.auth_permission_code IN ('me:preferences:read', 'me:preferences:update')
ON CONFLICT (auth_role_id, auth_permission_id) DO NOTHING;

-- Verification (NOTICE only).
DO $$
DECLARE perms int; grants int; roles int;
BEGIN
  SELECT count(*) INTO perms FROM sys.sys_auth_permissions
   WHERE auth_permission_code IN ('me:preferences:read', 'me:preferences:update');
  SELECT count(DISTINCT auth_role_id) INTO roles FROM sys.sys_auth_roles;
  SELECT count(*) INTO grants
    FROM sys.sys_auth_role_permissions rp
    JOIN sys.sys_auth_permissions p ON p.auth_permission_id = rp.auth_permission_id
   WHERE p.auth_permission_code IN ('me:preferences:read', 'me:preferences:update');
  RAISE NOTICE 'WS-4 P1: % preference perms, % grants across % roles (expect 2 perms, 2*roles grants)', perms, grants, roles;
END $$;
