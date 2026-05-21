BEGIN;

-- ============================================================================
-- temp_sdbi.goals (mirror of sys.sys_goals)
-- ============================================================================
CREATE TABLE IF NOT EXISTS temp_sdbi.goals (
  _legacy_source_id              uuid             NOT NULL,
  _import_run_id                 uuid             NOT NULL,
  goal_id                        uuid             NOT NULL DEFAULT gen_random_uuid(),
  goal_tenant_id                 uuid             NOT NULL,
  goal_natural_key               varchar(512)     NOT NULL,
  goal_subject_user_id           uuid,
  goal_owner_user_id             uuid,
  goal_parent_goal_id            uuid,    -- staging; resolved post-pass
  goal_template_id               uuid,
  goal_title                     varchar(255)     NOT NULL,
  goal_description               text,
  goal_type                      varchar(32)      NOT NULL,
  goal_category                  varchar(100),
  goal_priority                  varchar(16)      NOT NULL,
  goal_status                    varchar(32)      NOT NULL,
  goal_progress_percent          integer          NOT NULL,
  goal_weight                    numeric(5,2)     NOT NULL,
  goal_start_date                date,
  goal_due_date                  date,
  goal_completed_at              timestamptz,
  goal_tags                      jsonb            NOT NULL DEFAULT '[]'::jsonb,
  goal_custom_fields             jsonb            NOT NULL DEFAULT '{}'::jsonb,
  goal_metadata                  jsonb            NOT NULL DEFAULT '{}'::jsonb,
  goal_created_by                uuid,
  goal_updated_by                uuid,
  created_at                     timestamptz      NOT NULL,
  updated_at                     timestamptz      NOT NULL,
  PRIMARY KEY (_legacy_source_id)
);

CREATE INDEX IF NOT EXISTS temp_sdbi_goals_natural_key_idx ON temp_sdbi.goals (goal_natural_key);
CREATE INDEX IF NOT EXISTS temp_sdbi_goals_tenant_idx     ON temp_sdbi.goals (goal_tenant_id);

-- ============================================================================
-- temp_sdbi.goal_milestones
-- ============================================================================
CREATE TABLE IF NOT EXISTS temp_sdbi.goal_milestones (
  _legacy_source_id              uuid             NOT NULL,
  _legacy_source_goal_id         uuid             NOT NULL,    -- raw FK pointer, resolved in Phase 5
  _import_run_id                 uuid             NOT NULL,
  milestone_id                   uuid             NOT NULL DEFAULT gen_random_uuid(),
  milestone_tenant_id            uuid             NOT NULL,
  milestone_goal_id              uuid,                          -- resolved Phase 5 from _legacy_source_goal_id
  milestone_natural_key          varchar(512)     NOT NULL,
  milestone_title                varchar(255)     NOT NULL,
  milestone_description          text,
  milestone_target_date          date,
  milestone_completed_at         timestamptz,
  milestone_status               varchar(32)      NOT NULL,
  milestone_weight               numeric(5,2)     NOT NULL,
  milestone_metadata             jsonb            NOT NULL DEFAULT '{}'::jsonb,
  milestone_created_by           uuid,
  milestone_updated_by           uuid,
  created_at                     timestamptz      NOT NULL,
  updated_at                     timestamptz      NOT NULL,
  PRIMARY KEY (_legacy_source_id)
);

CREATE INDEX IF NOT EXISTS temp_sdbi_gm_legacy_goal_idx ON temp_sdbi.goal_milestones (_legacy_source_goal_id);

-- ============================================================================
-- temp_sdbi.goal_check_ins
-- ============================================================================
CREATE TABLE IF NOT EXISTS temp_sdbi.goal_check_ins (
  _legacy_source_id              uuid             NOT NULL,
  _legacy_source_goal_id         uuid             NOT NULL,
  _legacy_source_employee_id     uuid             NOT NULL,
  _import_run_id                 uuid             NOT NULL,
  check_in_id                    uuid             NOT NULL DEFAULT gen_random_uuid(),
  check_in_tenant_id             uuid             NOT NULL,
  check_in_goal_id               uuid,
  check_in_subject_user_id       uuid,
  check_in_natural_key           varchar(512)     NOT NULL,
  check_in_date                  date             NOT NULL,
  check_in_previous_progress     integer,
  check_in_new_progress          integer          NOT NULL,
  check_in_status_update         varchar(32),
  check_in_notes                 text,
  check_in_blockers              text,
  check_in_next_steps            text,
  check_in_confidence_level      integer,
  check_in_metadata              jsonb            NOT NULL DEFAULT '{}'::jsonb,
  created_at                     timestamptz      NOT NULL,
  PRIMARY KEY (_legacy_source_id)
);

CREATE INDEX IF NOT EXISTS temp_sdbi_gci_legacy_goal_idx ON temp_sdbi.goal_check_ins (_legacy_source_goal_id);

