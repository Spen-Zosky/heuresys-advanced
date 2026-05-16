-- =============================================================================
-- 000014_position_skill_requirements.sql
-- Heuresys Advanced — sys.sys_position_skill_requirements history table
-- -----------------------------------------------------------------------------
-- Note: the main sys_position_skill_requirements table is created in 000011
-- (alongside the position model) because it's a PIP base table. This
-- migration adds the slow-changing history sibling for proficiency drift
-- audit.
-- =============================================================================

CREATE TABLE IF NOT EXISTS sys.sys_position_skill_requirement_history (
  position_skill_requirement_history_id        uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  position_skill_requirement_history_psr_id    uuid         NOT NULL REFERENCES sys.sys_position_skill_requirements(position_skill_requirement_id) ON DELETE CASCADE,
  position_skill_requirement_history_tenant_id uuid         NOT NULL REFERENCES sys.sys_tenancies(tenant_id) ON DELETE CASCADE,
  position_skill_requirement_history_position_id uuid       NOT NULL REFERENCES sys.sys_positions(position_id) ON DELETE CASCADE,
  position_skill_requirement_history_skill_id  uuid         NOT NULL REFERENCES sys.sys_skills(skill_id) ON DELETE CASCADE,
  position_skill_requirement_history_old_proficiency varchar(32),
  position_skill_requirement_history_new_proficiency varchar(32) NOT NULL,
  position_skill_requirement_history_old_weight     numeric(4,3),
  position_skill_requirement_history_new_weight     numeric(4,3),
  position_skill_requirement_history_change_reason  text,
  position_skill_requirement_history_actor_user_id  uuid    REFERENCES sys.sys_users(user_id) ON DELETE SET NULL,
  position_skill_requirement_history_effective_at   timestamptz NOT NULL DEFAULT now(),
  position_skill_requirement_history_metadata       jsonb    NOT NULL DEFAULT '{}'::jsonb,
  created_at                                        timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE sys.sys_position_skill_requirement_history
  DROP CONSTRAINT IF EXISTS sys_psr_history_old_proficiency_check;
ALTER TABLE sys.sys_position_skill_requirement_history
  ADD CONSTRAINT sys_psr_history_old_proficiency_check
  CHECK (position_skill_requirement_history_old_proficiency IS NULL OR position_skill_requirement_history_old_proficiency IN
    ('NOVICE', 'BASIC', 'COMPETENT', 'PROFICIENT', 'EXPERT', 'MASTER'));

ALTER TABLE sys.sys_position_skill_requirement_history
  DROP CONSTRAINT IF EXISTS sys_psr_history_new_proficiency_check;
ALTER TABLE sys.sys_position_skill_requirement_history
  ADD CONSTRAINT sys_psr_history_new_proficiency_check
  CHECK (position_skill_requirement_history_new_proficiency IN
    ('NOVICE', 'BASIC', 'COMPETENT', 'PROFICIENT', 'EXPERT', 'MASTER'));

CREATE INDEX IF NOT EXISTS sys_psr_history_psr_idx
  ON sys.sys_position_skill_requirement_history (position_skill_requirement_history_psr_id, position_skill_requirement_history_effective_at DESC);

CREATE INDEX IF NOT EXISTS sys_psr_history_position_idx
  ON sys.sys_position_skill_requirement_history (position_skill_requirement_history_position_id);
