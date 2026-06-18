-- 000138_approval_chains.sql — 3.3 BPM slice-2: ordered multi-level approval chains.
--
-- Slice-D (000132) shipped flat single-level requests (all steps ordinal=1, one request
-- decision_policy). Slice-2 activates the ordinal: steps are materialized per LEVEL and a
-- level opens only when the prior level is satisfied. This migration adds the only schema
-- delta needed:
--   1. approval_step_level_policy (per-level quorum, nullable → falls back to the request's
--      decision_policy). Categorical → varchar+CHECK (RD-08, never ENUM).
--   2. a partial index on (request_id, ordinal) WHERE status='PENDING' for the cheap
--      "active level = MIN pending ordinal" lookup.
-- The step `ordinal` column and the 'SKIPPED' step status already exist (000132). Additive +
-- nullable → existing slice-1 single-level requests (ordinal=1, level_policy=NULL) behave
-- byte-identically. Idempotent (ADD COLUMN/CONSTRAINT/INDEX IF NOT EXISTS) → twice-run empty diff.

ALTER TABLE sys.sys_approval_steps
  ADD COLUMN IF NOT EXISTS approval_step_level_policy varchar(16);

DO $cs$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_approval_steps_level_policy_check') THEN
    ALTER TABLE sys.sys_approval_steps
      ADD CONSTRAINT sys_approval_steps_level_policy_check
      CHECK (approval_step_level_policy IS NULL OR approval_step_level_policy IN ('ALL_OF', 'ANY_OF'));
  END IF;
END $cs$;

CREATE INDEX IF NOT EXISTS sys_approval_steps_active_level_idx
  ON sys.sys_approval_steps (approval_step_request_id, approval_step_ordinal)
  WHERE approval_step_status = 'PENDING';

DO $$
DECLARE has_col boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'sys' AND table_name = 'sys_approval_steps'
       AND column_name = 'approval_step_level_policy'
  ) INTO has_col;
  IF NOT has_col THEN
    RAISE EXCEPTION '000138: approval_step_level_policy column missing';
  END IF;
  RAISE NOTICE '000138: approval chains slice-2 — per-level policy + active-level index ready.';
END $$;
