-- 34_gap_closure_actions.sql — F4 bucket-C. <- legacy learning_recommendations (440 user+gap resolve).
-- gap_id = a learning_gap of the same user; kind=TRAINING_ASSIGNMENT; status=PROPOSED. IDEMPOTENT: anti-join (source_id).
BEGIN;
INSERT INTO sys.sys_gap_closure_actions (
  gap_closure_action_gap_id, gap_closure_action_tenant_id, gap_closure_action_kind,
  gap_closure_action_status, gap_closure_action_payload)
SELECT g.learning_gap_id, u.user_tenant_id, 'TRAINING_ASSIGNMENT', 'PROPOSED',
  jsonb_build_object('legacy', jsonb_strip_nulls(jsonb_build_object('source_table','learning_recommendations',
    'source_id',s.id,'recommendation_type',s.recommendation_type,'status',s.status)))
FROM staging.tmp_f4_gca s
JOIN sys.sys_users u ON u.user_external_code='LEGACY_EMP::'||s.employee_id::text AND u.user_tenant_id IS NOT NULL
JOIN LATERAL (SELECT learning_gap_id FROM sys.sys_learning_gaps lg WHERE lg.learning_gap_user_id=u.user_id LIMIT 1) g ON true
WHERE NOT EXISTS (SELECT 1 FROM sys.sys_gap_closure_actions x
  WHERE x.gap_closure_action_payload->'legacy'->>'source_id'=s.id::text);
DO $$ DECLARE v int; BEGIN SELECT count(*) INTO v FROM sys.sys_gap_closure_actions;
  RAISE NOTICE 'gap_closure_actions: % rows', v; IF v=0 THEN RAISE EXCEPTION '0'; END IF; END $$;
COMMIT;
