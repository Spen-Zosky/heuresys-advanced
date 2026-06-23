-- ============================================================================
-- 000156_g01_kpi_names_it.sql
-- Fix G-01 (audit S1006), slice 1/N: KPI definition names.
-- The /analytics/kpi + /kpis pages showed mixed EN/IT KPI names (e.g. the
-- original G-01 example "AUM Growth Rate" (EN) next to "Aderenza cronogramma"
-- (IT)). Most KPI names are already Italian; these are the English seed/legacy
-- strays. Decision (Enzo, 2026-06-24): translate the data in the DB, IT-canonical
-- (the app + business are Italian-primary). The EN->IT mapping lives in this file
-- (recoverable). Resilient (join by kpi_definition_code) + idempotent (only
-- updates rows whose name still differs, so a re-run is a no-op).
-- ============================================================================

WITH tr(code, it) AS (VALUES
  ('KPI1',            'Produttività'),
  ('KPI2',            'Qualità'),
  ('KPI3',            'Scadenze'),
  ('KPI4',            'Clienti'),
  ('KPI-007',         'NPS clienti'),
  ('AML-ALERTS',      'Tasso di risoluzione alert AML'),
  ('AUM-GROWTH',      'Tasso di crescita AUM'),
  ('REPORT-ACCURACY', 'Accuratezza della reportistica'),
  ('RISK-ACCURACY',   'Accuratezza della valutazione del rischio'),
  ('TXN-ACCURACY',    'Tasso di accuratezza delle transazioni'),
  ('BP-005-KPI-02',   'Tasso di accuratezza'),
  ('BP-007-KPI-01',   'Crescita AUM'),
  ('BP-009-KPI-02',   'Tempo di risoluzione alert AML'),
  ('BP-009-KPI-03',   'Tasso di attivazione clienti')
)
UPDATE sys.sys_kpi_definitions k
   SET kpi_definition_name = tr.it
  FROM tr
 WHERE k.kpi_definition_code = tr.code
   AND k.kpi_definition_name <> tr.it;

DO $$
DECLARE leftover int;
BEGIN
  SELECT count(*) INTO leftover
  FROM sys.sys_kpi_definitions
  WHERE kpi_definition_code IN ('KPI1','KPI2','KPI3','KPI4','KPI-007','AML-ALERTS','AUM-GROWTH',
        'REPORT-ACCURACY','RISK-ACCURACY','TXN-ACCURACY','BP-005-KPI-02','BP-007-KPI-01',
        'BP-009-KPI-02','BP-009-KPI-03')
    AND kpi_definition_name ~ '[A-Za-z]{4,}'
    AND kpi_definition_name ~* '(productivity|quality|deadline|customer|accuracy|growth|alert|report|transaction|rate|time)';
  IF leftover > 0 THEN
    RAISE WARNING '000156: % targeted KPI name(s) may still read English — review', leftover;
  END IF;
  RAISE NOTICE '000156: KPI definition names translated to IT (G-01 slice 1).';
END $$;
