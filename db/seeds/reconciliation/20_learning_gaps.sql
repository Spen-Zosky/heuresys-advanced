-- 20_learning_gaps.sql — F4 bucket-C. sys.sys_learning_gaps <- legacy skill_gap_analyses (aggregate per analysis).
-- user LEGACY_EMP::target_entity_id; score=overall_match_score; severity derived from match% (defensible rule);
-- skill_id NULL (gap aggregated at analysis level; the skill_gaps JSONB array kept in metadata).
-- Staging: staging.tmp_f2_gap_analysis. IDEMPOTENT: anti-join (user, source_id).
BEGIN;
INSERT INTO sys.sys_learning_gaps (
  learning_gap_tenant_id, learning_gap_user_id, learning_gap_score, learning_gap_severity,
  learning_gap_detected_at, learning_gap_metadata)
SELECT u.user_tenant_id, u.user_id, s.overall_match_score,
  CASE WHEN s.overall_match_score < 50 THEN 'CRITICAL' WHEN s.overall_match_score < 70 THEN 'HIGH'
       WHEN s.overall_match_score < 85 THEN 'MEDIUM' ELSE 'LOW' END,
  coalesce(s.analysis_date::timestamptz, now()),
  jsonb_build_object('legacy', jsonb_strip_nulls(jsonb_build_object(
    'source_table','skill_gap_analyses','source_id',s.id,'skill_gaps',s.skill_gaps,
    'coverage_score',s.coverage_score,'proficiency_score',s.proficiency_score,'analysis_type',s.analysis_type)))
FROM staging.tmp_f2_gap_analysis s
JOIN sys.sys_users u ON u.user_external_code='LEGACY_EMP::'||s.target_entity_id::text AND u.user_tenant_id IS NOT NULL
WHERE s.overall_match_score IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM sys.sys_learning_gaps g
    WHERE g.learning_gap_user_id=u.user_id AND g.learning_gap_metadata->'legacy'->>'source_id'=s.id::text);
DO $$ DECLARE v int; BEGIN SELECT count(*) INTO v FROM sys.sys_learning_gaps;
  RAISE NOTICE 'learning_gaps: % rows', v; IF v=0 THEN RAISE EXCEPTION '0'; END IF; END $$;
COMMIT;
