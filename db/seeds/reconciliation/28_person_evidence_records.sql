-- 28_person_evidence_records.sql — F4 bucket-C. <- legacy self_assessment_evidence (237 resolve).
-- user LEGACY_EMP::; type=ASSESSMENT; source=SELF_ASSESSMENT (matches CHECK). payload carries title/file_url/evidence_type.
-- Staging: staging.tmp_f4_pe. IDEMPOTENT: anti-join (user, source_id).
BEGIN;
INSERT INTO sys.sys_person_evidence_records (
  person_evidence_record_user_id, person_evidence_record_tenant_id, person_evidence_type,
  person_evidence_source, person_evidence_recorded_at, person_evidence_payload)
SELECT u.user_id, u.user_tenant_id, 'ASSESSMENT', 'SELF_ASSESSMENT', now(),
  jsonb_build_object('legacy', jsonb_strip_nulls(jsonb_build_object('source_table','self_assessment_evidence',
    'source_id',s.id,'evidence_type',s.evidence_type,'title',s.title,'file_url',s.file_url)))
FROM staging.tmp_f4_pe s
JOIN sys.sys_users u ON u.user_external_code='LEGACY_EMP::'||s.employee_id::text AND u.user_tenant_id IS NOT NULL
WHERE NOT EXISTS (SELECT 1 FROM sys.sys_person_evidence_records x
  WHERE x.person_evidence_record_user_id=u.user_id AND x.person_evidence_payload->'legacy'->>'source_id'=s.id::text);
DO $$ DECLARE v int; BEGIN SELECT count(*) INTO v FROM sys.sys_person_evidence_records;
  RAISE NOTICE 'person_evidence_records: % rows', v; IF v=0 THEN RAISE EXCEPTION '0'; END IF; END $$;
COMMIT;
