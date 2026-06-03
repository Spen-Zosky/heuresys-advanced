-- 27_behavioral_assessments.sql — F4 bucket-C. <- legacy competency_review_ratings (465 resolve).
-- user LEGACY_EMP::; competency=competency_name; score=coalesce(manager_rating,self_rating)*20.
-- Staging: staging.tmp_f4_ba. IDEMPOTENT: anti-join (user, source_id).
BEGIN;
INSERT INTO sys.sys_behavioral_assessments (
  behavioral_assessment_tenant_id, behavioral_assessment_user_id, behavioral_assessment_competency,
  behavioral_assessment_score, behavioral_assessment_evidence_payload, behavioral_assessment_recorded_at)
SELECT u.user_tenant_id, u.user_id, s.competency_name,
  round(coalesce(s.manager_rating, s.self_rating)*20, 2),
  jsonb_build_object('legacy', jsonb_strip_nulls(jsonb_build_object('source_table','competency_review_ratings',
    'source_id',s.id,'manager_rating',s.manager_rating,'self_rating',s.self_rating))), now()
FROM staging.tmp_f4_ba s
JOIN sys.sys_users u ON u.user_external_code='LEGACY_EMP::'||s.employee_id::text AND u.user_tenant_id IS NOT NULL
WHERE s.competency_name IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM sys.sys_behavioral_assessments x
    WHERE x.behavioral_assessment_user_id=u.user_id AND x.behavioral_assessment_evidence_payload->'legacy'->>'source_id'=s.id::text);
DO $$ DECLARE v int; BEGIN SELECT count(*) INTO v FROM sys.sys_behavioral_assessments;
  RAISE NOTICE 'behavioral_assessments: % rows', v; IF v=0 THEN RAISE EXCEPTION '0'; END IF; END $$;
COMMIT;
