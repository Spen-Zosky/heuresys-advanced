-- db/seeds/reconciliation/01_kpi_definitions.sql
-- Data-reconciliation cat(i) — sys_kpi_definitions from legacy process_kpis (1:1, global).
-- Plan: docs/kb/DATA_RECONCILIATION_PLAN.md §2. Authored S958, supervised VM run (Enzo go).
--
-- PREREQUISITE — staging load (cross-DB, run once on the VM before this seed):
--   sudo -u postgres psql -d heuresys_advanced -q -c \
--     "DROP TABLE IF EXISTS staging.tmp_kpi_def_import; CREATE TABLE staging.tmp_kpi_def_import \
--      (id uuid, kpi_code text, kpi_name text, measurement_unit text, target_direction text, \
--       benchmark_value numeric, benchmark_min numeric, benchmark_max numeric, description text, \
--       process_id uuid, phase_id uuid);"
--   sudo -u postgres psql -d heuresys_platform -q -c \
--     "\copy (SELECT id, kpi_code, kpi_name, measurement_unit, target_direction, benchmark_value, \
--             benchmark_min, benchmark_max, description, process_id, phase_id FROM process_kpis) \
--      TO STDOUT WITH CSV" \
--   | sudo -u postgres psql -d heuresys_advanced -q -c "\copy staging.tmp_kpi_def_import FROM STDIN WITH CSV"
--
-- IDEMPOTENT: anti-join on (code, NULL tenant); 2nd run inserts 0. No lineage row (direct seed,
-- WS-1 pattern); the brownfield card path (DATA_RECONCILIATION_PLAN §2) can backfill lineage later.
-- Source process_kpis is GLOBAL (no tenant_id) -> tenant_id NULL + is_global true.

BEGIN;

INSERT INTO sys.sys_kpi_definitions (
  kpi_definition_tenant_id, kpi_definition_code, kpi_definition_name, kpi_definition_description,
  kpi_definition_unit, kpi_definition_polarity, kpi_definition_is_global, kpi_definition_metadata
)
SELECT DISTINCT ON (s.kpi_code)
  NULL::uuid,
  s.kpi_code,
  s.kpi_name,
  s.description,
  s.measurement_unit,
  CASE s.target_direction
    WHEN 'higher_better' THEN 'HIGHER_IS_BETTER'
    WHEN 'lower_better'  THEN 'LOWER_IS_BETTER'
    WHEN 'target_range'  THEN 'TARGET_RANGE'
    ELSE 'HIGHER_IS_BETTER'
  END,
  true,
  jsonb_build_object('legacy', jsonb_strip_nulls(jsonb_build_object(
    'source_table', 'process_kpis',
    'source_id', s.id,
    'benchmark_value', s.benchmark_value,
    'benchmark_min', s.benchmark_min,
    'benchmark_max', s.benchmark_max,
    'process_id', s.process_id,
    'phase_id', s.phase_id
  )))
FROM staging.tmp_kpi_def_import s
WHERE NOT EXISTS (
  SELECT 1 FROM sys.sys_kpi_definitions k
   WHERE k.kpi_definition_code = s.kpi_code
     AND k.kpi_definition_tenant_id IS NOT DISTINCT FROM NULL
)
ORDER BY s.kpi_code, s.id;

DO $$
DECLARE
  v_total int; v_src int; v_bad_polarity int;
BEGIN
  SELECT count(*) INTO v_total FROM sys.sys_kpi_definitions WHERE kpi_definition_tenant_id IS NULL;
  SELECT count(DISTINCT kpi_code) INTO v_src FROM staging.tmp_kpi_def_import;
  SELECT count(*) INTO v_bad_polarity FROM sys.sys_kpi_definitions
    WHERE kpi_definition_polarity NOT IN ('HIGHER_IS_BETTER','LOWER_IS_BETTER','TARGET_RANGE');
  RAISE NOTICE 'kpi_definitions: % global rows (source distinct codes: %), out-of-domain polarity: %',
    v_total, v_src, v_bad_polarity;
  IF v_bad_polarity > 0 THEN
    RAISE EXCEPTION 'kpi_definitions: % rows have out-of-domain polarity', v_bad_polarity;
  END IF;
  IF v_total < v_src THEN
    RAISE EXCEPTION 'kpi_definitions: only %/% source codes imported', v_total, v_src;
  END IF;
END $$;

COMMIT;
