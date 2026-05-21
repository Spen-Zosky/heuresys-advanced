-- =============================================================================
-- CW-B32 fix: convert job_templates.org_level mapping CAST_VARCHAR → CAST_ENUM
-- A1 ABSOLUTE relaxed post-Goal-003 (Opt3 strategy): UPDATE of column_mapping
-- transform + payload is legitimate when fixing a documented bug, not a
-- registry semantic change.
--
-- Idempotent: WHERE clause is column_mapping_id specific.
-- Rollback: revert by setting transform back to CAST_VARCHAR + payload note.
-- =============================================================================

BEGIN;

UPDATE brownfield.column_mappings
SET
  column_mapping_transform = 'CAST_ENUM',
  column_mapping_transform_payload = jsonb_build_object(
    'value_map', jsonb_build_object(
      '1', 'ENTRY',
      '2', 'JUNIOR',
      '3', 'MID',
      '4', 'SENIOR',
      '5', 'LEAD',
      '6', 'EXECUTIVE'
    ),
    'default', null,
    'cw_b32_fix', true,
    'authored_by', 'Cowork batch C5.1'
  )
WHERE column_mapping_id = '2248f925-df52-4ccd-b38f-9f74621df146';

-- Verify update affected exactly 1 row
DO $$
DECLARE
  v_count int;
BEGIN
  SELECT COUNT(*) INTO v_count FROM brownfield.column_mappings
   WHERE column_mapping_id = '2248f925-df52-4ccd-b38f-9f74621df146'
     AND column_mapping_transform = 'CAST_ENUM';
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'CW-B32 fix expected 1 row updated, got %', v_count;
  END IF;
END $$;

COMMIT;
