-- =============================================================================
-- 000032_sys_activity_classifications_check_relax.sql
-- Heuresys Advanced — Goal 003 Item C: relax sys_activity_classifications._scheme_check
-- to accept base-version scheme values from brownfield demo data.
-- -----------------------------------------------------------------------------
-- Background
-- ----------
-- Goal 002 REPORT §3.5 documented "2× sys_activity_classifications CHECK
-- constraint violation on _scheme_check" — meaning 2 distinct legacy scheme
-- values outside the original whitelist {ATECO_2025, NACE_REV_2_1, ATECO_2007,
-- NACE_REV_2}.
--
-- EXEC step 0 (Goal 003) discovered the 2 violating distinct values in
-- staging.wave1_activity_classifications via:
--   SELECT DISTINCT UPPER(staging_raw_record->>'classification_system')
--                   AS scheme_uppercased, count(*) AS n
--   FROM staging.wave1_activity_classifications
--   GROUP BY 1 ORDER BY 2 DESC;
--
-- Result (2026-05-19T16:40Z):
--   ATECO    : 2210 rows  ← base ATECO version, no year suffix
--   NACE     : 1066 rows  ← base NACE version, no revision suffix
--   <NULL>   :    8 rows  ← left to source_empty filter, NOT relaxed here
--
-- Decision: Cowork-approved supervisor decision A2 Path C.1 (PROMPT 003 v2 §4,
-- locked decisions_locked D7) — relax CHECK to include ATECO + NACE base
-- versions per demo-data realism. The 8 NULL rows remain filtered (source_empty
-- exception per C5 acceptance criterion).
--
-- Idempotency: DROP CONSTRAINT IF EXISTS + ADD pattern is idempotent under
-- re-application of this migration (DROP succeeds whether old or new constraint
-- present; ADD recreates with the v2 definition).
--
-- Reversibility: DROP the new constraint then ADD original 4-value whitelist:
--   ALTER TABLE sys.sys_activity_classifications
--     DROP CONSTRAINT IF EXISTS sys_activity_classifications_scheme_check;
--   ALTER TABLE sys.sys_activity_classifications
--     ADD CONSTRAINT sys_activity_classifications_scheme_check
--     CHECK (activity_classification_scheme IN
--       ('ATECO_2025', 'NACE_REV_2_1', 'ATECO_2007', 'NACE_REV_2'));
--
-- =============================================================================

-- 1) Drop existing _scheme_check constraint (idempotent)
ALTER TABLE sys.sys_activity_classifications
  DROP CONSTRAINT IF EXISTS sys_activity_classifications_scheme_check;

-- 2) Add relaxed CHECK with the 2 additional base-version scheme values
ALTER TABLE sys.sys_activity_classifications
  ADD CONSTRAINT sys_activity_classifications_scheme_check
  CHECK (activity_classification_scheme IN (
    -- Original (Migration 000xxx whitelist, preserved):
    'ATECO_2025',
    'NACE_REV_2_1',
    'ATECO_2007',
    'NACE_REV_2',
    -- Goal 003 Item C additions (demo-data realism per supervisor decision
    -- A2 Path C.1, locked in _02b_APPROVAL_003.md D7 / 2026-05-19):
    'ATECO',
    'NACE'
  ));

-- 3) Comment for future operators
COMMENT ON CONSTRAINT sys_activity_classifications_scheme_check
  ON sys.sys_activity_classifications IS
  'Relaxed for Goal 003 brownfield import (Item C, mig 000032). Added ATECO + NACE base versions per demo-data realism (supervisor decision A2 Path C.1, 2026-05-19). Source: 2210 ATECO + 1066 NACE rows in staging.wave1_activity_classifications. Original 4-value whitelist preserved.';

-- 4) Verification query for the operator (commented; run manually post-apply):
-- SELECT conname, pg_get_constraintdef(oid)
--   FROM pg_constraint
--   WHERE conrelid = 'sys.sys_activity_classifications'::regclass
--     AND conname  = 'sys_activity_classifications_scheme_check';
-- Expected: 1 row with definition listing all 6 allowed scheme values.

-- =============================================================================
-- end of 000032_sys_activity_classifications_check_relax.sql
-- =============================================================================
