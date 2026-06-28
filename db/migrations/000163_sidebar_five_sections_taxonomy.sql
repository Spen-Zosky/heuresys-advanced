-- ============================================================================
-- 000163_sidebar_five_sections_taxonomy.sql
-- Sidebar IA redesign (Enzo S1009): the 3 PET perspectives (PROCESS/ENTERPRISE/
-- TALENT) are replaced by 5 collapsible SECTIONS — OVERVIEW (Panoramica),
-- GOVERNANCE, WORKFORCE (Forza lavoro), INTELLIGENCE, PERSONAL (Area personale).
-- The perspective selector is retired (the web layout drops it); sections are
-- always-visible collapsible groups whose open/closed state lives in localStorage.
--
-- 9 analytics pages are folded into 6 "merge" entries as in-page TABS (handled in
-- the frontend); here they leave the sidebar via is_active=false — their routes
-- stay live and reachable from the tab bar.
--
-- Idempotent: drop+readd the perspective CHECK, UPDATE-join from a temp remap
-- (re-run produces the same rows; empty pg_dump diff).
-- ============================================================================

ALTER TABLE sys.sys_ui_interfaces
  DROP CONSTRAINT IF EXISTS sys_ui_interfaces_perspective_check;

DROP TABLE IF EXISTS pg_temp.ui_remap;
CREATE TEMP TABLE ui_remap (route text, persp text, grp text, label text, ord int, active boolean);
INSERT INTO ui_remap (route, persp, grp, label, ord, active) VALUES
  -- Panoramica
  ('/dashboard',              'OVERVIEW',     'overview',     'Dashboard',                   0, true),
  ('/process-owner',          'OVERVIEW',     'overview',     'Console Process Owner',       1, true),
  ('/system-health',          'OVERVIEW',     'overview',     'System health',               2, true),
  ('/admin/mfa-policy',       'OVERVIEW',     'overview',     'Policy MFA',                  3, true),
  ('/brownfield-adaptation',  'OVERVIEW',     'overview',     'Brownfield',                  4, true),
  ('/seed-acquisition/runs',  'OVERVIEW',     'overview',     'Seed acquisition',            5, true),
  ('/approvals',              'OVERVIEW',     'overview',     'Approvazioni',                6, true),
  ('/org-director',           'OVERVIEW',     'overview',     'Console Org Director',        7, true),
  -- Governance
  ('/blueprints',             'GOVERNANCE',   'governance',   'Blueprint',                  10, true),
  ('/tenants',                'GOVERNANCE',   'governance',   'Tenant',                     11, true),
  ('/processes',              'GOVERNANCE',   'governance',   'Processi',                   12, true),
  ('/positions',              'GOVERNANCE',   'governance',   'Posizioni',                  13, true),
  ('/admin/roles',            'GOVERNANCE',   'governance',   'Ruoli',                      14, true),
  ('/skills',                 'GOVERNANCE',   'governance',   'Competenze',                 15, true),
  ('/learning',               'GOVERNANCE',   'governance',   'Formazione',                 16, true),
  ('/users',                  'GOVERNANCE',   'governance',   'Utenti',                     17, true),
  -- Forza lavoro (● = merge entry; absorbed pages become in-page tabs below)
  ('/analytics/workforce',    'WORKFORCE',    'workforce',    'Analisi Forza Lavoro',       20, true),
  ('/organization',           'WORKFORCE',    'workforce',    'Analisi Organizzativa',      21, true),
  ('/analytics/attendance',   'WORKFORCE',    'workforce',    'Analisi presenze',           22, true),
  ('/analytics/skills',       'WORKFORCE',    'workforce',    'Analisi Skill',              23, true),
  ('/analytics/compensation', 'WORKFORCE',    'workforce',    'Analisi retributiva',        24, true),
  ('/analytics/kpi',          'WORKFORCE',    'workforce',    'Analisi KPI',                25, true),
  ('/goals',                  'WORKFORCE',    'workforce',    'Analisi Obiettivi',          26, true),
  ('/okrs',                   'WORKFORCE',    'workforce',    'Analisi OKR',                27, true),
  ('/career-succession',      'WORKFORCE',    'workforce',    'Carriera & successione',     28, true),
  -- Intelligence
  ('/insights',               'INTELLIGENCE', 'intelligence', 'Insights (flight-risk)',     30, true),
  ('/visualizations',         'INTELLIGENCE', 'intelligence', 'Visualizzazioni',            31, true),
  ('/engagement',             'INTELLIGENCE', 'intelligence', 'Engagement & Sondaggi',      32, true),
  ('/content',                'INTELLIGENCE', 'intelligence', 'Contenuti',                  33, true),
  -- Area personale
  ('/me',                     'PERSONAL',     'personal',     'My HR',                      40, true),
  ('/me/skills',              'PERSONAL',     'personal',     'Le mie competenze',          41, true),
  ('/me/learning',            'PERSONAL',     'personal',     'Formazione',                 42, true),
  ('/me/career',              'PERSONAL',     'personal',     'Carriera',                   43, true),
  ('/me/inbox',               'PERSONAL',     'personal',     'Inbox',                      44, true),
  ('/me/team',                'PERSONAL',     'personal',     'Il mio team',                45, true),
  ('/me/matching',            'PERSONAL',     'personal',     'Occupazioni compatibili',    46, true),
  ('/me/handbook',            'PERSONAL',     'personal',     'Manuale del dipendente',     47, true),
  ('/me/surveys',             'PERSONAL',     'personal',     'I miei sondaggi',            48, true),
  -- Absorbed analytics pages → out of the sidebar (is_active=false), routes stay
  -- live and are reached via the in-page tab bar of their parent merge entry.
  ('/analytics/org-network',         'WORKFORCE', 'workforce', 'Rete organizzativa',          21, false),
  ('/analytics/overtime',            'WORKFORCE', 'workforce', 'Richieste di straordinario',  22, false),
  ('/analytics/skills-by-category',  'WORKFORCE', 'workforce', 'Competenze per categoria',    23, false),
  ('/analytics/skills-group-share',  'WORKFORCE', 'workforce', 'Quote competenze per gruppo', 23, false),
  ('/gaps',                          'WORKFORCE', 'workforce', 'Gap',                         23, false),
  ('/insights/skill-gap',            'WORKFORCE', 'workforce', 'Skill gap',                   23, false),
  ('/compensation-intelligence',     'WORKFORCE', 'workforce', 'Compensation',                24, false),
  ('/kpis',                          'WORKFORCE', 'workforce', 'KPI',                         25, false),
  ('/insights/succession-readiness', 'WORKFORCE', 'workforce', 'Succession readiness',        28, false);

UPDATE sys.sys_ui_interfaces t SET
  ui_interface_perspective   = r.persp,
  ui_interface_sidebar_group = r.grp,
  ui_interface_label         = r.label,
  ui_interface_order         = r.ord,
  ui_interface_is_active     = r.active
FROM ui_remap r
WHERE t.ui_interface_route = r.route;

ALTER TABLE sys.sys_ui_interfaces
  ADD CONSTRAINT sys_ui_interfaces_perspective_check
  CHECK (ui_interface_perspective::text = ANY (ARRAY[
    'OVERVIEW'::varchar, 'GOVERNANCE'::varchar, 'WORKFORCE'::varchar,
    'INTELLIGENCE'::varchar, 'PERSONAL'::varchar
  ]::text[]));
