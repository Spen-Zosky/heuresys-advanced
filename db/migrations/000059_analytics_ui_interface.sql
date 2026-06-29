-- 000059_analytics_ui_interface.sql
-- BI analytics P1b: register the two BI analytics pages in the DB-driven sidebar registry
-- (sys.sys_ui_interfaces, U1/mig 000050). Both are admin BI surfaces gated by the same
-- `analytics:view` permission the routes enforce (GET /v1/analytics/workforce + /v1/analytics/kpi,
-- permission seeded in 000057). ENTERPRISE perspective, 'intelligence' sidebar group — the same
-- cluster as kpis(30)/comp(31)/viz(32)/org(33); these slot after at orders 34/35.
--
-- The registry is FLAT (no parent/child nesting — items are grouped only by sidebar_group), so we
-- register ONLY the two leaf pages that have a real page.tsx. We deliberately do NOT add a bare
-- '/analytics' parent row: there is no /analytics index page, so such a row would render a 404 link.
--
-- Gating mirrors the route's requirePermission('analytics:view'):
--   required_resource='analytics', required_action='view'  (both set — perm-pair CHECK satisfied)
--   requires_admin=true                                    (replicates the layout ADMIN_ROLES gate)
-- Icons must be keys already in the layout ICON_MAP: 'TrendingUp' and 'Gauge' are both mapped.
--
-- IDEMPOTENT: INSERT ... ON CONFLICT (ui_interface_code) DO NOTHING. Second run = no-op.

INSERT INTO sys.sys_ui_interfaces
  (ui_interface_code, ui_interface_label, ui_interface_route, ui_interface_icon,
   ui_interface_sidebar_group, ui_interface_perspective,
   ui_interface_required_resource, ui_interface_required_action, ui_interface_requires_admin, ui_interface_order)
VALUES
  ('analytics-workforce', 'Analisi forza lavoro', '/analytics/workforce', 'TrendingUp', 'intelligence', 'WORKFORCE', 'analytics', 'view', true, 34),
  ('analytics-kpi',       'Analisi KPI',          '/analytics/kpi',       'Gauge',      'intelligence', 'WORKFORCE', 'analytics', 'view', true, 35)
ON CONFLICT (ui_interface_code) DO NOTHING;

DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n
  FROM sys.sys_ui_interfaces
  WHERE ui_interface_code IN ('analytics-workforce', 'analytics-kpi');
  IF n <> 2 THEN
    RAISE EXCEPTION 'P1b: expected 2 analytics interface rows, got %', n;
  END IF;
  RAISE NOTICE 'P1b: % analytics sidebar interfaces registered (intelligence group, ENTERPRISE).', n;
END $$;
