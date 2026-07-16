-- 000170_inbox_orphan_purge.sql
-- D-54 (S1018): one-time purge of orphan inbox notifications.
--
-- sys_inbox_notifications references resources polymorphically (type + id, no
-- hard FK): a hard-deleted resource leaves dangling rows. The 4 known ASSESSMENT
-- orphans were cleaned manually in S1017 (commit 667d776c); this migration makes
-- the cleanup structural-and-repeatable, driven by the validation view itself.
-- Prevention (delete-time cleanup in the learning-modules / kpi-definitions
-- services via lib/notifications/cleanup.ts) ships in the same commit.
--
-- Idempotent: on a clean DB the view returns 0 rows and this is a no-op.

DO $$
DECLARE
  purged integer;
BEGIN
  DELETE FROM sys.sys_inbox_notifications
   WHERE notification_id IN (SELECT notification_id FROM sys.v_inbox_resource_consistency);
  GET DIAGNOSTICS purged = ROW_COUNT;
  RAISE NOTICE 'D-54: purged % orphan inbox notification(s)', purged;
END $$;
