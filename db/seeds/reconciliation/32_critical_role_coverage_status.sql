-- 32_critical_role_coverage_status.sql — F4 bucket-C. Coverage per critical position, counts aggregated
-- from sys.sys_readiness_scores (already imported) per readiness horizon. One row per sys_critical_positions.
-- IDEMPOTENT: anti-join (position).
BEGIN;
INSERT INTO sys.sys_critical_role_coverage_status (
  critical_role_coverage_status_tenant_id, critical_role_coverage_status_position_id,
  critical_role_coverage_ready_now_count, critical_role_coverage_ready_6mo_count,
  critical_role_coverage_ready_1y_count, critical_role_coverage_overall_score,
  critical_role_coverage_computed_at, critical_role_coverage_payload)
SELECT cp.critical_position_tenant_id, cp.critical_position_position_id,
  count(*) FILTER (WHERE rs.readiness_score_horizon='READY_NOW')::int,
  count(*) FILTER (WHERE rs.readiness_score_horizon='READY_6_MONTHS')::int,
  count(*) FILTER (WHERE rs.readiness_score_horizon='READY_1_YEAR')::int,
  round(avg(rs.readiness_score_value),2),
  now(), jsonb_build_object('derived','coverage rollup from readiness_scores')
FROM sys.sys_critical_positions cp
LEFT JOIN sys.sys_readiness_scores rs ON rs.readiness_score_position_id=cp.critical_position_position_id
WHERE NOT EXISTS (SELECT 1 FROM sys.sys_critical_role_coverage_status x
  WHERE x.critical_role_coverage_status_position_id=cp.critical_position_position_id)
GROUP BY cp.critical_position_tenant_id, cp.critical_position_position_id;
DO $$ DECLARE v int; BEGIN SELECT count(*) INTO v FROM sys.sys_critical_role_coverage_status;
  RAISE NOTICE 'critical_role_coverage_status: % rows', v; IF v=0 THEN RAISE EXCEPTION '0'; END IF; END $$;
COMMIT;
