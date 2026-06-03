-- 21_employee_position_fit_scores.sql — F4 bucket-C. <- legacy skill_gap_analyses.
-- user LEGACY_EMP::target_entity_id; position via the SAME employee (sys_positions.legacy_employee_id);
-- dimension='OVERALL', score=overall_match_score (the analysis IS an employee fit-to-role score).
-- Staging: staging.tmp_f2_gap_analysis. IDEMPOTENT: anti-join (user, position, dimension, source_id).
BEGIN;
INSERT INTO sys.sys_employee_position_fit_scores (
  employee_position_fit_score_tenant_id, employee_position_fit_score_user_id, employee_position_fit_score_position_id,
  employee_position_fit_score_dimension, employee_position_fit_score_score, employee_position_fit_score_computed_at,
  employee_position_fit_score_payload)
SELECT DISTINCT ON (u.user_id, p.position_id) u.user_tenant_id, u.user_id, p.position_id,
  'OVERALL', s.overall_match_score, coalesce(s.analysis_date::timestamptz, now()),
  jsonb_strip_nulls(jsonb_build_object('source_table','skill_gap_analyses','source_id',s.id,
    'coverage_score',s.coverage_score,'proficiency_score',s.proficiency_score,'analysis_type',s.analysis_type))
FROM staging.tmp_f2_gap_analysis s
JOIN sys.sys_users u ON u.user_external_code='LEGACY_EMP::'||s.target_entity_id::text AND u.user_tenant_id IS NOT NULL
JOIN sys.sys_positions p ON p.position_metadata->>'legacy_employee_id'=s.target_entity_id::text
WHERE s.overall_match_score IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM sys.sys_employee_position_fit_scores f
    WHERE f.employee_position_fit_score_user_id=u.user_id AND f.employee_position_fit_score_position_id=p.position_id
      AND f.employee_position_fit_score_dimension='OVERALL')
ORDER BY u.user_id, p.position_id, s.analysis_date DESC NULLS LAST;
DO $$ DECLARE v int; BEGIN SELECT count(*) INTO v FROM sys.sys_employee_position_fit_scores;
  RAISE NOTICE 'employee_position_fit_scores: % rows', v; IF v=0 THEN RAISE EXCEPTION '0'; END IF; END $$;
COMMIT;
