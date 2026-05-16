-- =============================================================================
-- 000020_seed_acquisition_staging.sql
-- Heuresys Advanced — seed acquisition staging (5 tables in sys)
-- -----------------------------------------------------------------------------
-- Per TARGET_SCHEMA_DESIGN §12.
-- Pipeline: external sources → candidates → validation → approval → canonical
-- upsert (via natural key + ON CONFLICT DO NOTHING / DO UPDATE).
-- =============================================================================

CREATE TABLE IF NOT EXISTS sys.sys_seed_acquisition_runs (
  seed_acquisition_run_id        uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  seed_acquisition_run_tenant_id uuid         NOT NULL REFERENCES sys.sys_tenancies(tenant_id) ON DELETE CASCADE,
  seed_acquisition_run_code      varchar(128) NOT NULL,
  seed_acquisition_run_prompt_template text,
  seed_acquisition_run_source_registry_payload jsonb NOT NULL DEFAULT '[]'::jsonb,
  seed_acquisition_run_started_at timestamptz NOT NULL DEFAULT now(),
  seed_acquisition_run_finished_at timestamptz,
  seed_acquisition_run_status    varchar(32)  NOT NULL DEFAULT 'RUNNING',
  seed_acquisition_run_metadata  jsonb        NOT NULL DEFAULT '{}'::jsonb,
  created_at                     timestamptz  NOT NULL DEFAULT now(),
  created_by                     uuid         REFERENCES sys.sys_users(user_id) ON DELETE SET NULL,
  updated_at                     timestamptz  NOT NULL DEFAULT now(),
  updated_by                     uuid         REFERENCES sys.sys_users(user_id) ON DELETE SET NULL
);

ALTER TABLE sys.sys_seed_acquisition_runs
  DROP CONSTRAINT IF EXISTS sys_seed_acquisition_run_status_check;
ALTER TABLE sys.sys_seed_acquisition_runs
  ADD CONSTRAINT sys_seed_acquisition_run_status_check
  CHECK (seed_acquisition_run_status IN ('RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED'));

CREATE UNIQUE INDEX IF NOT EXISTS sys_seed_acquisition_runs_tenant_code_uq
  ON sys.sys_seed_acquisition_runs (seed_acquisition_run_tenant_id, seed_acquisition_run_code);

DO $trg$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'sys_seed_acquisition_runs_set_updated_at' AND tgrelid = 'sys.sys_seed_acquisition_runs'::regclass) THEN
    CREATE TRIGGER sys_seed_acquisition_runs_set_updated_at BEFORE UPDATE ON sys.sys_seed_acquisition_runs FOR EACH ROW EXECUTE FUNCTION sys.sys_set_updated_at();
  END IF;
END $trg$;

CREATE TABLE IF NOT EXISTS sys.sys_seed_candidate_records (
  seed_candidate_record_id        uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  seed_candidate_record_run_id    uuid         NOT NULL REFERENCES sys.sys_seed_acquisition_runs(seed_acquisition_run_id) ON DELETE CASCADE,
  seed_candidate_record_tenant_id uuid         NOT NULL REFERENCES sys.sys_tenancies(tenant_id) ON DELETE CASCADE,
  seed_candidate_record_domain    varchar(64)  NOT NULL,
  seed_candidate_record_natural_key varchar(512) NOT NULL,
  seed_candidate_record_payload   jsonb        NOT NULL DEFAULT '{}'::jsonb,
  seed_candidate_record_validation_status varchar(32) NOT NULL DEFAULT 'PENDING',
  seed_candidate_record_metadata  jsonb        NOT NULL DEFAULT '{}'::jsonb,
  created_at                      timestamptz  NOT NULL DEFAULT now(),
  updated_at                      timestamptz  NOT NULL DEFAULT now()
);

ALTER TABLE sys.sys_seed_candidate_records
  DROP CONSTRAINT IF EXISTS sys_seed_candidate_validation_status_check;
