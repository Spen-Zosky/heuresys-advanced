-- 000097_engagement_normalized_schema.sql
-- B-10b m2b — Surveys NORMALIZED cluster (read-model). Schema only; data via seed 48.
--
-- Distinct from m2 (mig 000077, sys_engagement_survey_* JSONB authoring cluster): this is
-- the legacy NORMALIZED survey cluster (survey_*/pulse_checks) — its value is QUESTION-LEVEL
-- granularity (one sys_survey_responses row per answer), which the JSONB cluster cannot express.
-- Read-only analytical read-model (the live authoring path stays m2's JSONB surveys). Tables:
--   sys_surveys            — normalized survey instances
--   sys_survey_questions   — questions (FK survey)
--   sys_survey_responses   — ONE row per (survey, question, subject) answer  ← the value-add
--   sys_pulse_checks       — weekly pulse events (mood/workload/satisfaction)
-- I14 employee-centric: subjects link to sys_users via LEGACY_EMP:: crosswalk (FK nullable,
-- legacy id kept in *_metadata when unresolved). I5: tenant_id FK + API middleware filter.
-- engagement_pulse_configs (3 rows, config) is OUT-OF-SCOPE m2b (adjacent, low value) — deferred.
-- RBAC reuses the existing surveys:read permission (mig 000078) — no new perm seed.

-- ── sys_surveys ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sys.sys_surveys (
  survey_id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_tenant_id       uuid NOT NULL REFERENCES sys.sys_tenancies(tenant_id) ON DELETE RESTRICT,
  survey_natural_key     text NOT NULL,
  survey_title           varchar(300) NOT NULL,
  survey_description     text,
  survey_type            varchar(60),
  survey_status          varchar(30) NOT NULL DEFAULT 'closed'
                           CHECK (survey_status IN ('draft','active','closed','archived')),
  survey_start_date      date,
  survey_end_date        date,
  survey_is_anonymous    boolean NOT NULL DEFAULT false,
  survey_total_invitations integer,
  survey_metadata        jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sys_surveys_natural_key_uq UNIQUE (survey_tenant_id, survey_natural_key)
);
CREATE INDEX IF NOT EXISTS sys_surveys_tenant_idx ON sys.sys_surveys (survey_tenant_id);

-- ── sys_survey_questions ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sys.sys_survey_questions (
  survey_question_id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_question_survey_id     uuid NOT NULL REFERENCES sys.sys_surveys(survey_id) ON DELETE CASCADE,
  survey_question_tenant_id     uuid NOT NULL REFERENCES sys.sys_tenancies(tenant_id) ON DELETE RESTRICT,
  survey_question_natural_key   text NOT NULL,
  survey_question_text          text NOT NULL,
  survey_question_type          varchar(40),
  survey_question_options       jsonb,
  survey_question_category      varchar(80),
  survey_question_display_order integer,
  survey_question_is_required   boolean NOT NULL DEFAULT false,
  created_at                    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sys_survey_questions_natural_key_uq UNIQUE (survey_question_tenant_id, survey_question_natural_key)
);
CREATE INDEX IF NOT EXISTS sys_survey_questions_survey_idx ON sys.sys_survey_questions (survey_question_survey_id);

-- ── sys_survey_responses (one row per answer) ────────────────────────────────
CREATE TABLE IF NOT EXISTS sys.sys_survey_responses (
  survey_response_id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_response_survey_id     uuid NOT NULL REFERENCES sys.sys_surveys(survey_id) ON DELETE CASCADE,
  survey_response_question_id   uuid REFERENCES sys.sys_survey_questions(survey_question_id) ON DELETE SET NULL,
  survey_response_tenant_id     uuid NOT NULL REFERENCES sys.sys_tenancies(tenant_id) ON DELETE RESTRICT,
  survey_response_subject_user_id uuid REFERENCES sys.sys_users(user_id) ON DELETE SET NULL,
  survey_response_natural_key   text NOT NULL,
  survey_response_rating_value  integer,
  survey_response_text_value    text,
  survey_response_choice_value  varchar(200),
  survey_response_metadata      jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at                    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sys_survey_responses_natural_key_uq UNIQUE (survey_response_tenant_id, survey_response_natural_key)
);
CREATE INDEX IF NOT EXISTS sys_survey_responses_survey_idx ON sys.sys_survey_responses (survey_response_survey_id);
CREATE INDEX IF NOT EXISTS sys_survey_responses_question_idx ON sys.sys_survey_responses (survey_response_question_id);
CREATE INDEX IF NOT EXISTS sys_survey_responses_subject_idx ON sys.sys_survey_responses (survey_response_subject_user_id);

-- ── sys_pulse_checks ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sys.sys_pulse_checks (
  pulse_check_id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pulse_check_tenant_id     uuid NOT NULL REFERENCES sys.sys_tenancies(tenant_id) ON DELETE RESTRICT,
  pulse_check_subject_user_id uuid REFERENCES sys.sys_users(user_id) ON DELETE SET NULL,
  pulse_check_natural_key   text NOT NULL,
  pulse_check_mood_score    integer,
  pulse_check_workload_score integer,
  pulse_check_satisfaction_score integer,
  pulse_check_comment       text,
  pulse_check_date          date,
  pulse_check_week_number   integer,
  pulse_check_metadata      jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at                timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sys_pulse_checks_natural_key_uq UNIQUE (pulse_check_tenant_id, pulse_check_natural_key)
);
CREATE INDEX IF NOT EXISTS sys_pulse_checks_tenant_idx ON sys.sys_pulse_checks (pulse_check_tenant_id);
CREATE INDEX IF NOT EXISTS sys_pulse_checks_subject_idx ON sys.sys_pulse_checks (pulse_check_subject_user_id);

-- ── reconciliation registry: classify the 4 new sys.* tables (keep 0-UNCLASSIFIED even when
--    empty, e.g. CI runs migrations without the seed). Real legacy imports → bucket A / IMPORT.
INSERT INTO sys.sys_reconciliation_registry
  (reconciliation_registry_table_name, reconciliation_registry_bucket,
   reconciliation_registry_declared_status, reconciliation_registry_legacy_source,
   reconciliation_registry_wall, reconciliation_registry_rationale, reconciliation_registry_decided_at)
VALUES
  ('sys_surveys', 'A', 'IMPORT', 'surveys', NULL,
   '[B-10b m2b S978] Normalized survey instances (RTL slice). Imported via seed 48 (LEGACY_SURVEY:: natural key). Read-model parallel to the m2 engagement_* JSONB cluster.', now()),
  ('sys_survey_questions', 'A', 'IMPORT', 'survey_questions', NULL,
   '[B-10b m2b S978] Normalized survey questions (FK sys_surveys). Imported via seed 48 (LEGACY_SQ:: natural key).', now()),
  ('sys_survey_responses', 'A', 'IMPORT', 'survey_responses', NULL,
   '[B-10b m2b S978] One row per answer (survey×question×subject). The question-level value-add of m2b. I14 subject via LEGACY_EMP::. Imported via seed 48.', now()),
  ('sys_pulse_checks', 'A', 'IMPORT', 'pulse_checks', NULL,
   '[B-10b m2b S978] Weekly pulse events (mood/workload/satisfaction). I14 subject via LEGACY_EMP::. Imported via seed 48.', now())
ON CONFLICT (reconciliation_registry_table_name) DO NOTHING;

DO $$
BEGIN
  RAISE NOTICE 'm2b: normalized engagement cluster schema ready (sys_surveys/_questions/_responses/sys_pulse_checks).';
END $$;
