-- 000125_skills_group_share_analytics_ui_interface.sql
-- BI analytics (T3.8 chart + T2.6 clustering): register the skills-group-share analytics
-- page in the DB-driven sidebar registry (sys.sys_ui_interfaces, U1/mig 000050). Same admin BI
-- cluster ('intelligence' group, ENTERPRISE perspective) and the same `analytics:view` gate the
-- route enforces (GET /v1/analytics/skills-group-share, permission seeded in 000057). Slots after
-- analytics-skills-by-category(41) at order 42.
--
-- Surfaces the ESCO skill GROUP distribution: the ~400 ESCO skill groups
-- (sys_skills.skill_metadata->>'skill_group_uri', backfilled live S990 — 12892/21939
-- skills) ARE the natural skill clusters; the page shows each group's share of the
-- catalogue. Catalogue-global (ESCO skills are platform-global, tenantId=null).
--
-- Gating mirrors the route's requirePermission('analytics:view'):
--   required_resource='analytics', required_action='view'  (perm-pair CHECK satisfied)
--   requires_admin=true                                    (replicates the layout ADMIN_ROLES gate)
-- Icon 'PieChart' added to the layout ICON_MAP in the same change (distinct from Layers/Network).
--
-- IDEMPOTENT: INSERT ... ON CONFLICT (ui_interface_code) DO NOTHING. Second run = no-op.

INSERT INTO sys.sys_ui_interfaces
  (ui_interface_code, ui_interface_label, ui_interface_route, ui_interface_icon,
   ui_interface_sidebar_group, ui_interface_perspective,
   ui_interface_required_resource, ui_interface_required_action, ui_interface_requires_admin, ui_interface_order)
VALUES
  ('analytics-skills-group-share', 'Quote competenze per gruppo', '/analytics/skills-group-share', 'PieChart', 'intelligence', 'ENTERPRISE', 'analytics', 'view', true, 42)
ON CONFLICT (ui_interface_code) DO NOTHING;

DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n
  FROM sys.sys_ui_interfaces
  WHERE ui_interface_code = 'analytics-skills-group-share';
  IF n <> 1 THEN
    RAISE EXCEPTION 'T3.8: expected 1 skills-group-share interface row, got %', n;
  END IF;
  RAISE NOTICE 'T3.8: skills-group-share sidebar interface registered (intelligence group, ENTERPRISE).';
END $$;
