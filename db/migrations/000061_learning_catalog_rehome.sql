-- 000061_learning_catalog_rehome.sql
-- D5 / Wall W3 (learning catalog is event-sourced — F3b Wall-2). Dossier
-- docs/kb/RECONCILIATION_WALLS_AND_AI_DECISION_DOSSIER.md §4 + §7 D5.
--
-- LOCKED DECISION (Enzo): granularity = course = module, 1 sys_learning_module per legacy
-- course (NK = the canonical legacy course `code`, which for the 60 mis-placed rows already
-- carries the `CRS-<slug>-<n>` form, e.g. CRS-econova-1). Re-home the mis-placed catalog rows.
--
-- ============================================================================================
-- WHAT THIS MIGRATION DOES (structural correction, advanced->advanced, NO legacy read)
-- ============================================================================================
-- The advanced import event-sourced the learning catalog: sys_learning_modules is ~7299
-- OLDDB::<event> rows, and the real catalog that DID land mis-landed as CRS-* rows in
-- sys_learning_paths. This migration RE-HOMES the 60 mis-placed catalog codes already present
-- in advanced into sys_learning_modules as canonical course=modules, so the NOT-NULL module FK
-- of sys_learning_path_steps / sys_user_learning_evidence / sys_skill_learning_mappings finally
-- has a catalog row to point at. The full canonical 127-course catalog (incl. the 67 banking-
-- style codes never imported) is brought in by db/seeds/reconciliation/37_learning_catalog_import.sql
-- (which reads legacy); THIS migration only fixes the rows already mis-placed in advanced so the
-- re-home is twice-run-clean even if the seed has not yet run.
--
-- DUAL-HOME, NOT MOVE (critical — measured live S961):
--   The mis-placed CRS-* rows in sys_learning_paths are LOAD-BEARING. Two already-applied
--   reconciliation seeds JOIN sys_learning_paths ON learning_path_code = <course_code>:
--     - 11_position_learning_requirements.sql  (1791 rows already imported)
--     - 15_user_learning_assignments.sql       (1990 rows already imported)
--   Deleting the CRS-* path rows would break those imports' idempotent re-run. Therefore we
--   ADD the catalog rows to sys_learning_modules and LEAVE the CRS-* path rows in place. The
--   "re-home" is a dual-home: the catalog now lives canonically in sys_learning_modules while
--   the legacy path-code shim stays in sys_learning_paths for the dependent junctions. The
--   PATH-* rows are real learning paths and are untouched.
--
-- GRANULARITY / SCOPE:
--   Modules are imported GLOBAL (tenant_id NULL, is_global = true). Rationale: a course catalog
--   is a shared reference vocabulary, the canonical code is globally unique (127/127 distinct),
--   and a global module is reachable by every tenant's path-steps / evidence rows (the module FK
--   carries no tenant cross-check). This also sidesteps the defective tenant assignment in the
--   mis-placed path rows (econova/smartfood courses were wrongly stamped RTL_BANK + duplicated as
--   NULL-global). The unique key sys_learning_modules_tenant_code_uq
--   = (COALESCE(tenant_id,'000..0'), code) makes the global code unique by construction.
--
-- IDEMPOTENT: INSERT ... SELECT DISTINCT ON (code) ... ON CONFLICT (the tenant_code_uq) DO NOTHING.
-- Twice-run-clean: 2nd run inserts 0 (every code already present). Registry annotation guarded by
-- a NOT LIKE prefix check (mirrors 16_finalize_deadends.sql). NO legacy dependency — pure
-- advanced-side correction. Recorded by migrate.{ps1,sh}.
-- ============================================================================================

