-- ============================================================================
-- Migration 000132 — 3.3 BPM runtime, Slice D: generic approval runtime (2 tables)
-- ----------------------------------------------------------------------------
-- The platform has a process catalog/modeling layer (sys_blueprint_process_registry,
-- sys_organization_unit_processes) but ZERO runtime execution. Slice D delivers the
-- first executable BPM primitive: a generic, domain-agnostic approval runtime.
--   - sys_approval_requests : the running "instance" (status = varchar+CHECK state
--       machine PENDING/APPROVED/REJECTED/APPLIED; quorum policy ALL_OF/ANY_OF).
--   - sys_approval_steps    : the human-task ledger (one row per approver; each step
--       is delivered to the approver's inbox as an actionable notification).
-- D is a SPECIAL CASE of the full state-machine engine (option B): the column shapes
-- (varchar+CHECK status, polymorphic resource_type/resource_id, tenant-FK isolation,
-- ordinal, jsonb metadata) are exactly what a generic engine needs → forward-composing,
-- no throwaway. Spec: docs/superpowers/specs/2026-06-17-bpm-approval-flow-design.md.
-- ----------------------------------------------------------------------------
-- Conventions mirror 000121: sys.sys_<plural>; FK fields prefixed; PK uuid
--   DEFAULT gen_random_uuid(); tenant_id NOT NULL -> sys.sys_tenancies ON DELETE
--   CASCADE (I5 = FK + middleware filter, NEVER RLS); RD-08 categorical = varchar+CHECK
--   (never ENUM); RD-09 event timestamps = timestamptz; jsonb metadata DEFAULT '{}';
--   updated_at + sys_set_updated_at trigger + CHECK(updated_at >= created_at).
-- Idempotent: CREATE TABLE/INDEX IF NOT EXISTS + guarded ADD CONSTRAINT/TRIGGER.
--   Twice-run = empty pg_dump diff.
-- RBAC permission gate (approval:{create,decide,read}) seeded in sibling 000133.
-- Authored: 2026-06-18 (3.3 slice-D BPM approval runtime).
-- ============================================================================

-- -----------------------------------------------------------------------------
-- 1. sys.sys_approval_requests — the approval "instance"
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sys.sys_approval_requests (
  approval_request_id            uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  approval_request_tenant_id     uuid         NOT NULL,
  approval_request_title         varchar(255) NOT NULL,
  approval_request_body          text,
  approval_request_resource_type varchar(64),
  approval_request_resource_id   uuid,
  approval_request_status        varchar(16)  NOT NULL DEFAULT 'PENDING',
  approval_request_decision_policy varchar(16) NOT NULL DEFAULT 'ALL_OF',
  approval_request_priority      varchar(32)  NOT NULL DEFAULT 'MEDIUM',
  approval_request_metadata      jsonb        NOT NULL DEFAULT '{}'::jsonb,
  approval_request_resolved_at   timestamptz,
  approval_request_applied_at    timestamptz,
  created_at                     timestamptz  NOT NULL DEFAULT now(),
  created_by                     uuid,
  updated_at                     timestamptz  NOT NULL DEFAULT now()
);

DO $cs$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_approval_request_status_check') THEN
    ALTER TABLE sys.sys_approval_requests ADD CONSTRAINT sys_approval_request_status_check
      CHECK (approval_request_status IN ('PENDING','APPROVED','REJECTED','APPLIED'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_approval_request_policy_check') THEN
    ALTER TABLE sys.sys_approval_requests ADD CONSTRAINT sys_approval_request_policy_check
      CHECK (approval_request_decision_policy IN ('ALL_OF','ANY_OF'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_approval_request_priority_check') THEN
    ALTER TABLE sys.sys_approval_requests ADD CONSTRAINT sys_approval_request_priority_check
      CHECK (approval_request_priority IN ('INFO','MEDIUM','HIGH','CRITICAL'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_approval_request_updated_after') THEN
    ALTER TABLE sys.sys_approval_requests ADD CONSTRAINT sys_approval_request_updated_after
      CHECK (updated_at >= created_at);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_approval_request_tenant_fk') THEN
    ALTER TABLE sys.sys_approval_requests ADD CONSTRAINT sys_approval_request_tenant_fk
      FOREIGN KEY (approval_request_tenant_id) REFERENCES sys.sys_tenancies(tenant_id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_approval_request_creator_fk') THEN
    ALTER TABLE sys.sys_approval_requests ADD CONSTRAINT sys_approval_request_creator_fk
      FOREIGN KEY (created_by) REFERENCES sys.sys_users(user_id) ON DELETE SET NULL;
  END IF;
END;
$cs$;

CREATE INDEX IF NOT EXISTS sys_approval_request_tenant_status_idx
  ON sys.sys_approval_requests (approval_request_tenant_id, approval_request_status, created_at DESC);
CREATE INDEX IF NOT EXISTS sys_approval_request_resource_idx
  ON sys.sys_approval_requests (approval_request_resource_type, approval_request_resource_id)
  WHERE approval_request_resource_id IS NOT NULL;

DO $trg$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'sys_approval_requests_set_updated_at') THEN
    CREATE TRIGGER sys_approval_requests_set_updated_at BEFORE UPDATE ON sys.sys_approval_requests
      FOR EACH ROW EXECUTE FUNCTION sys.sys_set_updated_at();
  END IF;
END;
$trg$;

-- -----------------------------------------------------------------------------
-- 2. sys.sys_approval_steps — the human-task / transition ledger
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sys.sys_approval_steps (
  approval_step_id               uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  approval_step_request_id       uuid         NOT NULL,
  approval_step_tenant_id        uuid         NOT NULL,
  approval_step_approver_user_id uuid         NOT NULL,
  approval_step_ordinal          int          NOT NULL DEFAULT 1,
  approval_step_status           varchar(16)  NOT NULL DEFAULT 'PENDING',
  approval_step_decision_comment text,
  approval_step_decided_at       timestamptz,
  approval_step_decided_by       uuid,
  approval_step_metadata         jsonb        NOT NULL DEFAULT '{}'::jsonb,
  created_at                     timestamptz  NOT NULL DEFAULT now(),
  updated_at                     timestamptz  NOT NULL DEFAULT now()
);

DO $cs$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_approval_step_status_check') THEN
    ALTER TABLE sys.sys_approval_steps ADD CONSTRAINT sys_approval_step_status_check
      CHECK (approval_step_status IN ('PENDING','APPROVED','REJECTED','SKIPPED'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_approval_step_updated_after') THEN
    ALTER TABLE sys.sys_approval_steps ADD CONSTRAINT sys_approval_step_updated_after
      CHECK (updated_at >= created_at);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_approval_step_request_fk') THEN
    ALTER TABLE sys.sys_approval_steps ADD CONSTRAINT sys_approval_step_request_fk
      FOREIGN KEY (approval_step_request_id) REFERENCES sys.sys_approval_requests(approval_request_id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_approval_step_tenant_fk') THEN
    ALTER TABLE sys.sys_approval_steps ADD CONSTRAINT sys_approval_step_tenant_fk
      FOREIGN KEY (approval_step_tenant_id) REFERENCES sys.sys_tenancies(tenant_id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_approval_step_approver_fk') THEN
    ALTER TABLE sys.sys_approval_steps ADD CONSTRAINT sys_approval_step_approver_fk
      FOREIGN KEY (approval_step_approver_user_id) REFERENCES sys.sys_users(user_id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_approval_step_decider_fk') THEN
    ALTER TABLE sys.sys_approval_steps ADD CONSTRAINT sys_approval_step_decider_fk
      FOREIGN KEY (approval_step_decided_by) REFERENCES sys.sys_users(user_id) ON DELETE SET NULL;
  END IF;
END;
$cs$;

-- A user is an approver on a request AT MOST ONCE (clean 23505 -> 409 path).
CREATE UNIQUE INDEX IF NOT EXISTS sys_approval_step_request_approver_uq
  ON sys.sys_approval_steps (approval_step_request_id, approval_step_approver_user_id);
-- "my pending approvals" inbox query.
CREATE INDEX IF NOT EXISTS sys_approval_step_approver_pending_idx
  ON sys.sys_approval_steps (approval_step_approver_user_id, approval_step_status)
  WHERE approval_step_status = 'PENDING';
-- load the step ledger for a request.
CREATE INDEX IF NOT EXISTS sys_approval_step_request_idx
  ON sys.sys_approval_steps (approval_step_request_id);

DO $trg$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'sys_approval_steps_set_updated_at') THEN
    CREATE TRIGGER sys_approval_steps_set_updated_at BEFORE UPDATE ON sys.sys_approval_steps
      FOR EACH ROW EXECUTE FUNCTION sys.sys_set_updated_at();
  END IF;
END;
$trg$;

-- -----------------------------------------------------------------------------
-- 3. Widen the inbox CHECK domains so an approval task delivers via the 3.4
--    notification center (the REUSE SEAM). Additive + idempotent (drop+re-add).
-- -----------------------------------------------------------------------------
-- Aggiunta ADDITIVA: se il vincolo esiste già non lo si tocca. Il pattern
-- DROP+ADD riportava indietro un vocabolario che una migration successiva
-- ha allargato, e su un database con righe che usano i valori nuovi la
-- riesecuzione falliva («is violated by some row»).
DO $mig$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_inbox_notification_type_check') THEN
    ALTER TABLE sys.sys_inbox_notifications ADD CONSTRAINT sys_inbox_notification_type_check
      CHECK (notification_type IN ('TRAINING_DEADLINE', 'ASSESSMENT_REQUEST', 'MANAGER_FEEDBACK_READY',
    'CAREER_TARGET_STATUS', 'GAP_CLOSURE_DUE', 'SYSTEM', 'APPROVAL_REQUEST'));
  END IF;
END $mig$;

-- Aggiunta ADDITIVA: se il vincolo esiste già non lo si tocca. Il pattern
-- DROP+ADD riportava indietro un vocabolario che una migration successiva
-- ha allargato, e su un database con righe che usano i valori nuovi la
-- riesecuzione falliva («is violated by some row»).
DO $mig$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_inbox_notification_resource_type_check') THEN
    ALTER TABLE sys.sys_inbox_notifications ADD CONSTRAINT sys_inbox_notification_resource_type_check
      CHECK (notification_resource_type IS NULL OR notification_resource_type IN
    ('POSITION', 'LEARNING_MODULE', 'ASSESSMENT', 'CAREER_TARGET', 'KPI', 'SKILL', 'APPROVAL_STEP'));
  END IF;
END $mig$;

-- Extend the polymorphic-consistency VIEW with an APPROVAL_STEP arm (a deleted
-- step row is flagged). CREATE OR REPLACE keeps the same output columns.
CREATE OR REPLACE VIEW sys.v_inbox_resource_consistency AS
SELECT n.notification_id, n.notification_resource_type, n.notification_resource_id
FROM sys.sys_inbox_notifications n
WHERE n.notification_resource_id IS NOT NULL AND (
  (n.notification_resource_type = 'POSITION' AND NOT EXISTS
    (SELECT 1 FROM sys.sys_positions WHERE position_id = n.notification_resource_id))
  OR
  (n.notification_resource_type = 'LEARNING_MODULE' AND NOT EXISTS
    (SELECT 1 FROM sys.sys_learning_modules WHERE learning_module_id = n.notification_resource_id))
  OR
  (n.notification_resource_type = 'ASSESSMENT' AND NOT EXISTS
    (SELECT 1 FROM sys.sys_assessments WHERE assessment_id = n.notification_resource_id))
  OR
  (n.notification_resource_type = 'CAREER_TARGET' AND NOT EXISTS
    (SELECT 1 FROM sys.sys_user_target_positions WHERE user_target_position_id = n.notification_resource_id))
  OR
  (n.notification_resource_type = 'KPI' AND NOT EXISTS
    (SELECT 1 FROM sys.sys_kpi_definitions WHERE kpi_definition_id = n.notification_resource_id))
  OR
  (n.notification_resource_type = 'SKILL' AND NOT EXISTS
    (SELECT 1 FROM sys.sys_skills WHERE skill_id = n.notification_resource_id))
  OR
  (n.notification_resource_type = 'APPROVAL_STEP' AND NOT EXISTS
    (SELECT 1 FROM sys.sys_approval_steps WHERE approval_step_id = n.notification_resource_id))
);

-- -----------------------------------------------------------------------------
-- 4. Reconciliation registry: 0-UNCLASSIFIED invariant (mirror 000121 §4).
--    App-authored runtime tables, NOT legacy-import targets -> EXCLUDE / bucket D.
-- -----------------------------------------------------------------------------
INSERT INTO sys.sys_reconciliation_registry
  (reconciliation_registry_table_name, reconciliation_registry_bucket,
   reconciliation_registry_declared_status, reconciliation_registry_legacy_source,
   reconciliation_registry_rationale)
VALUES
  ('sys_approval_requests', 'D', 'EXCLUDE', NULL,
   '[sign-off: EXCLUDE — app-authored BPM approval-runtime instance table (3.3 slice-D, mig 000132). Created in-app via /v1/approvals; no legacy source. Not a reconciliation target.]'),
  ('sys_approval_steps', 'D', 'EXCLUDE', NULL,
   '[sign-off: EXCLUDE — app-authored BPM approval-runtime step ledger (3.3 slice-D, mig 000132). Created in-app via /v1/approvals; no legacy source. Not a reconciliation target.]')
ON CONFLICT (reconciliation_registry_table_name) DO NOTHING;

DO $rc$
DECLARE n_unclassified int;
BEGIN
  SELECT count(*) INTO n_unclassified FROM sys.v_reconciliation_status WHERE resolved_status = 'UNCLASSIFIED';
  IF n_unclassified <> 0 THEN
    RAISE EXCEPTION '000132: expected 0 UNCLASSIFIED after registering approval tables, found %', n_unclassified;
  END IF;
END $rc$;

-- ============================================================================
-- Post-condition (idempotent): both tables exist.
-- ============================================================================
DO $$
DECLARE n_tables int;
BEGIN
  SELECT count(*) INTO n_tables
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'sys' AND c.relkind = 'r'
    AND c.relname IN ('sys_approval_requests', 'sys_approval_steps');
  IF n_tables <> 2 THEN
    RAISE EXCEPTION '000132: expected 2 approval tables, found %', n_tables;
  END IF;
  RAISE NOTICE '000132: BPM approval runtime OK — 2 tables present + inbox CHECK widened + registered EXCLUDE.';
END $$;
