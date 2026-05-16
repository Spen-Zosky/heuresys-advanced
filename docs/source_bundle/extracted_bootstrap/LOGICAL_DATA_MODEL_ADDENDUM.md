# Logical Data Model Addendum

This file consolidates logical data-model areas introduced by the bundle.

## Universal Domain

- enterprise_typing_profile
- activity_classification_mapping
- industry_blueprint_mapping
- blueprint_activation
- organization_unit
- position
- job_role
- position_intelligence_profile
- person_evidence_record

## KPI Domain

- kpi_catalog
- process_kpi_template
- org_unit_kpi_template
- position_kpi_requirement
- employee_kpi_assignment
- kpi_metric_definition
- kpi_target
- kpi_measurement
- kpi_assessment_method
- kpi_weighting_rule
- kpi_assessment_result

## Learning Domain

- learning_catalog
- learning_module
- learning_path
- position_learning_requirement
- skill_learning_module_map
- certification_requirement
- employee_learning_assignment
- learning_completion_record
- learning_gap
- learning_recommendation

## Workforce Intelligence Domain

- position_requirement_weight
- role_weighting_profile
- skill_assessment
- behavioral_assessment
- employee_position_fit_score
- gap_analysis_result
- gap_closure_plan
- readiness_score
- talent_score
- succession_score

## Career and Succession Domain

- career_path_catalog
- career_path_step
- position_career_path
- employee_career_plan
- employee_target_position
- critical_position
- succession_pool
- successor_candidate
- successor_readiness
- critical_role_coverage_status

## Compensation Intelligence Domain

- compensation_band
- position_compensation_profile
- position_economic_weight
- objective_reward_rule
- payout_curve
- bonus_pool
- variable_pay_calculation
- reward_gate
- compensation_recommendation
- payroll_handoff_record

## Warning

These are logical names. Before SQL generation, convert them to the approved Heuresys `sys.sys_*` naming conventions and validate against the actual database source of truth.
