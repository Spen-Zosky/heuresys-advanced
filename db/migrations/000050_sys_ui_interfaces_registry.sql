-- 000050_sys_ui_interfaces_registry.sql
-- U1 (S955, RBAC_UIX_PERSPECTIVES_PLAN locked decision 5+6): DB-driven sidebar registry.
-- Creates sys.sys_ui_interfaces (the source of truth U2's live sidebar will consume) and seeds
-- the 23 current nav interfaces, faithfully porting the hybrid gate from apps/web's
-- (authenticated)/layout.tsx (D4): admin-section items require an admin-class role AND the
-- per-item permission; ESS (Me) items are always visible to an authenticated user.
--
-- Perspective = PET top axis (PROCESS / ENTERPRISE / TALENT). Mapping by nav group:
--   Me + Workforce -> TALENT ; Operations -> PROCESS ; Intelligence + Governance + Overview -> ENTERPRISE.
-- Empty perspectives are NOT hidden (honest empty-state) — that is the GET service's job; here
-- we store all 3 perspectives' interfaces.
--
-- required_resource/required_action mirror the route's API requirePermission gate
-- (auth_permission_code = '<resource>:<action>'). NULL pair = no permission gate (ESS / overview).
-- requires_admin replicates layout ADMIN_ROLES gating (prevents the USER leak: a pure USER holds
-- position/skill/learning/blueprint/bpm_process/organization_unit/tenant/user/visualization :read
-- for ESS self-access, so per-permission gating ALONE would leak the admin nav).
--
-- IDEMPOTENT: CREATE TABLE IF NOT EXISTS + INSERT ... ON CONFLICT (code) DO NOTHING. 2nd run = no-op.

CREATE TABLE IF NOT EXISTS sys.sys_ui_interfaces (
  ui_interface_id                uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  ui_interface_code              varchar(64)   NOT NULL,
  ui_interface_label             varchar(128)  NOT NULL,
  ui_interface_route             varchar(255)  NOT NULL,
  ui_interface_icon              varchar(64),
  ui_interface_sidebar_group     varchar(64)   NOT NULL,
  ui_interface_perspective       varchar(16)   NOT NULL,
  ui_interface_required_resource varchar(64),
  ui_interface_required_action   varchar(64),
  ui_interface_requires_admin    boolean       NOT NULL DEFAULT false,
  ui_interface_order             integer       NOT NULL DEFAULT 0,
  ui_interface_is_active         boolean       NOT NULL DEFAULT true,
  created_at                     timestamptz   NOT NULL DEFAULT now(),
  updated_at                     timestamptz   NOT NULL DEFAULT now(),
  CONSTRAINT sys_ui_interfaces_code_uq UNIQUE (ui_interface_code),
  CONSTRAINT sys_ui_interfaces_perspective_check
    CHECK (ui_interface_perspective IN ('OVERVIEW','GOVERNANCE','WORKFORCE','INTELLIGENCE','PERSONAL')),
  CONSTRAINT sys_ui_interfaces_perm_pair_check
    CHECK ((ui_interface_required_resource IS NULL) = (ui_interface_required_action IS NULL))
);

CREATE INDEX IF NOT EXISTS sys_ui_interfaces_active_idx
  ON sys.sys_ui_interfaces (ui_interface_is_active, ui_interface_perspective, ui_interface_order);

CREATE OR REPLACE TRIGGER sys_ui_interfaces_set_updated_at
  BEFORE UPDATE ON sys.sys_ui_interfaces
  FOR EACH ROW EXECUTE FUNCTION sys.sys_set_updated_at();

-- Seed the 23 nav interfaces. (code, label, route, icon, group, perspective, resource, action, requires_admin, order)
INSERT INTO sys.sys_ui_interfaces
  (ui_interface_code, ui_interface_label, ui_interface_route, ui_interface_icon,
   ui_interface_sidebar_group, ui_interface_perspective,
   ui_interface_required_resource, ui_interface_required_action, ui_interface_requires_admin, ui_interface_order)
VALUES
  -- #164 F3 (S1049): la voce 'brownfield' -> /brownfield-adaptation E' STATA TOLTA DA QUI,
  -- non cancellata da una migrazione successiva. La catena si ri-applica a ogni deploy:
  -- una DELETE a valle sarebbe stata disfatta al giro dopo. Si ritira una riga emendando
  -- il file che la crea — stessa dottrina dell'emendamento alla 000062.
  -- Overview (admin reach, no dedicated permission)
  ('dashboard',         'Dashboard',               '/dashboard',                'LayoutDashboard', 'overview',     'OVERVIEW', NULL,                        NULL,    true,  0),
  -- ESS / Me (always visible to an authenticated user)
  ('me-home',           'My HR',                   '/me',                       'User',            'me',           'PERSONAL',     NULL,                        NULL,    false, 1),
  ('me-skills',         'Le mie competenze',       '/me/skills',                'Layers',          'me',           'PERSONAL',     NULL,                        NULL,    false, 2),
  ('me-learning',       'Formazione',              '/me/learning',              'GraduationCap',   'me',           'PERSONAL',     NULL,                        NULL,    false, 3),
  ('me-career',         'Carriera',                '/me/career',                'TrendingUp',      'me',           'PERSONAL',     NULL,                        NULL,    false, 4),
  ('me-inbox',          'Inbox',                   '/me/inbox',                 'Inbox',           'me',           'PERSONAL',     NULL,                        NULL,    false, 5),
  -- Workforce (TALENT)
  ('positions',         'Posizioni',               '/positions',                'Briefcase',       'workforce',    'GOVERNANCE',     'position',                  'read',  true,  10),
  ('skills',            'Competenze',              '/skills',                   'Layers',          'workforce',    'GOVERNANCE',     'skill',                     'read',  true,  11),
  ('gaps',              'Gap',                     '/gaps',                     'TriangleAlert',   'workforce',    'WORKFORCE',     'gap_analysis',              'read',  true,  12),
  ('career-succession', 'Carriera & successione',  '/career-succession',        'TrendingUp',      'workforce',    'WORKFORCE',     'career_succession',         'read',  true,  13),
  ('learning',          'Formazione',              '/learning',                 'GraduationCap',   'workforce',    'GOVERNANCE',     'learning',                  'read',  true,  14),
  -- Operations (PROCESS)
  ('blueprints',        'Blueprint',               '/blueprints',               'FileText',        'operations',   'GOVERNANCE',    'blueprint',                 'read',  true,  20),
  ('processes',         'Processi',                '/processes',                'GitBranch',       'operations',   'GOVERNANCE',    'bpm_process',               'read',  true,  21),
  ('seeds',             'Seed acquisition',        '/seed-acquisition/runs',    'Sprout',          'operations',   'OVERVIEW',    'seed_acquisition',          'read',  true,  23),
  -- Intelligence (ENTERPRISE)
  ('kpis',              'KPI',                     '/kpis',                     'Gauge',           'intelligence', 'WORKFORCE', 'kpi',                       'read',  true,  30),
  ('comp',              'Compensation',            '/compensation-intelligence','Coins',           'intelligence', 'WORKFORCE', 'compensation_intelligence', 'read',  true,  31),
  ('viz',               'Visualizzazioni',         '/visualizations',           'Network',         'intelligence', 'INTELLIGENCE', 'visualization',             'read',  true,  32),
  ('org',               'Organizzazione',          '/organization',             'Building2',       'intelligence', 'WORKFORCE', 'organization_unit',         'read',  true,  33),
  -- Governance (ENTERPRISE)
  ('tenants',           'Tenant',                  '/tenants',                  'Building2',       'governance',   'GOVERNANCE', 'tenant',                    'read',  true,  40),
  ('users',             'Utenti',                  '/users',                    'Users',           'governance',   'GOVERNANCE', 'user',                      'read',  true,  41),
  ('roles',             'Ruoli',                   '/admin/roles',              'ShieldCheck',     'governance',   'GOVERNANCE', 'role',                      'read',  true,  42),
  ('system-health',     'System health',           '/system-health',            'Activity',        'governance',   'OVERVIEW', 'tenant',                    'read',  true,  43)
ON CONFLICT (ui_interface_code) DO NOTHING;

-- Verification (NOTICE only).
DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM sys.sys_ui_interfaces;
  -- D-46 (S1011): rows now seeded directly with their 5-section perspective value.
  RAISE NOTICE 'U1: % interfaces in sys_ui_interfaces (this migration seeds 23 on a fresh chain)', n;
END $$;
