-- 18_kpi_measurements.sql — F4 bucket-C import. sys.sys_kpi_measurements <- legacy employee_kpi_targets.
-- value = actual_value (NOT NULL -> 412 have it; 248 resolve user+kpi). Bridge LEGACY_EMP:: + kpi_code.
-- Staging: staging.tmp_f4_ekt. IDEMPOTENT: anti-join (user, kpi, period).
BEGIN;
INSERT INTO sys.sys_kpi_measurements (
  kpi_measurement_tenant_id, kpi_measurement_kpi_id, kpi_measurement_user_id,
  kpi_measurement_period_start, kpi_measurement_period_end, kpi_measurement_value,
  kpi_measurement_source, kpi_measurement_recorded_at, kpi_measurement_metadata)
SELECT u.user_tenant_id, k.kpi_definition_id, u.user_id, s.period_start, s.period_end,
  s.actual_value, 'LEGACY_IMPORT', now(),
  jsonb_build_object('legacy', jsonb_strip_nulls(jsonb_build_object(
    'source_table','employee_kpi_targets','source_id',s.id,'kpi_code',s.kpi_code,'target_value',s.target_value)))
FROM staging.tmp_f4_ekt s
JOIN sys.sys_users u ON u.user_external_code='LEGACY_EMP::'||s.employee_id::text AND u.user_tenant_id IS NOT NULL
JOIN sys.sys_kpi_definitions k ON k.kpi_definition_code=s.kpi_code AND k.kpi_definition_tenant_id IS NULL
WHERE s.actual_value IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sys.sys_kpi_measurements m
  WHERE m.kpi_measurement_user_id=u.user_id AND m.kpi_measurement_kpi_id=k.kpi_definition_id
    AND m.kpi_measurement_period_start=s.period_start AND m.kpi_measurement_period_end=s.period_end);
DO $$ DECLARE v int; BEGIN SELECT count(*) INTO v FROM sys.sys_kpi_measurements;
  RAISE NOTICE 'kpi_measurements: % rows', v; IF v=0 THEN RAISE EXCEPTION '0'; END IF; END $$;
COMMIT;
