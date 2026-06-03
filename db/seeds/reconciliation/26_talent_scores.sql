-- 26_talent_scores.sql — F4 bucket-C. <- legacy mv_employee_performance_context (157 resolve).
-- user LEGACY_EMP::; performance=latest_overall_rating*20 (1-5 -> 0-100); potential from latest_potential_rating
-- (text high/medium/low -> 90/60/30); band = 9-box quadrant (defensible). IDEMPOTENT: anti-join (user).
BEGIN;
INSERT INTO sys.sys_talent_scores (
  talent_score_tenant_id, talent_score_user_id, talent_score_performance, talent_score_potential,
  talent_score_band, talent_score_payload, talent_score_computed_at)
SELECT DISTINCT ON (u.user_id) u.user_tenant_id, u.user_id,
  round(s.perf::numeric*20, 2),
  CASE lower(s.potential) WHEN 'high' THEN 90 WHEN 'medium' THEN 60 WHEN 'low' THEN 30 ELSE 50 END::numeric(5,2),
  CASE WHEN s.perf::numeric>=3.5 AND lower(s.potential)='high' THEN 'STAR'
       WHEN s.perf::numeric>=3.5 THEN 'HIGH_PERFORMER'
       WHEN lower(s.potential)='high' THEN 'HIGH_POTENTIAL' ELSE 'CORE' END,
  jsonb_build_object('legacy', jsonb_build_object('source_table','mv_employee_performance_context',
    'latest_overall_rating',s.perf,'latest_potential_rating',s.potential)), now()
FROM staging.tmp_f4_ts s
JOIN sys.sys_users u ON u.user_external_code='LEGACY_EMP::'||s.employee_id::text AND u.user_tenant_id IS NOT NULL
WHERE s.perf ~ '^[0-9.]+$' AND NOT EXISTS (SELECT 1 FROM sys.sys_talent_scores x WHERE x.talent_score_user_id=u.user_id)
ORDER BY u.user_id, s.perf::numeric DESC;
DO $$ DECLARE v int; BEGIN SELECT count(*) INTO v FROM sys.sys_talent_scores;
  RAISE NOTICE 'talent_scores: % rows', v; IF v=0 THEN RAISE EXCEPTION '0'; END IF; END $$;
COMMIT;
