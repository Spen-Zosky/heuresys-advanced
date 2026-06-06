-- 42_registry_s970_bridge.sql — #1 closure (S970, 2026-06-06): registry rationale.
-- KPI leg RESOLVED (via 41_position_kpi_requirements.sql); succession DEFERRED (Enzo decision B).
-- IDEMPOTENT: only annotates rows not already carrying the S970 marker.
BEGIN;
UPDATE sys.sys_reconciliation_registry r SET
  reconciliation_registry_rationale = d.note || ' | ' || r.reconciliation_registry_rationale
FROM (VALUES
  ('sys_position_kpi_requirements',
   '[RESOLVED S970: 172 rows/43 pos/1 tenant via legacy tenant_job_kpis, employee-mediated; ESCO job_kpis dead-end superseded]'),
  ('sys_succession_pools',
   '[DEFER S970 (Enzo): only live source succession_plans has position_id 100% NULL -> 9/31 anchor via incumbent; gap-explicit pending Wave-2 position_id]'),
  ('sys_successor_candidates',
   '[DEFER S970 (Enzo): cascade on empty sys_succession_pools; 24/206 full-cascade ready once pools seeded]')
) AS d(tbl, note)
WHERE r.reconciliation_registry_table_name = d.tbl
  AND r.reconciliation_registry_rationale NOT LIKE '%S970%';
DO $$ DECLARE v int; BEGIN
  SELECT count(*) INTO v FROM sys.sys_reconciliation_registry WHERE reconciliation_registry_rationale LIKE '%S970%';
  RAISE NOTICE 'registry S970 annotations: %', v;
  IF v < 3 THEN RAISE EXCEPTION 'expected >=3 S970 annotations, got %', v; END IF;
END $$;
COMMIT;
