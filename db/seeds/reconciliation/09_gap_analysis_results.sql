-- db/seeds/reconciliation/09_gap_analysis_results.sql
-- F2 bucket-A import #4: sys.sys_gap_analysis_results from legacy public.skill_gap_analyses.
-- EMPLOYEE-CENTRIC (I14/ADR-0024): the source target_entity_type is uniformly 'employee'
--   -> user_id via LEGACY_EMP::target_entity_id (NOT users).
-- SEMANTIC DECISIONS (signed off S960):
--   kind    = 'SKILL' for all (source is a skill-gap analysis; analysis_type/comparison_type are
--             CONTEXT, not gap kind -> they go into the payload, not the CHECK kind).
--   payload = composition of the 5 source jsonb columns + scores + analysis_type/comparison_type
--             (+ a 'legacy' sub-object for lineage). The target has no separate metadata column.
--
-- PREREQUISITE staging (supervised COPY pipe):
--   CREATE TABLE IF NOT EXISTS staging.tmp_f2_gap_analysis (id uuid, target_entity_id uuid, tenant_id uuid,
--     analysis_name text, analysis_type text, comparison_type text, target_position_id uuid,
--     target_position_name text, analysis_date date, overall_match_score numeric, coverage_score numeric,
--     proficiency_score numeric, skill_matches jsonb, skill_gaps jsonb, skill_surplus jsonb,
--     recommendations jsonb, priority_skills jsonb);
--   TRUNCATE staging.tmp_f2_gap_analysis;
--   ssh oracle-vm-default 'sudo -u postgres psql -d heuresys_platform -c "\copy (SELECT id, target_entity_id,
--     tenant_id, analysis_name, analysis_type, comparison_type, target_position_id, target_position_name,
--     analysis_date, overall_match_score, coverage_score, proficiency_score, skill_matches, skill_gaps,
--     skill_surplus, recommendations, priority_skills FROM skill_gap_analyses) TO STDOUT WITH (FORMAT csv)"' \
--     | psql … -c "\copy staging.tmp_f2_gap_analysis FROM STDIN WITH (FORMAT csv)"
--
-- FK resolution (measured S960): user 270/304 resolve (RTL); 34 skip (out-of-scope employees).
--   tenant from the resolved sys_user. position_id = NULL (job->position bridge is wall F3).
-- IDEMPOTENT: anti-join (user_id, legacy source_id in payload). 2nd run inserts 0.

BEGIN;

INSERT INTO sys.sys_gap_analysis_results (
  gap_analysis_result_tenant_id, gap_analysis_result_user_id, gap_analysis_result_position_id,
  gap_analysis_result_kind, gap_analysis_result_payload, gap_analysis_result_overall_score,
  gap_analysis_result_computed_at
)
SELECT
  u.user_tenant_id,
  u.user_id,
  NULL,
  'SKILL',
  jsonb_strip_nulls(jsonb_build_object(
    'skill_matches', s.skill_matches, 'skill_gaps', s.skill_gaps, 'skill_surplus', s.skill_surplus,
    'recommendations', s.recommendations, 'priority_skills', s.priority_skills,
    'coverage_score', s.coverage_score, 'proficiency_score', s.proficiency_score,
    'analysis_type', s.analysis_type, 'comparison_type', s.comparison_type,
    'legacy', jsonb_build_object('source_table', 'skill_gap_analyses', 'source_id', s.id,
      'analysis_name', s.analysis_name, 'target_position_name', s.target_position_name))),
  s.overall_match_score,
  coalesce(s.analysis_date::timestamptz, now())
FROM staging.tmp_f2_gap_analysis s
JOIN sys.sys_users u
  ON u.user_external_code = 'LEGACY_EMP::' || s.target_entity_id::text
 AND u.user_tenant_id IS NOT NULL
WHERE NOT EXISTS (
  SELECT 1 FROM sys.sys_gap_analysis_results g
  WHERE g.gap_analysis_result_user_id = u.user_id
    AND g.gap_analysis_result_payload -> 'legacy' ->> 'source_id' = s.id::text
);

DO $$
DECLARE v_total int; v_scored int;
BEGIN
  SELECT count(*), count(gap_analysis_result_overall_score) INTO v_total, v_scored FROM sys.sys_gap_analysis_results;
  RAISE NOTICE 'gap_analysis_results: % rows (% with overall_score)', v_total, v_scored;
  IF v_total = 0 THEN RAISE EXCEPTION 'gap_analysis_results: 0 rows imported'; END IF;
END $$;

COMMIT;
