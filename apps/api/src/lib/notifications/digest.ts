/**
 * apps/api/src/lib/notifications/digest.ts — 3.4 notification digest.
 *
 * Aggregates each opted-in user's UNREAD in-app notifications into a periodic
 * digest and sends it via the mailer. "Opted-in" = the user has email_enabled=true
 * for at least one notification type (default is email-off, so a digest is
 * strictly opt-in). Email delivery is SMTP-gated in production — without creds the
 * mailer is a no-op/log, so the digest is a chassis until SMTP is configured.
 *
 * Invoked by the systemd timer via the digest CLI (notifications:digest); never by
 * the serving API. Best-effort: a per-user send failure never aborts the run.
 */
import type { Pool, PoolClient } from "pg";
import type { IMailer } from "../../modules/auth/mailer.js";

export type DbConnector = Pool | PoolClient;

export interface UserDigest {
  userId: string;
  email: string;
  unreadCount: number;
}

/** Users with ≥1 UNREAD notification AND an email-opt-in on some type. */
export async function computeUserDigests(db: DbConnector): Promise<UserDigest[]> {
  const res = await db.query<{ user_id: string; email: string; unread: number }>(
    `SELECT u.user_id, u.user_email AS email, count(n.notification_id)::int AS unread
       FROM sys.sys_users u
       JOIN sys.sys_inbox_notifications n
         ON n.notification_user_id = u.user_id AND n.notification_status = 'UNREAD'
      WHERE u.user_email IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM sys.sys_notification_preferences p
           WHERE p.preference_user_id = u.user_id AND p.preference_email_enabled = true)
      GROUP BY u.user_id, u.user_email
     HAVING count(n.notification_id) > 0`,
  );
  return res.rows.map((r) => ({ userId: r.user_id, email: r.email, unreadCount: r.unread }));
}

/** Compute + send digests. Returns how many were sent and how many were eligible. */
export async function runDigest(
  db: DbConnector,
  mailer: Pick<IMailer, "sendNotificationDigest">,
): Promise<{ digestsSent: number; recipients: number }> {
  const digests = await computeUserDigests(db);
  let sent = 0;
  for (const d of digests) {
    try {
      await mailer.sendNotificationDigest(d.email, d.unreadCount);
      sent++;
    } catch {
      /* best-effort: one bad send must not abort the scheduled run */
    }
  }
  return { digestsSent: sent, recipients: digests.length };
}
