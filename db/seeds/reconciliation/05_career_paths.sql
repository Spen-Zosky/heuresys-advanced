-- db/seeds/reconciliation/05_career_paths.sql
-- F2 bucket-A import #1: sys.sys_career_paths from legacy public.career_paths (catalog).
-- Reconciliation-closure cycle F2 (spec 2026-06-03-reconciliation-closure-design.md).
--
-- PREREQUISITE staging load (supervised, cross-DB COPY pipe — mirrors seeds 02/03 staging pattern):
--   psql … -c "CREATE TABLE IF NOT EXISTS staging.tmp_f2_career_paths
--               (id uuid, tenant_id uuid, name text, description text, path_type text);
--              TRUNCATE staging.tmp_f2_career_paths;"
--   ssh oracle-vm-default 'sudo -u postgres psql -d heuresys_platform -c "\copy (SELECT id, tenant_id,
--     name, description, path_type FROM career_paths WHERE deleted_at IS NULL) TO STDOUT WITH (FORMAT csv)"' \
--     | psql … -c "\copy staging.tmp_f2_career_paths FROM STDIN WITH (FORMAT csv)"
--
-- Transforms (all measured S960):
--   tenant : legacy tenant_id -> sys via brownfield.tenant_id_mappings (28/32 resolve to RTL_BANK;
--            the 4 rows of the un-mapped legacy tenant 1d7bf448 are out-of-scope -> skipped by the JOIN).
--   code   : deterministic 'LEGACY_CP::'||id (natural key; UQ is COALESCE(tenant, zero-uuid)+code).
--   kind   : linear->VERTICAL, branching->CROSS_FUNCTIONAL, matrix->LATERAL (CHECK-domain aligned;
--            only linear+branching present in the data).
--   is_global=false (tenant-scoped source). legacy id/path_type kept under metadata.legacy.*.
-- IDEMPOTENT: anti-join on (tenant, code). 2nd run inserts 0.

BEGIN;

INSERT INTO sys.sys_career_paths (
  career_path_tenant_id, career_path_code, career_path_name,
  career_path_description, career_path_kind, career_path_is_global, career_path_metadata
)
SELECT
  m.canonical_tenant_id,
  'LEGACY_CP::' || s.id::text,
  s.name,
  s.description,
  CASE s.path_type
    WHEN 'linear'    THEN 'VERTICAL'
    WHEN 'branching' THEN 'CROSS_FUNCTIONAL'
    WHEN 'matrix'    THEN 'LATERAL'
    ELSE 'VERTICAL' END,
  false,
  jsonb_build_object('legacy', jsonb_strip_nulls(jsonb_build_object(
    'source_table', 'career_paths', 'source_id', s.id, 'path_type', s.path_type)))
FROM staging.tmp_f2_career_paths s
JOIN brownfield.tenant_id_mappings m ON m.legacy_id = s.tenant_id::text
WHERE NOT EXISTS (
  SELECT 1 FROM sys.sys_career_paths c
  WHERE c.career_path_tenant_id = m.canonical_tenant_id
    AND c.career_path_code = 'LEGACY_CP::' || s.id::text
);

DO $$
DECLARE v_total int; v_kinds int;
BEGIN
  SELECT count(*), count(DISTINCT career_path_kind) INTO v_total, v_kinds FROM sys.sys_career_paths;
  RAISE NOTICE 'career_paths: % rows (% distinct kinds)', v_total, v_kinds;
  IF v_total = 0 THEN RAISE EXCEPTION 'career_paths: 0 rows imported (crosswalk/staging failed)'; END IF;
END $$;

COMMIT;
