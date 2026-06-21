-- ============================================================================
-- 000151_reconcile_needs_decision_registry.sql — close #13 B-50 bridges.
-- Registry hygiene (A2-class doc-drift): the reconciliation registry still
-- DECLARED 28 tables NEEDS_DECISION, but every one of them is POPULATED (has_rows)
-- and the live view sys.v_reconciliation_status already RESOLVES them POPULATED.
-- The "decision" was made across S960-S982 (the tables were filled via the
-- defensible alternatives — employee-centric keying, peer-group prevalence,
-- partial bridges); only the authored declared_status was never moved off
-- NEEDS_DECISION. This flips the 28 to the IMPORT terminal so the registry agrees
-- with the view (0 NEEDS_DECISION).
--
-- The two #13 bridges, verified live (S1002):
--   * location->org_unit : DONE — sys_branches (6 rows, imported S982, PM D1=B);
--     the advanced model uses branches as the location entity (no sys_locations).
--   * job->position      : the 8 wall-blocked tables are ALL populated (35..1791
--     rows). The clean 1:1 job->position crosswalk is a TERMINAL structural wall
--     (legacy job catalog is ESCO-disjoint from the org); the current derivation
--     is the defensible fill — there is nothing left to import.
--
-- Explicit table list (the 28 verified has_rows=t) so the flip cannot touch a
-- FUTURE genuinely-empty NEEDS_DECISION table added by a later migration.
-- Idempotent: the WHERE guards on declared_status + a NOT-LIKE marker, so a
-- twice-run leaves an identical state (no double-append, no re-flip).
-- Authored: 2026-06-21 (S1002, #13 B-50 bridges).
-- ============================================================================

UPDATE sys.sys_reconciliation_registry
SET reconciliation_registry_declared_status = 'IMPORT',
    reconciliation_registry_rationale = reconciliation_registry_rationale ||
      ' [S1002 registry reconciliation: NEEDS_DECISION->IMPORT — table populated (has_rows); v_reconciliation_status already resolves POPULATED. The clean 1:1 job->position / derivation crosswalk is a terminal structural wall (legacy job catalog ESCO-disjoint from the org); the current employee-centric / peer-group / partial-bridge fill is the defensible terminal. #13 B-50 bridges closed.]',
    updated_at = TIMESTAMPTZ '2026-06-21 00:00:00+00'
WHERE reconciliation_registry_declared_status = 'NEEDS_DECISION'
  AND reconciliation_registry_rationale NOT LIKE '%[S1002 registry reconciliation%'
  AND reconciliation_registry_table_name = ANY(ARRAY[
    'sys_behavioral_assessments','sys_career_path_steps','sys_compensation_recommendations',
    'sys_critical_positions','sys_critical_role_coverage_status','sys_employee_position_fit_scores',
    'sys_enterprise_typing_profiles','sys_gap_closure_actions','sys_gap_closure_plans',
    'sys_kpi_assessment_results','sys_kpi_measurements','sys_kpi_metric_definitions',
    'sys_learning_gaps','sys_objective_reward_rules','sys_organization_unit_kpi_templates',
    'sys_person_evidence_records','sys_position_career_paths','sys_position_economic_weight',
    'sys_position_kpi_requirements','sys_position_learning_requirements','sys_position_skill_requirements',
    'sys_position_succession_relevance','sys_readiness_scores','sys_succession_scores',
    'sys_talent_scores','sys_user_kpi_evidence','sys_user_learning_assignments',
    'sys_variable_pay_calculations'
  ]::text[]);

DO $$
DECLARE n_still int; n_import int;
BEGIN
  -- All 28 reconciled to IMPORT.
  SELECT count(*) INTO n_import FROM sys.sys_reconciliation_registry
   WHERE reconciliation_registry_declared_status = 'IMPORT'
     AND reconciliation_registry_table_name = ANY(ARRAY[
       'sys_behavioral_assessments','sys_career_path_steps','sys_compensation_recommendations',
       'sys_critical_positions','sys_critical_role_coverage_status','sys_employee_position_fit_scores',
       'sys_enterprise_typing_profiles','sys_gap_closure_actions','sys_gap_closure_plans',
       'sys_kpi_assessment_results','sys_kpi_measurements','sys_kpi_metric_definitions',
       'sys_learning_gaps','sys_objective_reward_rules','sys_organization_unit_kpi_templates',
       'sys_person_evidence_records','sys_position_career_paths','sys_position_economic_weight',
       'sys_position_kpi_requirements','sys_position_learning_requirements','sys_position_skill_requirements',
       'sys_position_succession_relevance','sys_readiness_scores','sys_succession_scores',
       'sys_talent_scores','sys_user_kpi_evidence','sys_user_learning_assignments',
       'sys_variable_pay_calculations'
     ]::text[]);
  IF n_import <> 28 THEN
    RAISE EXCEPTION '000151: expected the 28 bridge/derived tables = IMPORT, found %', n_import;
  END IF;
  -- No NEEDS_DECISION left at this point in the chain (every current one was populated).
  SELECT count(*) INTO n_still FROM sys.sys_reconciliation_registry
   WHERE reconciliation_registry_declared_status = 'NEEDS_DECISION';
  IF n_still <> 0 THEN
    RAISE EXCEPTION '000151: expected 0 NEEDS_DECISION after reconciliation, found %', n_still;
  END IF;
  RAISE NOTICE '000151: reconciliation registry — 28 NEEDS_DECISION->IMPORT (all populated); 0 NEEDS_DECISION remain. #13 B-50 bridges closed.';
END $$;
