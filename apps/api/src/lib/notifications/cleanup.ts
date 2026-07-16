/**
 * apps/api/src/lib/notifications/cleanup.ts — D-54 (S1018).
 *
 * sys_inbox_notifications references resources polymorphically
 * (notification_resource_type + notification_resource_id, NO hard FK), so a
 * hard-deleted resource leaves dangling notifications behind (caught by
 * sys.v_inbox_resource_consistency, which must stay at 0).
 *
 * Structural prevention: every service that HARD-deletes a resource of a type
 * tracked by the view (POSITION / LEARNING_MODULE / ASSESSMENT / CAREER_TARGET /
 * KPI / SKILL / APPROVAL_STEP) calls this IN THE SAME TRANSACTION as the delete.
 * Soft-delete paths (e.g. positions) must NOT call it — their notifications
 * still point at an existing row.
 *
 * Delete-site census (S1018): the only live hard-delete sites are
 * learning-modules (LEARNING_MODULE) and kpi-definitions (KPI); new hard-delete
 * paths must adopt this helper (regression net: inbox-consistency test).
 */
import type { Pool, PoolClient } from "pg";

type DbConnector = Pool | PoolClient;

/** Delete every inbox notification pointing at (resourceType, resourceId). Returns the count. */
export async function deleteInboxNotificationsForResource(
  db: DbConnector,
  resourceType: string,
  resourceId: string,
): Promise<number> {
  const res = await db.query(
    `DELETE FROM sys.sys_inbox_notifications
      WHERE notification_resource_type = $1
        AND notification_resource_id = $2`,
    [resourceType, resourceId],
  );
  return res.rowCount ?? 0;
}
