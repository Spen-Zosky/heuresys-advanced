-- 25_compensation_recommendations.sql — F4 bucket-C. <- legacy merit_recommendations (116 resolve).
-- user LEGACY_EMP::; period from merit_cycles.effective_date; amount_eur=recommended_increase_amount;
-- signal from status (approved*->APPROVED, rejected->REJECTED, else PROPOSED).
-- Staging: staging.tmp_f4_cr. IDEMPOTENT: anti-join (user, source_id).
BEGIN;
INSERT INTO sys.sys_compensation_recommendations (
  compensation_recommendation_tenant_id, compensation_recommendation_user_id,
  compensation_recommendation_period_start, compensation_recommendation_period_end,
  compensation_recommendation_signal, compensation_recommendation_amount_eur,
  compensation_recommendation_payload, compensation_recommendation_computed_at)
SELECT u.user_tenant_id, u.user_id, s.period_start, s.period_end,
  CASE WHEN s.status IN ('manager_approved','hr_approved','final_approved') THEN 'APPROVED'
       WHEN s.status='rejected' THEN 'REJECTED' ELSE 'PROPOSED' END,
  s.amount,
  jsonb_build_object('legacy', jsonb_strip_nulls(jsonb_build_object(
    'source_table','merit_recommendations','source_id',s.id,'status',s.status,'increase_percent',s.percent))), now()
FROM staging.tmp_f4_cr s
JOIN sys.sys_users u ON u.user_external_code='LEGACY_EMP::'||s.employee_id::text AND u.user_tenant_id IS NOT NULL
WHERE s.period_start IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM sys.sys_compensation_recommendations x
    WHERE x.compensation_recommendation_user_id=u.user_id AND x.compensation_recommendation_payload->'legacy'->>'source_id'=s.id::text);
DO $$ DECLARE v int; BEGIN SELECT count(*) INTO v FROM sys.sys_compensation_recommendations;
  RAISE NOTICE 'compensation_recommendations: % rows', v; IF v=0 THEN RAISE EXCEPTION '0'; END IF; END $$;
COMMIT;
