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
    CHECK (ui_interface_perspective IN ('PROCESS','ENTERPRISE','TALENT')),
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
  -- Overview (admin reach, no dedicated permission)
  ('dashboard',         'Dashboard',               '/dashboard',                'LayoutDashboard', 'overview',     'ENTERPRISE', NULL,                        NULL,    true,  0),
  -- ESS / Me (always visible to an authenticated user)
  ('me-home',           'My HR',                   '/me',                       'User',            'me',           'TALENT',     NULL,                        NULL,    false, 1),
  ('me-skills',         'Le mie competenze',       '/me/skills',                'Layers',          'me',           'TALENT',     NULL,                        NULL,    false, 2),
  ('me-learning',       'Formazione',              '/me/learning',              'GraduationCap',   'me',           'TALENT',     NULL,                        NULL,    false, 3),
  ('me-career',         'Carriera',                '/me/career',                'TrendingUp',      'me',           'TALENT',     NULL,                        NULL,    false, 4),
  ('me-inbox',          'Inbox',                   '/me/inbox',                 'Inbox',           'me',           'TALENT',     NULL,                        NULL,    false, 5),
  -- Workforce (TALENT)
  ('positions',         'Posizioni',               '/positions',                'Briefcase',       'workforce',    'TALENT',     'position',                  'read',  true,  10),
  ('skills',            'Competenze',              '/skills',                   'Layers',          'workforce',    'TALENT',     'skill',                     'read',  true,  11),
  ('gaps',              'Gap',                     '/gaps',                     'TriangleAlert',   'workforce',    'TALENT',     'gap_analysis',              'read',  true,  12),
  ('career-succession', 'Carriera & successione',  '/career-succession',        'TrendingUp',      'workforce',    'TALENT',     'career_succession',         'read',  true,  13),
  ('learning',          'Formazione',              '/learning',                 'GraduationCap',   'workforce',    'TALENT',     'learning',                  'read',  true,  14),
  -- Operations (PROCESS)
  ('blueprints',        'Blueprint',               '/blueprints',               'FileText',        'operations',   'PROCESS',    'blueprint',                 'read',  true,  20),
  ('processes',         'Processi',                '/processes',                'GitBranch',       'operations',   'PROCESS',    'bpm_process',               'read',  true,  21),
  ('brownfield',        'Brownfield',              '/brownfield-adaptation',    'Database',        'operations',   'PROCESS',    'brownfield_adaptation',     'read',  true,  22),
  ('seeds',             'Seed acquisition',        '/seed-acquisition/runs',    'Sprout',          'operations',   'PROCESS',    'seed_acquisition',          'read',  true,  23),
  -- Intelligence (ENTERPRISE)
  ('kpis',              'KPI',                     '/kpis',                     'Gauge',           'intelligence', 'ENTERPRISE', 'kpi',                       'read',  true,  30),
  ('comp',              'Compensation',            '/compensation-intelligence','Coins',           'intelligence', 'ENTERPRISE', 'compensation_intelligence', 'read',  true,  31),
  ('viz',               'Visualizzazioni',         '/visualizations',           'Network',         'intelligence', 'ENTERPRISE', 'visualization',             'read',  true,  32),
  ('org',               'Organizzazione',          '/organization',             'Building2',       'intelligence', 'ENTERPRISE', 'organization_unit',         'read',  true,  33),
  -- Governance (ENTERPRISE)
  ('tenants',           'Tenant',                  '/tenants',                  'Building2',       'governance',   'ENTERPRISE', 'tenant',                    'read',  true,  40),
  ('users',             'Utenti',                  '/users',                    'Users',           'governance',   'ENTERPRISE', 'user',                      'read',  true,  41),
  ('roles',             'Ruoli',                   '/admin/roles',              'ShieldCheck',     'governance',   'ENTERPRISE', 'role',                      'read',  true,  42),
  ('system-health',     'System health',           '/system-health',            'Activity',        'governance',   'ENTERPRISE', 'tenant',                    'read',  true,  43)
ON CONFLICT (ui_interface_code) DO NOTHING;

-- Verification (NOTICE only).
DO $$
DECLARE n int; p int; e int; t int;
BEGIN
  SELECT count(*) INTO n FROM sys.sys_ui_interfaces;
  SELECT count(*) FILTER (WHERE ui_interface_perspective='PROCESS')    INTO p FROM sys.sys_ui_interfaces;
  SELECT count(*) FILTER (WHERE ui_interface_perspective='ENTERPRISE') INTO e FROM sys.sys_ui_interfaces;
  SELECT count(*) FILTER (WHERE ui_interface_perspective='TALENT')     INTO t FROM sys.sys_ui_interfaces;
  RAISE NOTICE 'U1: % interfaces (PROCESS=%, ENTERPRISE=%, TALENT=%) — expect 23 (4/9/10)', n, p, e, t;
END $$;