-- 1) Re-home: dual-home the mis-placed CRS-* catalog codes already present in sys_learning_paths
--    into sys_learning_modules as canonical GLOBAL course=modules. One module per distinct code
--    (the mis-placed rows duplicate each code up to 2x via the tenant/NULL pair — DISTINCT ON
--    collapses that). learning_module_code = the canonical course code as-is (already CRS-*).
INSERT INTO sys.sys_learning_modules (
  learning_module_tenant_id,
  learning_module_code,
  learning_module_title,
  learning_module_kind,
  learning_module_delivery,
  learning_module_is_global,
  learning_module_metadata
)
SELECT DISTINCT ON (lp.learning_path_code)
  NULL::uuid,                       -- GLOBAL (tenant-agnostic catalog)
  lp.learning_path_code,            -- canonical course code (e.g. CRS-econova-1)
  lp.learning_path_name,            -- the course title carried by the mis-placed row
  'COURSE',
  'SELF_PACED',
  true,
  jsonb_build_object(
    'rehome', jsonb_build_object(
      'source', 'sys_learning_paths',
      'migration', '000061_learning_catalog_rehome',
      'note', 'dual-home of mis-placed CRS-* catalog row; canonical re-import in seed 37'))
FROM sys.sys_learning_paths lp
WHERE lp.learning_path_code LIKE 'CRS-%'
ORDER BY lp.learning_path_code, (lp.learning_path_tenant_id IS NOT NULL) DESC
ON CONFLICT (COALESCE(learning_module_tenant_id, '00000000-0000-0000-0000-000000000000'::uuid),
             learning_module_code) DO NOTHING;

-- 2) Annotate the reconciliation registry: the catalog re-home unblocks the 4 W3 targets whose
--    declared wall was `learning_catalog_reimport`. The resolved_status auto-flips to POPULATED
--    in sys.v_reconciliation_status once the seeds land rows (fn_reconciliation_status, 000058,
--    derives POPULATED from EXISTS). We record the closure in the rationale. Guarded: only
--    prepends once (mirrors 16_finalize_deadends.sql).
UPDATE sys.sys_reconciliation_registry r SET
  reconciliation_registry_declared_status = 'IMPORT',
  reconciliation_registry_rationale =
    '[RE-HOMED D5/W3 S961: ' || d.note || '] ' || r.reconciliation_registry_rationale
FROM (VALUES
  ('sys_learning_path_steps',
   'module_id now resolves — 60 CRS-* course=modules re-homed into sys_learning_modules; '
   || 'learning_path_courses 124/124 both-leg buildable (seed 37)'),
  ('sys_skill_learning_mappings',
   'module_id now resolves — course=module catalog present; course_esco_skills skill-leg 635/717 '
   || 'resolvable subset imported (seed 39)'),
  ('sys_user_learning_evidence',
   'module_id now resolves — course=module catalog present; course_enrollments + '
   || 'employee_training_records employee-centric (LEGACY_EMP::) imported (seed 38)')
) AS d(tbl, note)
WHERE r.reconciliation_registry_table_name = d.tbl
  AND r.reconciliation_registry_rationale NOT LIKE '[RE-HOMED%';

DO $$
DECLARE v_modules int; v_crs_modules int; v_annotated int;
BEGIN
  SELECT count(*) INTO v_modules FROM sys.sys_learning_modules;
  SELECT count(*) INTO v_crs_modules FROM sys.sys_learning_modules WHERE learning_module_code LIKE 'CRS-%';
  SELECT count(*) INTO v_annotated FROM sys.sys_reconciliation_registry
    WHERE reconciliation_registry_rationale LIKE '[RE-HOMED%';
  RAISE NOTICE '000061: % learning_modules total, % CRS-* re-homed, % registry rows annotated',
    v_modules, v_crs_modules, v_annotated;
  -- The 60 mis-placed CRS-* codes must now exist as modules (idempotent floor; seed 37 adds the 67 more).
  IF v_crs_modules < 60 THEN
    RAISE EXCEPTION '000061: expected >=60 CRS-* re-homed modules, found %', v_crs_modules;
  END IF;
END $$;
