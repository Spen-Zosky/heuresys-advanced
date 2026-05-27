-- SDBI Compensation pilot — Phase 3 seed. Run via psql -v ON_ERROR_STOP=1.
BEGIN;
DO $$ DECLARE v uuid := gen_random_uuid(); BEGIN
  INSERT INTO brownfield.import_runs (import_run_id, import_run_export_id, import_run_status, import_run_started_at, import_run_metadata)
  VALUES (v,(SELECT source_export_id FROM brownfield.source_exports ORDER BY 1 LIMIT 1),'RUNNING',now(),
    jsonb_build_object('workflow','SDBI_PHASE_3','pilot','compensation','mapping_card','COMPENSATION-MAP-01','source','heuresys_platform_0507'));
  PERFORM set_config('sdbi.run_id', v::text, true);
END $$;

INSERT INTO temp_sdbi.bonus_plans (_legacy_source_id,_import_run_id,bonus_plan_tenant_id,bonus_plan_natural_key,bonus_plan_name,
  bonus_plan_description,bonus_plan_type,bonus_plan_period_start,bonus_plan_period_end,bonus_plan_payout_date,bonus_plan_total_budget,
  bonus_plan_allocated_amount,bonus_plan_calculation_method,bonus_plan_eligibility_rules,bonus_plan_performance_multipliers,
  bonus_plan_status,bonus_plan_metadata,created_at,updated_at)
SELECT src.id,current_setting('sdbi.run_id')::uuid,tm.canonical_tenant_id,'BONUS_PLAN::'||tm.canonical_tenant_id::text||'::'||src.id::text,
  TRIM(src.name),src.description,UPPER(src.bonus_type),src.period_start,src.period_end,src.payout_date,src.total_budget,
  src.allocated_amount,UPPER(src.calculation_method),src.eligibility_rules,src.performance_multipliers,UPPER(src.status),
  jsonb_build_object('legacy_id',src.id::text,'legacy_table','public.bonus_plans','legacy_created_by',src.created_by::text),
  src.created_at AT TIME ZONE 'UTC',src.updated_at AT TIME ZONE 'UTC'
FROM legacy_mirror.bonus_plans src JOIN brownfield.tenant_id_mappings tm ON tm.legacy_id=src.tenant_id::text
ON CONFLICT (_legacy_source_id) DO NOTHING;

INSERT INTO temp_sdbi.salary_bands (_legacy_source_id,_import_run_id,band_tenant_id,band_natural_key,band_code,band_name,
  band_description,band_job_level,band_job_family,band_currency,band_min_salary,band_mid_salary,band_max_salary,
  band_range_spread_percent,band_geo_region,band_geo_adjustment_percent,band_effective_from,band_effective_to,band_is_active,
  band_deleted_at,band_metadata,created_at,updated_at)
SELECT src.id,current_setting('sdbi.run_id')::uuid,tm.canonical_tenant_id,'SALARY_BAND::'||tm.canonical_tenant_id::text||'::'||src.id::text,
  src.band_code,src.band_name,src.description,src.job_level,src.job_family,src.currency,src.min_salary,src.mid_salary,src.max_salary,
  src.range_spread_percent,src.geo_region,src.geo_adjustment_percent,src.effective_from,src.effective_to,src.is_active,src.deleted_at,
  jsonb_build_object('legacy_id',src.id::text,'legacy_table','public.salary_bands','legacy_created_by',src.created_by::text),
  src.created_at AT TIME ZONE 'UTC',src.updated_at AT TIME ZONE 'UTC'
FROM legacy_mirror.salary_bands src JOIN brownfield.tenant_id_mappings tm ON tm.legacy_id=src.tenant_id::text
ON CONFLICT (_legacy_source_id) DO NOTHING;

-- assignments: no tenant_id → inherit from parent salary_bands
INSERT INTO temp_sdbi.salary_band_assignments (_legacy_source_id,_legacy_band_id,_import_run_id,assignment_tenant_id,
  assignment_natural_key,assignment_current_salary,assignment_compa_ratio,assignment_range_penetration,assignment_assigned_at,
  assignment_metadata,created_at,updated_at)
SELECT src.id,src.band_id,current_setting('sdbi.run_id')::uuid,tm.canonical_tenant_id,
  'SALARY_BAND_ASSIGN::'||tm.canonical_tenant_id::text||'::'||src.id::text,src.current_salary,src.compa_ratio,src.range_penetration,
  src.assigned_at AT TIME ZONE 'UTC',
  jsonb_build_object('legacy_id',src.id::text,'legacy_band_id',src.band_id::text,'legacy_employee_id',src.employee_id::text,'legacy_assigned_by',src.assigned_by::text),
  src.created_at,src.updated_at
FROM legacy_mirror.salary_band_assignments src
JOIN legacy_mirror.salary_bands b ON b.id=src.band_id
JOIN brownfield.tenant_id_mappings tm ON tm.legacy_id=b.tenant_id::text
ON CONFLICT (_legacy_source_id) DO NOTHING;

UPDATE brownfield.import_runs SET import_run_status='COMPLETED', import_run_finished_at=now() WHERE import_run_id=current_setting('sdbi.run_id')::uuid;
COMMIT;
SELECT 'bonus_plans' t,count(*) FROM temp_sdbi.bonus_plans UNION ALL SELECT 'salary_bands',count(*) FROM temp_sdbi.salary_bands
UNION ALL SELECT 'salary_band_assignments',count(*) FROM temp_sdbi.salary_band_assignments ORDER BY 1;
