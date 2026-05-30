-- db/seeds/rtl_positions_hierarchy.sql
-- Idempotent: derives a real reporting hierarchy for the RTL_BANK tenant by
-- setting sys_positions.position_reports_to_position_id from the organization-unit
-- tree. Three levels: (root unit lead) ← (each unit lead) ← (unit members).
-- Re-runnable (recomputes deterministically). Reverse with:
--   UPDATE sys.sys_positions SET position_reports_to_position_id = NULL
--    WHERE position_tenant_id = '<tenant>' AND position_is_active;
-- Feeds /organization/org-chart (rebuild with db/seeds/org_chart_rtl_demo.sql after).

DO $$
DECLARE
  v_tenant   uuid;
  v_root_pos uuid;
BEGIN
  SELECT user_tenant_id INTO v_tenant
    FROM sys.sys_users WHERE lower(user_email) = 'tenant_admin_test@rtl-bank.test' LIMIT 1;
  IF v_tenant IS NULL THEN RAISE NOTICE 'rtl_positions_hierarchy: tenant not found'; RETURN; END IF;

  -- One lead position per org-unit: highest criticality, then lowest id (stable).
  CREATE TEMP TABLE _unit_lead ON COMMIT DROP AS
    SELECT DISTINCT ON (position_organization_unit_id)
           position_organization_unit_id AS unit_id,
           position_id                    AS lead_id
      FROM sys.sys_positions
     WHERE position_tenant_id = v_tenant AND position_is_active
       AND position_organization_unit_id IS NOT NULL
     ORDER BY position_organization_unit_id,
              CASE position_criticality
                WHEN 'CRITICAL' THEN 3 WHEN 'HIGH' THEN 2 WHEN 'MEDIUM' THEN 1 ELSE 0 END DESC,
              position_id;

  -- Root = lead of the unit that has no parent.
  SELECT ul.lead_id INTO v_root_pos
    FROM _unit_lead ul
    JOIN sys.sys_organization_units ou ON ou.organization_unit_id = ul.unit_id
   WHERE ou.organization_unit_parent_id IS NULL
   LIMIT 1;

  -- 1) Non-lead members report to their own unit lead.
  UPDATE sys.sys_positions p
     SET position_reports_to_position_id = ul.lead_id, updated_at = now()
    FROM _unit_lead ul
   WHERE p.position_tenant_id = v_tenant AND p.position_is_active
     AND p.position_organization_unit_id = ul.unit_id
     AND p.position_id <> ul.lead_id;

  -- 2) Each unit lead reports to the lead of its parent unit.
  UPDATE sys.sys_positions p
     SET position_reports_to_position_id = parent_lead.lead_id, updated_at = now()
    FROM _unit_lead ul
    JOIN sys.sys_organization_units ou ON ou.organization_unit_id = ul.unit_id
    JOIN _unit_lead parent_lead ON parent_lead.unit_id = ou.organization_unit_parent_id
   WHERE p.position_id = ul.lead_id
     AND ou.organization_unit_parent_id IS NOT NULL;

  -- 3) The root unit lead is the top — reports to no one.
  UPDATE sys.sys_positions p
     SET position_reports_to_position_id = NULL, updated_at = now()
   WHERE p.position_id = v_root_pos;

  -- 4) Positions with no org-unit hang directly under the root.
  UPDATE sys.sys_positions p
     SET position_reports_to_position_id = v_root_pos, updated_at = now()
   WHERE p.position_tenant_id = v_tenant AND p.position_is_active
     AND p.position_organization_unit_id IS NULL
     AND p.position_id <> v_root_pos;

  RAISE NOTICE 'rtl_positions_hierarchy: root=% , % positions now have a manager',
    v_root_pos,
    (SELECT count(*) FROM sys.sys_positions
      WHERE position_tenant_id = v_tenant AND position_is_active
        AND position_reports_to_position_id IS NOT NULL);
END $$;
