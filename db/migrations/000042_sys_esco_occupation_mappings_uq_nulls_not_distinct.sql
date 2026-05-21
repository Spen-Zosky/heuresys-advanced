-- =============================================================================
-- 000042_sys_esco_occupation_mappings_uq_nulls_not_distinct.sql
-- CW-B38 fix — make sys_esco_occupation_mappings_pair_uq treat NULL as NOT
-- DISTINCT, so ON CONFLICT (job_role_id, esco_uri) triggers for NULL
-- job_role_id rows. Prevents X7 wave1 retry duplication 7645 → 15290 (ADR-0016
-- nullable FK + PG default NULL ≠ NULL semantic combined re-emit duplicates
-- across runs).
--
-- PG 16+ supports `UNIQUE NULLS NOT DISTINCT` index. Idempotent via
-- DROP INDEX IF EXISTS + CREATE UNIQUE INDEX IF NOT EXISTS.
-- =============================================================================

BEGIN;

DROP INDEX IF EXISTS sys.sys_esco_occupation_mappings_pair_uq;

CREATE UNIQUE INDEX IF NOT EXISTS sys_esco_occupation_mappings_pair_uq
  ON sys.sys_esco_occupation_mappings (
    esco_occupation_mapping_job_role_id,
    esco_occupation_mapping_esco_uri
  )
  NULLS NOT DISTINCT;

COMMENT ON INDEX sys.sys_esco_occupation_mappings_pair_uq IS
  'CW-B38 (X7): NULLS NOT DISTINCT so that the nullable FK pattern (ADR-0016) does not bypass ON CONFLICT, preventing cross-run duplicate emission for unmapped ESCO catalog rows.';

COMMIT;
