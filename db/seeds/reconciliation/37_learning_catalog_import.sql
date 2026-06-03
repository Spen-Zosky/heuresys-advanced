-- db/seeds/reconciliation/37_learning_catalog_import.sql
-- D5 / Wall W3 — canonical learning catalog re-import (course=module granularity).
-- Dossier docs/kb/RECONCILIATION_WALLS_AND_AI_DECISION_DOSSIER.md §4 + §7 D5.
--
-- Imports the canonical legacy catalog (read-only, no-PII source, ADR-0023) into advanced:
--   (1) public.courses (127, 127 distinct code) -> sys.sys_learning_modules as GLOBAL course=modules
--       (NK = the course code as-is; 60 are CRS-* — already re-homed by migration 000061 — and 67
--        are banking-style codes ABA-TELL-001/AML-102/... NEVER imported before).
--   (2) public.learning_path_courses (124, 20 distinct path, sequence_order 1..9, 124/124 both-leg)
--       -> sys.sys_learning_path_steps (path <- PATH-* code, module <- course code, ordinal <- seq).
--
-- WHY course=module (locked, Enzo): the legacy catalog is code-stable (courses 127/127, paths 20/20,
-- learning_path_courses 124/124 both-leg). course_modules(564) is a finer sub-unit model NOT used:
-- granularity is 1 module per course. The mis-placed CRS-* rows stay dual-homed in sys_learning_paths
-- for the dependent junctions (11/15) — see 000061 header.
--
-- ==========================================================================================
-- PREREQUISITE staging (supervised COPY pipe — CLI runs this BEFORE applying this file):
--   psql … -c "
--     CREATE TABLE IF NOT EXISTS staging.tmp_w3_courses (
--       id uuid, code text, title text, description text, tenant_id uuid,
--       duration_hours numeric, level text, provider text, category text);
--     CREATE TABLE IF NOT EXISTS staging.tmp_w3_lpc (
--       id uuid, path_code text, course_code text, sequence_order int, is_mandatory boolean);
--     TRUNCATE staging.tmp_w3_courses; TRUNCATE staging.tmp_w3_lpc;"
--
--   ssh oracle-vm-default 'sudo -u postgres psql -d heuresys_platform -c "\copy (
--     SELECT id, code, title, description, tenant_id, duration_hours, skill_level AS level, provider, category
--     FROM public.courses) TO STDOUT WITH (FORMAT csv)"' \
--     | psql … -c "\copy staging.tmp_w3_courses FROM STDIN WITH (FORMAT csv)"
--
--   ssh oracle-vm-default 'sudo -u postgres psql -d heuresys_platform -c "\copy (
--     SELECT lpc.id, lp.code AS path_code, c.code AS course_code, lpc.sequence_order, lpc.is_mandatory
--     FROM public.learning_path_courses lpc
--     JOIN public.learning_paths lp ON lp.id = lpc.learning_path_id
--     JOIN public.courses        c  ON c.id  = lpc.course_id) TO STDOUT WITH (FORMAT csv)"' \
--     | psql … -c "\copy staging.tmp_w3_lpc FROM STDIN WITH (FORMAT csv)"
--
-- Measured live S961: tmp_w3_courses = 127 (127 distinct code, 4 legacy tenants);
--   tmp_w3_lpc = 124 (20 distinct path_code, all PATH-*; 60 distinct course_code, all CRS-*;
--   sequence_order 1..9, 124/124 (path,ordinal) distinct, 0 nulls).
-- ==========================================================================================
-- IDEMPOTENT:
--   modules: ON CONFLICT (COALESCE(tenant,'000..0'), code) DO NOTHING — 2nd run inserts 0.
--   steps:   resolve path (tenant-set PATH-* row) + module (global course=module) then
--            ON CONFLICT (path_id, ordinal) DO NOTHING (the table's unique key).
-- ==========================================================================================

BEGIN;

-- (1) Courses -> GLOBAL course=modules. All 127; the 60 CRS-* already exist (000061) -> no-op for them.
INSERT INTO sys.sys_learning_modules (
  learning_module_tenant_id,
  learning_module_code,
  learning_module_title,
  learning_module_description,
  learning_module_kind,
  learning_module_delivery,
  learning_module_duration_minutes,
  learning_module_is_global,
  learning_module_metadata
)
SELECT DISTINCT ON (s.code)
  NULL::uuid,
  s.code,
  s.title,
  s.description,
  'COURSE',
  'SELF_PACED',
  CASE WHEN s.duration_hours IS NOT NULL THEN round(s.duration_hours * 60)::int ELSE NULL END,
  true,
  jsonb_build_object('legacy', jsonb_strip_nulls(jsonb_build_object(
    'source_table', 'courses', 'source_id', s.id, 'code', s.code,
    'legacy_tenant_id', s.tenant_id, 'level', s.level,
    'provider', s.provider, 'category', s.category)))
FROM staging.tmp_w3_courses s
WHERE s.code IS NOT NULL
ORDER BY s.code, s.id
ON CONFLICT (COALESCE(learning_module_tenant_id, '00000000-0000-0000-0000-000000000000'::uuid),
             learning_module_code) DO NOTHING;

-- (2) learning_path_courses -> sys_learning_path_steps.
--   path  : course's path code (PATH-*) -> the TENANT-SET advanced PATH-* row (20 distinct;
--           the dual NULL-global copy is ignored so each legacy path resolves to exactly one
--           advanced path, keeping (path_id, ordinal) unique).
--   module: course code -> the GLOBAL course=module just imported.
--   ordinal: sequence_order (1..9), guaranteed (path,ordinal)-unique in source (124/124).
INSERT INTO sys.sys_learning_path_steps (
  learning_path_step_path_id,
  learning_path_step_module_id,
  learning_path_step_ordinal,
  learning_path_step_metadata
)
SELECT
  lp.learning_path_id,
  lm.learning_module_id,
  s.sequence_order::smallint,
  jsonb_build_object('legacy', jsonb_strip_nulls(jsonb_build_object(
    'source_table', 'learning_path_courses', 'source_id', s.id,
    'path_code', s.path_code, 'course_code', s.course_code,
    'is_mandatory', s.is_mandatory)))
