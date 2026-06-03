-- db/seeds/reconciliation/16_finalize_deadends.sql
-- F3/F3b CLOSURE: annotate the measured DEAD-END targets in the reconciliation registry.
-- These bucket-B tables have a legacy source WITH rows, but the required FK is 0-overlap / cascade-blocked
-- on the actual data (not a modeling gap that any bridge could close). They stay declared_status=NEEDS_DECISION
-- (a future canonical source or schema change could revisit) but the rationale now records the dead-end measure.
-- IDEMPOTENT: only prepends if not already annotated.
BEGIN;
UPDATE sys.sys_reconciliation_registry r SET
  reconciliation_registry_rationale = '[DEAD-END F3/F3b S960: ' || d.reason || '] ' || r.reconciliation_registry_rationale
FROM (VALUES
  ('sys_position_kpi_requirements',        'job_kpis 0/2000 — ESCO job_templates disjoint from the workforce'),
  ('sys_succession_pools',                 'talent_pools 0/24 — template/instance disjoint'),
  ('sys_successor_candidates',             'pool_id NOT NULL -> empty dead-end sys_succession_pools (cascade)'),
  ('sys_process_kpi_templates',            'process keyspace BP-xxx vs blueprint registry ordinals 00..22 disjoint'),
  ('sys_learning_path_steps',              'module_id 0/124 — legacy course catalog landed in sys_learning_paths, not modules'),
  ('sys_skill_learning_mappings',          'module_id 0/717 — same learning-module catalog gap'),
  ('sys_user_learning_evidence',           'module_id 0/2657 — module-anchored, no path-id fallback'),
  ('sys_organization_unit_kpi_templates',  'template/instance namespaces disjoint — 1 code overlap / 4% ambiguous'),
  ('sys_branches',                         'location->org_unit bridge not measured in S960 — candidate, not a confirmed dead-end')
) AS d(tbl, reason)
WHERE r.reconciliation_registry_table_name = d.tbl
  AND r.reconciliation_registry_rationale NOT LIKE '[DEAD-END%'
  AND r.reconciliation_registry_rationale NOT LIKE '[%not measured%';
DO $$ DECLARE v int; BEGIN
  SELECT count(*) INTO v FROM sys.sys_reconciliation_registry WHERE reconciliation_registry_rationale LIKE '[DEAD-END%' OR reconciliation_registry_rationale LIKE '%not measured%';
  RAISE NOTICE 'finalize_deadends: % registry rows annotated', v;
END $$;
COMMIT;
