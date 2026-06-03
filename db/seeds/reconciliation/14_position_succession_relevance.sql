-- db/seeds/reconciliation/14_position_succession_relevance.sql
-- F3 PARTIAL import: sys.sys_position_succession_relevance from legacy public.succession_plans (9/31 resolve).
-- Bridge: succession_plans.incumbent_employee_id -> sys_positions via position_metadata->>'legacy_employee_id'
--   (9 incumbents resolve to an RTL sys_position; the rest skip).
-- is_critical <- (criticality_level in high/critical). Staging: staging.tmp_f3c_sp.
-- IDEMPOTENT: anti-join on position_id (one relevance row per position).
BEGIN;
INSERT INTO sys.sys_position_succession_relevance (
  position_id, position_succession_relevance_tenant_id, is_critical, position_succession_relevance_metadata)
SELECT DISTINCT ON (p.position_id) p.position_id, p.position_tenant_id,
  (lower(s.criticality_level) IN ('high', 'critical')),
  jsonb_build_object('legacy', jsonb_strip_nulls(jsonb_build_object(
    'source_table', 'succession_plans', 'source_id', s.id, 'position_name', s.position_name,
    'criticality_level', s.criticality_level, 'status', s.status)))
FROM staging.tmp_f3c_sp s
JOIN sys.sys_positions p ON p.position_metadata->>'legacy_employee_id' = s.incumbent_employee_id::text
WHERE NOT EXISTS (SELECT 1 FROM sys.sys_position_succession_relevance r WHERE r.position_id = p.position_id)
ORDER BY p.position_id, s.id;
DO $$ DECLARE v int; BEGIN SELECT count(*) INTO v FROM sys.sys_position_succession_relevance;
  RAISE NOTICE 'position_succession_relevance: % rows', v; IF v=0 THEN RAISE EXCEPTION 'pos_succ_rel: 0 imported'; END IF; END $$;
COMMIT;
