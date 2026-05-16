-- =============================================================================
-- 000016_learning_model.sql
-- Heuresys Advanced — learning + gap closure (10 tables) + late FKs
-- -----------------------------------------------------------------------------
-- Per TARGET_SCHEMA_DESIGN §7.
-- Invariant I11: training COMPLETION ≠ skill MASTERY. Completion is evidence;
-- reassessment is required for promotion.
-- =============================================================================

CREATE TABLE IF NOT EXISTS sys.sys_learning_modules (
  learning_module_id          uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  learning_module_tenant_id   uuid         REFERENCES sys.sys_tenancies(tenant_id) ON DELETE CASCADE,
  learning_module_code        varchar(128) NOT NULL,
  learning_module_title       varchar(255) NOT NULL,
  learning_module_description text,
  learning_module_kind        varchar(32)  NOT NULL DEFAULT 'COURSE',
  learning_module_delivery    varchar(32)  NOT NULL DEFAULT 'SELF_PACED',
  learning_module_duration_minutes integer,
  learning_module_is_global   boolean      NOT NULL DEFAULT false,
  learning_module_metadata    jsonb        NOT NULL DEFAULT '{}'::jsonb,
  created_at                  timestamptz  NOT NULL DEFAULT now(),
  created_by                  uuid         REFERENCES sys.sys_users(user_id) ON DELETE SET NULL,
  updated_at                  timestamptz  NOT NULL DEFAULT now(),
  updated_by                  uuid         REFERENCES sys.sys_users(user_id) ON DELETE SET NULL
);

ALTER TABLE sys.sys_learning_modules
  DROP CONSTRAINT IF EXISTS sys_learning_module_kind_check;
ALTER TABLE sys.sys_learning_modules
  ADD CONSTRAINT sys_learning_module_kind_check
  CHECK (learning_module_kind IN ('COURSE', 'MICRO_LESSON', 'LAB', 'WORKSHOP', 'CERTIFICATION_PREP', 'COACHING'));

ALTER TABLE sys.sys_learning_modules
  DROP CONSTRAINT IF EXISTS sys_learning_module_delivery_check;
ALTER TABLE sys.sys_learning_modules
  ADD CONSTRAINT sys_learning_module_delivery_check
  CHECK (learning_module_delivery IN ('SELF_PACED', 'INSTRUCTOR_LED', 'BLENDED', 'ON_THE_JOB'));

CREATE UNIQUE INDEX IF NOT EXISTS sys_learning_modules_tenant_code_uq
  ON sys.sys_learning_modules (COALESCE(learning_module_tenant_id, '00000000-0000-0000-0000-000000000000'::uuid), learning_module_code);

DO $trg$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'sys_learning_modules_set_updated_at' AND tgrelid = 'sys.sys_learning_modules'::regclass) THEN
    CREATE TRIGGER sys_learning_modules_set_updated_at BEFORE UPDATE ON sys.sys_learning_modules FOR EACH ROW EXECUTE FUNCTION sys.sys_set_updated_at();
  END IF;
END $trg$;

CREATE TABLE IF NOT EXISTS sys.sys_training_initiatives (
  training_initiative_id          uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  training_initiative_tenant_id   uuid         NOT NULL REFERENCES sys.sys_tenancies(tenant_id) ON DELETE CASCADE,
  training_initiative_module_id   uuid         NOT NULL REFERENCES sys.sys_learning_modules(learning_module_id) ON DELETE RESTRICT,
  training_initiative_code        varchar(128) NOT NULL,
  training_initiative_cohort_name varchar(255),
  training_initiative_start_date  date         NOT NULL,
  training_initiative_end_date    date,
  training_initiative_facilitator_user_id uuid REFERENCES sys.sys_users(user_id) ON DELETE SET NULL,
  training_initiative_status      varchar(32)  NOT NULL DEFAULT 'PLANNED',
  training_initiative_capacity    integer,
  training_initiative_metadata    jsonb        NOT NULL DEFAULT '{}'::jsonb,
  created_at                      timestamptz  NOT NULL DEFAULT now(),
  created_by                      uuid         REFERENCES sys.sys_users(user_id) ON DELETE SET NULL,
  updated_at                      timestamptz  NOT NULL DEFAULT now(),
  updated_by                      uuid         REFERENCES sys.sys_users(user_id) ON DELETE SET NULL
);

