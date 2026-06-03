-- db/seeds/reconciliation/10_position_career_paths.sql
-- F3 bridgeable import #1: sys.sys_position_career_paths from legacy public.employee_career_progress.
-- Crosses the job->position wall via the EMPLOYEE bridge (employee_career_progress is the per-person
-- enrollment table; career_path_levels itself carries no position/employee key).
--
-- PREREQUISITE staging (supervised COPY pipe):
--   CREATE TABLE IF NOT EXISTS staging.tmp_f3_ecp (id uuid, employee_id uuid, path_id uuid, status text,
--     overall_fit_score numeric, skill_coverage_pct numeric, estimated_months_to_ready int);
--   TRUNCATE staging.tmp_f3_ecp;
--   ssh oracle-vm-default 'sudo -u postgres psql -d heuresys_platform -c "\copy (SELECT id, employee_id, path_id,
--     status, overall_fit_score, skill_coverage_pct, estimated_months_to_ready FROM employee_career_progress)
--     TO STDOUT WITH (FORMAT csv)"' | psql … -c "\copy staging.tmp_f3_ecp FROM STDIN WITH (FORMAT csv)"
--
-- Bridge (measured S960, 40/40 resolve):
--   position_id <- employee_id -> sys.sys_positions via position_metadata->>'legacy_employee_id'
--   career_path_id <- path_id -> sys.sys_career_paths via career_path_code = 'LEGACY_CP::'||path_id (within position tenant)
--   tenant <- the resolved position's tenant.
-- IDEMPOTENT: ON CONFLICT (position_id, career_path_id) DO NOTHING (also dedups intra-batch level rows).

BEGIN;

INSERT INTO sys.sys_position_career_paths (
  position_id, position_career_path_tenant_id, career_path_id, position_career_path_metadata
)
SELECT
  p.position_id,
  p.position_tenant_id,
  cp.career_path_id,
  jsonb_build_object('legacy', jsonb_strip_nulls(jsonb_build_object(
    'source_table', 'employee_career_progress', 'source_id', s.id, 'status', s.status,
    'overall_fit_score', s.overall_fit_score, 'skill_coverage_pct', s.skill_coverage_pct,
    'estimated_months_to_ready', s.estimated_months_to_ready)))
FROM staging.tmp_f3_ecp s
JOIN sys.sys_positions p
  ON p.position_metadata->>'legacy_employee_id' = s.employee_id::text
JOIN sys.sys_career_paths cp
  ON cp.career_path_code = 'LEGACY_CP::' || s.path_id::text
 AND cp.career_path_tenant_id = p.position_tenant_id
ON CONFLICT (position_id, career_path_id) DO NOTHING;

DO $$
DECLARE v_total int;
BEGIN
  SELECT count(*) INTO v_total FROM sys.sys_position_career_paths;
  RAISE NOTICE 'position_career_paths: % rows', v_total;
  IF v_total = 0 THEN RAISE EXCEPTION 'position_career_paths: 0 rows imported'; END IF;
END $$;

COMMIT;
