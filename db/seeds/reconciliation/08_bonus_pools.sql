-- db/seeds/reconciliation/08_bonus_pools.sql
-- F2 bucket-A import #5: sys.sys_bonus_pools from legacy public.bonus_plans (RTL subset).
--
-- PREREQUISITE staging (supervised COPY pipe):
--   CREATE TABLE IF NOT EXISTS staging.tmp_f2_bonus_pools (id uuid, tenant_id uuid, name text, description text,
--     bonus_type text, period_start date, period_end date, payout_date date, total_budget numeric,
--     allocated_amount numeric, calculation_method text, eligibility_rules jsonb, performance_multipliers jsonb, status text);
--   TRUNCATE staging.tmp_f2_bonus_pools;
--   ssh oracle-vm-default 'sudo -u postgres psql -d heuresys_platform -c "\copy (SELECT id, tenant_id, name,
--     description, bonus_type, period_start, period_end, payout_date, total_budget, allocated_amount,
--     calculation_method, eligibility_rules, performance_multipliers, status FROM bonus_plans) TO STDOUT WITH (FORMAT csv)"' \
--     | psql … -c "\copy staging.tmp_f2_bonus_pools FROM STDIN WITH (FORMAT csv)"
--
-- FK resolution (measured S960): tenant via brownfield.tenant_id_mappings — 6/14 RTL resolve
--   (the 8 rows of out-of-scope legacy tenants fb1e866c + 1d7bf448 are skipped by the JOIN).
--   All 6 RTL rows carry period_start+period_end (target NOT NULL satisfied).
-- scope='TENANT' (no org-unit scoping in the source). org_unit_id NULL. total_eur <- total_budget.
-- IDEMPOTENT: anti-join on (tenant, legacy source_id in payload). 2nd run inserts 0.

BEGIN;

INSERT INTO sys.sys_bonus_pools (
  bonus_pool_tenant_id, bonus_pool_scope, bonus_pool_period_start, bonus_pool_period_end,
  bonus_pool_total_eur, bonus_pool_payload
)
SELECT
  m.canonical_tenant_id,
  'TENANT',
  s.period_start,
  s.period_end,
  s.total_budget,
  jsonb_build_object('legacy', jsonb_strip_nulls(jsonb_build_object(
    'source_table', 'bonus_plans', 'source_id', s.id, 'name', s.name, 'description', s.description,
    'bonus_type', s.bonus_type, 'calculation_method', s.calculation_method, 'status', s.status,
    'payout_date', s.payout_date, 'allocated_amount', s.allocated_amount,
    'eligibility_rules', s.eligibility_rules, 'performance_multipliers', s.performance_multipliers)))
FROM staging.tmp_f2_bonus_pools s
JOIN brownfield.tenant_id_mappings m ON m.legacy_id = s.tenant_id::text
WHERE s.period_start IS NOT NULL AND s.period_end IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM sys.sys_bonus_pools b
    WHERE b.bonus_pool_tenant_id = m.canonical_tenant_id
      AND b.bonus_pool_payload -> 'legacy' ->> 'source_id' = s.id::text
  );

DO $$
DECLARE v_total int;
BEGIN
  SELECT count(*) INTO v_total FROM sys.sys_bonus_pools;
  RAISE NOTICE 'bonus_pools: % rows', v_total;
  IF v_total = 0 THEN RAISE EXCEPTION 'bonus_pools: 0 rows imported'; END IF;
END $$;

COMMIT;