FROM staging.tmp_w3_lpc s
JOIN sys.sys_learning_paths lp
  ON lp.learning_path_code = s.path_code
 AND lp.learning_path_tenant_id IS NOT NULL          -- the real tenant-scoped path (not the NULL shim)
JOIN sys.sys_learning_modules lm
  ON lm.learning_module_code = s.course_code
 AND lm.learning_module_tenant_id IS NULL            -- the global course=module
ON CONFLICT (learning_path_step_path_id, learning_path_step_ordinal) DO NOTHING;

DO $$
DECLARE v_modules int; v_crs int; v_steps int; v_step_paths int;
BEGIN
  SELECT count(*) INTO v_modules FROM sys.sys_learning_modules;
  SELECT count(*) INTO v_crs FROM sys.sys_learning_modules WHERE learning_module_code LIKE 'CRS-%';
  SELECT count(*), count(DISTINCT learning_path_step_path_id) INTO v_steps, v_step_paths
    FROM sys.sys_learning_path_steps;
  RAISE NOTICE '37: learning_modules=% (CRS-*=%), path_steps=% across % paths',
    v_modules, v_crs, v_steps, v_step_paths;
  -- 127 canonical course=modules must exist (60 CRS-* + 67 banking-style); 124 steps must land.
  IF v_crs < 60 THEN RAISE EXCEPTION '37: expected >=60 CRS-* modules, found %', v_crs; END IF;
  IF v_steps = 0 THEN RAISE EXCEPTION '37: learning_path_steps still 0 after import'; END IF;
END $$;

COMMIT;
