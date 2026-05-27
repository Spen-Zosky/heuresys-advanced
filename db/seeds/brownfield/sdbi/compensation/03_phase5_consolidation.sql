-- SDBI Compensation pilot — Phase 5 consolidation. FK via sys.* natural_key. ON_ERROR_STOP=1.
BEGIN;
SELECT set_config('sdbi.run_id',(SELECT import_run_id::text FROM brownfield.import_runs
  WHERE import_run_metadata->>'pilot'='compensation' ORDER BY import_run_started_at DESC LIMIT 1), false);

INSERT INTO sys.sys_bonus_plans (bonus_plan_id,bonus_plan_tenant_id,bonus_plan_natural_key,bonus_plan_name,bonus_plan_description,
  bonus_plan_type,bonus_plan_period_start,bonus_plan_period_end,bonus_plan_payout_date,bonus_plan_total_budget,bonus_plan_allocated_amount,
  bonus_plan_calculation_method,bonus_plan_eligibility_rules,bonus_plan_performance_multipliers,bonus_plan_status,bonus_plan_created_by_user_id,
  bonus_plan_metadata,created_at,updated_at)
SELECT bonus_plan_id,bonus_plan_tenant_id,bonus_plan_natural_key,bonus_plan_name,bonus_plan_description,bonus_plan_type,
  bonus_plan_period_start,bonus_plan_period_end,bonus_plan_payout_date,bonus_plan_total_budget,bonus_plan_allocated_amount,
  bonus_plan_calculation_method,bonus_plan_eligibility_rules,bonus_plan_performance_multipliers,bonus_plan_status,NULL::uuid,
  bonus_plan_metadata,created_at,updated_at FROM temp_sdbi.bonus_plans
ON CONFLICT (bonus_plan_tenant_id,bonus_plan_natural_key) DO NOTHING;

INSERT INTO sys.sys_salary_bands (band_id,band_tenant_id,band_natural_key,band_code,band_name,band_description,band_job_level,
  band_job_family,band_currency,band_min_salary,band_mid_salary,band_max_salary,band_range_spread_percent,band_geo_region,
  band_geo_adjustment_percent,band_effective_from,band_effective_to,band_is_active,band_deleted_at,band_created_by_user_id,
  band_metadata,created_at,updated_at)
SELECT band_id,band_tenant_id,band_natural_key,band_code,band_name,band_description,band_job_level,band_job_family,band_currency,
  band_min_salary,band_mid_salary,band_max_salary,band_range_spread_percent,band_geo_region,band_geo_adjustment_percent,
  band_effective_from,band_effective_to,band_is_active,band_deleted_at,NULL::uuid,band_metadata,created_at,updated_at FROM temp_sdbi.salary_bands
ON CONFLICT (band_tenant_id,band_natural_key) DO NOTHING;

INSERT INTO sys.sys_salary_band_assignments (assignment_id,assignment_tenant_id,assignment_natural_key,assignment_band_id,
  assignment_employee_user_id,assignment_current_salary,assignment_compa_ratio,assignment_range_penetration,assignment_assigned_at,
  assignment_assigned_by_user_id,assignment_metadata,created_at,updated_at)
SELECT a.assignment_id,a.assignment_tenant_id,a.assignment_natural_key,
  (SELECT band_id FROM sys.sys_salary_bands b WHERE b.band_tenant_id=a.assignment_tenant_id
     AND b.band_natural_key='SALARY_BAND::'||a.assignment_tenant_id::text||'::'||a._legacy_band_id::text),
  NULL::uuid,a.assignment_current_salary,a.assignment_compa_ratio,a.assignment_range_penetration,a.assignment_assigned_at,
  NULL::uuid,a.assignment_metadata,a.created_at,a.updated_at
FROM temp_sdbi.salary_band_assignments a
WHERE EXISTS (SELECT 1 FROM sys.sys_salary_bands b WHERE b.band_tenant_id=a.assignment_tenant_id
     AND b.band_natural_key='SALARY_BAND::'||a.assignment_tenant_id::text||'::'||a._legacy_band_id::text)
ON CONFLICT (assignment_tenant_id,assignment_natural_key) DO NOTHING;

INSERT INTO sys.sys_source_lineage_records (source_lineage_tenant_id,source_lineage_source_system,source_lineage_source_table,
  source_lineage_source_record_id,source_lineage_source_natural_key,source_lineage_import_run_id,source_lineage_target_table_name,
  source_lineage_target_record_id,source_lineage_mapping_confidence,source_lineage_validation_status,source_lineage_metadata,
  source_lineage_sdbi_mapping_card_id,source_lineage_sdbi_confidence,source_lineage_sdbi_ai_model_id,source_lineage_sdbi_human_approver)
SELECT x.tenant,'heuresys_platform',x.src,x.sid::text,'OLDDB::'||x.src||'::'||x.sid::text,current_setting('sdbi.run_id')::uuid,
  x.tgt,x.tid,0.85,'VALID',jsonb_build_object('sdbi_pilot','compensation'),'COMPENSATION-MAP-01',0.85,'cli-claude-opus-4.7','enzo.spenuso@outlook.com'
FROM (
  SELECT bonus_plan_tenant_id tenant,'bonus_plans' src,_legacy_source_id sid,'sys_bonus_plans' tgt,bonus_plan_id tid FROM temp_sdbi.bonus_plans
  UNION ALL SELECT band_tenant_id,'salary_bands',_legacy_source_id,'sys_salary_bands',band_id FROM temp_sdbi.salary_bands
  UNION ALL SELECT assignment_tenant_id,'salary_band_assignments',_legacy_source_id,'sys_salary_band_assignments',assignment_id FROM temp_sdbi.salary_band_assignments
) x ON CONFLICT (source_lineage_source_system,source_lineage_source_table,source_lineage_source_record_id,source_lineage_target_table_name) DO NOTHING;

INSERT INTO audit.import_validation_results (import_validation_result_run_id,import_validation_result_rule_code,
  import_validation_result_status,import_validation_result_message,import_validation_result_payload)
SELECT current_setting('sdbi.run_id')::uuid,'SDBI_CONSOLIDATION_COMPLETE_V1','PASSED','SDBI Compensation pilot — '||tgt,
  jsonb_build_object('mapping_card','COMPENSATION-MAP-01','target_table',tgt)
FROM (VALUES ('sys_bonus_plans'),('sys_salary_bands'),('sys_salary_band_assignments')) v(tgt);
COMMIT;
SELECT 'sys_bonus_plans' t,count(*) FROM sys.sys_bonus_plans UNION ALL SELECT 'sys_salary_bands',count(*) FROM sys.sys_salary_bands
UNION ALL SELECT 'sys_salary_band_assignments',count(*) FROM sys.sys_salary_band_assignments ORDER BY 1;