-- ============================================================================
-- temp_sdbi.goal_updates
-- ============================================================================
CREATE TABLE IF NOT EXISTS temp_sdbi.goal_updates (
  _legacy_source_id              uuid             NOT NULL,
  _legacy_source_goal_id         uuid             NOT NULL,
  _legacy_source_author_id       uuid,
  _import_run_id                 uuid             NOT NULL,
  update_id                      uuid             NOT NULL DEFAULT gen_random_uuid(),
  update_tenant_id               uuid             NOT NULL,
  update_goal_id                 uuid,
  update_author_user_id          uuid,
  update_natural_key             varchar(512)     NOT NULL,
  update_type                    varchar(32)      NOT NULL,
  update_previous_progress       numeric(5,2),
  update_new_progress            numeric(5,2),
  update_previous_status         varchar(32),
  update_new_status              varchar(32),
  update_content                 text,
  update_attachments             jsonb            NOT NULL DEFAULT '[]'::jsonb,
  update_metadata                jsonb            NOT NULL DEFAULT '{}'::jsonb,
  created_at                     timestamptz      NOT NULL,
  PRIMARY KEY (_legacy_source_id)
);

-- ============================================================================
-- temp_sdbi.goal_comments
-- ============================================================================
CREATE TABLE IF NOT EXISTS temp_sdbi.goal_comments (
  _legacy_source_id              uuid             NOT NULL,
  _legacy_source_goal_id         uuid             NOT NULL,
  _legacy_source_author_id       uuid,
  _legacy_source_parent_comment_id uuid,
  _import_run_id                 uuid             NOT NULL,
  comment_id                     uuid             NOT NULL DEFAULT gen_random_uuid(),
  comment_tenant_id              uuid             NOT NULL,
  comment_goal_id                uuid,
  comment_author_user_id         uuid,
  comment_parent_comment_id      uuid,
  comment_natural_key            varchar(512)     NOT NULL,
  comment_content                text             NOT NULL,
  comment_is_private             boolean          NOT NULL,
  comment_metadata               jsonb            NOT NULL DEFAULT '{}'::jsonb,
  created_at                     timestamptz      NOT NULL,
  updated_at                     timestamptz      NOT NULL,
  PRIMARY KEY (_legacy_source_id)
);

-- ============================================================================
-- temp_sdbi.goal_alignments
-- ============================================================================
CREATE TABLE IF NOT EXISTS temp_sdbi.goal_alignments (
  _legacy_source_id              uuid             NOT NULL,
  _legacy_source_source_goal_id  uuid             NOT NULL,
  _legacy_source_aligned_goal_id uuid             NOT NULL,
  _import_run_id                 uuid             NOT NULL,
  alignment_id                   uuid             NOT NULL DEFAULT gen_random_uuid(),
  alignment_tenant_id            uuid             NOT NULL,
  alignment_source_goal_id       uuid,
  alignment_aligned_goal_id      uuid,
  alignment_natural_key          varchar(512)     NOT NULL,
  alignment_type                 varchar(32)      NOT NULL,
  alignment_weight               numeric(5,2)     NOT NULL,
  alignment_metadata             jsonb            NOT NULL DEFAULT '{}'::jsonb,
  created_at                     timestamptz      NOT NULL,
  PRIMARY KEY (_legacy_source_id)
);

-- ============================================================================
-- temp_sdbi.goal_templates
-- ============================================================================
CREATE TABLE IF NOT EXISTS temp_sdbi.goal_templates (
  _legacy_source_id                  uuid         NOT NULL,
  _import_run_id                     uuid         NOT NULL,
  template_id                        uuid         NOT NULL DEFAULT gen_random_uuid(),
  template_tenant_id                 uuid         NOT NULL,
  template_role_id                   uuid,
  template_org_unit_id               uuid,
  template_natural_key               varchar(512) NOT NULL,
  template_name                      varchar(255) NOT NULL,
  template_description               text,
  template_category                  varchar(100),
  template_goal_type                 varchar(32)  NOT NULL,
  template_suggested_metrics         text[],
  template_suggested_duration_days   integer,
  template_suggested_weight          numeric(5,2) NOT NULL,
  template_difficulty_level          varchar(32)  NOT NULL,
  template_is_company_wide           boolean      NOT NULL,
  template_usage_count               integer      NOT NULL,
  template_is_active                 boolean      NOT NULL,
  template_deleted_at                timestamptz,
  template_metadata                  jsonb        NOT NULL DEFAULT '{}'::jsonb,
  template_created_by                uuid,
  template_updated_by                uuid,
  created_at                         timestamptz  NOT NULL,
  updated_at                         timestamptz  NOT NULL,
  PRIMARY KEY (_legacy_source_id)
);

