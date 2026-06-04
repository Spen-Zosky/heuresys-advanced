-- db/seeds/reconciliation/40_org_unit_kpi_templates.sql
-- D4 / Wall W2 — Option A import (org-unit TEMPLATE layer, full-fidelity).
-- Authoritative design: docs/kb/D4_ORG_UNIT_TEMPLATE_DESIGN.md (Option A, all 6 D4.x recommendations).
-- Schema introduced by migration 000064_org_unit_template_layer.sql.
--
-- Imports the legacy (read-only, no-PII, ADR-0023) org-unit blueprint taxonomy + its KPI templates:
--   (1) org_unit_templates (225 = 9 blueprints x 25 codes) -> sys.sys_organization_unit_templates,
--       preserving the blueprint grouping 1:1 (D4.4: NO dedup; no fabricated merge rule).
--   (2) org_unit_kpis (100, 100 distinct code, 0 orphan) -> sys.sys_organization_unit_kpi_templates,
--       resolving unit_template_id (100/100 against the just-imported templates) + kpi_id (100/100
--       global in sys_kpi_definitions, S958.1 catalog unification). weight=1.000 (D4.5: legacy has no
--       per-KPI weight); target jsonb built from target_direction + benchmark_value/min/max.
--       unit_id / tenant_id stay NULL (D4.2: GLOBAL / tenant-less blueprint KPI templates).
--
-- ==========================================================================================
-- PREREQUISITE staging (supervised file-based COPY pipe — CLI runs this BEFORE applying this file):
--   psql ... -c "CREATE TABLE IF NOT EXISTS staging.tmp_d4_org_unit_templates (...);
--                CREATE TABLE IF NOT EXISTS staging.tmp_d4_org_unit_kpis (...);
--                TRUNCATE both;"
--   ssh oracle-vm-default 'sudo -u postgres psql -d heuresys_platform -c "\copy (
--     SELECT id, template_id, parent_id, code, name_it, name_en, short_name, area_code, level,
--            level_name, nature, is_line, is_management, headcount_min, headcount_max, typical_span,
--            description, responsibilities::text, sort_order, depth
--     FROM org_unit_templates ORDER BY id) TO /tmp/d4_org_unit_templates.csv WITH (FORMAT csv)"'
--   ssh oracle-vm-default 'sudo -u postgres psql -d heuresys_platform -c "\copy (
--     SELECT id, org_unit_template_id, kpi_code, kpi_name, kpi_description, measurement_unit,
--            target_direction, benchmark_value, benchmark_min, benchmark_max, data_source,
--            calculation_formula FROM org_unit_kpis ORDER BY id) TO /tmp/d4_org_unit_kpis.csv WITH (FORMAT csv)"'
--   scp both down, \copy into staging.tmp_d4_*.
-- Measured live S961: tmp_d4_org_unit_templates = 225 (9 blueprint, 25 code); tmp_d4_org_unit_kpis = 100
--   (100 distinct kpi_code, 0 orphan template FK); all 100 kpi_code resolve global in sys_kpi_definitions.
-- ==========================================================================================
-- IDEMPOTENT:
--   templates: natural key = metadata->>'legacy_org_unit_template_id' (the legacy uuid); the UNIQUE
--              (blueprint_id, code) backs ON CONFLICT DO NOTHING. 2nd run inserts 0.
--   parent fixup: UPDATE join legacy parent_id -> the imported child's parent row (idempotent UPDATE).
--   kpis:      ON CONFLICT (unit_template_id, kpi_id) [partial UNIQUE] DO NOTHING. 2nd run inserts 0.
-- ==========================================================================================

-- (1) templates -> sys_organization_unit_templates. blueprint_id = legacy template_id (the 9 groups).
--     type_id derived from code semantics where mappable (CEO->HEADQUARTERS, DIR-*->DIVISION,
--     DEPT-*->DEPARTMENT); NULL otherwise (FK is ON DELETE SET NULL, nullable). parent fixed up below.
INSERT INTO sys.sys_organization_unit_templates (
  organization_unit_template_blueprint_id,
  organization_unit_template_code,
  organization_unit_template_name,
  organization_unit_template_name_en,
  organization_unit_template_type_id,
  organization_unit_template_level,
  organization_unit_template_nature,
  organization_unit_template_metadata
)
SELECT
  s.template_id,
  s.code,
  s.name_it,
  s.name_en,
  ot.organization_unit_type_id,
  s.level::smallint,
  s.nature,
  jsonb_strip_nulls(jsonb_build_object(
    'legacy', jsonb_strip_nulls(jsonb_build_object(
      'source_table',           'org_unit_templates',
      'legacy_org_unit_template_id', s.id,
      'legacy_blueprint_id',    s.template_id,
      'legacy_parent_id',       s.parent_id,
      'short_name',             s.short_name,
      'area_code',              s.area_code,
      'level_name',             s.level_name,
      'is_line',                s.is_line,
      'is_management',          s.is_management,
      'headcount_min',          s.headcount_min,
      'headcount_max',          s.headcount_max,
      'typical_span',           s.typical_span,
      'sort_order',             s.sort_order,
      'depth',                  s.depth,
      'description',            s.description,
      'responsibilities',       s.responsibilities)))
  )
