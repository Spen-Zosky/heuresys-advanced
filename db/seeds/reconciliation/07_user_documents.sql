-- db/seeds/reconciliation/07_user_documents.sql
-- F2 bucket-A import #3: sys.sys_user_documents from legacy public.employee_documents.
-- EMPLOYEE-CENTRIC (I14/ADR-0024): driver is legacy employees, NOT users.
--
-- PREREQUISITE staging (supervised COPY pipe; all 1089 source rows are status=active + is_latest):
--   CREATE TABLE IF NOT EXISTS staging.tmp_f2_user_documents
--     (id uuid, employee_id uuid, title text, document_type text, file_path text, mime_type text,
--      file_size int, category text, filename text, document_date date, expiry_date date, reference_number text);
--   TRUNCATE staging.tmp_f2_user_documents;
--   ssh oracle-vm-default 'sudo -u postgres psql -d heuresys_platform -c "\copy (SELECT id, employee_id, title,
--     document_type, file_path, mime_type, file_size, category, filename, document_date, expiry_date,
--     reference_number FROM employee_documents) TO STDOUT WITH (FORMAT csv)"' \
--     | psql … -c "\copy staging.tmp_f2_user_documents FROM STDIN WITH (FORMAT csv)"
--
-- FK resolution (measured S960): user_id LEGACY_EMP::<employee_id> -> sys_users (657/1089 resolve;
--   432 skip = out-of-scope employees). tenant from the resolved sys_user.
-- kind map (legacy document_type -> target CHECK): cv->CV, certificate->CERTIFICATE,
--   contract->CONTRACT_REFERENCE, {id_document,id_card,payslip,policy_acknowledgment}->OTHER.
-- uri <- file_path (NOT NULL on both). IDEMPOTENT: anti-join (user_id, legacy source_id). 2nd run inserts 0.

BEGIN;

INSERT INTO sys.sys_user_documents (
  user_document_user_id, user_document_tenant_id, user_document_kind,
  user_document_title, user_document_uri, user_document_mime_type,
  user_document_size_bytes, user_document_metadata
)
SELECT
  u.user_id,
  u.user_tenant_id,
  CASE s.document_type
    WHEN 'cv'          THEN 'CV'
    WHEN 'certificate' THEN 'CERTIFICATE'
    WHEN 'contract'    THEN 'CONTRACT_REFERENCE'
    ELSE 'OTHER' END,
  s.title,
  s.file_path,
  s.mime_type,
  s.file_size::bigint,
  jsonb_build_object('legacy', jsonb_strip_nulls(jsonb_build_object(
    'source_table', 'employee_documents', 'source_id', s.id, 'document_type', s.document_type,
    'category', s.category, 'filename', s.filename, 'document_date', s.document_date,
    'expiry_date', s.expiry_date, 'reference_number', s.reference_number)))
FROM staging.tmp_f2_user_documents s
JOIN sys.sys_users u
  ON u.user_external_code = 'LEGACY_EMP::' || s.employee_id::text
 AND u.user_tenant_id IS NOT NULL
WHERE NOT EXISTS (
  SELECT 1 FROM sys.sys_user_documents d
  WHERE d.user_document_user_id = u.user_id
    AND d.user_document_metadata -> 'legacy' ->> 'source_id' = s.id::text
);

DO $$
DECLARE v_total int; v_kinds text;
BEGIN
  SELECT count(*), string_agg(DISTINCT user_document_kind, ',') INTO v_total, v_kinds FROM sys.sys_user_documents;
  RAISE NOTICE 'user_documents: % rows (kinds: %)', v_total, v_kinds;
  IF v_total = 0 THEN RAISE EXCEPTION 'user_documents: 0 rows imported'; END IF;
END $$;

COMMIT;
