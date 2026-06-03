-- db/seeds/sdbi/_template/02_phase3_temp_sdbi_seed.sql  (SDBI template — Phase 3 seed)
-- Copy to db/seeds/brownfield/sdbi/<AREA>/02_phase3_temp_sdbi_seed.sql and replace <…> placeholders.
-- Reference implementation: db/seeds/brownfield/sdbi/goals_pilot/02_phase3_temp_sdbi_seed.sql
--
-- Strategy (per RUNBOOK §2 Phase 3):
--   * tenant_id via brownfield.tenant_id_mappings (legacy tenant -> canonical tenant)
--   * user_id via the LEGACY_EMP:: crosswalk (I14): sys_users.user_external_code =
--       'LEGACY_EMP::' || <legacy employees.id>  (NEVER 'LEGACY::' || users.id)
--   * self-FK / sibling-FK pointers stay raw (_legacy_source_<fk>_id) — resolved in Phase 5
-- Run via: psql … -v ON_ERROR_STOP=1 -f this_file
-- Idempotent: ON CONFLICT (_legacy_source_id) DO NOTHING. Re-run inserts 0.

BEGIN;

-- ---- Create the SDBI import_run row (anchors lineage + audit FK) ----------------------
DO $$
DECLARE
  v_run_id uuid := gen_random_uuid();
BEGIN
  INSERT INTO brownfield.import_runs (
    import_run_id, import_run_export_id, import_run_wave, import_run_status,
    import_run_started_at, import_run_metadata
  ) VALUES (
    v_run_id,
    (SELECT source_export_id FROM brownfield.source_exports
       ORDER BY created_at DESC LIMIT 1),   -- or pin a specific db-export-<date>
    NULL,
    'RUNNING',
    now(),
    jsonb_build_object(
      'workflow', 'SDBI_PHASE_3',
      'pilot',    '<AREA>',
      'scope',    '<N> source table(s) -> sys.* + temp_sdbi staging',
      'mapping_card_id', '<MAPPING_CARD_ID>'
    )
  );
  PERFORM set_config('sdbi.run_id', v_run_id::text, true);
END $$;

-- ---- temp_sdbi.<ENTITY> <- legacy_mirror.<SOURCE_TABLE> ------------------------------
-- NOTE: if <SOURCE_TABLE> is not yet in legacy_mirror, extend the extract first
-- (docs/brownfield/wave_runners/ pattern) — legacy_mirror does not hold every SDBI source.
INSERT INTO temp_sdbi.<ENTITY> (
  _legacy_source_id, _import_run_id, <ENTITY>_tenant_id, <ENTITY>_natural_key,
  -- <ENTITY>_<field>, …
  <ENTITY>_metadata, created_at, updated_at
)
SELECT
  src.id,
  current_setting('sdbi.run_id')::uuid,
  tm.canonical_tenant_id,
  '<NK_PREFIX>::' || tm.canonical_tenant_id::text || '::' || src.id::text,
  -- <transform per mapping card: TRIM(src.x), UPPER(src.y), COALESCE(src.z, …), … >,
  jsonb_build_object('legacy_id', src.id::text, 'legacy_table', 'public.<SOURCE_TABLE>'),
  src.created_at, src.updated_at
FROM legacy_mirror.<SOURCE_TABLE> src
JOIN brownfield.tenant_id_mappings tm ON tm.legacy_id = src.tenant_id::text
ON CONFLICT (_legacy_source_id) DO NOTHING;

-- Repeat one INSERT block per source table in the area (FK-pointer columns stay raw here).

COMMIT;

-- Verify (counts ≈ source row count modulo soft-delete filters)
SELECT 'temp_sdbi.<ENTITY>' AS t, count(*) FROM temp_sdbi.<ENTITY>;
