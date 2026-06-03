-- db/seeds/reconciliation/11_position_learning_requirements.sql
-- F3 bridgeable import #2: sys.sys_position_learning_requirements from legacy public.job_title_courses.
-- Crosses the job->position wall because job_title_courses key on a job_title employees ACTUALLY HOLD
-- (the B-51 job_role vocabulary), unlike job_kpis which keyed on the disjoint ESCO job_templates.
--
-- 1:N FAN-OUT (design decision, signed off): a job_title is a ROLE label, not an instance key, so each
-- source row expands to every sys_position carrying that role. 207 source rows -> 1791 distinct
-- (position, learning_path) pairs. Semantics: "every Bank Teller position requires these courses".
--
-- PREREQUISITE staging (supervised COPY pipe — note the join to courses for the code):
--   CREATE TABLE IF NOT EXISTS staging.tmp_f3_jtc (id uuid, job_title text, course_code text, course_title text,
--     requirement_type text, priority int, rationale text);
--   TRUNCATE staging.tmp_f3_jtc;
--   ssh oracle-vm-default 'sudo -u postgres psql -d heuresys_platform -c "\copy (SELECT jtc.id, jtc.job_title,
--     c.code, c.title, jtc.requirement_type, jtc.priority, jtc.rationale FROM job_title_courses jtc
--     JOIN courses c ON c.id=jtc.course_id) TO STDOUT WITH (FORMAT csv)"' | psql … -c "\copy staging.tmp_f3_jtc FROM STDIN WITH (FORMAT csv)"
--
-- Bridge (measured S960, 207/207 both FKs resolve):
--   position_id <- job_title -> sys.sys_job_roles.job_role_name (case-insensitive) -> sys.sys_positions.position_job_role_id (1:N)
--   learning_path_id <- course_code -> sys.sys_learning_paths.learning_path_code (within the position tenant)
--   is_mandatory <- (requirement_type = 'mandatory'). tenant <- the resolved position's tenant.
-- IDEMPOTENT: ON CONFLICT (position_id, learning_path_id) DO NOTHING (also collapses the fan-out duplicates).

BEGIN;

INSERT INTO sys.sys_position_learning_requirements (
  position_id, position_learning_requirement_tenant_id, learning_path_id,
  is_mandatory, position_learning_requirement_metadata
)
SELECT DISTINCT ON (p.position_id, lp.learning_path_id)
  p.position_id,
  p.position_tenant_id,
  lp.learning_path_id,
  (s.requirement_type = 'mandatory'),
  jsonb_build_object('legacy', jsonb_strip_nulls(jsonb_build_object(
    'source_table', 'job_title_courses', 'source_id', s.id, 'job_title', s.job_title,
    'course_code', s.course_code, 'requirement_type', s.requirement_type,
    'priority', s.priority, 'rationale', s.rationale)))
FROM staging.tmp_f3_jtc s
JOIN sys.sys_job_roles jr ON lower(jr.job_role_name) = lower(s.job_title)
JOIN sys.sys_positions p ON p.position_job_role_id = jr.job_role_id
JOIN sys.sys_learning_paths lp
  ON lp.learning_path_code = s.course_code
 AND lp.learning_path_tenant_id = p.position_tenant_id
ORDER BY p.position_id, lp.learning_path_id, s.priority
ON CONFLICT (position_id, learning_path_id) DO NOTHING;

DO $$
DECLARE v_total int; v_mand int;
BEGIN
  SELECT count(*), count(*) FILTER (WHERE is_mandatory) INTO v_total, v_mand FROM sys.sys_position_learning_requirements;
  RAISE NOTICE 'position_learning_requirements: % rows (% mandatory)', v_total, v_mand;
  IF v_total = 0 THEN RAISE EXCEPTION 'position_learning_requirements: 0 rows imported'; END IF;
END $$;

COMMIT;
