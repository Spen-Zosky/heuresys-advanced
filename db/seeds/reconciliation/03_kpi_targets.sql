-- db/seeds/reconciliation/03_kpi_targets.sql
-- Data-reconciliation cat(i) — sys_kpi_targets from legacy employee_kpi_targets.
-- Plan: DATA_RECONCILIATION_PLAN.md §3. Unblocked by seed 02 (the 17 employee-level
-- kpi_codes now exist in sys_kpi_definitions). Authored S958, supervised VM run.
--
-- FK resolution (all measured before authoring):
--   kpi_id   <- kpi_code -> sys_kpi_definitions.kpi_definition_code (global, tenant NULL) — 17/17 resolve
--   user_id  <- employee_id -> sys_users.user_external_code = 'LEGACY_EMP::'||employee_id (ADR-0024) — 248/412 rows
--   tenant   <- the resolved sys_user's user_tenant_id (clean: only in-scope RTL/Heuresys users resolve)
-- The 164 unresolved rows are collapsed-out tenants (SmartFood/EcoNova, S950) — a clean,
-- documented boundary, NOT a defect. position_id left NULL (no position info in source).
-- IDEMPOTENT: anti-join on (user_id, kpi_id, period_start, period_end). 2nd run inserts 0.
--
-- PREREQUISITE staging: tmp_emp_kpi_targets (employee_kpi_targets) — loaded with seed 02.

BEGIN;

INSERT INTO sys.sys_kpi_targets (
  kpi_target_tenant_id, kpi_target_kpi_id, kpi_target_user_id,
  kpi_target_period_start, kpi_target_period_end,
  kpi_target_target_value, kpi_target_minimum_value, kpi_target_stretch_value,
  kpi_target_metadata
)
SELECT
  u.user_tenant_id, k.kpi_definition_id, u.user_id,
  e.period_start, e.period_end,
  e.target_value, e.min_acceptable, e.stretch_target,
  jsonb_build_object('legacy', jsonb_strip_nulls(jsonb_build_object(
    'source_table','employee_kpi_targets','source_id',e.id,'kpi_code',e.kpi_code,
    'actual_value',e.actual_value,'status',e.status,'tenant_job_kpi_id',e.tenant_job_kpi_id)))
FROM staging.tmp_emp_kpi_targets e
JOIN sys.sys_users u
  ON u.user_external_code = 'LEGACY_EMP::' || e.employee_id::text
 AND u.user_tenant_id IS NOT NULL
JOIN sys.sys_kpi_definitions k
  ON k.kpi_definition_code = e.kpi_code
 AND k.kpi_definition_tenant_id IS NULL
WHERE NOT EXISTS (
  SELECT 1 FROM sys.sys_kpi_targets t
   WHERE t.kpi_target_user_id = u.user_id
     AND t.kpi_target_kpi_id = k.kpi_definition_id
     AND t.kpi_target_period_start = e.period_start
     AND t.kpi_target_period_end = e.period_end
);

DO $$
DECLARE v_total int; v_users int; v_kpis int;
BEGIN
  SELECT count(*), count(DISTINCT kpi_target_user_id), count(DISTINCT kpi_target_kpi_id)
    INTO v_total, v_users, v_kpis FROM sys.sys_kpi_targets;
  RAISE NOTICE 'kpi_targets: % rows (% distinct users, % distinct kpis)', v_total, v_users, v_kpis;
  IF v_total = 0 THEN RAISE EXCEPTION 'kpi_targets: 0 rows imported (FK resolution failed)'; END IF;
END $$;

COMMIT;
