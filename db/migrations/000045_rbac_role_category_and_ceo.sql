-- =============================================================================
-- 000045_rbac_role_category_and_ceo.sql
-- R1a — RBAC roles phase (split): adds auth_role_category + the CEO role.
--   * auth_role_category varchar(32) + CHECK ('hierarchical_operational' |
--     'functional')  — RD-08 (varchar+CHECK, never ENUM).
--   * Categorizes the 8 existing roles (6 functional / 2 hierarchical_operational).
--   * Adds CEO (hierarchical_operational): executive read-broad across the tenant
--     business domain; NO system administration, NO mutations, NO ESS self-scope.
-- Teams (sys_teams + TEAM_LEADER/TEAM_MEMBER) are deferred to R1b.
-- Per docs/kb/RBAC_UIX_PERSPECTIVES_PLAN.md phase R1. Idempotent.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. auth_role_category column + CHECK (nullable + NULL-tolerant CHECK for
--    forward-compat with future role inserts that backfill category separately)
-- -----------------------------------------------------------------------------
ALTER TABLE sys.sys_auth_roles
  ADD COLUMN IF NOT EXISTS auth_role_category varchar(32);

ALTER TABLE sys.sys_auth_roles
  DROP CONSTRAINT IF EXISTS sys_auth_roles_category_check;
ALTER TABLE sys.sys_auth_roles
  ADD CONSTRAINT sys_auth_roles_category_check
  CHECK (auth_role_category IS NULL
         OR auth_role_category IN ('hierarchical_operational', 'functional'));

-- -----------------------------------------------------------------------------
-- 2. Categorize the 8 existing roles
-- -----------------------------------------------------------------------------
UPDATE sys.sys_auth_roles SET auth_role_category = 'functional'
  WHERE auth_role_code IN
    ('PLATFORM_ADMIN', 'TENANT_ADMIN', 'BLUEPRINT_MANAGER', 'HRMS_MANAGER', 'PROCESS_OWNER', 'READ_ONLY');

UPDATE sys.sys_auth_roles SET auth_role_category = 'hierarchical_operational'
  WHERE auth_role_code IN ('MANAGER', 'USER');

-- -----------------------------------------------------------------------------
-- 3. CEO role (apex executive, hierarchical_operational)
-- -----------------------------------------------------------------------------
INSERT INTO sys.sys_auth_roles
  (auth_role_code, auth_role_name, auth_role_description, auth_role_is_platform, auth_role_category)
VALUES
  ('CEO', 'Chief Executive Officer',
   'Executive read-broad across the tenant business domain; no system administration.',
   false, 'hierarchical_operational')
ON CONFLICT (auth_role_code)
  DO UPDATE SET auth_role_category = EXCLUDED.auth_role_category;

-- -----------------------------------------------------------------------------
-- 4. CEO permission set — business read/list only.
--    NO mutations, NO admin/technical (seed_acquisition, brownfield, role:*write,
--    auth:revoke), NO ESS self-scope (CEO is not a self-service identity).
-- -----------------------------------------------------------------------------
INSERT INTO sys.sys_auth_role_permissions (auth_role_id, auth_permission_id)
SELECT r.auth_role_id, p.auth_permission_id
FROM sys.sys_auth_roles r
JOIN sys.sys_auth_permissions p
  ON p.auth_permission_code IN (
    'tenant:read',
    'user:list', 'user:read',
    'user_profile:read',
    'user_position_assignment:list', 'user_position_assignment:read',
    'enterprise_typing:read',
    'blueprint:read',
    'bpm_process:read',
    'organization_unit:list', 'organization_unit:read',
    'position:list', 'position:read',
    'job_role:read',
    'skill:read',
    'kpi:read',
    'learning:read', 'learning:browse_catalogue',
    'training_initiative:list', 'training_initiative:read',
    'assessment:read',
    'gap_analysis:read',
    'career_succession:read',
    'compensation_intelligence:read',
    'visualization:read',
    'role:read'
  )
WHERE r.auth_role_code = 'CEO'
ON CONFLICT DO NOTHING;
