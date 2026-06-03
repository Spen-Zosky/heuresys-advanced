-- 22_succession_scores.sql — F4 bucket-C. <- legacy succession_candidates (90 user+position resolve).
-- user+position via candidate_employee_id (LEGACY_EMP:: + legacy_employee_id). horizon from readiness_level;
-- value = rank-derived proxy (best rank wins). Staging: staging.tmp_f4_sc. IDEMPOTENT: anti-join (user, position).
BEGIN;
INSERT INTO sys.sys_succession_scores (
  succession_score_tenant_id, succession_score_user_id, succession_score_position_id,
  succession_score_value, succession_score_horizon, succession_score_payload, succession_score_computed_at)
SELECT DISTINCT ON (u.user_id, p.position_id) u.user_tenant_id, u.user_id, p.position_id,
  greatest(10, 100 - (coalesce(s.rank_order,1)-1)*15)::numeric(5,2),
  CASE s.readiness_level WHEN 'ready_now' THEN 'READY_NOW' WHEN 'ready_1_year' THEN 'READY_1_YEAR'
       WHEN 'ready_2_years' THEN 'READY_2_YEARS' ELSE 'NOT_READY' END,
  jsonb_build_object('legacy', jsonb_strip_nulls(jsonb_build_object(
    'source_table','succession_candidates','source_id',s.id,'readiness_level',s.readiness_level,'rank_order',s.rank_order))),
  now()
FROM staging.tmp_f4_sc s
JOIN sys.sys_users u ON u.user_external_code='LEGACY_EMP::'||s.candidate_employee_id::text AND u.user_tenant_id IS NOT NULL
JOIN sys.sys_positions p ON p.position_metadata->>'legacy_employee_id'=s.candidate_employee_id::text
WHERE NOT EXISTS (SELECT 1 FROM sys.sys_succession_scores x
  WHERE x.succession_score_user_id=u.user_id AND x.succession_score_position_id=p.position_id)
ORDER BY u.user_id, p.position_id, coalesce(s.rank_order,99);
DO $$ DECLARE v int; BEGIN SELECT count(*) INTO v FROM sys.sys_succession_scores;
  RAISE NOTICE 'succession_scores: % rows', v; IF v=0 THEN RAISE EXCEPTION '0'; END IF; END $$;
COMMIT;
