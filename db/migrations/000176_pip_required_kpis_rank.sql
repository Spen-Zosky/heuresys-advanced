-- ============================================================================
-- 000176_pip_required_kpis_rank.sql — PIP view: project KPI `rank` (S1021, R3).
--
-- PROBLEM: sys_position_kpi_requirements grew a `rank` column and
--   GET /v1/positions/:id/kpis orders by `rank NULLS LAST, weight DESC`, but the
--   PIP view (I9: PIP is a VIEW, never a JSONB blob) was never updated — its
--   required_kpis objects carried only kpi_definition_id / target_template /
--   weight, and the jsonb_agg had no ORDER BY, so element order was whatever the
--   planner produced.
--   positions.integration.test.ts ("KPIS WI-D2 ... PIP carries rank") asserts
--   requiredKpis[0].rank === 1 and was therefore failing on `undefined`.
--
-- FIX: rebuild required_kpis with `rank` included and the SAME ordering as the
--   list endpoint, so the view and the endpoint agree.
--
-- Column list/types are unchanged → CREATE OR REPLACE VIEW is valid.
-- IDEMPOTENT: CREATE OR REPLACE is safe to re-run.
-- Authored: 2026-07-19.
-- ============================================================================

CREATE OR REPLACE VIEW sys.sys_position_intelligence_profiles_v AS
 SELECT position_id,
    position_tenant_id,
    position_code,
    position_title,
    position_organization_unit_id,
    position_job_role_id,
    position_owner_user_id,
    position_reports_to_position_id,
    position_esco_occupation_uri,
    position_criticality,
    position_economic_weight,
    position_is_active,
    position_effective_from,
    position_effective_to,
    ( SELECT jsonb_agg(jsonb_build_object('skill_id', psr.skill_id, 'required_proficiency', psr.required_proficiency, 'weight', psr.weight, 'criticality', psr.criticality)) AS jsonb_agg
           FROM sys.sys_position_skill_requirements psr
          WHERE psr.position_id = p.position_id) AS required_skills,
    ( SELECT jsonb_agg(jsonb_build_object('kpi_definition_id', pkr.kpi_definition_id, 'target_template', pkr.target_template, 'weight', pkr.weight, 'rank', pkr.rank)
                       ORDER BY pkr.rank NULLS LAST, pkr.weight DESC) AS jsonb_agg
           FROM sys.sys_position_kpi_requirements pkr
          WHERE pkr.position_id = p.position_id) AS required_kpis,
    ( SELECT jsonb_agg(jsonb_build_object('learning_path_id', plr.learning_path_id, 'mandatory', plr.is_mandatory, 'deadline_rule', plr.deadline_rule)) AS jsonb_agg
           FROM sys.sys_position_learning_requirements plr
          WHERE plr.position_id = p.position_id) AS required_learning_paths,
    ( SELECT jsonb_agg(jsonb_build_object('career_path_id', pcp.career_path_id)) AS jsonb_agg
           FROM sys.sys_position_career_paths pcp
          WHERE pcp.position_id = p.position_id) AS career_paths,
    ( SELECT row_to_json(pcp2.*) AS row_to_json
           FROM ( SELECT sys_position_compensation_profiles.compensation_band_id,
                    sys_position_compensation_profiles.economic_weight,
                    sys_position_compensation_profiles.reward_gates_applied
                   FROM sys.sys_position_compensation_profiles
                  WHERE sys_position_compensation_profiles.position_id = p.position_id
                 LIMIT 1) pcp2) AS compensation_profile,
    ( SELECT row_to_json(psrr.*) AS row_to_json
           FROM ( SELECT sys_position_succession_relevance.is_critical,
                    sys_position_succession_relevance.readiness_horizon
                   FROM sys.sys_position_succession_relevance
                  WHERE sys_position_succession_relevance.position_id = p.position_id
                 LIMIT 1) psrr) AS succession_relevance,
    position_ai_hints,
    updated_at
   FROM sys.sys_positions p;
