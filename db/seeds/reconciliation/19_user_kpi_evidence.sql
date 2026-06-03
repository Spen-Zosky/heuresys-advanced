-- 19_user_kpi_evidence.sql — F4 bucket-C import. sys.sys_user_kpi_evidence <- legacy employee_kpi_targets.
-- measured_value=actual_value, target_value=target_value. Bridge LEGACY_EMP:: + kpi_code (248/412).
-- Staging: staging.tmp_f4_ekt. IDEMPOTENT: anti-join (user, kpi, period).
BEGIN;
INSERT INTO sys.sys_user_kpi_evidence (
  user_kpi_evidence_user_id, user_kpi_evidence_tenant_id, user_kpi_evidence_kpi_id,
  user_kpi_evidence_period_start, user_kpi_evidence_period_end,
  user_kpi_evidence_measured_value, user_kpi_evidence_target_value,
  user_kpi_evidence_recorded_at, user_kpi_evidence_metadata)
SELECT u.user_id, u.user_tenant_id, k.kpi_definition_id, s.period_start, s.period_end,
  s.actual_value, s.target_value, now(),
  jsonb_build_object('legacy', jsonb_strip_nulls(jsonb_build_object(
    'source_table','employee_kpi_targets','source_id',s.id,'kpi_code',s.kpi_code,
    'achievement_percent',s.achievement_percent,'stretch_target',s.stretch_target)))
FROM staging.tmp_f4_ekt s
JOIN sys.sys_users u ON u.user_external_code='LEGACY_EMP::'||s.employee_id::text AND u.user_tenant_id IS NOT NULL
JOIN sys.sys_kpi_definitions k ON k.kpi_definition_code=s.kpi_code AND k.kpi_definition_tenant_id IS NULL
WHERE NOT EXISTS (SELECT 1 FROM sys.sys_user_kpi_evidence e
  WHERE e.user_kpi_evidence_user_id=u.user_id AND e.user_kpi_evidence_kpi_id=k.kpi_definition_id
    AND e.user_kpi_evidence_period_start=s.period_start AND e.user_kpi_evidence_period_end=s.period_end);
DO $$ DECLARE v int; BEGIN SELECT count(*) INTO v FROM sys.sys_user_kpi_evidence;
  RAISE NOTICE 'user_kpi_evidence: % rows', v; IF v=0 THEN RAISE EXCEPTION '0'; END IF; END $$;
COMMIT;
