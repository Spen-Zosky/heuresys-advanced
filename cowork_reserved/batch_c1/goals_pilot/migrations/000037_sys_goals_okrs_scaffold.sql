-- ============================================================================
-- Migration 000035 — sys.* Goals/OKRs scaffold (10 new tables)
-- ----------------------------------------------------------------------------
-- ADR ref: ADR-0014 (SDBI) — Phase 3 prep
-- Companion doc: cowork_reserved/batch_c1/goals_pilot/02_TARGET_SCHEMA_PROPOSAL.md
-- ----------------------------------------------------------------------------
-- Creates 10 sys.* tables for Goals/OKRs SDBI pilot:
--   1. sys.sys_goal_templates       (40 rows expected post-import)
--   2. sys.sys_goals                (1067)
--   3. sys.sys_goal_milestones      (1000)
--   4. sys.sys_goal_check_ins       (1000)
--   5. sys.sys_goal_updates         (1811)
--   6. sys.sys_goal_comments        (856)
--   7. sys.sys_goal_alignments      (100)
--   8. sys.sys_okrs                 (20)
--   9. sys.sys_okr_key_results      (20)
--   10. sys.sys_okr_check_ins       (25 = 15 + 10 merged)
-- ----------------------------------------------------------------------------
-- Conventions (per 02a_ADV_SYS.md + sys.sys_skills/sys_positions templates):
--   - Table name: sys.sys_<entity_plural>
--   - Column prefix: <entity_singular>_<field>
--   - PK: <entity>_id uuid DEFAULT gen_random_uuid()
--   - Tenant FK: <entity>_tenant_id uuid NOT NULL → sys.sys_tenancies ON DELETE RESTRICT
--   - Audit: created_at, updated_at (where applicable), <entity>_created_by, <entity>_updated_by
--   - Natural key: <entity>_natural_key varchar(512) + UQ(tenant_id, natural_key)
--   - Metadata: <entity>_metadata jsonb NOT NULL DEFAULT '{}'::jsonb
--   - CHECK constraints (RD-08, NEVER ENUM)
--   - NO RLS (I5: tenant isolation via FK + middleware)
-- ----------------------------------------------------------------------------
-- Idempotent: CREATE TABLE IF NOT EXISTS + ADD CONSTRAINT IF NOT EXISTS (via DO blocks)
-- ----------------------------------------------------------------------------
-- Authored: 2026-05-20 (Batch C1.8)
-- ============================================================================

BEGIN;

-- =====================================================================
-- §1 — sys.sys_goal_templates  (CATALOG, no FK to goals/okrs)
-- =====================================================================

CREATE TABLE IF NOT EXISTS sys.sys_goal_templates (
  template_id                       uuid             PRIMARY KEY DEFAULT gen_random_uuid(),
  template_tenant_id                uuid             NOT NULL,
  template_role_id                  uuid,
  template_org_unit_id              uuid,
  template_natural_key              varchar(512)     NOT NULL,
  template_name                     varchar(255)     NOT NULL,
  template_description              text,
  template_category                 varchar(100),
  template_goal_type                varchar(32)      NOT NULL DEFAULT 'OBJECTIVE',
  template_suggested_metrics        text[],
  template_suggested_duration_days  integer,
  template_suggested_weight         numeric(5,2)     NOT NULL DEFAULT 1.00,
  template_difficulty_level         varchar(32)      NOT NULL DEFAULT 'MEDIUM',
  template_is_company_wide          boolean          NOT NULL DEFAULT false,
  template_usage_count              integer          NOT NULL DEFAULT 0,
  template_is_active                boolean          NOT NULL DEFAULT true,
  template_deleted_at               timestamptz,
  template_metadata                 jsonb            NOT NULL DEFAULT '{}'::jsonb,
  template_created_by               uuid,
  template_updated_by               uuid,
  created_at                        timestamptz      NOT NULL DEFAULT now(),
  updated_at                        timestamptz      NOT NULL DEFAULT now()
);

