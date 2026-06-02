-- 000054_r1b_teams_and_roles.sql
-- WS-4 R1b (RBAC_UIX_PERSPECTIVES_PLAN §"TEAMS note" + locked decision 4): the team entity
-- implied by TEAM_LEADER/TEAM_MEMBER, plus the 3rd RBAC scope axis ("my team") in the service
-- layer. This migration ships ONLY the SCHEMA (tables + roles + permissions + role→permission
-- mappings). The TEAM DATA is derived from the REAL org structure (sys_organization_units +
-- position→OU membership) by the idempotent seed db/seeds/rtl-rebuild/13_teams_from_org.sql —
-- NO fixtures, NO invention (matrix-complete, employee-centric, ADR-0024).
--
-- DOCTRINE:
--   * I3/I4 schema discipline: business tables in sys.sys_<plural>, prefixed columns.
--   * I5 tenant isolation = FK + API middleware filter, NEVER RLS.
--   * RD-08 categorical fields = varchar(N) + CHECK, never PostgreSQL ENUM.
--   * Auth-roles are a FUNCTIONAL grant layer (sys_user_auth_roles) ORTHOGONAL to org placement
--     (locked decision 4): granting TEAM_LEADER/TEAM_MEMBER does not change org structure.
--   * The "my team" 3rd scope axis (beyond tenant / self / reports-of-mine) is enforced in the
--     teams service: admin-class roles see all teams in tenant; a TEAM_LEADER/TEAM_MEMBER sees
--     only teams they lead or belong to.
--
-- IDEMPOTENT: CREATE TABLE IF NOT EXISTS + guarded trigger + INSERT ... ON CONFLICT DO NOTHING /
-- DO UPDATE. Second run = empty pg_dump diff. Applied by migrate.sh under `psql -1 -f`.

-- =============================================================================
-- 1. sys.sys_teams — a team, derived from a real organization unit.
--    team_organization_unit_id is the org anchor; team_lead_user_id is the
--    OU manager (the team lead). Both nullable FKs (ON DELETE SET NULL) so a
--    dissolved OU / departed lead doesn't cascade-delete the team record.
-- =============================================================================
CREATE TABLE IF NOT EXISTS sys.sys_teams (
  team_id                   uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  team_tenant_id            uuid          NOT NULL REFERENCES sys.sys_tenancies(tenant_id) ON DELETE RESTRICT,
  team_code                 varchar(64)   NOT NULL,
  team_name                 varchar(128)  NOT NULL,
  team_organization_unit_id uuid          REFERENCES sys.sys_organization_units(organization_unit_id) ON DELETE SET NULL,
  team_lead_user_id         uuid          REFERENCES sys.sys_users(user_id) ON DELETE SET NULL,
  team_is_active            boolean       NOT NULL DEFAULT true,
  team_metadata             jsonb         NOT NULL DEFAULT '{}'::jsonb,
  created_at                timestamptz   NOT NULL DEFAULT now(),
  created_by                uuid          REFERENCES sys.sys_users(user_id) ON DELETE SET NULL,
  updated_at                timestamptz   NOT NULL DEFAULT now(),
  updated_by                uuid          REFERENCES sys.sys_users(user_id) ON DELETE SET NULL,
  CONSTRAINT sys_teams_code_uq UNIQUE (team_tenant_id, team_code)
);

CREATE INDEX IF NOT EXISTS sys_teams_tenant_idx
  ON sys.sys_teams (team_tenant_id, team_is_active);
CREATE INDEX IF NOT EXISTS sys_teams_lead_idx
  ON sys.sys_teams (team_lead_user_id);
CREATE INDEX IF NOT EXISTS sys_teams_ou_idx
  ON sys.sys_teams (team_organization_unit_id);

DO $trg$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'sys_teams_set_updated_at' AND tgrelid = 'sys.sys_teams'::regclass) THEN
    CREATE TRIGGER sys_teams_set_updated_at BEFORE UPDATE ON sys.sys_teams FOR EACH ROW EXECUTE FUNCTION sys.sys_set_updated_at();
  END IF;
END $trg$;

-- =============================================================================
-- 2. sys.sys_team_members — user↔team membership. team_member_role distinguishes
--    the lead from members (RD-08 varchar+CHECK). One membership row per (team,user).
-- =============================================================================
CREATE TABLE IF NOT EXISTS sys.sys_team_members (
  team_member_id        uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  team_member_team_id   uuid          NOT NULL REFERENCES sys.sys_teams(team_id) ON DELETE CASCADE,
  team_member_user_id   uuid          NOT NULL REFERENCES sys.sys_users(user_id) ON DELETE CASCADE,
  team_member_role      varchar(16)   NOT NULL DEFAULT 'MEMBER',
  team_member_is_active boolean       NOT NULL DEFAULT true,
  created_at            timestamptz   NOT NULL DEFAULT now(),
  created_by            uuid          REFERENCES sys.sys_users(user_id) ON DELETE SET NULL,
  updated_at            timestamptz   NOT NULL DEFAULT now(),
  updated_by            uuid          REFERENCES sys.sys_users(user_id) ON DELETE SET NULL,
  CONSTRAINT sys_team_members_member_uq UNIQUE (team_member_team_id, team_member_user_id)
);

ALTER TABLE sys.sys_team_members
  DROP CONSTRAINT IF EXISTS sys_team_members_role_check;
