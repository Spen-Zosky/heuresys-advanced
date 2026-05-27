-- ============================================================================
-- Migration 000050 — SDBI Succession/TalentPool target schema (4 tables)
-- ADR-0014 SDBI MVP-4 2.4. Card SUCCESSION-MAP-01. Conventions: I5 tenant FK,
--   RD-09, natural_key UQ, embeddings skipped. Idempotent. Authored 2026-05-27 (2.4.11).
-- ============================================================================
BEGIN;

CREATE TABLE IF NOT EXISTS sys.sys_talent_pools (
  pool_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_tenant_id uuid NOT NULL REFERENCES sys.sys_tenancies (tenant_id),
  pool_natural_key text NOT NULL,
  pool_name varchar(255) NOT NULL,
  pool_description text,
  pool_type varchar(50),
  pool_criteria jsonb,
  pool_is_active boolean,
  pool_created_by_user_id uuid REFERENCES sys.sys_users (user_id),
  pool_deleted_at timestamptz,
  pool_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS sys_talent_pools_nk_uq ON sys.sys_talent_pools (pool_tenant_id, pool_natural_key);

CREATE TABLE IF NOT EXISTS sys.sys_talent_pool_members (
  member_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_tenant_id uuid NOT NULL REFERENCES sys.sys_tenancies (tenant_id),
  member_natural_key text NOT NULL,
  member_pool_id uuid NOT NULL REFERENCES sys.sys_talent_pools (pool_id) ON DELETE CASCADE,
  member_employee_user_id uuid REFERENCES sys.sys_users (user_id),
  member_added_reason text,
  member_added_by_user_id uuid REFERENCES sys.sys_users (user_id),
  member_added_at timestamptz,
  member_removed_at timestamptz,
  member_removed_reason text,
  member_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS sys_talent_pool_members_nk_uq ON sys.sys_talent_pool_members (member_tenant_id, member_natural_key);
CREATE INDEX IF NOT EXISTS sys_talent_pool_members_pool_idx ON sys.sys_talent_pool_members (member_pool_id);

CREATE TABLE IF NOT EXISTS sys.sys_succession_plans (
  plan_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_tenant_id uuid NOT NULL REFERENCES sys.sys_tenancies (tenant_id),
  plan_natural_key text NOT NULL,
  plan_position_name varchar(255),
  plan_legacy_position_id uuid,
  plan_incumbent_user_id uuid REFERENCES sys.sys_users (user_id),
  plan_criticality_level varchar(30),
  plan_risk_level varchar(30),
  plan_notes text,
  plan_target_date date,
  plan_status varchar(30),
  plan_created_by_user_id uuid REFERENCES sys.sys_users (user_id),
  plan_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS sys_succession_plans_nk_uq ON sys.sys_succession_plans (plan_tenant_id, plan_natural_key);

CREATE TABLE IF NOT EXISTS sys.sys_critical_roles (
  role_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_tenant_id uuid NOT NULL REFERENCES sys.sys_tenancies (tenant_id),
  role_natural_key text NOT NULL,
  role_name varchar(255),
  role_department varchar(255),
  role_incumbent_user_id uuid REFERENCES sys.sys_users (user_id),
  role_criticality_level varchar(30),
  role_impact_if_vacant text,
  role_time_to_fill_estimate integer,
  role_succession_status varchar(30),
  role_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS sys_critical_roles_nk_uq ON sys.sys_critical_roles (role_tenant_id, role_natural_key);

-- candidates link to critical_roles (verified: 86/100), NOT succession_plans
CREATE TABLE IF NOT EXISTS sys.sys_succession_candidates (
  candidate_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_tenant_id uuid NOT NULL REFERENCES sys.sys_tenancies (tenant_id),
  candidate_natural_key text NOT NULL,
  candidate_critical_role_id uuid REFERENCES sys.sys_critical_roles (role_id) ON DELETE CASCADE,
  candidate_employee_user_id uuid REFERENCES sys.sys_users (user_id),
  candidate_readiness_level varchar(30),
  candidate_strengths text,
  candidate_development_needs text,
  candidate_development_plan text,
  candidate_rank_order integer,
  candidate_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS sys_succession_candidates_nk_uq ON sys.sys_succession_candidates (candidate_tenant_id, candidate_natural_key);
CREATE INDEX IF NOT EXISTS sys_succession_candidates_role_idx ON sys.sys_succession_candidates (candidate_critical_role_id);

COMMIT;