-- ============================================================================
-- temp_sdbi.okrs
-- ============================================================================
CREATE TABLE IF NOT EXISTS temp_sdbi.okrs (
  _legacy_source_id              uuid             NOT NULL,
  _import_run_id                 uuid             NOT NULL,
  okr_id                         uuid             NOT NULL DEFAULT gen_random_uuid(),
  okr_tenant_id                  uuid             NOT NULL,
  okr_owner_user_id              uuid,
  okr_created_by_user_id         uuid,
  okr_parent_okr_id              uuid,
  okr_natural_key                varchar(512)     NOT NULL,
  okr_objective                  text             NOT NULL,
  okr_description                text,
  okr_okr_type                   varchar(32)      NOT NULL,
  okr_department                 varchar(100),
  okr_period_type                varchar(16)      NOT NULL,
  okr_period_start               date             NOT NULL,
  okr_period_end                 date             NOT NULL,
  okr_fiscal_year                integer,
  okr_fiscal_quarter             integer,
  okr_status                     varchar(32)      NOT NULL,
  okr_overall_progress           numeric(5,2)     NOT NULL,
  okr_confidence_level           numeric(3,2),
  okr_tags                       jsonb            NOT NULL DEFAULT '[]'::jsonb,
  okr_metadata                   jsonb            NOT NULL DEFAULT '{}'::jsonb,
  created_at                     timestamptz      NOT NULL,
  updated_at                     timestamptz      NOT NULL,
  PRIMARY KEY (_legacy_source_id)
);

CREATE INDEX IF NOT EXISTS temp_sdbi_okrs_natural_key_idx ON temp_sdbi.okrs (okr_natural_key);

-- ============================================================================
-- temp_sdbi.okr_key_results
-- ============================================================================
CREATE TABLE IF NOT EXISTS temp_sdbi.okr_key_results (
  _legacy_source_id              uuid             NOT NULL,
  _legacy_source_okr_id          uuid             NOT NULL,
  _import_run_id                 uuid             NOT NULL,
  key_result_id                  uuid             NOT NULL DEFAULT gen_random_uuid(),
  key_result_tenant_id           uuid             NOT NULL,
  key_result_okr_id              uuid,
  key_result_owner_user_id       uuid,
  key_result_natural_key         varchar(512)     NOT NULL,
  key_result_description         text             NOT NULL,
  key_result_metric_type         varchar(32)      NOT NULL,
  key_result_start_value         numeric(15,2)    NOT NULL,
  key_result_target_value        numeric(15,2)    NOT NULL,
  key_result_current_value       numeric(15,2)    NOT NULL,
  key_result_unit                varchar(50),
  key_result_progress_percent    numeric(5,2)     NOT NULL,
  key_result_status              varchar(32)      NOT NULL,
  key_result_weight              numeric(5,2)     NOT NULL,
  key_result_confidence_level    integer          NOT NULL,
  key_result_last_check_in_at    timestamptz,
  key_result_metadata            jsonb            NOT NULL DEFAULT '{}'::jsonb,
  created_at                     timestamptz      NOT NULL,
  updated_at                     timestamptz      NOT NULL,
  PRIMARY KEY (_legacy_source_id)
);

CREATE INDEX IF NOT EXISTS temp_sdbi_kr_legacy_okr_idx ON temp_sdbi.okr_key_results (_legacy_source_okr_id);

-- ============================================================================
-- temp_sdbi.okr_check_ins (merged target — supports both A and B source)
-- ============================================================================
CREATE TABLE IF NOT EXISTS temp_sdbi.okr_check_ins (
  _legacy_source_id              uuid             NOT NULL,
  _legacy_source_table           varchar(64)      NOT NULL,    -- 'okr_check_ins' or 'okr_checkins'
  _legacy_source_okr_id          uuid             NOT NULL,
  _legacy_source_key_result_id   uuid,                          -- only for A rows
  _legacy_source_user_id         uuid,                          -- employee_id for A, author_id for B
  _import_run_id                 uuid             NOT NULL,
  check_in_id                          uuid       NOT NULL DEFAULT gen_random_uuid(),
  check_in_tenant_id                   uuid       NOT NULL,
  check_in_okr_id                      uuid,
  check_in_key_result_id               uuid,
  check_in_subject_user_id             uuid,
  check_in_natural_key                 varchar(512) NOT NULL,
  check_in_scope                       varchar(32)  NOT NULL,
  check_in_date                        date         NOT NULL,
  check_in_previous_value              numeric(15,2),
  check_in_new_value                   numeric(15,2),
  check_in_previous_progress           numeric(5,2),
  check_in_new_progress                numeric(5,2),
  check_in_overall_progress            numeric(5,2),
  check_in_status_update               text,
  check_in_next_steps                  text,
  check_in_key_result_updates_snapshot jsonb,
  check_in_confidence_level            numeric(5,2),
  check_in_notes                       text,
  check_in_blockers                    text,
  check_in_metadata                    jsonb        NOT NULL DEFAULT '{}'::jsonb,
  created_at                           timestamptz  NOT NULL,
  PRIMARY KEY (_legacy_source_id, _legacy_source_table)
);

CREATE INDEX IF NOT EXISTS temp_sdbi_okr_ci_legacy_okr_idx ON temp_sdbi.okr_check_ins (_legacy_source_okr_id);

COMMIT;