ALTER TABLE sys.sys_team_members
  ADD CONSTRAINT sys_team_members_role_check
  CHECK (team_member_role IN ('LEAD', 'MEMBER'));

CREATE INDEX IF NOT EXISTS sys_team_members_team_idx
  ON sys.sys_team_members (team_member_team_id, team_member_is_active);
CREATE INDEX IF NOT EXISTS sys_team_members_user_idx
  ON sys.sys_team_members (team_member_user_id, team_member_is_active);

DO $trg$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'sys_team_members_set_updated_at' AND tgrelid = 'sys.sys_team_members'::regclass) THEN
    CREATE TRIGGER sys_team_members_set_updated_at BEFORE UPDATE ON sys.sys_team_members FOR EACH ROW EXECUTE FUNCTION sys.sys_set_updated_at();
  END IF;
END $trg$;

-- =============================================================================
-- 3. TEAM_LEADER + TEAM_MEMBER auth-roles (hierarchical_operational — they are
--    org-structure-derived operational roles, like MANAGER/USER, not functional).
-- =============================================================================
INSERT INTO sys.sys_auth_roles
  (auth_role_code, auth_role_name, auth_role_description, auth_role_is_platform, auth_role_category)
VALUES
  ('TEAM_LEADER', 'Team Leader',
   'Leads a specific team (derived from an org unit); reads their own team + its members.',
   false, 'hierarchical_operational'),
  ('TEAM_MEMBER', 'Team Member',
   'Belongs to a specific team; reads their own team.',
   false, 'hierarchical_operational')
ON CONFLICT (auth_role_code)
  DO UPDATE SET auth_role_category = EXCLUDED.auth_role_category,
                auth_role_description = EXCLUDED.auth_role_description;

-- =============================================================================
-- 4. team:* permissions.
--    team:list / team:read = collection + single read (scope enforced in service).
--    team:read:self        = ESS self view ("my team", /v1/me/team) — granted to ALL roles.
-- =============================================================================
INSERT INTO sys.sys_auth_permissions (auth_permission_code, auth_permission_name, auth_permission_resource, auth_permission_action)
VALUES
  ('team:list',      'List teams (scope-filtered)', 'team', 'list'),
  ('team:read',      'Read a team + its members',   'team', 'read'),
  ('team:read:self', 'Read own team(s) (ESS)',      'team', 'read:self')
ON CONFLICT (auth_permission_code) DO NOTHING;

-- 4a. team:list + team:read → admin/hierarchical roles that legitimately browse org teams,
--     plus TEAM_LEADER (the service narrows TEAM_LEADER to its own teams = the 3rd scope axis).
INSERT INTO sys.sys_auth_role_permissions (auth_role_id, auth_permission_id)
SELECT r.auth_role_id, p.auth_permission_id
FROM sys.sys_auth_roles r
JOIN sys.sys_auth_permissions p
  ON p.auth_permission_code IN ('team:list', 'team:read')
WHERE r.auth_role_code IN
  ('PLATFORM_ADMIN', 'TENANT_ADMIN', 'MANAGER', 'CEO', 'HRMS_MANAGER', 'TEAM_LEADER')
ON CONFLICT (auth_role_id, auth_permission_id) DO NOTHING;

-- 4b. team:read:self → every role (each authenticated user can see its own team via /v1/me/team).
INSERT INTO sys.sys_auth_role_permissions (auth_role_id, auth_permission_id)
SELECT r.auth_role_id, p.auth_permission_id
FROM sys.sys_auth_roles r
CROSS JOIN sys.sys_auth_permissions p
WHERE p.auth_permission_code = 'team:read:self'
ON CONFLICT (auth_role_id, auth_permission_id) DO NOTHING;

-- =============================================================================
-- 5. Verification (fail loud if roles/perms didn't land; NOTICE on grants).
-- =============================================================================
DO $$
DECLARE roles_added int; perms_added int; list_grants int; self_grants int; total_roles int;
BEGIN
  SELECT count(*) INTO roles_added FROM sys.sys_auth_roles
   WHERE auth_role_code IN ('TEAM_LEADER', 'TEAM_MEMBER');
  IF roles_added <> 2 THEN
    RAISE EXCEPTION 'R1b: expected 2 team roles, got %', roles_added;
  END IF;

  SELECT count(*) INTO perms_added FROM sys.sys_auth_permissions
   WHERE auth_permission_code IN ('team:list', 'team:read', 'team:read:self');
  IF perms_added <> 3 THEN
    RAISE EXCEPTION 'R1b: expected 3 team perms, got %', perms_added;
  END IF;

  SELECT count(DISTINCT auth_role_id) INTO total_roles FROM sys.sys_auth_roles;
  SELECT count(*) INTO list_grants
    FROM sys.sys_auth_role_permissions rp
    JOIN sys.sys_auth_permissions p ON p.auth_permission_id = rp.auth_permission_id
   WHERE p.auth_permission_code IN ('team:list', 'team:read');
  SELECT count(*) INTO self_grants
    FROM sys.sys_auth_role_permissions rp
    JOIN sys.sys_auth_permissions p ON p.auth_permission_id = rp.auth_permission_id
   WHERE p.auth_permission_code = 'team:read:self';

  RAISE NOTICE 'R1b: 2 roles, 3 perms, % list/read grants (expect 12 = 6 roles x 2), % read:self grants (expect %, all roles)',
    list_grants, self_grants, total_roles;
END $$;
