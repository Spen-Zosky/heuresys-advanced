-- =============================================================================
-- 000154_retire_synthetic_user_flag.sql
-- Heuresys Advanced — retire the synthetic-user concept (ADR-0026 decision A).
-- -----------------------------------------------------------------------------
-- ADR-0026 establishes a single production-grade environment with two current
-- production tenants whose data is treated as real. The `user_is_synthetic`
-- flag drew a synthetic-vs-real dichotomy that does not exist (the legacy data
-- source is itself synthetic case-study, ADR-0023) and was never a behavioural
-- gate. This migration removes the flag entirely and renames the now-misnamed
-- user_type 'SYNTHETIC_REFERENCE' (blueprint-generated placeholder incumbents in
-- tenant-materialization) to the functional 'GENERATED_INCUMBENT'.
--
-- Idempotent (IF EXISTS throughout; twice-run = empty diff). Data-safe: 0 rows
-- are SYNTHETIC_REFERENCE in the live tenants (census S1004) — the UPDATE is a
-- no-op there but keeps fresh rebuilds + the materializer correct. Reversible
-- (DOWN block documented at the bottom for reference).
-- =============================================================================

-- 1) Drop the consistency validation view (was created in 000023).
DROP VIEW IF EXISTS sys.v_synthetic_user_flag_consistency;

-- 2) Drop the synthetic/type consistency CHECK (frees the rename + column drop).
ALTER TABLE sys.sys_users
  DROP CONSTRAINT IF EXISTS sys_users_synthetic_consistency_check;

-- 3) Rename the now-misnamed user_type value (placeholder incumbents).
UPDATE sys.sys_users
   SET user_type = 'GENERATED_INCUMBENT'
 WHERE user_type = 'SYNTHETIC_REFERENCE';

-- 4) Swap the user_type CHECK to the new value set (idempotent drop+recreate).
ALTER TABLE sys.sys_users
  DROP CONSTRAINT IF EXISTS sys_users_user_type_check;
ALTER TABLE sys.sys_users
  ADD CONSTRAINT sys_users_user_type_check
  CHECK (user_type IN ('STANDARD', 'GENERATED_INCUMBENT', 'SERVICE'));

-- 5) Drop the synthetic partial index, then the column itself.
DROP INDEX IF EXISTS sys.sys_users_synthetic_idx;
ALTER TABLE sys.sys_users
  DROP COLUMN IF EXISTS user_is_synthetic;

-- =============================================================================
-- DOWN (manual, for reference — not auto-run):
--   ALTER TABLE sys.sys_users ADD COLUMN IF NOT EXISTS user_is_synthetic boolean NOT NULL DEFAULT false;
--   UPDATE sys.sys_users SET user_type='SYNTHETIC_REFERENCE', user_is_synthetic=true WHERE user_type='GENERATED_INCUMBENT';
--   ALTER TABLE sys.sys_users DROP CONSTRAINT IF EXISTS sys_users_user_type_check;
--   ALTER TABLE sys.sys_users ADD CONSTRAINT sys_users_user_type_check CHECK (user_type IN ('STANDARD','SYNTHETIC_REFERENCE','SERVICE'));
--   ALTER TABLE sys.sys_users ADD CONSTRAINT sys_users_synthetic_consistency_check
--     CHECK ((user_type='SYNTHETIC_REFERENCE' AND user_is_synthetic=true) OR (user_type<>'SYNTHETIC_REFERENCE' AND user_is_synthetic=false));
--   CREATE INDEX IF NOT EXISTS sys_users_synthetic_idx ON sys.sys_users (user_is_synthetic) WHERE user_is_synthetic=true;
--   (recreate v_synthetic_user_flag_consistency per 000023)
-- =============================================================================
