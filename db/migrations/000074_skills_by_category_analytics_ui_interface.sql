-- 000074_skills_by_category_analytics_ui_interface.sql
-- BI analytics ①·#8b (skills coverage by CATEGORY): register the skills-by-category analytics
-- page in the DB-driven sidebar registry (sys.sys_ui_interfaces, U1/mig 000050). Same admin BI
-- cluster ('intelligence' group, ENTERPRISE perspective) and the same `analytics:view` gate the
-- route enforces (GET /v1/analytics/skills-by-category, permission seeded in 000057). Slots after
-- analytics-overtime(40) at order 41.
--
-- Distinct from analytics-skills (OU × proficiency heatmap): this re-pivots the SAME 902 skill
-- evidences on skill_category instead of organizational unit. The category link
-- (sys_skills.skill_category_id, wired S970) resolves on every evidence → dense heatmap.
--
-- Gating mirrors the route's requirePermission('analytics:view'):
--   required_resource='analytics', required_action='view'  (perm-pair CHECK satisfied)
--   requires_admin=true                                    (replicates the layout ADMIN_ROLES gate)
-- Icon 'Layers' is a key already present in the layout ICON_MAP (distinct from skills' GraduationCap).
--
-- IDEMPOTENT: INSERT ... ON CONFLICT (ui_interface_code) DO NOTHING. Second run = no-op.

INSERT INTO sys.sys_ui_interfaces
  (ui_interface_code, ui_interface_label, ui_interface_route, ui_interface_icon,
   ui_interface_sidebar_group, ui_interface_perspective,
   ui_interface_required_resource, ui_interface_required_action, ui_interface_requires_admin, ui_interface_order)
VALUES
  ('analytics-skills-by-category', 'Competenze per categoria', '/analytics/skills-by-category', 'Layers', 'intelligence', 'WORKFORCE', 'analytics', 'view', true, 41)
ON CONFLICT (ui_interface_code) DO NOTHING;

DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n
  FROM sys.sys_ui_interfaces
  WHERE ui_interface_code = 'analytics-skills-by-category';
  IF n <> 1 THEN
    RAISE EXCEPTION '①·#8b: expected 1 skills-by-category interface row, got %', n;
  END IF;
  RAISE NOTICE '①·#8b: skills-by-category sidebar interface registered (intelligence group, ENTERPRISE).';
END $$;
