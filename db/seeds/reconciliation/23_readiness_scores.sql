-- 23_readiness_scores.sql — F4 bucket-C. <- legacy succession_candidates.readiness_level (90 resolve).
-- user+position via candidate_employee_id. horizon (NOT NULL) from readiness_level; value = horizon-derived proxy.
-- Most-ready wins per (user, position). Staging: staging.tmp_f4_sc. IDEMPOTENT: anti-join (user, position).
BEGIN;
INSERT INTO sys.sys_readiness_scores (
  readiness_score_tenant_id, readiness_score_user_id, readiness_score_position_id,
  readiness_score_horizon, readiness_score_value, readiness_score_payload, readiness_score_computed_at)
SELECT DISTINCT ON (u.user_id, p.position_id) u.user_tenant_id, u.user_id, p.position_id,
  CASE s.readiness_level WHEN 'ready_now' THEN 'READY_NOW' WHEN 'ready_1_year' THEN 'READY_1_YEAR'
       WHEN 'ready_2_years' THEN 'READY_2_YEARS' ELSE 'NOT_READY' END,
  CASE s.readiness_level WHEN 'ready_now' THEN 100 WHEN 'ready_1_year' THEN 66
       WHEN 'ready_2_years' THEN 40 ELSE 15 END::numeric(5,2),
  jsonb_build_object('legacy', jsonb_strip_nulls(jsonb_build_object(
    'source_table','succession_candidates','source_id',s.id,'readiness_level',s.readiness_level))),
  now()
FROM staging.tmp_f4_sc s
JOIN sys.sys_users u ON u.user_external_code='LEGACY_EMP::'||s.candidate_employee_id::text AND u.user_tenant_id IS NOT NULL
JOIN sys.sys_positions p ON p.position_metadata->>'legacy_employee_id'=s.candidate_employee_id::text
WHERE NOT EXISTS (SELECT 1 FROM sys.sys_readiness_scores x
  WHERE x.readiness_score_user_id=u.user_id AND x.readiness_score_position_id=p.position_id)
ORDER BY u.user_id, p.position_id,
  CASE s.readiness_level WHEN 'ready_now' THEN 1 WHEN 'ready_1_year' THEN 2 WHEN 'ready_2_years' THEN 3 ELSE 4 END;
DO $$ DECLARE v int; BEGIN SELECT count(*) INTO v FROM sys.sys_readiness_scores;
  RAISE NOTICE 'readiness_scores: % rows', v; IF v=0 THEN RAISE EXCEPTION '0'; END IF; END $$;
COMMIT;