DO $cs$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_gt_type_check') THEN
    ALTER TABLE sys.sys_goal_templates ADD CONSTRAINT sys_gt_type_check CHECK (
      template_goal_type IN ('OBJECTIVE','INDIVIDUAL','TECHNICAL','SALES','CUSTOMER','PERFORMANCE','PROJECT','FINANCIAL','SECURITY','LEADERSHIP','DEVELOPMENT','EFFICIENCY','COMPLIANCE')
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_gt_difficulty_check') THEN
    ALTER TABLE sys.sys_goal_templates ADD CONSTRAINT sys_gt_difficulty_check CHECK (
      template_difficulty_level IN ('EASY','MEDIUM','HARD','STRETCH')
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_gt_updated_after') THEN
    ALTER TABLE sys.sys_goal_templates ADD CONSTRAINT sys_gt_updated_after CHECK (updated_at >= created_at);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_gt_tenant_fk') THEN
    ALTER TABLE sys.sys_goal_templates ADD CONSTRAINT sys_gt_tenant_fk FOREIGN KEY (template_tenant_id) REFERENCES sys.sys_tenancies(tenant_id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_gt_created_by_fk') THEN
    ALTER TABLE sys.sys_goal_templates ADD CONSTRAINT sys_gt_created_by_fk FOREIGN KEY (template_created_by) REFERENCES sys.sys_users(user_id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_gt_updated_by_fk') THEN
    ALTER TABLE sys.sys_goal_templates ADD CONSTRAINT sys_gt_updated_by_fk FOREIGN KEY (template_updated_by) REFERENCES sys.sys_users(user_id) ON DELETE SET NULL;
  END IF;
  -- FK to sys_job_roles / sys_organization_units are LATE-BOUND (deferred) since target tables may be empty;
  -- left as plain uuid columns. To bind later, add ALTER TABLE ADD CONSTRAINT sys_gt_role_fk FK (template_role_id) REFERENCES sys.sys_job_roles(job_role_id);
END;
$cs$;

CREATE UNIQUE INDEX IF NOT EXISTS sys_goal_templates_natural_key_uq ON sys.sys_goal_templates (template_tenant_id, template_natural_key);
CREATE INDEX IF NOT EXISTS sys_goal_templates_active_idx       ON sys.sys_goal_templates (template_tenant_id, template_is_active);
CREATE INDEX IF NOT EXISTS sys_goal_templates_category_idx     ON sys.sys_goal_templates (template_tenant_id, template_category);
CREATE INDEX IF NOT EXISTS sys_goal_templates_role_idx         ON sys.sys_goal_templates (template_role_id) WHERE template_role_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS sys_goal_templates_org_unit_idx     ON sys.sys_goal_templates (template_org_unit_id) WHERE template_org_unit_id IS NOT NULL;

DO $trg$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'sys_goal_templates_set_updated_at') THEN
    CREATE TRIGGER sys_goal_templates_set_updated_at BEFORE UPDATE ON sys.sys_goal_templates
      FOR EACH ROW EXECUTE FUNCTION sys.sys_set_updated_at();
  END IF;
END;
$trg$;


-- =====================================================================
-- §2 — sys.sys_goals  (ENTITY, hierarchy)
-- =====================================================================

CREATE TABLE IF NOT EXISTS sys.sys_goals (
  goal_id                         uuid             PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_tenant_id                  uuid             NOT NULL,
  goal_natural_key                varchar(512)     NOT NULL,
  goal_subject_user_id            uuid,
  goal_owner_user_id              uuid,
  goal_parent_goal_id             uuid,
  goal_template_id                uuid,
  goal_title                      varchar(255)     NOT NULL,
  goal_description                text,
  goal_type                       varchar(32)      NOT NULL DEFAULT 'OBJECTIVE',
  goal_category                   varchar(100),
  goal_priority                   varchar(16)      NOT NULL DEFAULT 'MEDIUM',
  goal_status                     varchar(32)      NOT NULL DEFAULT 'NOT_STARTED',
  goal_progress_percent           integer          NOT NULL DEFAULT 0,
  goal_weight                     numeric(5,2)     NOT NULL DEFAULT 1.00,
  goal_start_date                 date,
  goal_due_date                   date,
  goal_completed_at               timestamptz,
  goal_tags                       jsonb            NOT NULL DEFAULT '[]'::jsonb,
  goal_custom_fields              jsonb            NOT NULL DEFAULT '{}'::jsonb,
  goal_metadata                   jsonb            NOT NULL DEFAULT '{}'::jsonb,
  goal_created_by                 uuid,
  goal_updated_by                 uuid,
  created_at                      timestamptz      NOT NULL DEFAULT now(),
  updated_at                      timestamptz      NOT NULL DEFAULT now()
);

DO $cs$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_goals_type_check') THEN
    ALTER TABLE sys.sys_goals ADD CONSTRAINT sys_goals_type_check CHECK (
      goal_type IN ('OBJECTIVE','INDIVIDUAL','TECHNICAL','SALES','CUSTOMER','PERFORMANCE','PROJECT','FINANCIAL','SECURITY','LEADERSHIP','DEVELOPMENT','EFFICIENCY','COMPLIANCE')
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_goals_priority_check') THEN
    ALTER TABLE sys.sys_goals ADD CONSTRAINT sys_goals_priority_check CHECK (goal_priority IN ('LOW','MEDIUM','HIGH','CRITICAL'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_goals_status_check') THEN
    ALTER TABLE sys.sys_goals ADD CONSTRAINT sys_goals_status_check CHECK (
      goal_status IN ('NOT_STARTED','IN_PROGRESS','ON_TRACK','AT_RISK','BLOCKED','COMPLETED','CANCELLED')
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_goals_progress_check') THEN
    ALTER TABLE sys.sys_goals ADD CONSTRAINT sys_goals_progress_check CHECK (goal_progress_percent BETWEEN 0 AND 100);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_goals_updated_after') THEN
    ALTER TABLE sys.sys_goals ADD CONSTRAINT sys_goals_updated_after CHECK (updated_at >= created_at);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_goals_dates_ordered') THEN
    ALTER TABLE sys.sys_goals ADD CONSTRAINT sys_goals_dates_ordered CHECK (
      goal_due_date IS NULL OR goal_start_date IS NULL OR goal_due_date >= goal_start_date
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_goals_tenant_fk') THEN
    ALTER TABLE sys.sys_goals ADD CONSTRAINT sys_goals_tenant_fk FOREIGN KEY (goal_tenant_id) REFERENCES sys.sys_tenancies(tenant_id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_goals_subject_user_fk') THEN
    ALTER TABLE sys.sys_goals ADD CONSTRAINT sys_goals_subject_user_fk FOREIGN KEY (goal_subject_user_id) REFERENCES sys.sys_users(user_id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_goals_owner_user_fk') THEN
    ALTER TABLE sys.sys_goals ADD CONSTRAINT sys_goals_owner_user_fk FOREIGN KEY (goal_owner_user_id) REFERENCES sys.sys_users(user_id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_goals_parent_goal_fk') THEN
    ALTER TABLE sys.sys_goals ADD CONSTRAINT sys_goals_parent_goal_fk FOREIGN KEY (goal_parent_goal_id) REFERENCES sys.sys_goals(goal_id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_goals_template_fk') THEN
    ALTER TABLE sys.sys_goals ADD CONSTRAINT sys_goals_template_fk FOREIGN KEY (goal_template_id) REFERENCES sys.sys_goal_templates(template_id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_goals_created_by_fk') THEN
    ALTER TABLE sys.sys_goals ADD CONSTRAINT sys_goals_created_by_fk FOREIGN KEY (goal_created_by) REFERENCES sys.sys_users(user_id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_goals_updated_by_fk') THEN
    ALTER TABLE sys.sys_goals ADD CONSTRAINT sys_goals_updated_by_fk FOREIGN KEY (goal_updated_by) REFERENCES sys.sys_users(user_id) ON DELETE SET NULL;
  END IF;
END;
$cs$;

CREATE UNIQUE INDEX IF NOT EXISTS sys_goals_natural_key_uq    ON sys.sys_goals (goal_tenant_id, goal_natural_key);
CREATE INDEX IF NOT EXISTS sys_goals_tenant_idx               ON sys.sys_goals (goal_tenant_id);
CREATE INDEX IF NOT EXISTS sys_goals_subject_user_idx         ON sys.sys_goals (goal_subject_user_id) WHERE goal_subject_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS sys_goals_owner_user_idx           ON sys.sys_goals (goal_owner_user_id)   WHERE goal_owner_user_id   IS NOT NULL;
CREATE INDEX IF NOT EXISTS sys_goals_parent_idx               ON sys.sys_goals (goal_parent_goal_id)  WHERE goal_parent_goal_id  IS NOT NULL;
CREATE INDEX IF NOT EXISTS sys_goals_template_idx             ON sys.sys_goals (goal_template_id)     WHERE goal_template_id     IS NOT NULL;
CREATE INDEX IF NOT EXISTS sys_goals_status_idx               ON sys.sys_goals (goal_tenant_id, goal_status);
CREATE INDEX IF NOT EXISTS sys_goals_due_date_idx             ON sys.sys_goals (goal_tenant_id, goal_due_date);

DO $trg$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'sys_goals_set_updated_at') THEN
    CREATE TRIGGER sys_goals_set_updated_at BEFORE UPDATE ON sys.sys_goals
      FOR EACH ROW EXECUTE FUNCTION sys.sys_set_updated_at();
  END IF;
END;
$trg$;


-- =====================================================================
-- §3 — sys.sys_goal_milestones
-- =====================================================================

CREATE TABLE IF NOT EXISTS sys.sys_goal_milestones (
  milestone_id                     uuid             PRIMARY KEY DEFAULT gen_random_uuid(),
  milestone_tenant_id              uuid             NOT NULL,
  milestone_goal_id                uuid             NOT NULL,
  milestone_natural_key            varchar(512)     NOT NULL,
  milestone_title                  varchar(255)     NOT NULL,
  milestone_description            text,
  milestone_target_date            date,
  milestone_completed_at           timestamptz,
  milestone_status                 varchar(32)      NOT NULL DEFAULT 'PENDING',
  milestone_weight                 numeric(5,2)     NOT NULL DEFAULT 0,
  milestone_metadata               jsonb            NOT NULL DEFAULT '{}'::jsonb,
  milestone_created_by             uuid,
  milestone_updated_by             uuid,
  created_at                       timestamptz      NOT NULL DEFAULT now(),
  updated_at                       timestamptz      NOT NULL DEFAULT now()
);

DO $cs$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_gm_status_check') THEN
    ALTER TABLE sys.sys_goal_milestones ADD CONSTRAINT sys_gm_status_check CHECK (
      milestone_status IN ('PENDING','IN_PROGRESS','COMPLETED','MISSED','CANCELLED')
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_gm_updated_after') THEN
    ALTER TABLE sys.sys_goal_milestones ADD CONSTRAINT sys_gm_updated_after CHECK (updated_at >= created_at);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_gm_tenant_fk') THEN
    ALTER TABLE sys.sys_goal_milestones ADD CONSTRAINT sys_gm_tenant_fk FOREIGN KEY (milestone_tenant_id) REFERENCES sys.sys_tenancies(tenant_id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_gm_goal_fk') THEN
    ALTER TABLE sys.sys_goal_milestones ADD CONSTRAINT sys_gm_goal_fk FOREIGN KEY (milestone_goal_id) REFERENCES sys.sys_goals(goal_id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_gm_created_by_fk') THEN
    ALTER TABLE sys.sys_goal_milestones ADD CONSTRAINT sys_gm_created_by_fk FOREIGN KEY (milestone_created_by) REFERENCES sys.sys_users(user_id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_gm_updated_by_fk') THEN
    ALTER TABLE sys.sys_goal_milestones ADD CONSTRAINT sys_gm_updated_by_fk FOREIGN KEY (milestone_updated_by) REFERENCES sys.sys_users(user_id) ON DELETE SET NULL;
  END IF;
END;
$cs$;

CREATE UNIQUE INDEX IF NOT EXISTS sys_goal_milestones_natural_key_uq ON sys.sys_goal_milestones (milestone_tenant_id, milestone_natural_key);
CREATE INDEX IF NOT EXISTS sys_goal_milestones_goal_idx        ON sys.sys_goal_milestones (milestone_goal_id);
CREATE INDEX IF NOT EXISTS sys_goal_milestones_target_date_idx ON sys.sys_goal_milestones (milestone_tenant_id, milestone_target_date);

DO $trg$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'sys_goal_milestones_set_updated_at') THEN
    CREATE TRIGGER sys_goal_milestones_set_updated_at BEFORE UPDATE ON sys.sys_goal_milestones
      FOR EACH ROW EXECUTE FUNCTION sys.sys_set_updated_at();
  END IF;
END;
$trg$;


-- =====================================================================
-- §4 — sys.sys_goal_check_ins (immutable event log, no updated_at)
-- =====================================================================

CREATE TABLE IF NOT EXISTS sys.sys_goal_check_ins (
  check_in_id                      uuid             PRIMARY KEY DEFAULT gen_random_uuid(),
  check_in_tenant_id               uuid             NOT NULL,
  check_in_goal_id                 uuid             NOT NULL,
  check_in_subject_user_id         uuid             NOT NULL,
  check_in_natural_key             varchar(512)     NOT NULL,
  check_in_date                    date             NOT NULL DEFAULT CURRENT_DATE,
  check_in_previous_progress       integer,
  check_in_new_progress            integer          NOT NULL,
  check_in_status_update           varchar(32),
  check_in_notes                   text,
  check_in_blockers                text,
  check_in_next_steps              text,
  check_in_confidence_level        integer,
  check_in_metadata                jsonb            NOT NULL DEFAULT '{}'::jsonb,
  created_at                       timestamptz      NOT NULL DEFAULT now()
);

DO $cs$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_gci_progress_check') THEN
    ALTER TABLE sys.sys_goal_check_ins ADD CONSTRAINT sys_gci_progress_check CHECK (check_in_new_progress BETWEEN 0 AND 100);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_gci_prev_progress_chk') THEN
    ALTER TABLE sys.sys_goal_check_ins ADD CONSTRAINT sys_gci_prev_progress_chk CHECK (check_in_previous_progress IS NULL OR check_in_previous_progress BETWEEN 0 AND 100);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_gci_status_check') THEN
    ALTER TABLE sys.sys_goal_check_ins ADD CONSTRAINT sys_gci_status_check CHECK (
      check_in_status_update IS NULL OR check_in_status_update IN ('ON_TRACK','AHEAD','AT_RISK','BLOCKED','COMPLETED')
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_gci_confidence_check') THEN
    ALTER TABLE sys.sys_goal_check_ins ADD CONSTRAINT sys_gci_confidence_check CHECK (check_in_confidence_level IS NULL OR check_in_confidence_level BETWEEN 1 AND 5);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_gci_tenant_fk') THEN
    ALTER TABLE sys.sys_goal_check_ins ADD CONSTRAINT sys_gci_tenant_fk FOREIGN KEY (check_in_tenant_id) REFERENCES sys.sys_tenancies(tenant_id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_gci_goal_fk') THEN
    ALTER TABLE sys.sys_goal_check_ins ADD CONSTRAINT sys_gci_goal_fk FOREIGN KEY (check_in_goal_id) REFERENCES sys.sys_goals(goal_id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_gci_subject_user_fk') THEN
    ALTER TABLE sys.sys_goal_check_ins ADD CONSTRAINT sys_gci_subject_user_fk FOREIGN KEY (check_in_subject_user_id) REFERENCES sys.sys_users(user_id) ON DELETE RESTRICT;
  END IF;
END;
$cs$;

CREATE UNIQUE INDEX IF NOT EXISTS sys_goal_check_ins_natural_key_uq ON sys.sys_goal_check_ins (check_in_tenant_id, check_in_natural_key);
CREATE INDEX IF NOT EXISTS sys_goal_check_ins_goal_idx           ON sys.sys_goal_check_ins (check_in_goal_id);
CREATE INDEX IF NOT EXISTS sys_goal_check_ins_subject_user_idx   ON sys.sys_goal_check_ins (check_in_subject_user_id);
CREATE INDEX IF NOT EXISTS sys_goal_check_ins_date_idx           ON sys.sys_goal_check_ins (check_in_tenant_id, check_in_date DESC);


-- =====================================================================
-- §5 — sys.sys_goal_updates (immutable event log)
-- =====================================================================

CREATE TABLE IF NOT EXISTS sys.sys_goal_updates (
  update_id                        uuid             PRIMARY KEY DEFAULT gen_random_uuid(),
  update_tenant_id                 uuid             NOT NULL,
  update_goal_id                   uuid             NOT NULL,
  update_author_user_id            uuid,
  update_natural_key               varchar(512)     NOT NULL,
  update_type                      varchar(32)      NOT NULL DEFAULT 'PROGRESS',
  update_previous_progress         numeric(5,2),
  update_new_progress              numeric(5,2),
  update_previous_status           varchar(32),
  update_new_status                varchar(32),
  update_content                   text,
  update_attachments               jsonb            NOT NULL DEFAULT '[]'::jsonb,
  update_metadata                  jsonb            NOT NULL DEFAULT '{}'::jsonb,
  created_at                       timestamptz      NOT NULL DEFAULT now()
);

DO $cs$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_gu_type_check') THEN
    ALTER TABLE sys.sys_goal_updates ADD CONSTRAINT sys_gu_type_check CHECK (
      update_type IN ('PROGRESS','STATUS_CHANGE','MILESTONE','BLOCKER','NOTE')
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_gu_tenant_fk') THEN
    ALTER TABLE sys.sys_goal_updates ADD CONSTRAINT sys_gu_tenant_fk FOREIGN KEY (update_tenant_id) REFERENCES sys.sys_tenancies(tenant_id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_gu_goal_fk') THEN
    ALTER TABLE sys.sys_goal_updates ADD CONSTRAINT sys_gu_goal_fk FOREIGN KEY (update_goal_id) REFERENCES sys.sys_goals(goal_id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_gu_author_fk') THEN
    ALTER TABLE sys.sys_goal_updates ADD CONSTRAINT sys_gu_author_fk FOREIGN KEY (update_author_user_id) REFERENCES sys.sys_users(user_id) ON DELETE SET NULL;
  END IF;
END;
$cs$;

CREATE UNIQUE INDEX IF NOT EXISTS sys_goal_updates_natural_key_uq ON sys.sys_goal_updates (update_tenant_id, update_natural_key);
CREATE INDEX IF NOT EXISTS sys_goal_updates_goal_idx        ON sys.sys_goal_updates (update_goal_id);
CREATE INDEX IF NOT EXISTS sys_goal_updates_author_idx      ON sys.sys_goal_updates (update_author_user_id) WHERE update_author_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS sys_goal_updates_created_idx     ON sys.sys_goal_updates (update_tenant_id, created_at DESC);


-- =====================================================================
-- §6 — sys.sys_goal_comments (threading-ready, self-FK)
-- =====================================================================

CREATE TABLE IF NOT EXISTS sys.sys_goal_comments (
  comment_id                       uuid             PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_tenant_id                uuid             NOT NULL,
  comment_goal_id                  uuid             NOT NULL,
  comment_author_user_id           uuid,
  comment_parent_comment_id        uuid,
  comment_natural_key              varchar(512)     NOT NULL,
  comment_content                  text             NOT NULL,
  comment_is_private               boolean          NOT NULL DEFAULT false,
  comment_metadata                 jsonb            NOT NULL DEFAULT '{}'::jsonb,
  created_at                       timestamptz      NOT NULL DEFAULT now(),
  updated_at                       timestamptz      NOT NULL DEFAULT now()
);

DO $cs$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_gc_updated_after') THEN
    ALTER TABLE sys.sys_goal_comments ADD CONSTRAINT sys_gc_updated_after CHECK (updated_at >= created_at);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_gc_tenant_fk') THEN
    ALTER TABLE sys.sys_goal_comments ADD CONSTRAINT sys_gc_tenant_fk FOREIGN KEY (comment_tenant_id) REFERENCES sys.sys_tenancies(tenant_id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_gc_goal_fk') THEN
    ALTER TABLE sys.sys_goal_comments ADD CONSTRAINT sys_gc_goal_fk FOREIGN KEY (comment_goal_id) REFERENCES sys.sys_goals(goal_id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_gc_author_fk') THEN
    ALTER TABLE sys.sys_goal_comments ADD CONSTRAINT sys_gc_author_fk FOREIGN KEY (comment_author_user_id) REFERENCES sys.sys_users(user_id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_gc_parent_fk') THEN
    ALTER TABLE sys.sys_goal_comments ADD CONSTRAINT sys_gc_parent_fk FOREIGN KEY (comment_parent_comment_id) REFERENCES sys.sys_goal_comments(comment_id) ON DELETE CASCADE;
  END IF;
END;
$cs$;

CREATE UNIQUE INDEX IF NOT EXISTS sys_goal_comments_natural_key_uq ON sys.sys_goal_comments (comment_tenant_id, comment_natural_key);
CREATE INDEX IF NOT EXISTS sys_goal_comments_goal_idx        ON sys.sys_goal_comments (comment_goal_id);
CREATE INDEX IF NOT EXISTS sys_goal_comments_author_idx      ON sys.sys_goal_comments (comment_author_user_id) WHERE comment_author_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS sys_goal_comments_parent_idx      ON sys.sys_goal_comments (comment_parent_comment_id) WHERE comment_parent_comment_id IS NOT NULL;

DO $trg$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'sys_goal_comments_set_updated_at') THEN
    CREATE TRIGGER sys_goal_comments_set_updated_at BEFORE UPDATE ON sys.sys_goal_comments
      FOR EACH ROW EXECUTE FUNCTION sys.sys_set_updated_at();
  END IF;
END;
$trg$;


-- =====================================================================
-- §7 — sys.sys_goal_alignments (junction goals × goals)
-- =====================================================================

CREATE TABLE IF NOT EXISTS sys.sys_goal_alignments (
  alignment_id                     uuid             PRIMARY KEY DEFAULT gen_random_uuid(),
  alignment_tenant_id              uuid             NOT NULL,
  alignment_source_goal_id         uuid             NOT NULL,
  alignment_aligned_goal_id        uuid             NOT NULL,
  alignment_natural_key            varchar(512)     NOT NULL,
  alignment_type                   varchar(32)      NOT NULL DEFAULT 'SUPPORTS',
  alignment_weight                 numeric(5,2)     NOT NULL DEFAULT 100,
  alignment_metadata               jsonb            NOT NULL DEFAULT '{}'::jsonb,
  created_at                       timestamptz      NOT NULL DEFAULT now()
);

DO $cs$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_ga_type_check') THEN
    ALTER TABLE sys.sys_goal_alignments ADD CONSTRAINT sys_ga_type_check CHECK (
      alignment_type IN ('SUPPORTS','CONTRIBUTES_TO','DERIVED_FROM','DEPENDS_ON')
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_ga_no_self') THEN
    ALTER TABLE sys.sys_goal_alignments ADD CONSTRAINT sys_ga_no_self CHECK (alignment_source_goal_id <> alignment_aligned_goal_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_ga_tenant_fk') THEN
    ALTER TABLE sys.sys_goal_alignments ADD CONSTRAINT sys_ga_tenant_fk FOREIGN KEY (alignment_tenant_id) REFERENCES sys.sys_tenancies(tenant_id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_ga_source_fk') THEN
    ALTER TABLE sys.sys_goal_alignments ADD CONSTRAINT sys_ga_source_fk FOREIGN KEY (alignment_source_goal_id) REFERENCES sys.sys_goals(goal_id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_ga_aligned_fk') THEN
    ALTER TABLE sys.sys_goal_alignments ADD CONSTRAINT sys_ga_aligned_fk FOREIGN KEY (alignment_aligned_goal_id) REFERENCES sys.sys_goals(goal_id) ON DELETE CASCADE;
  END IF;
END;
$cs$;

CREATE UNIQUE INDEX IF NOT EXISTS sys_goal_alignments_natural_key_uq ON sys.sys_goal_alignments (alignment_tenant_id, alignment_natural_key);
CREATE UNIQUE INDEX IF NOT EXISTS sys_goal_alignments_pair_uq        ON sys.sys_goal_alignments (alignment_source_goal_id, alignment_aligned_goal_id);
CREATE INDEX IF NOT EXISTS sys_goal_alignments_source_idx     ON sys.sys_goal_alignments (alignment_source_goal_id);
CREATE INDEX IF NOT EXISTS sys_goal_alignments_aligned_idx    ON sys.sys_goal_alignments (alignment_aligned_goal_id);


-- =====================================================================
-- §8 — sys.sys_okrs (ENTITY)
-- =====================================================================

CREATE TABLE IF NOT EXISTS sys.sys_okrs (
  okr_id                           uuid             PRIMARY KEY DEFAULT gen_random_uuid(),
  okr_tenant_id                    uuid             NOT NULL,
  okr_owner_user_id                uuid,
  okr_created_by_user_id           uuid,
  okr_parent_okr_id                uuid,
  okr_natural_key                  varchar(512)     NOT NULL,
  okr_objective                    text             NOT NULL,
  okr_description                  text,
  okr_okr_type                     varchar(32)      NOT NULL DEFAULT 'COMPANY',
  okr_department                   varchar(100),
  okr_period_type                  varchar(16)      NOT NULL DEFAULT 'QUARTERLY',
  okr_period_start                 date             NOT NULL,
  okr_period_end                   date             NOT NULL,
  okr_fiscal_year                  integer,
  okr_fiscal_quarter               integer,
  okr_status                       varchar(32)      NOT NULL DEFAULT 'ACTIVE',
  okr_overall_progress             numeric(5,2)     NOT NULL DEFAULT 0,
  okr_confidence_level             numeric(3,2),
  okr_tags                         jsonb            NOT NULL DEFAULT '[]'::jsonb,
  okr_metadata                     jsonb            NOT NULL DEFAULT '{}'::jsonb,
  created_at                       timestamptz      NOT NULL DEFAULT now(),
  updated_at                       timestamptz      NOT NULL DEFAULT now()
);

DO $cs$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_okrs_type_check') THEN
    ALTER TABLE sys.sys_okrs ADD CONSTRAINT sys_okrs_type_check CHECK (okr_okr_type IN ('COMPANY','DEPARTMENT','TEAM','INDIVIDUAL'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_okrs_period_check') THEN
    ALTER TABLE sys.sys_okrs ADD CONSTRAINT sys_okrs_period_check CHECK (okr_period_type IN ('QUARTERLY','MONTHLY','YEARLY','CUSTOM'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_okrs_status_check') THEN
    ALTER TABLE sys.sys_okrs ADD CONSTRAINT sys_okrs_status_check CHECK (okr_status IN ('DRAFT','ACTIVE','ACHIEVED','MISSED','CANCELLED','ARCHIVED'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_okrs_period_ordered') THEN
    ALTER TABLE sys.sys_okrs ADD CONSTRAINT sys_okrs_period_ordered CHECK (okr_period_end >= okr_period_start);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_okrs_fiscal_q_check') THEN
    ALTER TABLE sys.sys_okrs ADD CONSTRAINT sys_okrs_fiscal_q_check CHECK (okr_fiscal_quarter IS NULL OR okr_fiscal_quarter BETWEEN 1 AND 4);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_okrs_updated_after') THEN
    ALTER TABLE sys.sys_okrs ADD CONSTRAINT sys_okrs_updated_after CHECK (updated_at >= created_at);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_okrs_tenant_fk') THEN
    ALTER TABLE sys.sys_okrs ADD CONSTRAINT sys_okrs_tenant_fk FOREIGN KEY (okr_tenant_id) REFERENCES sys.sys_tenancies(tenant_id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_okrs_owner_fk') THEN
    ALTER TABLE sys.sys_okrs ADD CONSTRAINT sys_okrs_owner_fk FOREIGN KEY (okr_owner_user_id) REFERENCES sys.sys_users(user_id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_okrs_created_by_fk') THEN
    ALTER TABLE sys.sys_okrs ADD CONSTRAINT sys_okrs_created_by_fk FOREIGN KEY (okr_created_by_user_id) REFERENCES sys.sys_users(user_id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_okrs_parent_fk') THEN
    ALTER TABLE sys.sys_okrs ADD CONSTRAINT sys_okrs_parent_fk FOREIGN KEY (okr_parent_okr_id) REFERENCES sys.sys_okrs(okr_id) ON DELETE SET NULL;
  END IF;
END;
$cs$;

CREATE UNIQUE INDEX IF NOT EXISTS sys_okrs_natural_key_uq    ON sys.sys_okrs (okr_tenant_id, okr_natural_key);
CREATE INDEX IF NOT EXISTS sys_okrs_owner_idx          ON sys.sys_okrs (okr_owner_user_id) WHERE okr_owner_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS sys_okrs_period_idx         ON sys.sys_okrs (okr_tenant_id, okr_period_start, okr_period_end);
CREATE INDEX IF NOT EXISTS sys_okrs_status_idx         ON sys.sys_okrs (okr_tenant_id, okr_status);
CREATE INDEX IF NOT EXISTS sys_okrs_parent_idx         ON sys.sys_okrs (okr_parent_okr_id) WHERE okr_parent_okr_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS sys_okrs_type_idx           ON sys.sys_okrs (okr_tenant_id, okr_okr_type);

DO $trg$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'sys_okrs_set_updated_at') THEN
    CREATE TRIGGER sys_okrs_set_updated_at BEFORE UPDATE ON sys.sys_okrs
      FOR EACH ROW EXECUTE FUNCTION sys.sys_set_updated_at();
  END IF;
END;
$trg$;


-- =====================================================================
-- §9 — sys.sys_okr_key_results (composition of OKR)
-- =====================================================================

CREATE TABLE IF NOT EXISTS sys.sys_okr_key_results (
  key_result_id                    uuid             PRIMARY KEY DEFAULT gen_random_uuid(),
  key_result_tenant_id             uuid             NOT NULL,
  key_result_okr_id                uuid             NOT NULL,
  key_result_owner_user_id         uuid,
  key_result_natural_key           varchar(512)     NOT NULL,
  key_result_description           text             NOT NULL,
  key_result_metric_type           varchar(32)      NOT NULL DEFAULT 'PERCENTAGE',
  key_result_start_value           numeric(15,2)    NOT NULL DEFAULT 0,
  key_result_target_value          numeric(15,2)    NOT NULL,
  key_result_current_value         numeric(15,2)    NOT NULL DEFAULT 0,
  key_result_unit                  varchar(50),
  key_result_progress_percent      numeric(5,2)     NOT NULL DEFAULT 0,
  key_result_status                varchar(32)      NOT NULL DEFAULT 'ON_TRACK',
  key_result_weight                numeric(5,2)     NOT NULL DEFAULT 1.00,
  key_result_confidence_level      integer          NOT NULL DEFAULT 3,
  key_result_last_check_in_at      timestamptz,
  key_result_metadata              jsonb            NOT NULL DEFAULT '{}'::jsonb,
  created_at                       timestamptz      NOT NULL DEFAULT now(),
  updated_at                       timestamptz      NOT NULL DEFAULT now()
);

DO $cs$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_okr_kr_metric_check') THEN
    ALTER TABLE sys.sys_okr_key_results ADD CONSTRAINT sys_okr_kr_metric_check CHECK (
      key_result_metric_type IN ('PERCENTAGE','NUMBER','CURRENCY','BOOLEAN','MILESTONE')
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_okr_kr_status_check') THEN
    ALTER TABLE sys.sys_okr_key_results ADD CONSTRAINT sys_okr_kr_status_check CHECK (
      key_result_status IN ('ON_TRACK','AT_RISK','BEHIND','COMPLETED','ABANDONED')
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_okr_kr_confidence_check') THEN
    ALTER TABLE sys.sys_okr_key_results ADD CONSTRAINT sys_okr_kr_confidence_check CHECK (key_result_confidence_level BETWEEN 1 AND 5);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_okr_kr_updated_after') THEN
    ALTER TABLE sys.sys_okr_key_results ADD CONSTRAINT sys_okr_kr_updated_after CHECK (updated_at >= created_at);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_okr_kr_tenant_fk') THEN
    ALTER TABLE sys.sys_okr_key_results ADD CONSTRAINT sys_okr_kr_tenant_fk FOREIGN KEY (key_result_tenant_id) REFERENCES sys.sys_tenancies(tenant_id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_okr_kr_okr_fk') THEN
    ALTER TABLE sys.sys_okr_key_results ADD CONSTRAINT sys_okr_kr_okr_fk FOREIGN KEY (key_result_okr_id) REFERENCES sys.sys_okrs(okr_id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_okr_kr_owner_fk') THEN
    ALTER TABLE sys.sys_okr_key_results ADD CONSTRAINT sys_okr_kr_owner_fk FOREIGN KEY (key_result_owner_user_id) REFERENCES sys.sys_users(user_id) ON DELETE SET NULL;
  END IF;
END;
$cs$;

CREATE UNIQUE INDEX IF NOT EXISTS sys_okr_key_results_natural_key_uq ON sys.sys_okr_key_results (key_result_tenant_id, key_result_natural_key);
CREATE INDEX IF NOT EXISTS sys_okr_key_results_okr_idx       ON sys.sys_okr_key_results (key_result_okr_id);
CREATE INDEX IF NOT EXISTS sys_okr_key_results_owner_idx     ON sys.sys_okr_key_results (key_result_owner_user_id) WHERE key_result_owner_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS sys_okr_key_results_status_idx    ON sys.sys_okr_key_results (key_result_status);

DO $trg$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'sys_okr_key_results_set_updated_at') THEN
    CREATE TRIGGER sys_okr_key_results_set_updated_at BEFORE UPDATE ON sys.sys_okr_key_results
      FOR EACH ROW EXECUTE FUNCTION sys.sys_set_updated_at();
  END IF;
END;
$trg$;


-- =====================================================================
-- §10 — sys.sys_okr_check_ins (merged target for okr_check_ins + okr_checkins)
-- =====================================================================

CREATE TABLE IF NOT EXISTS sys.sys_okr_check_ins (
  check_in_id                          uuid             PRIMARY KEY DEFAULT gen_random_uuid(),
  check_in_tenant_id                   uuid             NOT NULL,
  check_in_okr_id                      uuid             NOT NULL,
  check_in_key_result_id               uuid,
  check_in_subject_user_id             uuid,
  check_in_natural_key                 varchar(512)     NOT NULL,
  check_in_scope                       varchar(32)      NOT NULL,
  check_in_date                        date             NOT NULL DEFAULT CURRENT_DATE,
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
  check_in_metadata                    jsonb            NOT NULL DEFAULT '{}'::jsonb,
  created_at                           timestamptz      NOT NULL DEFAULT now()
);

DO $cs$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_okr_ci_scope_check') THEN
    ALTER TABLE sys.sys_okr_check_ins ADD CONSTRAINT sys_okr_ci_scope_check CHECK (check_in_scope IN ('KEY_RESULT','OKR_AGGREGATE'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_okr_ci_scope_kr_coherent') THEN
    ALTER TABLE sys.sys_okr_check_ins ADD CONSTRAINT sys_okr_ci_scope_kr_coherent CHECK (
      (check_in_scope = 'KEY_RESULT' AND check_in_key_result_id IS NOT NULL)
      OR
      (check_in_scope = 'OKR_AGGREGATE' AND check_in_key_result_id IS NULL)
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_okr_ci_tenant_fk') THEN
    ALTER TABLE sys.sys_okr_check_ins ADD CONSTRAINT sys_okr_ci_tenant_fk FOREIGN KEY (check_in_tenant_id) REFERENCES sys.sys_tenancies(tenant_id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_okr_ci_okr_fk') THEN
    ALTER TABLE sys.sys_okr_check_ins ADD CONSTRAINT sys_okr_ci_okr_fk FOREIGN KEY (check_in_okr_id) REFERENCES sys.sys_okrs(okr_id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_okr_ci_kr_fk') THEN
    ALTER TABLE sys.sys_okr_check_ins ADD CONSTRAINT sys_okr_ci_kr_fk FOREIGN KEY (check_in_key_result_id) REFERENCES sys.sys_okr_key_results(key_result_id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_okr_ci_subject_fk') THEN
    ALTER TABLE sys.sys_okr_check_ins ADD CONSTRAINT sys_okr_ci_subject_fk FOREIGN KEY (check_in_subject_user_id) REFERENCES sys.sys_users(user_id) ON DELETE SET NULL;
  END IF;
END;
$cs$;

CREATE UNIQUE INDEX IF NOT EXISTS sys_okr_check_ins_natural_key_uq ON sys.sys_okr_check_ins (check_in_tenant_id, check_in_natural_key);
CREATE INDEX IF NOT EXISTS sys_okr_check_ins_okr_idx           ON sys.sys_okr_check_ins (check_in_okr_id);
CREATE INDEX IF NOT EXISTS sys_okr_check_ins_kr_idx            ON sys.sys_okr_check_ins (check_in_key_result_id) WHERE check_in_key_result_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS sys_okr_check_ins_subject_idx       ON sys.sys_okr_check_ins (check_in_subject_user_id) WHERE check_in_subject_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS sys_okr_check_ins_date_idx          ON sys.sys_okr_check_ins (check_in_tenant_id, check_in_date DESC);


COMMIT;

-- ============================================================================
-- End migration 000035
-- ============================================================================
