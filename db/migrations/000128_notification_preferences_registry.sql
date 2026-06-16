-- ============================================================================
-- Migration 000128 — 3.4: register sys_notification_preferences in the
-- reconciliation registry (EXCLUDE) so v_reconciliation_status leaves 0
-- UNCLASSIFIED. Every sys.* table must have a registry row — the runtime view
-- (unlike 000062's one-time assert) classifies ALL sys.* tables, so a new table
-- created after 000062 still surfaces as UNCLASSIFIED until registered. Mirrors
-- the 000116 sys_auth_mfa_exemptions pattern (app-authored config, no source).
-- Idempotent (ON CONFLICT). Authored: 2026-06-16.
-- ============================================================================

INSERT INTO sys.sys_reconciliation_registry
  (reconciliation_registry_table_name, reconciliation_registry_bucket,
   reconciliation_registry_declared_status, reconciliation_registry_rationale)
VALUES
  ('sys_notification_preferences', 'D', 'EXCLUDE',
   '[3.4 notification center] Per-user notification delivery preferences (in-app/email opt-out per type) — app-authored config, no legacy source. Companion to sys_inbox_notifications (which predates this).')
ON CONFLICT (reconciliation_registry_table_name) DO NOTHING;
