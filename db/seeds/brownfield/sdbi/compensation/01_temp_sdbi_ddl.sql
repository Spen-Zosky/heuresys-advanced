-- SDBI Compensation pilot — Phase 3 temp_sdbi DDL. Idempotent.
BEGIN;
DROP TABLE IF EXISTS temp_sdbi.salary_band_assignments;
DROP TABLE IF EXISTS temp_sdbi.salary_bands;
DROP TABLE IF EXISTS temp_sdbi.bonus_plans;

CREATE TABLE temp_sdbi.bonus_plans (
  bonus_plan_id uuid DEFAULT gen_random_uuid(), _legacy_source_id uuid UNIQUE, _import_run_id uuid,
  bonus_plan_tenant_id uuid, bonus_plan_natural_key text, bonus_plan_name varchar(255), bonus_plan_description text,
  bonus_plan_type varchar(50), bonus_plan_period_start date, bonus_plan_period_end date, bonus_plan_payout_date date,
  bonus_plan_total_budget numeric(18,2), bonus_plan_allocated_amount numeric(18,2), bonus_plan_calculation_method varchar(50),
  bonus_plan_eligibility_rules jsonb, bonus_plan_performance_multipliers jsonb, bonus_plan_status varchar(30),
  bonus_plan_metadata jsonb, created_at timestamptz, updated_at timestamptz);

CREATE TABLE temp_sdbi.salary_bands (
  band_id uuid DEFAULT gen_random_uuid(), _legacy_source_id uuid UNIQUE, _import_run_id uuid,
  band_tenant_id uuid, band_natural_key text, band_code varchar(50), band_name varchar(255), band_description text,
  band_job_level varchar(50), band_job_family varchar(100), band_currency varchar(10), band_min_salary numeric(18,2),
  band_mid_salary numeric(18,2), band_max_salary numeric(18,2), band_range_spread_percent numeric(8,4),
  band_geo_region varchar(100), band_geo_adjustment_percent numeric(8,4), band_effective_from date, band_effective_to date,
  band_is_active boolean, band_deleted_at timestamptz, band_metadata jsonb, created_at timestamptz, updated_at timestamptz);

CREATE TABLE temp_sdbi.salary_band_assignments (
  assignment_id uuid DEFAULT gen_random_uuid(), _legacy_source_id uuid UNIQUE, _legacy_band_id uuid, _import_run_id uuid,
  assignment_tenant_id uuid, assignment_natural_key text, assignment_current_salary numeric(18,2),
  assignment_compa_ratio numeric(8,4), assignment_range_penetration numeric(8,4), assignment_assigned_at timestamptz,
  assignment_metadata jsonb, created_at timestamptz, updated_at timestamptz);
COMMIT;
