-- =============================================================================
-- 000026_brownfield_import_validation.sql
-- Heuresys Advanced — brownfield validation + approval (audit schema)
-- -----------------------------------------------------------------------------
-- Per TARGET_SCHEMA_DESIGN §13.
-- audit.import_validation_results: per-candidate validation rule results.
-- audit.import_approval_decisions: human approval gates pre-upsert.
-- =============================================================================

CREATE TABLE IF NOT EXISTS audit.import_validation_results (
  import_validation_result_id          uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  import_validation_result_run_id      uuid         NOT NULL REFERENCES brownfield.import_runs(import_run_id) ON DELETE CASCADE,
  import_validation_result_source_table_id uuid    NOT NULL REFERENCES brownfield.source_tables(source_table_id) ON DELETE CASCADE,
  import_validation_result_source_record_id varchar(255),
  import_validation_result_rule_code   varchar(128) NOT NULL,
  import_validation_result_status      varchar(32)  NOT NULL,
  import_validation_result_message     text,
  import_validation_result_payload     jsonb        NOT NULL DEFAULT '{}'::jsonb,
  created_at                           timestamptz  NOT NULL DEFAULT now()
);

ALTER TABLE audit.import_validation_results
  DROP CONSTRAINT IF EXISTS audit_import_validation_result_status_check;
ALTER TABLE audit.import_validation_results
  ADD CONSTRAINT audit_import_validation_result_status_check
  CHECK (import_validation_result_status IN ('PASSED', 'FAILED', 'WARNING', 'SKIPPED'));

CREATE INDEX IF NOT EXISTS audit_import_validation_results_run_status_idx
  ON audit.import_validation_results (import_validation_result_run_id, import_validation_result_status, created_at DESC);

CREATE INDEX IF NOT EXISTS audit_import_validation_results_source_table_idx
  ON audit.import_validation_results (import_validation_result_source_table_id, import_validation_result_status);

CREATE TABLE IF NOT EXISTS audit.import_approval_decisions (
  import_approval_decision_id        uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  import_approval_decision_run_id    uuid         NOT NULL REFERENCES brownfield.import_runs(import_run_id) ON DELETE CASCADE,
  import_approval_decision_table_mapping_id uuid  REFERENCES brownfield.table_mappings(table_mapping_id) ON DELETE SET NULL,
  import_approval_decision_approver_user_id uuid  REFERENCES sys.sys_users(user_id) ON DELETE SET NULL,
  import_approval_decision_status    varchar(32)  NOT NULL,
  import_approval_decision_rationale text,
  import_approval_decision_decided_at timestamptz NOT NULL DEFAULT now(),
  created_at                         timestamptz  NOT NULL DEFAULT now()
);

ALTER TABLE audit.import_approval_decisions
  DROP CONSTRAINT IF EXISTS audit_import_approval_decision_status_check;
ALTER TABLE audit.import_approval_decisions
  ADD CONSTRAINT audit_import_approval_decision_status_check
  CHECK (import_approval_decision_status IN ('APPROVED', 'REJECTED', 'NEEDS_CHANGES', 'ESCALATED'));

CREATE INDEX IF NOT EXISTS audit_import_approval_decisions_run_idx
  ON audit.import_approval_decisions (import_approval_decision_run_id, import_approval_decision_decided_at DESC);
