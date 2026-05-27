-- SDBI Succession/TalentPool pilot — Phase 3 temp_sdbi DDL. Idempotent.
BEGIN;
DROP TABLE IF EXISTS temp_sdbi.succession_candidates;
DROP TABLE IF EXISTS temp_sdbi.critical_roles;
DROP TABLE IF EXISTS temp_sdbi.succession_plans;
DROP TABLE IF EXISTS temp_sdbi.talent_pool_members;
DROP TABLE IF EXISTS temp_sdbi.talent_pools;

CREATE TABLE temp_sdbi.talent_pools (
  pool_id uuid DEFAULT gen_random_uuid(), _legacy_source_id uuid UNIQUE, _import_run_id uuid,
  pool_tenant_id uuid, pool_natural_key text, pool_name varchar(255), pool_description text, pool_type varchar(50),
  pool_criteria jsonb, pool_is_active boolean, pool_deleted_at timestamptz, pool_metadata jsonb, created_at timestamptz, updated_at timestamptz);

CREATE TABLE temp_sdbi.talent_pool_members (
  member_id uuid DEFAULT gen_random_uuid(), _legacy_source_id uuid UNIQUE, _legacy_pool_id uuid, _import_run_id uuid,
  member_tenant_id uuid, member_natural_key text, member_added_reason text, member_added_at timestamptz,
  member_removed_at timestamptz, member_removed_reason text, member_metadata jsonb, created_at timestamptz, updated_at timestamptz);

CREATE TABLE temp_sdbi.succession_plans (
  plan_id uuid DEFAULT gen_random_uuid(), _legacy_source_id uuid UNIQUE, _import_run_id uuid,
  plan_tenant_id uuid, plan_natural_key text, plan_position_name varchar(255), plan_legacy_position_id uuid,
  plan_criticality_level varchar(30), plan_risk_level varchar(30), plan_notes text, plan_target_date date,
  plan_status varchar(30), plan_metadata jsonb, created_at timestamptz, updated_at timestamptz);

CREATE TABLE temp_sdbi.critical_roles (
  role_id uuid DEFAULT gen_random_uuid(), _legacy_source_id uuid UNIQUE, _import_run_id uuid,
  role_tenant_id uuid, role_natural_key text, role_name varchar(255), role_department varchar(255),
  role_criticality_level varchar(30), role_impact_if_vacant text, role_time_to_fill_estimate integer,
  role_succession_status varchar(30), role_metadata jsonb, created_at timestamptz, updated_at timestamptz);

CREATE TABLE temp_sdbi.succession_candidates (
  candidate_id uuid DEFAULT gen_random_uuid(), _legacy_source_id uuid UNIQUE, _legacy_critical_role_id uuid, _import_run_id uuid,
  candidate_tenant_id uuid, candidate_natural_key text, candidate_readiness_level varchar(30), candidate_strengths text,
  candidate_development_needs text, candidate_development_plan text, candidate_rank_order integer,
  candidate_metadata jsonb, created_at timestamptz, updated_at timestamptz);
COMMIT;
