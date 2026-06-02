-- db/seeds/reconciliation/02_kpi_catalog_unification.sql
-- Data-reconciliation cat(i) — unify the legacy KPI catalog into sys_kpi_definitions.
-- Plan: docs/kb/DATA_RECONCILIATION_PLAN.md §3 (opt. A). Authored S958, supervised VM run.
--
-- The 4 legacy KPI namespaces are KPIs at DIFFERENT org levels (not 4 versions of one
-- catalog), each with definitional columns -> derivable 1:1 into the single sys catalog:
--   process_kpis (81, BP-*) = process-level   [already done, seed 01]
--   job_kpis (45, CUST-*)   = job/role-level   -> +45
--   org_unit_kpis (100, KPI-*) = org-unit-level -> +100
--   employee_kpi_targets (17, AML-*) = employee-level -> +17
-- All GLOBAL (tenant NULL + is_global true). Namespaces are disjoint; anti-join also
-- guards any accidental code collision. Idempotent (2nd run inserts 0).
--
-- PREREQUISITE staging (cross-DB COPY-pipe on the VM, run once before this seed):
--   tmp_job_kpis (job_kpis), tmp_org_unit_kpis (DISTINCT kpi_code from org_unit_kpis),
--   tmp_emp_kpi_targets (employee_kpi_targets) — see session log / DATA_RECONCILIATION_PLAN §4.

BEGIN;

-- (a) job_kpis (45 distinct codes; kpi_code->name verified 1:1) -----------------------------
INSERT INTO sys.sys_kpi_definitions (
  kpi_definition_tenant_id, kpi_definition_code, kpi_definition_name, kpi_definition_description,
  kpi_definition_unit, kpi_definition_polarity, kpi_definition_is_global, kpi_definition_metadata
)
SELECT DISTINCT ON (s.kpi_code)
  NULL::uuid, s.kpi_code, COALESCE(s.name_it, s.name_en), s.description, s.unit,
  'HIGHER_IS_BETTER',  -- job_kpis carries no target_direction; column DEFAULT
  true,
  jsonb_build_object('legacy', jsonb_strip_nulls(jsonb_build_object(
    'source_table','job_kpis','level','job','name_en',s.name_en,'measurement_type',s.measurement_type,
    'kpi_category',s.kpi_category,'frequency',s.frequency,'weight',s.weight,
    'target_value',s.target_value,'min_acceptable',s.min_acceptable,'stretch_target',s.stretch_target)))
FROM staging.tmp_job_kpis s
WHERE NOT EXISTS (SELECT 1 FROM sys.sys_kpi_definitions k
  WHERE k.kpi_definition_code = s.kpi_code AND k.kpi_definition_tenant_id IS NOT DISTINCT FROM NULL)
ORDER BY s.kpi_code, s.id;

-- (b) org_unit_kpis (100 distinct codes; has target_direction) -------------------------------
INSERT INTO sys.sys_kpi_definitions (
  kpi_definition_tenant_id, kpi_definition_code, kpi_definition_name, kpi_definition_description,
  kpi_definition_unit, kpi_definition_polarity, kpi_definition_is_global, kpi_definition_metadata
)
SELECT DISTINCT ON (s.kpi_code)
  NULL::uuid, s.kpi_code, s.kpi_name, NULL, s.measurement_unit,
  CASE s.target_direction
    WHEN 'higher_better' THEN 'HIGHER_IS_BETTER'
    WHEN 'lower_better'  THEN 'LOWER_IS_BETTER'
    WHEN 'target_range'  THEN 'TARGET_RANGE'
    ELSE 'HIGHER_IS_BETTER' END,
  true,
  jsonb_build_object('legacy', jsonb_build_object('source_table','org_unit_kpis','level','org_unit'))
FROM staging.tmp_org_unit_kpis s
WHERE NOT EXISTS (SELECT 1 FROM sys.sys_kpi_definitions k
  WHERE k.kpi_definition_code = s.kpi_code AND k.kpi_definition_tenant_id IS NOT DISTINCT FROM NULL)
ORDER BY s.kpi_code;

-- (c) employee_kpi_targets (17 distinct codes; instance-level, def = code+name) --------------
INSERT INTO sys.sys_kpi_definitions (
  kpi_definition_tenant_id, kpi_definition_code, kpi_definition_name, kpi_definition_description,
  kpi_definition_unit, kpi_definition_polarity, kpi_definition_is_global, kpi_definition_metadata
)
SELECT DISTINCT ON (s.kpi_code)
  NULL::uuid, s.kpi_code, s.kpi_name, NULL, NULL,
  'HIGHER_IS_BETTER',  -- no direction in source; DEFAULT
  true,
  jsonb_build_object('legacy', jsonb_build_object('source_table','employee_kpi_targets','level','employee'))
FROM staging.tmp_emp_kpi_targets s
WHERE NOT EXISTS (SELECT 1 FROM sys.sys_kpi_definitions k
  WHERE k.kpi_definition_code = s.kpi_code AND k.kpi_definition_tenant_id IS NOT DISTINCT FROM NULL)
ORDER BY s.kpi_code, s.id;

DO $$
DECLARE v_total int; v_bad int;
BEGIN
  SELECT count(*) INTO v_total FROM sys.sys_kpi_definitions WHERE kpi_definition_tenant_id IS NULL;
  SELECT count(*) INTO v_bad FROM sys.sys_kpi_definitions
    WHERE kpi_definition_polarity NOT IN ('HIGHER_IS_BETTER','LOWER_IS_BETTER','TARGET_RANGE');
  RAISE NOTICE 'kpi catalog unified: % global definitions (expect 243 = 81+45+100+17), bad polarity: %', v_total, v_bad;
  IF v_bad > 0 THEN RAISE EXCEPTION '% out-of-domain polarity', v_bad; END IF;
END $$;

COMMIT;
