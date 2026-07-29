-- =============================================================================
-- 000027_ess_inbox_and_audit.sql
-- Heuresys Advanced — ESS inbox + self-service audit trail (ADR-0011)
-- -----------------------------------------------------------------------------
-- Per ADR-0011 + TARGET_SCHEMA_DESIGN §1.5 + §13.1.
-- Creates:
--   - sys.sys_inbox_notifications (Employee Self-Service inbox)
--   - audit.user_self_service_actions (forensic trail of /v1/me/* mutations)
-- Replaces the placeholder VIEW sys.v_inbox_resource_consistency (from
-- 000023) with the real polymorphic-FK consistency body now that the
-- sys_inbox_notifications table exists and ALL target tables (POSITION,
-- LEARNING_MODULE, ASSESSMENT, CAREER_TARGET = sys_user_target_positions,
-- KPI, SKILL) have been created in earlier migrations.
--
-- Runs LAST in the sequence intentionally.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. sys.sys_inbox_notifications
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sys.sys_inbox_notifications (
  notification_id            uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_tenant_id     uuid         NOT NULL REFERENCES sys.sys_tenancies(tenant_id) ON DELETE CASCADE,
  notification_user_id       uuid         NOT NULL REFERENCES sys.sys_users(user_id) ON DELETE CASCADE,
  notification_type          varchar(64)  NOT NULL,
  notification_subject       varchar(255) NOT NULL,
  notification_body          text,
  notification_action_url    text,
  notification_resource_type varchar(64),
  notification_resource_id   uuid,
  notification_priority      varchar(32)  NOT NULL DEFAULT 'INFO',
  notification_status        varchar(32)  NOT NULL DEFAULT 'UNREAD',
  notification_read_at       timestamptz,
  notification_dismissed_at  timestamptz,
  notification_expires_at    timestamptz,
  created_at                 timestamptz  NOT NULL DEFAULT now(),
  created_by                 uuid         REFERENCES sys.sys_users(user_id) ON DELETE SET NULL
);

-- Aggiunta ADDITIVA: se il vincolo esiste già non lo si tocca. Il pattern
-- DROP+ADD riportava indietro un vocabolario che una migration successiva
-- ha allargato, e su un database con righe che usano i valori nuovi la
-- riesecuzione falliva («is violated by some row»).
DO $mig$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_inbox_notification_type_check') THEN
    ALTER TABLE sys.sys_inbox_notifications ADD CONSTRAINT sys_inbox_notification_type_check
      CHECK (notification_type IN ('TRAINING_DEADLINE', 'ASSESSMENT_REQUEST', 'MANAGER_FEEDBACK_READY', 'CAREER_TARGET_STATUS', 'GAP_CLOSURE_DUE', 'SYSTEM'));
  END IF;
END $mig$;

ALTER TABLE sys.sys_inbox_notifications
  DROP CONSTRAINT IF EXISTS sys_inbox_notification_priority_check;
ALTER TABLE sys.sys_inbox_notifications
  ADD CONSTRAINT sys_inbox_notification_priority_check
  CHECK (notification_priority IN ('INFO', 'MEDIUM', 'HIGH', 'CRITICAL'));

ALTER TABLE sys.sys_inbox_notifications
  DROP CONSTRAINT IF EXISTS sys_inbox_notification_status_check;
ALTER TABLE sys.sys_inbox_notifications
  ADD CONSTRAINT sys_inbox_notification_status_check
  CHECK (notification_status IN ('UNREAD', 'READ', 'DISMISSED', 'ARCHIVED'));

-- Aggiunta ADDITIVA: se il vincolo esiste già non lo si tocca. Il pattern
-- DROP+ADD riportava indietro un vocabolario che una migration successiva
-- ha allargato, e su un database con righe che usano i valori nuovi la
-- riesecuzione falliva («is violated by some row»).
DO $mig$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_inbox_notification_resource_type_check') THEN
    ALTER TABLE sys.sys_inbox_notifications ADD CONSTRAINT sys_inbox_notification_resource_type_check
      CHECK (notification_resource_type IS NULL OR notification_resource_type IN
    ('POSITION', 'LEARNING_MODULE', 'ASSESSMENT', 'CAREER_TARGET', 'KPI', 'SKILL'));
  END IF;
END $mig$;

CREATE INDEX IF NOT EXISTS sys_inbox_user_unread_idx
  ON sys.sys_inbox_notifications (notification_user_id, created_at DESC)
  WHERE notification_status = 'UNREAD';

CREATE INDEX IF NOT EXISTS sys_inbox_tenant_user_created_idx
  ON sys.sys_inbox_notifications (notification_tenant_id, notification_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS sys_inbox_resource_idx
  ON sys.sys_inbox_notifications (notification_resource_type, notification_resource_id)
  WHERE notification_resource_id IS NOT NULL;

-- -----------------------------------------------------------------------------
-- 2. audit.user_self_service_actions
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit.user_self_service_actions (
  action_id              uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  action_user_id         uuid         NOT NULL REFERENCES sys.sys_users(user_id) ON DELETE RESTRICT,
  action_tenant_id       uuid         NOT NULL REFERENCES sys.sys_tenancies(tenant_id) ON DELETE RESTRICT,
  action_type            varchar(64)  NOT NULL,
  action_resource_type   varchar(64),
  action_resource_id     uuid,
  action_payload_summary jsonb        NOT NULL DEFAULT '{}'::jsonb,
  action_ip              inet,
  action_user_agent      text,
  created_at             timestamptz  NOT NULL DEFAULT now()
);

ALTER TABLE audit.user_self_service_actions
  DROP CONSTRAINT IF EXISTS audit_user_self_service_action_type_check;
ALTER TABLE audit.user_self_service_actions
  ADD CONSTRAINT audit_user_self_service_action_type_check
  CHECK (action_type IN (
    'PROFILE_UPDATE', 'SKILL_SELF_ASSESS', 'LEARNING_ENROLL',
    'CAREER_TARGET_REQUEST', 'CERT_UPLOAD', 'DOC_UPLOAD',
    'INBOX_MARK_READ', 'INBOX_DISMISS'
  ));

CREATE INDEX IF NOT EXISTS audit_ussa_user_idx
  ON audit.user_self_service_actions (action_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS audit_ussa_tenant_idx
  ON audit.user_self_service_actions (action_tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS audit_ussa_type_idx
  ON audit.user_self_service_actions (action_type, created_at DESC);

CREATE INDEX IF NOT EXISTS audit_ussa_resource_idx
  ON audit.user_self_service_actions (action_resource_type, action_resource_id)
  WHERE action_resource_id IS NOT NULL;

-- -----------------------------------------------------------------------------
-- 3. Replace placeholder VIEW sys.v_inbox_resource_consistency with real body
-- -----------------------------------------------------------------------------
-- CREATE OR REPLACE works because 000023 placeholder uses varchar(64) cast
-- (matching the body of sys_inbox_notifications.notification_resource_type).
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
);
