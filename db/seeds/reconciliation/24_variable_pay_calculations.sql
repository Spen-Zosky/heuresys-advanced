-- 24_variable_pay_calculations.sql — F4 bucket-C. <- legacy bonus_allocations (121 resolve).
-- user LEGACY_EMP::employee_id; period from bonus_plans (plan_id); amount_eur=actual_amount.
-- Staging: staging.tmp_f4_vp. IDEMPOTENT: anti-join (user, source_id).
BEGIN;
INSERT INTO sys.sys_variable_pay_calculations (
  variable_pay_calculation_tenant_id, variable_pay_calculation_user_id,
  variable_pay_calculation_period_start, variable_pay_calculation_period_end,
  variable_pay_calculation_amount_eur, variable_pay_calculation_payload, variable_pay_calculation_computed_at)
SELECT u.user_tenant_id, u.user_id, s.period_start, s.period_end, s.amount,
  jsonb_build_object('legacy', jsonb_strip_nulls(jsonb_build_object(
    'source_table','bonus_allocations','source_id',s.id,'status',s.status,'actual_amount',s.amount))), now()
FROM staging.tmp_f4_vp s
JOIN sys.sys_users u ON u.user_external_code='LEGACY_EMP::'||s.employee_id::text AND u.user_tenant_id IS NOT NULL
WHERE s.period_start IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM sys.sys_variable_pay_calculations x
    WHERE x.variable_pay_calculation_user_id=u.user_id AND x.variable_pay_calculation_payload->'legacy'->>'source_id'=s.id::text);
DO $$ DECLARE v int; BEGIN SELECT count(*) INTO v FROM sys.sys_variable_pay_calculations;
  RAISE NOTICE 'variable_pay_calculations: % rows', v; IF v=0 THEN RAISE EXCEPTION '0'; END IF; END $$;
COMMIT;