FROM staging.tmp_d4_org_unit_templates s
LEFT JOIN sys.sys_organization_unit_types ot
  ON ot.organization_unit_type_code =
     CASE
       WHEN s.code = 'CEO'         THEN 'HEADQUARTERS'
       WHEN s.code LIKE 'DIR-%'    THEN 'DIVISION'
       WHEN s.code LIKE 'DEPT-%'   THEN 'DEPARTMENT'
       ELSE NULL
     END
ON CONFLICT (organization_unit_template_blueprint_id, organization_unit_template_code) DO NOTHING;

-- parent fixup: resolve organization_unit_template_parent_id from the legacy parent_id, matching
-- the parent's imported row by its stashed legacy_org_unit_template_id (within the same blueprint).
UPDATE sys.sys_organization_unit_templates child
   SET organization_unit_template_parent_id = parent.organization_unit_template_id
  FROM sys.sys_organization_unit_templates parent
 WHERE (child.organization_unit_template_metadata #>> '{legacy,legacy_parent_id}')
         = (parent.organization_unit_template_metadata #>> '{legacy,legacy_org_unit_template_id}')
   AND child.organization_unit_template_parent_id IS DISTINCT FROM parent.organization_unit_template_id;

-- (2) org_unit_kpis -> sys_organization_unit_kpi_templates (blueprint-keyed, tenant-less).
--   unit_template_id : resolve via the template's stashed legacy_org_unit_template_id.
--   kpi_id           : resolve via kpi_code -> sys_kpi_definitions (global, 100/100).
--   weight           : 1.000 default (D4.5).
--   target jsonb     : { direction, benchmark, benchmark_min, benchmark_max } (nulls stripped).
--   metadata         : legacy provenance.
INSERT INTO sys.sys_organization_unit_kpi_templates (
  organization_unit_kpi_template_unit_template_id,
  organization_unit_kpi_template_kpi_id,
  organization_unit_kpi_template_unit_id,
  organization_unit_kpi_template_tenant_id,
  organization_unit_kpi_template_weight,
  organization_unit_kpi_template_target,
  organization_unit_kpi_template_metadata
)
SELECT
  t.organization_unit_template_id,
  kd.kpi_definition_id,
  NULL::uuid,                    -- blueprint-keyed: no instance unit
  NULL::uuid,                    -- GLOBAL / tenant-less
  1.000,
  jsonb_strip_nulls(jsonb_build_object(
    'direction',     s.target_direction,
    'benchmark',     s.benchmark_value,
    'benchmark_min', s.benchmark_min,
    'benchmark_max', s.benchmark_max)),
  jsonb_build_object('legacy', jsonb_strip_nulls(jsonb_build_object(
    'source_table',        'org_unit_kpis',
    'legacy_org_unit_kpi_id', s.id,
    'kpi_code',            s.kpi_code,
    'measurement_unit',    s.measurement_unit,
    'data_source',         s.data_source,
    'calculation_formula', s.calculation_formula)))
FROM staging.tmp_d4_org_unit_kpis s
JOIN sys.sys_organization_unit_templates t
  ON (t.organization_unit_template_metadata #>> '{legacy,legacy_org_unit_template_id}') = s.org_unit_template_id::text
JOIN sys.sys_kpi_definitions kd
  ON kd.kpi_definition_code = s.kpi_code
 AND kd.kpi_definition_tenant_id IS NULL          -- the global KPI definition (100/100 global)
ON CONFLICT (organization_unit_kpi_template_unit_template_id, organization_unit_kpi_template_kpi_id)
   WHERE organization_unit_kpi_template_unit_template_id IS NOT NULL
   DO NOTHING;

DO $$
DECLARE
  v_tmpl int; v_kpi int; v_kpi_resolved int; v_kpi_kpi_id int; v_parent_set int;
BEGIN
  SELECT count(*) INTO v_tmpl FROM sys.sys_organization_unit_templates;
  SELECT count(*) INTO v_parent_set FROM sys.sys_organization_unit_templates
    WHERE organization_unit_template_parent_id IS NOT NULL;
  SELECT count(*),
         count(*) FILTER (WHERE organization_unit_kpi_template_unit_template_id IS NOT NULL),
         count(*) FILTER (WHERE organization_unit_kpi_template_kpi_id IS NOT NULL)
    INTO v_kpi, v_kpi_resolved, v_kpi_kpi_id
    FROM sys.sys_organization_unit_kpi_templates;
  RAISE NOTICE '40: org_unit_templates=% (parent_set=%), org_unit_kpi_templates=% (unit_template_id resolved=%, kpi_id resolved=%)',
    v_tmpl, v_parent_set, v_kpi, v_kpi_resolved, v_kpi_kpi_id;
  IF v_tmpl <> 225 THEN RAISE EXCEPTION '40: expected 225 org_unit_templates, found %', v_tmpl; END IF;
  IF v_kpi  <> 100 THEN RAISE EXCEPTION '40: expected 100 org_unit_kpi_templates, found %', v_kpi; END IF;
  IF v_kpi_resolved <> 100 THEN RAISE EXCEPTION '40: expected 100 unit_template_id resolved, found %', v_kpi_resolved; END IF;
  IF v_kpi_kpi_id   <> 100 THEN RAISE EXCEPTION '40: expected 100 kpi_id resolved, found %', v_kpi_kpi_id; END IF;
END $$;
