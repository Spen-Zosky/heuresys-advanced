-- 33_gap_closure_plans.sql — F4 bucket-C. <- legacy skill_development_paths (36 resolve).
-- user LEGACY_EMP::; milestones jsonb (target job family/level); status ACTIVE. IDEMPOTENT: anti-join (user, source_id).
BEGIN;
INSERT INTO sys.sys_gap_closure_plans (
  gap_closure_plan_tenant_id, gap_closure_plan_user_id, gap_closure_plan_milestones,
  gap_closure_plan_status, gap_closure_plan_metadata)
SELECT u.user_tenant_id, u.user_id,
  jsonb_build_array(jsonb_strip_nulls(jsonb_build_object('target_job_family',s.target_job_family,'target_job_level',s.target_job_level))),
  'ACTIVE',
  jsonb_build_object('legacy', jsonb_build_object('source_table','skill_development_paths','source_id',s.id))
FROM staging.tmp_f4_gcp s
JOIN sys.sys_users u ON u.user_external_code='LEGACY_EMP::'||s.employee_id::text AND u.user_tenant_id IS NOT NULL
WHERE NOT EXISTS (SELECT 1 FROM sys.sys_gap_closure_plans x
  WHERE x.gap_closure_plan_user_id=u.user_id AND x.gap_closure_plan_metadata->'legacy'->>'source_id'=s.id::text);
DO $$ DECLARE v int; BEGIN SELECT count(*) INTO v FROM sys.sys_gap_closure_plans;
  RAISE NOTICE 'gap_closure_plans: % rows', v; IF v=0 THEN RAISE EXCEPTION '0'; END IF; END $$;
COMMIT;
