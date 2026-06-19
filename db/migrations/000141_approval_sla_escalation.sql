-- ============================================================================
-- Migration 000141 — 3.3 BPM approval-flow slice-3b: SLA / escalation
-- ----------------------------------------------------------------------------
-- Adds the SLA/escalation fields to the approval runtime (000132) so the
-- scheduler (apps/api/src/lib/notifications/... approvals/sla.ts) can detect
-- overdue PENDING steps, emit reminder/overdue inbox notifications, and escalate.
-- Pure ADDITIVE: new columns + one partial index + 2 new inbox CHECK values.
-- NO new tables -> no reconciliation-registry rows needed (000132 already covers
-- sys_approval_requests / sys_approval_steps as EXCLUDE/D).
--
-- Conventions: RD-09 (intra-day reminders -> timestamptz, not date); RD-08
-- (no ENUM). Idempotent: ADD COLUMN IF NOT EXISTS + CREATE INDEX IF NOT EXISTS +
-- DROP/re-ADD CHECK. Twice-run = empty pg_dump diff.
-- Spec: docs/superpowers/specs/2026-06-18-bpm-approval-slice2-3-design.md §3b.
-- Authored: 2026-06-19 (S997).
-- ============================================================================

-- 1. SLA fields on the step ledger (the human task that can go overdue).
ALTER TABLE sys.sys_approval_steps
  ADD COLUMN IF NOT EXISTS approval_step_due_at         timestamptz,
  ADD COLUMN IF NOT EXISTS approval_step_reminder_count int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS approval_step_escalated_at   timestamptz;

-- 2. Optional per-request SLA window (hours) — a step's due_at can be derived
--    from it at creation time; the column makes the policy auditable.
ALTER TABLE sys.sys_approval_requests
  ADD COLUMN IF NOT EXISTS approval_request_sla_hours int;

DO $cs$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_approval_request_sla_hours_check') THEN
    ALTER TABLE sys.sys_approval_requests ADD CONSTRAINT sys_approval_request_sla_hours_check
      CHECK (approval_request_sla_hours IS NULL OR approval_request_sla_hours > 0);
  END IF;
END;
$cs$;

-- 3. The scheduler scan index: pending steps with a due date.
CREATE INDEX IF NOT EXISTS sys_approval_step_due_idx
  ON sys.sys_approval_steps (approval_step_due_at)
  WHERE approval_step_status = 'PENDING' AND approval_step_due_at IS NOT NULL;

-- 4. Widen the inbox notification_type CHECK with the two SLA event kinds
--    (mirror NotificationTypeSchema in @heuresys/shared). Additive + idempotent.
ALTER TABLE sys.sys_inbox_notifications
  DROP CONSTRAINT IF EXISTS sys_inbox_notification_type_check;
ALTER TABLE sys.sys_inbox_notifications
  ADD CONSTRAINT sys_inbox_notification_type_check
  CHECK (notification_type IN ('TRAINING_DEADLINE', 'ASSESSMENT_REQUEST', 'MANAGER_FEEDBACK_READY',
    'CAREER_TARGET_STATUS', 'GAP_CLOSURE_DUE', 'SYSTEM', 'APPROVAL_REQUEST',
    'APPROVAL_REMINDER', 'APPROVAL_OVERDUE'));

-- ============================================================================
-- Post-condition (idempotent): the 3 step columns + request column exist.
-- ============================================================================
DO $$
DECLARE n_cols int;
BEGIN
  SELECT count(*) INTO n_cols
  FROM information_schema.columns
  WHERE table_schema = 'sys'
    AND ( (table_name = 'sys_approval_steps'
            AND column_name IN ('approval_step_due_at','approval_step_reminder_count','approval_step_escalated_at'))
       OR (table_name = 'sys_approval_requests' AND column_name = 'approval_request_sla_hours') );
  IF n_cols <> 4 THEN
    RAISE EXCEPTION '000141: expected 4 SLA columns, found %', n_cols;
  END IF;
  RAISE NOTICE '000141: approval SLA/escalation fields OK — 4 columns + due index + inbox CHECK widened (+APPROVAL_REMINDER/OVERDUE).';
END $$;
