-- 35_position_economic_weight.sql — F4 bucket-C. <- legacy job_evaluations (job_title->position, 24 positions).
-- value = total_points (Hay-style job evaluation points). job_title->sys_job_roles->sys_positions (1:N fan-out).
-- IDEMPOTENT: anti-join (position).
BEGIN;
INSERT INTO sys.sys_position_economic_weight (
  position_economic_weight_position_id, position_economic_weight_tenant_id,
  position_economic_weight_value, position_economic_weight_metadata)
SELECT DISTINCT ON (p.position_id) p.position_id, p.position_tenant_id,
  least(9999.9999, s.total_points)::numeric(8,4),
  jsonb_build_object('legacy', jsonb_build_object('source_table','job_evaluations','job_title',s.job_title,'total_points',s.total_points))
FROM staging.tmp_f4_pew s
JOIN sys.sys_job_roles jr ON lower(jr.job_role_name)=lower(s.job_title)
JOIN sys.sys_positions p ON p.position_job_role_id=jr.job_role_id
WHERE s.total_points IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM sys.sys_position_economic_weight x WHERE x.position_economic_weight_position_id=p.position_id)
ORDER BY p.position_id, s.total_points DESC;
DO $$ DECLARE v int; BEGIN SELECT count(*) INTO v FROM sys.sys_position_economic_weight;
  RAISE NOTICE 'position_economic_weight: % rows', v; IF v=0 THEN RAISE EXCEPTION '0'; END IF; END $$;
COMMIT;
