-- 53_registry_process_kpi_templates_s994_evidence.sql
-- B-50 / B-42 RE-CONFIRMATION with FRESH S994 evidence (2026-06-17, item #12).
--
-- CONTEXT: item #12 re-measured the sys_process_kpi_templates wall (the one residual
-- EXCLUDE that carries a measurable legacy source: process_kpis) to decide IMPORT vs
-- keep-EXCLUDE. The S970 B-42 close (seed 43, EXCLUDE) was NOT trusted blindly; it was
-- re-measured live against the shared advanced DB (:5433) and legacy heuresys_platform
-- (oracle-vm-default, sudo -u postgres).
--
-- VERDICT: WALL HOLDS — keep EXCLUDE. No crosswalk fabricated (that is an Enzo-authored
-- WHAT decision). This seed ONLY appends the fresh measured numbers to the registry
-- rationale so the EXCLUDE is evidence-backed at S994 (no import, no schema, no FK).
--
-- MEASURED S994 (numbers from live queries, item #12):
--   * Legacy process_kpis ......... 81 rows, 25 distinct process_id (business_processes).
--   * Legacy KPI side RESOLVES 1:1: all 81 process_kpis.kpi_code exist in
--     sys.sys_kpi_definitions.kpi_definition_code (pattern 'BP-%-KPI-%' = 81/81).
--     The process FK target sys.sys_kpi_definitions was populated from process_kpis in S958.
--   * Legacy process keyspace (business_processes.process_code) of the 25 KPI-bearing
--     processes = BP-001..BP-011 (banking, IT names) + BP-EN-001..007 (energy) +
--     BP-SF-001..007 (food). v5 registry sys_blueprint_process_registry uses ordinal
--     codes 00..22 (23 banking processes, EN names).
--   * CODE-overlap legacy<->v5 registry .... 0 / 25  (zero).
--   * EXACT NAME-overlap (case-insens) ..... 1 / 25  (only "Risk Management" = registry "10").
--   * CRUX: the NOT-NULL process FK process_kpi_template_process_id ->
--     sys_blueprint_process_registry cannot resolve for 24/25 processes. Importing the
--     81 templates would require FABRICATING a process crosswalk for 24/25 processes -> a
--     modeling/WHAT decision (Enzo-authored), not a code fix. KPI side resolving does NOT
--     unblock: the process anchor is the wall.
--
-- DECISION: keep EXCLUDE (re-confirms B-42 with fresh numbers). IMPORT requires an
-- Enzo-authored legacy-process -> v5-registry crosswalk (~25 banking mappings) -> WHAT.
--
-- IDEMPOTENT: appends the S994 marker block only if absent (keyed on '%S994%' NOT LIKE).
-- 2nd run = no-op. No BEGIN/COMMIT (the seed runner wraps each file in one psql txn).

UPDATE sys.sys_reconciliation_registry
SET reconciliation_registry_rationale =
      '[B-42 RE-CONFIRMED S994 (2026-06-17, item #12): re-measured live, wall HOLDS, kept EXCLUDE. '
   || 'Legacy process_kpis=81 rows / 25 distinct processes. KPI side RESOLVES 1:1 (81/81 kpi_code '
   || 'in sys_kpi_definitions, pattern BP-%-KPI-%). BUT process FK -> sys_blueprint_process_registry: '
   || 'CODE-overlap 0/25, exact NAME-overlap 1/25 (only "Risk Management"="10"). Legacy keyspace '
   || 'BP-001..BP-011 + BP-EN-xxx + BP-SF-xxx (multi-industry) vs v5 ordinals 00..22 (banking-native). '
   || 'Import needs an Enzo-authored process crosswalk for 24/25 processes = WHAT decision, not a code bug. '
   || 'No crosswalk fabricated.] '
   || reconciliation_registry_rationale
WHERE reconciliation_registry_table_name = 'sys_process_kpi_templates'
  AND reconciliation_registry_rationale NOT LIKE '%RE-CONFIRMED S994%';

DO $$ DECLARE v text; BEGIN
  SELECT resolved_status INTO v FROM sys.v_reconciliation_status WHERE table_name='sys_process_kpi_templates';
  RAISE NOTICE 'sys_process_kpi_templates resolved_status = % (expect EXCLUDE)', v;
  IF v <> 'EXCLUDE' THEN RAISE EXCEPTION 'expected EXCLUDE, got %', v; END IF;
END $$;
