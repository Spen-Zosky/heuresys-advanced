-- 36_finalize_bucketC_deadends.sql — F4 CLOSURE: annotate the 4 non-importable bucket-C tables.
-- These are the only bucket-C tables NOT imported (the other 19 were re-measured and imported S960).
-- They stay declared_status=NEEDS_DECISION; rationale records the measured reason. IDEMPOTENT.
BEGIN;
UPDATE sys.sys_reconciliation_registry r SET
  reconciliation_registry_rationale = '[F4 NOT-IMPORTABLE S960: ' || d.reason || '] ' || r.reconciliation_registry_rationale,
  reconciliation_registry_legacy_source_rows = 0
FROM (VALUES
  ('sys_payout_curves',        'NO_SOURCE — genuinely computed comp curve, no legacy row source found'),
  ('sys_user_target_positions','0-overlap — career_goals/career_path_recommendations resolve 0/60 to RTL users'),
  ('sys_successor_readiness',  'cascade — readiness data exists but FK parent sys_successor_candidates is empty (pool dead-end)'),
  ('sys_reward_gate_results',  'cascade — gate_id NOT NULL -> sys_reward_gates is empty')
) AS d(tbl, reason)
WHERE r.reconciliation_registry_table_name = d.tbl
  AND r.reconciliation_registry_rationale NOT LIKE '[F4 NOT-IMPORTABLE%';
DO $$ DECLARE v int; BEGIN
  SELECT count(*) INTO v FROM sys.sys_reconciliation_registry WHERE reconciliation_registry_rationale LIKE '[F4 NOT-IMPORTABLE%';
  RAISE NOTICE 'finalize_bucketC: % rows annotated', v;
END $$;
COMMIT;