ALTER TABLE sys.sys_training_initiatives
  DROP CONSTRAINT IF EXISTS sys_training_initiative_status_check;
ALTER TABLE sys.sys_training_initiatives
  ADD CONSTRAINT sys_training_initiative_status_check
  CHECK (training_initiative_status IN ('PLANNED', 'OPEN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'));

CREATE UNIQUE INDEX IF NOT EXISTS sys_training_initiatives_tenant_code_uq
  ON sys.sys_training_initiatives (training_initiative_tenant_id, training_initiative_code);

DO $trg$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'sys_training_initiatives_set_updated_at' AND tgrelid = 'sys.sys_training_initiatives'::regclass) THEN
    CREATE TRIGGER sys_training_initiatives_set_updated_at BEFORE UPDATE ON sys.sys_training_initiatives FOR EACH ROW EXECUTE FUNCTION sys.sys_set_updated_at();
  END IF;
END $trg$;

CREATE TABLE IF NOT EXISTS sys.sys_learning_paths (
  learning_path_id          uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  learning_path_tenant_id   uuid         REFERENCES sys.sys_tenancies(tenant_id) ON DELETE CASCADE,
  learning_path_code        varchar(128) NOT NULL,
  learning_path_name        varchar(255) NOT NULL,
  learning_path_description text,
  learning_path_target_outcome text,
  learning_path_is_global   boolean      NOT NULL DEFAULT false,
  learning_path_metadata    jsonb        NOT NULL DEFAULT '{}'::jsonb,
  created_at                timestamptz  NOT NULL DEFAULT now(),
  created_by                uuid         REFERENCES sys.sys_users(user_id) ON DELETE SET NULL,
  updated_at                timestamptz  NOT NULL DEFAULT now(),
  updated_by                uuid         REFERENCES sys.sys_users(user_id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS sys_learning_paths_tenant_code_uq
  ON sys.sys_learning_paths (COALESCE(learning_path_tenant_id, '00000000-0000-0000-0000-000000000000'::uuid), learning_path_code);

DO $trg$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'sys_learning_paths_set_updated_at' AND tgrelid = 'sys.sys_learning_paths'::regclass) THEN
    CREATE TRIGGER sys_learning_paths_set_updated_at BEFORE UPDATE ON sys.sys_learning_paths FOR EACH ROW EXECUTE FUNCTION sys.sys_set_updated_at();
  END IF;
END $trg$;

CREATE TABLE IF NOT EXISTS sys.sys_learning_path_steps (
  learning_path_step_id          uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  learning_path_step_path_id     uuid         NOT NULL REFERENCES sys.sys_learning_paths(learning_path_id) ON DELETE CASCADE,
  learning_path_step_module_id   uuid         NOT NULL REFERENCES sys.sys_learning_modules(learning_module_id) ON DELETE RESTRICT,
  learning_path_step_ordinal     smallint     NOT NULL,
  learning_path_step_is_prerequisite_for jsonb NOT NULL DEFAULT '[]'::jsonb,
  learning_path_step_metadata    jsonb        NOT NULL DEFAULT '{}'::jsonb,
  created_at                     timestamptz  NOT NULL DEFAULT now(),
  updated_at                     timestamptz  NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS sys_learning_path_steps_path_ordinal_uq
  ON sys.sys_learning_path_steps (learning_path_step_path_id, learning_path_step_ordinal);

CREATE TABLE IF NOT EXISTS sys.sys_skill_learning_mappings (
  skill_learning_mapping_id            uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_learning_mapping_skill_id      uuid         NOT NULL REFERENCES sys.sys_skills(skill_id) ON DELETE CASCADE,
  skill_learning_mapping_module_id     uuid         NOT NULL REFERENCES sys.sys_learning_modules(learning_module_id) ON DELETE CASCADE,
  skill_learning_mapping_target_proficiency varchar(32) NOT NULL,
  skill_learning_mapping_metadata      jsonb        NOT NULL DEFAULT '{}'::jsonb,
  created_at                           timestamptz  NOT NULL DEFAULT now()
);

ALTER TABLE sys.sys_skill_learning_mappings
  DROP CONSTRAINT IF EXISTS sys_skill_learning_mapping_target_check;
ALTER TABLE sys.sys_skill_learning_mappings
  ADD CONSTRAINT sys_skill_learning_mapping_target_check
  CHECK (skill_learning_mapping_target_proficiency IN ('NOVICE', 'BASIC', 'COMPETENT', 'PROFICIENT', 'EXPERT', 'MASTER'));

CREATE UNIQUE INDEX IF NOT EXISTS sys_skill_learning_mappings_pair_uq
  ON sys.sys_skill_learning_mappings (skill_learning_mapping_skill_id, skill_learning_mapping_module_id);

CREATE TABLE IF NOT EXISTS sys.sys_user_learning_assignments (
  user_learning_assignment_id              uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_learning_assignment_tenant_id       uuid         NOT NULL REFERENCES sys.sys_tenancies(tenant_id) ON DELETE CASCADE,
  user_learning_assignment_user_id         uuid         NOT NULL REFERENCES sys.sys_users(user_id) ON DELETE CASCADE,
  user_learning_assignment_initiative_id   uuid         REFERENCES sys.sys_training_initiatives(training_initiative_id) ON DELETE SET NULL,
  user_learning_assignment_module_id       uuid         REFERENCES sys.sys_learning_modules(learning_module_id) ON DELETE SET NULL,
  user_learning_assignment_path_id         uuid         REFERENCES sys.sys_learning_paths(learning_path_id) ON DELETE SET NULL,
  user_learning_assignment_is_mandatory    boolean      NOT NULL DEFAULT true,
  user_learning_assignment_deadline        date,
  user_learning_assignment_status          varchar(32)  NOT NULL DEFAULT 'ASSIGNED',
  user_learning_assignment_assigned_by     uuid         REFERENCES sys.sys_users(user_id) ON DELETE SET NULL,
  user_learning_assignment_metadata        jsonb        NOT NULL DEFAULT '{}'::jsonb,
  created_at                               timestamptz  NOT NULL DEFAULT now(),
  updated_at                               timestamptz  NOT NULL DEFAULT now()
);

ALTER TABLE sys.sys_user_learning_assignments
  DROP CONSTRAINT IF EXISTS sys_ula_status_check;
ALTER TABLE sys.sys_user_learning_assignments
  ADD CONSTRAINT sys_ula_status_check
  CHECK (user_learning_assignment_status IN ('ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'OVERDUE', 'WAIVED', 'CANCELLED'));

ALTER TABLE sys.sys_user_learning_assignments
  DROP CONSTRAINT IF EXISTS sys_ula_scope_check;
ALTER TABLE sys.sys_user_learning_assignments
  ADD CONSTRAINT sys_ula_scope_check
  CHECK (user_learning_assignment_initiative_id IS NOT NULL
      OR user_learning_assignment_module_id IS NOT NULL
      OR user_learning_assignment_path_id IS NOT NULL);

CREATE INDEX IF NOT EXISTS sys_ula_user_status_idx
  ON sys.sys_user_learning_assignments (user_learning_assignment_user_id, user_learning_assignment_status);

DO $trg$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'sys_ula_set_updated_at' AND tgrelid = 'sys.sys_user_learning_assignments'::regclass) THEN
    CREATE TRIGGER sys_ula_set_updated_at BEFORE UPDATE ON sys.sys_user_learning_assignments FOR EACH ROW EXECUTE FUNCTION sys.sys_set_updated_at();
  END IF;
END $trg$;

CREATE TABLE IF NOT EXISTS sys.sys_learning_gaps (
  learning_gap_id          uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  learning_gap_tenant_id   uuid         NOT NULL REFERENCES sys.sys_tenancies(tenant_id) ON DELETE CASCADE,
  learning_gap_user_id     uuid         NOT NULL REFERENCES sys.sys_users(user_id) ON DELETE CASCADE,
  learning_gap_position_id uuid         REFERENCES sys.sys_positions(position_id) ON DELETE SET NULL,
  learning_gap_skill_id    uuid         REFERENCES sys.sys_skills(skill_id) ON DELETE SET NULL,
  learning_gap_required_proficiency varchar(32),
  learning_gap_current_proficiency  varchar(32),
  learning_gap_score       numeric(5,2),
  learning_gap_severity    varchar(32)  NOT NULL DEFAULT 'MEDIUM',
  learning_gap_detected_at timestamptz  NOT NULL DEFAULT now(),
  learning_gap_metadata    jsonb        NOT NULL DEFAULT '{}'::jsonb,
  created_at               timestamptz  NOT NULL DEFAULT now(),
  updated_at               timestamptz  NOT NULL DEFAULT now()
);

ALTER TABLE sys.sys_learning_gaps
  DROP CONSTRAINT IF EXISTS sys_learning_gap_severity_check;
ALTER TABLE sys.sys_learning_gaps
  ADD CONSTRAINT sys_learning_gap_severity_check
  CHECK (learning_gap_severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL'));

CREATE INDEX IF NOT EXISTS sys_learning_gaps_user_idx
  ON sys.sys_learning_gaps (learning_gap_user_id, learning_gap_severity, learning_gap_detected_at DESC);

CREATE TABLE IF NOT EXISTS sys.sys_gap_closure_actions (
  gap_closure_action_id          uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  gap_closure_action_gap_id      uuid         NOT NULL REFERENCES sys.sys_learning_gaps(learning_gap_id) ON DELETE CASCADE,
  gap_closure_action_tenant_id   uuid         NOT NULL REFERENCES sys.sys_tenancies(tenant_id) ON DELETE CASCADE,
  gap_closure_action_kind        varchar(64)  NOT NULL,
  gap_closure_action_status      varchar(32)  NOT NULL DEFAULT 'PROPOSED',
  gap_closure_action_owner_user_id uuid       REFERENCES sys.sys_users(user_id) ON DELETE SET NULL,
  gap_closure_action_due_date    date,
  gap_closure_action_payload     jsonb        NOT NULL DEFAULT '{}'::jsonb,
  created_at                     timestamptz  NOT NULL DEFAULT now(),
  updated_at                     timestamptz  NOT NULL DEFAULT now()
);

ALTER TABLE sys.sys_gap_closure_actions
  DROP CONSTRAINT IF EXISTS sys_gap_closure_action_kind_check;
ALTER TABLE sys.sys_gap_closure_actions
  ADD CONSTRAINT sys_gap_closure_action_kind_check
  CHECK (gap_closure_action_kind IN ('TRAINING_ASSIGNMENT', 'CERTIFICATION_REQUIRED', 'MANAGER_INTERVENTION', 'PEER_COACHING', 'ON_THE_JOB_EXPOSURE', 'MENTORING'));

ALTER TABLE sys.sys_gap_closure_actions
  DROP CONSTRAINT IF EXISTS sys_gap_closure_action_status_check;
ALTER TABLE sys.sys_gap_closure_actions
  ADD CONSTRAINT sys_gap_closure_action_status_check
  CHECK (gap_closure_action_status IN ('PROPOSED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'));

CREATE INDEX IF NOT EXISTS sys_gap_closure_actions_gap_idx
  ON sys.sys_gap_closure_actions (gap_closure_action_gap_id);

-- Late-binding FKs from earlier migrations
DO $fk$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_schema = 'sys'
      AND table_name = 'sys_user_learning_evidence'
      AND constraint_name = 'sys_user_learning_evidence_module_id_fkey'
  ) THEN
    ALTER TABLE sys.sys_user_learning_evidence
      ADD CONSTRAINT sys_user_learning_evidence_module_id_fkey
      FOREIGN KEY (user_learning_evidence_module_id)
      REFERENCES sys.sys_learning_modules(learning_module_id) ON DELETE RESTRICT;
  END IF;
END
$fk$;

DO $fk$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_schema = 'sys'
      AND table_name = 'sys_position_learning_requirements'
      AND constraint_name = 'sys_position_learning_requirements_path_id_fkey'
  ) THEN
    ALTER TABLE sys.sys_position_learning_requirements
      ADD CONSTRAINT sys_position_learning_requirements_path_id_fkey
      FOREIGN KEY (learning_path_id)
      REFERENCES sys.sys_learning_paths(learning_path_id) ON DELETE RESTRICT;
  END IF;
END
$fk$;
