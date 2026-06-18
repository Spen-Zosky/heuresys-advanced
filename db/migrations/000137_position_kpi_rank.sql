-- ============================================================================
-- 000137_position_kpi_rank.sql — WI-D2: explicit priority rank for position KPIs.
-- ----------------------------------------------------------------------------
-- Adds a `rank` (smallint, 1 = highest priority) to sys_position_kpi_requirements
-- — today the only ordering signal is `weight numeric(4,3)`. The PIP VIEW's
-- required_kpis projection now carries `rank` and orders rank NULLS LAST, then
-- weight DESC. rank lives in the BASE TABLE; the VIEW merely projects it
-- (ADR-0008 / I9: the PIP is a VIEW, never a JSONB blob).
--
-- Additive + NULLABLE → existing 000011 rows stay valid; read/behavior is
-- byte-identical until a rank is written. Categorical/ordering field stays a
-- plain integer with a CHECK (RD-08: no ENUM). Idempotent (ADD COLUMN IF NOT
-- EXISTS, guarded CHECK, CREATE OR REPLACE VIEW) → twice-run = empty pg_dump
-- diff. Authored 2026-06-18 (#4 WI-D2).
-- ============================================================================

ALTER TABLE sys.sys_position_kpi_requirements
  ADD COLUMN IF NOT EXISTS rank smallint;

ALTER TABLE sys.sys_position_kpi_requirements
  DROP CONSTRAINT IF EXISTS sys_pkr_rank_check;
ALTER TABLE sys.sys_position_kpi_requirements
  ADD CONSTRAINT sys_pkr_rank_check CHECK (rank IS NULL OR rank >= 1);

-- Re-emit the PIP VIEW verbatim (000011 §8) with rank added to required_kpis.
-- Output column list/types are UNCHANGED (required_kpis stays a single jsonb
-- column) so CREATE OR REPLACE is legal.
CREATE OR REPLACE VIEW sys.sys_position_intelligence_profiles_v AS
SELECT
  p.position_id,
  p.position_tenant_id,
  p.position_code,
  p.position_title,
  p.position_organization_unit_id,
  p.position_job_role_id,
  p.position_owner_user_id,
  p.position_reports_to_position_id,
  p.position_esco_occupation_uri,
  p.position_criticality,
  p.position_economic_weight,
  p.position_is_active,
  p.position_effective_from,
  p.position_effective_to,
  (SELECT jsonb_agg(jsonb_build_object(
            'skill_id', psr.skill_id,
            'required_proficiency', psr.required_proficiency,
            'weight', psr.weight,
            'criticality', psr.criticality))
   FROM sys.sys_position_skill_requirements psr
   WHERE psr.position_id = p.position_id) AS required_skills,
  (SELECT jsonb_agg(jsonb_build_object(
            'kpi_definition_id', pkr.kpi_definition_id,
            'target_template', pkr.target_template,
            'weight', pkr.weight,
            'rank', pkr.rank)
            ORDER BY pkr.rank NULLS LAST, pkr.weight DESC)
   FROM sys.sys_position_kpi_requirements pkr
   WHERE pkr.position_id = p.position_id) AS required_kpis,
  (SELECT jsonb_agg(jsonb_build_object(
            'learning_path_id', plr.learning_path_id,
            'mandatory', plr.is_mandatory,
            'deadline_rule', plr.deadline_rule))
   FROM sys.sys_position_learning_requirements plr
   WHERE plr.position_id = p.position_id) AS required_learning_paths,
  (SELECT jsonb_agg(jsonb_build_object('career_path_id', pcp.career_path_id))
   FROM sys.sys_position_career_paths pcp
   WHERE pcp.position_id = p.position_id) AS career_paths,
  (SELECT row_to_json(pcp2)
   FROM (SELECT compensation_band_id, economic_weight, reward_gates_applied
         FROM sys.sys_position_compensation_profiles
         WHERE position_id = p.position_id LIMIT 1) pcp2) AS compensation_profile,
  (SELECT row_to_json(psrr)
   FROM (SELECT is_critical, readiness_horizon
         FROM sys.sys_position_succession_relevance
         WHERE position_id = p.position_id LIMIT 1) psrr) AS succession_relevance,
  p.position_ai_hints,
  p.updated_at
FROM sys.sys_positions p;

DO $$
DECLARE has_rank boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'sys'
       AND table_name = 'sys_position_kpi_requirements'
       AND column_name = 'rank'
  ) INTO has_rank;
  IF NOT has_rank THEN
    RAISE EXCEPTION '000137: rank column missing on sys_position_kpi_requirements';
  END IF;
  RAISE NOTICE '000137: position KPI rank added + PIP view projects rank (ORDER BY rank NULLS LAST, weight DESC).';
END $$;
