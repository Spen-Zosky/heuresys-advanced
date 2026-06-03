-- db/seeds/reconciliation/38_user_learning_evidence.sql
-- D5 / Wall W3 — sys.sys_user_learning_evidence from legacy completion sources (employee-centric).
-- Dossier docs/kb/RECONCILIATION_WALLS_AND_AI_DECISION_DOSSIER.md §4 + §7 D5.
--
-- UNBLOCKED by the course=module catalog (000061 + seed 37): the NOT-NULL module_id FK now has a
-- catalog row to point at. This is COMPLETION evidence (the table carries completed_at + score +
-- certificate), so only real completions are imported:
--   - public.course_enrollments      where completed_at  IS NOT NULL  (1888 such; 1394 resolvable)
--   - public.employee_training_records where completion_date IS NOT NULL (   40 such;   40 resolvable)
--
-- EMPLOYEE-CENTRIC (I14 / ADR-0024): the person FK is the legacy EMPLOYEE, never the legacy user.
--   user <- 'LEGACY_EMP::' || employee_id -> sys.sys_users (159/269 distinct evidence employees
--   materialize -> the ~59% employee->user ceiling, NOT a wall; same ceiling as seed 15).
-- module <- course code -> the GLOBAL course=module (seed 37). The module is tenant-agnostic; the
--   evidence row is tenant-scoped via the resolved user's tenant (I5 via FK + the user join).
--
-- ==========================================================================================
-- PREREQUISITE staging (supervised COPY pipe — UNION of both completion sources, course resolved):
--   psql … -c "
--     CREATE TABLE IF NOT EXISTS staging.tmp_w3_evidence (
--       source_table text, source_id uuid, employee_id uuid, course_code text,
--       completed_at timestamptz, score numeric, certificate_url text);
--     TRUNCATE staging.tmp_w3_evidence;"
--
--   ssh oracle-vm-default 'sudo -u postgres psql -d heuresys_platform -c "\copy (
--     SELECT ''course_enrollments'', ce.id, ce.employee_id, c.code, ce.completed_at, ce.score, ce.certificate_url
--       FROM public.course_enrollments ce JOIN public.courses c ON c.id = ce.course_id
--       WHERE ce.employee_id IS NOT NULL AND ce.completed_at IS NOT NULL
--     UNION ALL
--     SELECT ''employee_training_records'', etr.id, etr.employee_id, c.code,
--            etr.completion_date::timestamptz, etr.score, etr.certificate_url
--       FROM public.employee_training_records etr JOIN public.courses c ON c.id = etr.course_id
--       WHERE etr.employee_id IS NOT NULL AND etr.completion_date IS NOT NULL
--     ) TO STDOUT WITH (FORMAT csv)"' \
--     | psql … -c "\copy staging.tmp_w3_evidence FROM STDIN WITH (FORMAT csv)"
--
-- Measured live S961: staging = 1928 rows (1888 enroll + 40 training). Resolvable (employee->user
-- AND course->module) = 1434 DISTINCT (user, module, completed_at). enrollment score range
-- 70.07..99.93, training 60..100; certificate_url is NULL for every legacy row (no cert evidence).
-- ==========================================================================================
-- IDEMPOTENT: NK = (user_id, module_id, completed_at). The table has no UNIQUE constraint (only the
-- PK on id), so we anti-join on the NK (no ON CONFLICT target available). DISTINCT ON collapses
-- same-NK source duplicates; the anti-join makes the 2nd run insert 0.
-- ==========================================================================================

BEGIN;

INSERT INTO sys.sys_user_learning_evidence (
  user_learning_evidence_user_id,
  user_learning_evidence_tenant_id,
  user_learning_evidence_module_id,
  user_learning_evidence_completed_at,
  user_learning_evidence_score,
  user_learning_evidence_certificate_uri,
  user_learning_evidence_metadata
)
SELECT DISTINCT ON (u.user_id, lm.learning_module_id, s.completed_at)
  u.user_id,
  u.user_tenant_id,
  lm.learning_module_id,
  s.completed_at,
  s.score,
  s.certificate_url,
  jsonb_build_object('legacy', jsonb_strip_nulls(jsonb_build_object(
    'source_table', s.source_table, 'source_id', s.source_id,
    'course_code', s.course_code, 'score', s.score)))
FROM staging.tmp_w3_evidence s
JOIN sys.sys_users u
  ON u.user_external_code = 'LEGACY_EMP::' || s.employee_id::text
 AND u.user_tenant_id IS NOT NULL
JOIN sys.sys_learning_modules lm
  ON lm.learning_module_code = s.course_code
 AND lm.learning_module_tenant_id IS NULL
WHERE s.completed_at IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM sys.sys_user_learning_evidence x
    WHERE x.user_learning_evidence_user_id = u.user_id
      AND x.user_learning_evidence_module_id = lm.learning_module_id
      AND x.user_learning_evidence_completed_at = s.completed_at)
ORDER BY u.user_id, lm.learning_module_id, s.completed_at, s.score DESC NULLS LAST;

DO $$
DECLARE v_total int; v_users int; v_orphan_mod int; v_orphan_tenant int;
BEGIN
  SELECT count(*), count(DISTINCT user_learning_evidence_user_id) INTO v_total, v_users
    FROM sys.sys_user_learning_evidence;
  -- FK integrity beyond the constraint: every module/tenant resolves; tenant coheres with the user.
  SELECT count(*) INTO v_orphan_mod FROM sys.sys_user_learning_evidence e
    WHERE NOT EXISTS (SELECT 1 FROM sys.sys_learning_modules m WHERE m.learning_module_id = e.user_learning_evidence_module_id);
  SELECT count(*) INTO v_orphan_tenant FROM sys.sys_user_learning_evidence e
    JOIN sys.sys_users u ON u.user_id = e.user_learning_evidence_user_id
    WHERE u.user_tenant_id <> e.user_learning_evidence_tenant_id;
  RAISE NOTICE '38: user_learning_evidence=% across % users (orphan_module=%, tenant_mismatch=%)',
    v_total, v_users, v_orphan_mod, v_orphan_tenant;
  IF v_total = 0 THEN RAISE EXCEPTION '38: user_learning_evidence still 0 after import'; END IF;
  IF v_orphan_mod <> 0 THEN RAISE EXCEPTION '38: % evidence rows orphan a module', v_orphan_mod; END IF;
  IF v_orphan_tenant <> 0 THEN RAISE EXCEPTION '38: % evidence rows tenant-mismatch the user', v_orphan_tenant; END IF;
END $$;

COMMIT;
