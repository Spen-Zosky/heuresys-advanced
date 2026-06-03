-- 29_objective_reward_rules.sql — F4 bucket-C. <- legacy bonus_plans (6 RTL via tenant crosswalk).
-- tenant via brownfield.tenant_id_mappings; code=LEGACY_BP::id; name=bonus_plan name. Staging: staging.tmp_f4_or.
-- IDEMPOTENT: anti-join (tenant, code).
BEGIN;
INSERT INTO sys.sys_objective_reward_rules (
  objective_reward_rule_tenant_id, objective_reward_rule_code, objective_reward_rule_name, objective_reward_rule_payload)
SELECT m.canonical_tenant_id, 'LEGACY_BP::'||s.id::text, s.name,
  jsonb_build_object('legacy', jsonb_strip_nulls(jsonb_build_object('source_table','bonus_plans','source_id',s.id,
    'bonus_type',s.bonus_type,'calculation_method',s.calculation_method)))
FROM staging.tmp_f4_or s
JOIN brownfield.tenant_id_mappings m ON m.legacy_id=s.tenant_id::text
WHERE NOT EXISTS (SELECT 1 FROM sys.sys_objective_reward_rules x
  WHERE x.objective_reward_rule_tenant_id=m.canonical_tenant_id AND x.objective_reward_rule_code='LEGACY_BP::'||s.id::text);
DO $$ DECLARE v int; BEGIN SELECT count(*) INTO v FROM sys.sys_objective_reward_rules;
  RAISE NOTICE 'objective_reward_rules: % rows', v; IF v=0 THEN RAISE EXCEPTION '0'; END IF; END $$;
COMMIT;
