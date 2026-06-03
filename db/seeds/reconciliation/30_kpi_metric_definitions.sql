-- 30_kpi_metric_definitions.sql — F4 bucket-C. Derived 1:1 from sys.sys_kpi_definitions (already populated).
-- One base metric per KPI definition (the legacy KPIs are single-valued -> a single base AVG metric).
-- code = <kpi_code>-M; aggregation=AVG (in CHECK domain). IDEMPOTENT: anti-join (kpi_id).
BEGIN;
INSERT INTO sys.sys_kpi_metric_definitions (
  kpi_metric_definition_kpi_id, kpi_metric_definition_code, kpi_metric_definition_name,
  kpi_metric_definition_unit, kpi_metric_definition_aggregation, kpi_metric_definition_metadata)
SELECT k.kpi_definition_id, left(k.kpi_definition_code,124)||'-M', k.kpi_definition_name,
  k.kpi_definition_unit, 'AVG',
  jsonb_build_object('derived','base metric per kpi_definition','kpi_code',k.kpi_definition_code)
FROM sys.sys_kpi_definitions k
WHERE NOT EXISTS (SELECT 1 FROM sys.sys_kpi_metric_definitions x WHERE x.kpi_metric_definition_kpi_id=k.kpi_definition_id);
DO $$ DECLARE v int; BEGIN SELECT count(*) INTO v FROM sys.sys_kpi_metric_definitions;
  RAISE NOTICE 'kpi_metric_definitions: % rows', v; IF v=0 THEN RAISE EXCEPTION '0'; END IF; END $$;
COMMIT;
