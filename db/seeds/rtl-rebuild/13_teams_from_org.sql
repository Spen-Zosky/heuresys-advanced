-- 13_teams_from_org.sql — WS-4 R1b: derive sys_teams + sys_team_members from the REAL org
-- structure (sys_organization_units + position→OU membership) and grant TEAM_LEADER/TEAM_MEMBER
-- to the real users by their org role. NO fixtures, NO invention (matrix-complete, ADR-0024).
--
-- DERIVATION (deterministic, employee-centric):
--   1) One team per ACTIVE organization unit that HAS a manager (the lead). team_code = OU code,
--      team_name = OU name, team_organization_unit_id = OU, team_lead_user_id = OU manager,
--      tenant ALWAYS = the OU's tenant (I5 FK isolation).
--   2) Members:
--        - the OU manager → membership row role='LEAD'
--        - every user with an ACTIVE position in that OU → membership row role='MEMBER'
--          (the lead, if also a position-holder, stays 'LEAD' — ON CONFLICT keeps the first).
--   3) Role grants (auth-roles are ORTHOGONAL to org placement — locked decision 4):
--        - TEAM_LEADER → every distinct team lead, tenant = team tenant
--        - TEAM_MEMBER → every distinct 'MEMBER' (non-lead), tenant = team tenant
--
-- Run via psql AFTER migration 000054 (schema) and AFTER seeds 02/03/04 (OUs/positions/assignments).
-- IDEMPOTENT + ADDITIVE: ON CONFLICT DO NOTHING / WHERE NOT EXISTS. Second run = INSERT 0 0 =
-- empty pg_dump diff. Never DELETEs.

BEGIN;

-- 1. Teams (one per active OU with a manager). -------------------------------
INSERT INTO sys.sys_teams
  (team_tenant_id, team_code, team_name, team_organization_unit_id, team_lead_user_id, team_metadata)
SELECT ou.organization_unit_tenant_id,
       ou.organization_unit_code,
       ou.organization_unit_name,
       ou.organization_unit_id,
       ou.organization_unit_manager_user_id,
       jsonb_build_object('derived_from', 'organization_unit', 'ou_code', ou.organization_unit_code)
FROM sys.sys_organization_units ou
WHERE ou.organization_unit_is_active
  AND ou.organization_unit_manager_user_id IS NOT NULL
ON CONFLICT (team_tenant_id, team_code) DO NOTHING;

-- 2a. Lead membership row (role='LEAD'). ------------------------------------
INSERT INTO sys.sys_team_members (team_member_team_id, team_member_user_id, team_member_role)
SELECT t.team_id, t.team_lead_user_id, 'LEAD'
FROM sys.sys_teams t
WHERE t.team_lead_user_id IS NOT NULL
ON CONFLICT (team_member_team_id, team_member_user_id) DO NOTHING;

-- 2b. Member rows (role='MEMBER') = users with an ACTIVE position in the team's OU,
--     excluding the lead (already inserted as 'LEAD'). -----------------------
INSERT INTO sys.sys_team_members (team_member_team_id, team_member_user_id, team_member_role)
SELECT DISTINCT t.team_id, upa.user_position_assignment_user_id, 'MEMBER'
FROM sys.sys_teams t
JOIN sys.sys_positions p
  ON p.position_organization_unit_id = t.team_organization_unit_id
JOIN sys.sys_user_position_assignments upa
  ON upa.user_position_assignment_position_id = p.position_id
 AND upa.user_position_assignment_status = 'ACTIVE'
WHERE upa.user_position_assignment_user_id IS DISTINCT FROM t.team_lead_user_id
ON CONFLICT (team_member_team_id, team_member_user_id) DO NOTHING;

-- 3a. Grant TEAM_LEADER to every distinct team lead. ------------------------
INSERT INTO sys.sys_user_auth_roles
  (user_auth_role_user_id, user_auth_role_role_id, user_auth_role_tenant_id)
SELECT DISTINCT t.team_lead_user_id, r.auth_role_id, t.team_tenant_id
FROM sys.sys_teams t
JOIN sys.sys_auth_roles r ON r.auth_role_code = 'TEAM_LEADER'
WHERE t.team_lead_user_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM sys.sys_user_auth_roles ex
    WHERE ex.user_auth_role_user_id = t.team_lead_user_id
      AND ex.user_auth_role_role_id = r.auth_role_id
      AND COALESCE(ex.user_auth_role_tenant_id, '00000000-0000-0000-0000-000000000000'::uuid)
          = COALESCE(t.team_tenant_id, '00000000-0000-0000-0000-000000000000'::uuid)
      AND ex.user_auth_role_revoked_at IS NULL
  );

-- 3b. Grant TEAM_MEMBER to every distinct 'MEMBER' (non-lead). --------------
INSERT INTO sys.sys_user_auth_roles
  (user_auth_role_user_id, user_auth_role_role_id, user_auth_role_tenant_id)
SELECT DISTINCT tm.team_member_user_id, r.auth_role_id, t.team_tenant_id
FROM sys.sys_team_members tm
JOIN sys.sys_teams t ON t.team_id = tm.team_member_team_id
JOIN sys.sys_auth_roles r ON r.auth_role_code = 'TEAM_MEMBER'
WHERE tm.team_member_role = 'MEMBER'
  AND NOT EXISTS (
    SELECT 1 FROM sys.sys_user_auth_roles ex
    WHERE ex.user_auth_role_user_id = tm.team_member_user_id
      AND ex.user_auth_role_role_id = r.auth_role_id
      AND COALESCE(ex.user_auth_role_tenant_id, '00000000-0000-0000-0000-000000000000'::uuid)
          = COALESCE(t.team_tenant_id, '00000000-0000-0000-0000-000000000000'::uuid)
      AND ex.user_auth_role_revoked_at IS NULL
  );

-- 4. Verification (NOTICE only; fail loud if zero teams derived). -----------
DO $$
DECLARE teams int; members int; leads_granted int; members_granted int;
BEGIN
  SELECT count(*) INTO teams FROM sys.sys_teams;
  SELECT count(*) INTO members FROM sys.sys_team_members;
  SELECT count(DISTINCT ur.user_auth_role_user_id) INTO leads_granted
    FROM sys.sys_user_auth_roles ur JOIN sys.sys_auth_roles r ON r.auth_role_id=ur.user_auth_role_role_id
    WHERE r.auth_role_code='TEAM_LEADER' AND ur.user_auth_role_revoked_at IS NULL;
  SELECT count(DISTINCT ur.user_auth_role_user_id) INTO members_granted
    FROM sys.sys_user_auth_roles ur JOIN sys.sys_auth_roles r ON r.auth_role_id=ur.user_auth_role_role_id
    WHERE r.auth_role_code='TEAM_MEMBER' AND ur.user_auth_role_revoked_at IS NULL;
  IF teams = 0 THEN
    RAISE EXCEPTION 'R1b seed: 0 teams derived — OUs/positions not seeded?';
  END IF;
  RAISE NOTICE 'R1b seed: % teams, % memberships, % TEAM_LEADER holders, % TEAM_MEMBER holders',
    teams, members, leads_granted, members_granted;
END $$;

COMMIT;
