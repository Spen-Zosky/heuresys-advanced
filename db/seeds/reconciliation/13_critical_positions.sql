-- db/seeds/reconciliation/13_critical_positions.sql
-- F3 PARTIAL import: sys.sys_critical_positions from legacy public.critical_roles (8/16 resolve).
-- Bridge: critical_roles.current_incumbent_id -> sys_positions via position_metadata->>'legacy_employee_id'
--   (8 incumbents resolve to an RTL sys_position; 8 skip = null/out-of-scope incumbents).
-- Staging: staging.tmp_f3c_cr (id, role_name, current_incumbent_id, criticality_level, succession_status).
-- IDEMPOTENT: anti-join on position_id (one critical flag per position).
BEGIN;
INSERT INTO sys.sys_critical_positions (
  critical_position_tenant_id, critical_position_position_id, critical_position_flagged_at, critical_position_metadata)
SELECT DISTINCT ON (p.position_id) p.position_tenant_id, p.position_id, now(),
  jsonb_build_object('legacy', jsonb_strip_nulls(jsonb_build_object(
    'source_table', 'critical_roles', 'source_id', s.id, 'role_name', s.role_name,
    'criticality_level', s.criticality_level, 'succession_status', s.succession_status)))
FROM staging.tmp_f3c_cr s
JOIN sys.sys_positions p ON p.position_metadata->>'legacy_employee_id' = s.current_incumbent_id::text
WHERE NOT EXISTS (SELECT 1 FROM sys.sys_critical_positions c WHERE c.critical_position_position_id = p.position_id)
ORDER BY p.position_id, s.id;
DO $$ DECLARE v int; BEGIN SELECT count(*) INTO v FROM sys.sys_critical_positions;
  RAISE NOTICE 'critical_positions: % rows', v; IF v=0 THEN RAISE EXCEPTION 'critical_positions: 0 imported'; END IF; END $$;
COMMIT;