ALTER TABLE sys.sys_seed_candidate_records
  ADD CONSTRAINT sys_seed_candidate_validation_status_check
  CHECK (seed_candidate_record_validation_status IN ('PENDING', 'PASSED', 'FAILED', 'WARNING', 'APPROVED', 'REJECTED', 'APPLIED'));

CREATE UNIQUE INDEX IF NOT EXISTS sys_seed_candidate_records_run_natural_key_uq
  ON sys.sys_seed_candidate_records (seed_candidate_record_run_id, seed_candidate_record_natural_key);

CREATE INDEX IF NOT EXISTS sys_seed_candidate_records_domain_status_idx
  ON sys.sys_seed_candidate_records (seed_candidate_record_domain, seed_candidate_record_validation_status);

CREATE TABLE IF NOT EXISTS sys.sys_seed_source_evidence (
  seed_source_evidence_id          uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  seed_source_evidence_candidate_id uuid        NOT NULL REFERENCES sys.sys_seed_candidate_records(seed_candidate_record_id) ON DELETE CASCADE,
  seed_source_evidence_url         text         NOT NULL,
  seed_source_evidence_retrieved_at timestamptz NOT NULL DEFAULT now(),
  seed_source_evidence_content_hash char(64),
  seed_source_evidence_payload     jsonb        NOT NULL DEFAULT '{}'::jsonb,
  created_at                       timestamptz  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sys_seed_source_evidence_candidate_idx
  ON sys.sys_seed_source_evidence (seed_source_evidence_candidate_id);

CREATE TABLE IF NOT EXISTS sys.sys_seed_validation_results (
  seed_validation_result_id          uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  seed_validation_result_candidate_id uuid        NOT NULL REFERENCES sys.sys_seed_candidate_records(seed_candidate_record_id) ON DELETE CASCADE,
  seed_validation_result_rule_code   varchar(128) NOT NULL,
  seed_validation_result_status      varchar(32)  NOT NULL,
  seed_validation_result_message     text,
  seed_validation_result_payload     jsonb        NOT NULL DEFAULT '{}'::jsonb,
  created_at                         timestamptz  NOT NULL DEFAULT now()
);

ALTER TABLE sys.sys_seed_validation_results
  DROP CONSTRAINT IF EXISTS sys_seed_validation_result_status_check;
ALTER TABLE sys.sys_seed_validation_results
  ADD CONSTRAINT sys_seed_validation_result_status_check
  CHECK (seed_validation_result_status IN ('PASSED', 'FAILED', 'WARNING', 'SKIPPED'));

CREATE INDEX IF NOT EXISTS sys_seed_validation_results_candidate_idx
  ON sys.sys_seed_validation_results (seed_validation_result_candidate_id, created_at DESC);

CREATE TABLE IF NOT EXISTS sys.sys_seed_approval_decisions (
  seed_approval_decision_id        uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  seed_approval_decision_candidate_id uuid      NOT NULL REFERENCES sys.sys_seed_candidate_records(seed_candidate_record_id) ON DELETE CASCADE,
  seed_approval_decision_approver_user_id uuid  REFERENCES sys.sys_users(user_id) ON DELETE SET NULL,
  seed_approval_decision_status    varchar(32)  NOT NULL,
  seed_approval_decision_rationale text,
  seed_approval_decision_decided_at timestamptz NOT NULL DEFAULT now(),
  created_at                       timestamptz  NOT NULL DEFAULT now()
);

ALTER TABLE sys.sys_seed_approval_decisions
  DROP CONSTRAINT IF EXISTS sys_seed_approval_decision_status_check;
ALTER TABLE sys.sys_seed_approval_decisions
  ADD CONSTRAINT sys_seed_approval_decision_status_check
  CHECK (seed_approval_decision_status IN ('APPROVED', 'REJECTED', 'NEEDS_CHANGES'));

CREATE INDEX IF NOT EXISTS sys_seed_approval_decisions_candidate_idx
  ON sys.sys_seed_approval_decisions (seed_approval_decision_candidate_id, seed_approval_decision_decided_at DESC);
