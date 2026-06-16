-- ============================================================================
-- Migration 000126 — 3.4 Notification center (S987 ondata-1): per-user prefs
-- ----------------------------------------------------------------------------
-- Creates sys.sys_notification_preferences: one row per (user, notification_type)
-- expressing opt-out + channel choice. The consumer side (sys_inbox_notifications
-- + /me/inbox) already exists; this is the producer-side config the emitter
-- (lib/notifications/emit.ts) consults before delivering.
--
-- Model: absence of a row = IN_APP enabled (default-on), EMAIL disabled. A row
-- with in_app_enabled=false opts the user out of in-app delivery for that type;
-- email_enabled=true requests email delivery (gated on SMTP creds — no-op until
-- configured, so default false).
--
-- Conventions (mirror 000113): sys.sys_<plural>; column prefix <entity>_<field>;
-- PK uuid gen_random_uuid(); tenant_id NOT NULL -> sys_tenancies ON DELETE
-- RESTRICT (I5, NO RLS); user_id -> sys_users ON DELETE CASCADE (prefs die with
-- the user); notification_type CHECK mirrors sys_inbox_notifications (RD-08,
-- never ENUM); UQ(user_id, notification_type); updated_at + sys_set_updated_at.
-- Registry note: created after 000062, so it is outside that migration's
-- 0-UNCLASSIFIED assert scope (same as 000113) — no registry row needed.
-- Idempotent: CREATE TABLE IF NOT EXISTS + guarded constraints + IF NOT EXISTS
-- index/trigger. Purely additive. Authored: 2026-06-16.
-- ============================================================================

CREATE TABLE IF NOT EXISTS sys.sys_notification_preferences (
  preference_id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  -- nullable: preferences are self-scoped by user_id; tenant is a denormalised
  -- convenience that is NULL for tenant-less users (PLATFORM_ADMIN). I5 unaffected
  -- (rows are never cross-tenant readable — always filtered by user_id).
  preference_tenant_id         uuid,
  preference_user_id           uuid        NOT NULL,
  preference_notification_type varchar(50) NOT NULL,
  preference_in_app_enabled    boolean     NOT NULL DEFAULT true,
  preference_email_enabled     boolean     NOT NULL DEFAULT false,
  preference_metadata          jsonb       NOT NULL DEFAULT '{}'::jsonb,
  created_at                   timestamptz NOT NULL DEFAULT now(),
  updated_at                   timestamptz NOT NULL DEFAULT now()
);

DO $cs$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_npref_type_check') THEN
    ALTER TABLE sys.sys_notification_preferences ADD CONSTRAINT sys_npref_type_check CHECK (
      preference_notification_type IN (
        'TRAINING_DEADLINE','ASSESSMENT_REQUEST','MANAGER_FEEDBACK_READY',
        'CAREER_TARGET_STATUS','GAP_CLOSURE_DUE','SYSTEM'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_npref_updated_after') THEN
    ALTER TABLE sys.sys_notification_preferences ADD CONSTRAINT sys_npref_updated_after CHECK (updated_at >= created_at);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_npref_tenant_fk') THEN
    ALTER TABLE sys.sys_notification_preferences ADD CONSTRAINT sys_npref_tenant_fk
      FOREIGN KEY (preference_tenant_id) REFERENCES sys.sys_tenancies(tenant_id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_npref_user_fk') THEN
    ALTER TABLE sys.sys_notification_preferences ADD CONSTRAINT sys_npref_user_fk
      FOREIGN KEY (preference_user_id) REFERENCES sys.sys_users(user_id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sys_npref_user_type_uq') THEN
    ALTER TABLE sys.sys_notification_preferences ADD CONSTRAINT sys_npref_user_type_uq
      UNIQUE (preference_user_id, preference_notification_type);
  END IF;
END
$cs$;

-- Make tenant nullable on DBs where 000126 first applied with NOT NULL
-- (idempotent: DROP NOT NULL on an already-nullable column is a no-op).
ALTER TABLE sys.sys_notification_preferences ALTER COLUMN preference_tenant_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sys_npref_user ON sys.sys_notification_preferences (preference_user_id);

DO $tr$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_sys_npref_updated_at') THEN
    CREATE TRIGGER trg_sys_npref_updated_at
      BEFORE UPDATE ON sys.sys_notification_preferences
      FOR EACH ROW EXECUTE FUNCTION sys.sys_set_updated_at();
  END IF;
END
$tr$;
