-- =============================================================================
-- 000012_user_position_assignments.sql
-- Heuresys Advanced — sys.sys_user_position_assignments (the user × position bridge)
-- -----------------------------------------------------------------------------
-- Per TARGET_SCHEMA_DESIGN §4.2. Tracks every assignment of a user to a
-- position over time. Supports PRIMARY/SECONDARY/INTERIM/ACTING kinds.
--
-- Invariant I1: a user can have at most ONE ACTIVE PRIMARY assignment
-- (enforced by partial unique index).
-- =============================================================================

CREATE TABLE IF NOT EXISTS sys.sys_user_position_assignments (
  user_position_assignment_id           uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_position_assignment_tenant_id    uuid         NOT NULL REFERENCES sys.sys_tenancies(tenant_id) ON DELETE RESTRICT,
  user_position_assignment_user_id      uuid         NOT NULL REFERENCES sys.sys_users(user_id) ON DELETE RESTRICT,
  user_position_assignment_position_id  uuid         NOT NULL REFERENCES sys.sys_positions(position_id) ON DELETE RESTRICT,
  user_position_assignment_kind         varchar(32)  NOT NULL,
  user_position_assignment_fte          numeric(4,3) NOT NULL DEFAULT 1.000,
  user_position_assignment_start_date   date         NOT NULL,
  user_position_assignment_end_date     date,
  user_position_assignment_status       varchar(32)  NOT NULL DEFAULT 'ACTIVE',
  user_position_assignment_notes        text,
  user_position_assignment_metadata     jsonb        NOT NULL DEFAULT '{}'::jsonb,
  created_at                            timestamptz  NOT NULL DEFAULT now(),
  created_by                            uuid         REFERENCES sys.sys_users(user_id) ON DELETE SET NULL,
  updated_at                            timestamptz  NOT NULL DEFAULT now(),
  updated_by                            uuid         REFERENCES sys.sys_users(user_id) ON DELETE SET NULL
);

ALTER TABLE sys.sys_user_position_assignments
  DROP CONSTRAINT IF EXISTS sys_upa_kind_check;
ALTER TABLE sys.sys_user_position_assignments
  ADD CONSTRAINT sys_upa_kind_check
  CHECK (user_position_assignment_kind IN ('PRIMARY', 'SECONDARY', 'INTERIM', 'ACTING'));

ALTER TABLE sys.sys_user_position_assignments
  DROP CONSTRAINT IF EXISTS sys_upa_status_check;
ALTER TABLE sys.sys_user_position_assignments
  ADD CONSTRAINT sys_upa_status_check
  CHECK (user_position_assignment_status IN ('ACTIVE', 'ENDED', 'PROPOSED', 'CANCELLED'));

ALTER TABLE sys.sys_user_position_assignments
  DROP CONSTRAINT IF EXISTS sys_upa_fte_range_check;
ALTER TABLE sys.sys_user_position_assignments
  ADD CONSTRAINT sys_upa_fte_range_check
  CHECK (user_position_assignment_fte >= 0 AND user_position_assignment_fte <= 1);

ALTER TABLE sys.sys_user_position_assignments
  DROP CONSTRAINT IF EXISTS sys_upa_dates_ordered_check;
ALTER TABLE sys.sys_user_position_assignments
  ADD CONSTRAINT sys_upa_dates_ordered_check
  CHECK (user_position_assignment_end_date IS NULL OR user_position_assignment_end_date >= user_position_assignment_start_date);

CREATE INDEX IF NOT EXISTS sys_upa_user_idx
  ON sys.sys_user_position_assignments (user_position_assignment_user_id);

CREATE INDEX IF NOT EXISTS sys_upa_position_idx
  ON sys.sys_user_position_assignments (user_position_assignment_position_id);

CREATE INDEX IF NOT EXISTS sys_upa_tenant_status_idx
  ON sys.sys_user_position_assignments (user_position_assignment_tenant_id, user_position_assignment_status);

-- INVARIANT I1: at most one ACTIVE PRIMARY assignment per user
CREATE UNIQUE INDEX IF NOT EXISTS sys_upa_one_primary_active_per_user
  ON sys.sys_user_position_assignments (user_position_assignment_user_id)
  WHERE user_position_assignment_kind = 'PRIMARY'
    AND user_position_assignment_status = 'ACTIVE';

DO $trg$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'sys_upa_set_updated_at' AND tgrelid = 'sys.sys_user_position_assignments'::regclass) THEN
    CREATE TRIGGER sys_upa_set_updated_at BEFORE UPDATE ON sys.sys_user_position_assignments FOR EACH ROW EXECUTE FUNCTION sys.sys_set_updated_at();
  END IF;
END $trg$;
