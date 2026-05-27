-- ============================================================================
-- Migration 000051 — SDBI Compensation target schema (3 tables)
-- ADR-0014 SDBI MVP-4 2.4. Card COMPENSATION-MAP-01. New tables (distinct from
--   existing sys_compensation_bands/sys_bonus_pools which have different schemas).
-- Conventions: I5 tenant FK, RD-09, natural_key UQ. Idempotent. Authored 2026-05-27 (2.4.12).
-- ============================================================================
BEGIN;

CREATE TABLE IF NOT EXISTS sys.sys_bonus_plans (
  bonus_plan_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bonus_plan_tenant_id uuid NOT NULL REFERENCES sys.sys_tenancies (tenant_id),
  bonus_plan_natural_key text NOT NULL,
  bonus_plan_name varchar(255) NOT NULL,
  bonus_plan_description text,
  bonus_plan_type varchar(50),
  bonus_plan_period_start date,
  bonus_plan_period_end date,
  bonus_plan_payout_date date,
  bonus_plan_total_budget numeric(18,2),
  bonus_plan_allocated_amount numeric(18,2),
  bonus_plan_calculation_method varchar(50),
  bonus_plan_eligibility_rules jsonb,
  bonus_plan_performance_multipliers jsonb,
  bonus_plan_status varchar(30),
  bonus_plan_created_by_user_id uuid REFERENCES sys.sys_users (user_id),
  bonus_plan_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS sys_bonus_plans_nk_uq ON sys.sys_bonus_plans (bonus_plan_tenant_id, bonus_plan_natural_key);

CREATE TABLE IF NOT EXISTS sys.sys_salary_bands (
  band_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  band_tenant_id uuid NOT NULL REFERENCES sys.sys_tenancies (tenant_id),
  band_natural_key text NOT NULL,
  band_code varchar(50),
  band_name varchar(255),
  band_description text,
  band_job_level varchar(50),
  band_job_family varchar(100),
  band_currency varchar(10),
  band_min_salary numeric(18,2),
  band_mid_salary numeric(18,2),
  band_max_salary numeric(18,2),
  band_range_spread_percent numeric(8,4),
  band_geo_region varchar(100),
  band_geo_adjustment_percent numeric(8,4),
  band_effective_from date,
  band_effective_to date,
  band_is_active boolean,
  band_deleted_at timestamptz,
  band_created_by_user_id uuid REFERENCES sys.sys_users (user_id),
  band_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS sys_salary_bands_nk_uq ON sys.sys_salary_bands (band_tenant_id, band_natural_key);

CREATE TABLE IF NOT EXISTS sys.sys_salary_band_assignments (
  assignment_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_tenant_id uuid NOT NULL REFERENCES sys.sys_tenancies (tenant_id),
  assignment_natural_key text NOT NULL,
  assignment_band_id uuid REFERENCES sys.sys_salary_bands (band_id) ON DELETE CASCADE,
  assignment_employee_user_id uuid REFERENCES sys.sys_users (user_id),
  assignment_current_salary numeric(18,2),
  assignment_compa_ratio numeric(8,4),
  assignment_range_penetration numeric(8,4),
  assignment_assigned_at timestamptz,
  assignment_assigned_by_user_id uuid REFERENCES sys.sys_users (user_id),
  assignment_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS sys_salary_band_assignments_nk_uq ON sys.sys_salary_band_assignments (assignment_tenant_id, assignment_natural_key);
CREATE INDEX IF NOT EXISTS sys_salary_band_assignments_band_idx ON sys.sys_salary_band_assignments (assignment_band_id);

COMMIT;
