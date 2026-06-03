-- 17_kpi_assessment_results.sql — F4 bucket-C import (re-measured: HAS a source, not pure-derived).
-- sys.sys_kpi_assessment_results <- legacy employee_kpi_targets (248/412 resolve user+kpi).
-- Bridge: user LEGACY_EMP::employee_id, kpi via kpi_code -> sys_kpi_definitions, score = achievement_percent.
-- Staging: staging.tmp_f4_ekt. IDEMPOTENT: anti-join (user, kpi, period).
BEGIN;
INSERT INTO sys.sys_kpi_assessment_results (
  kpi_assessment_result_tenant_id, kpi_assessment_result_kpi_id, kpi_assessment_result_user_id,
  kpi_assessment_result_period_start, kpi_assessment_result_period_end,
  kpi_assessment_result_score, kpi_assessment_result_payload, kpi_assessment_result_computed_at)
SELECT u.user_tenant_id, k.kpi_definition_id, u.user_id, s.period_start, s.period_end,
  s.achievement_percent,
  jsonb_build_object('legacy', jsonb_strip_nulls(jsonb_build_object(
    'source_table','employee_kpi_targets','source_id',s.id,'kpi_code',s.kpi_code,
    'target_value',s.target_value,'actual_value',s.actual_value,'achievement_percent',s.achievement_percent))),
  now()
FROM staging.tmp_f4_ekt s
JOIN sys.sys_users u ON u.user_external_code='LEGACY_EMP::'||s.employee_id::text AND u.user_tenant_id IS NOT NULL
JOIN sys.sys_kpi_definitions k ON k.kpi_definition_code=s.kpi_code AND k.kpi_definition_tenant_id IS NULL
WHERE NOT EXISTS (SELECT 1 FROM sys.sys_kpi_assessment_results r
  WHERE r.kpi_assessment_result_user_id=u.user_id AND r.kpi_assessment_result_kpi_id=k.kpi_definition_id
    AND r.kpi_assessment_result_period_start=s.period_start AND r.kpi_assessment_result_period_end=s.period_end);
DO $$ DECLARE v int; BEGIN SELECT count(*) INTO v FROM sys.sys_kpi_assessment_results;
  RAISE NOTICE 'kpi_assessment_results: % rows', v; IF v=0 THEN RAISE EXCEPTION '0'; END IF; END $$;
COMMIT;
