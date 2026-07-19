/**
 * apps/api/src/lib/notifications/emit.ts — 3.4 notification center.
 *
 * The single producer-side entry point: emitNotification() inserts an in-app
 * notification into sys_inbox_notifications, honouring the user's per-type
 * preferences (sys_notification_preferences). The consumer side (/me/inbox,
 * me/repository.ts) reads these rows. Email delivery is gated on SMTP creds and
 * handled by the digest scheduler (Slice C) — this path is in-app only.
 *
 * Default-on: absence of a preference row = in-app enabled. A row with
 * in_app_enabled=false opts the user out for that type → emit is a no-op (null).
 *
 * dedupe: when true, skips insertion if an UNREAD notification of the same
 * (user, type, resource_id) already exists — lets event/scheduled producers be
 * re-run (e.g. insights recompute) without spamming the inbox.
 *
 * Accepts a Pool or a PoolClient so producers can emit inside their own txn.
 */
import type { Pool, PoolClient } from "pg";
import type { NotificationType, NotificationPriority } from "@heuresys/shared";

export type DbConnector = Pool | PoolClient;

export interface NotificationInput {
  tenantId: string | null;
  userId: string;
  type: NotificationType;
  subject: string;
  body?: string | null;
  priority?: NotificationPriority;
  resourceType?: string | null;
  resourceId?: string | null;
  actionUrl?: string | null;
  expiresAt?: string | null;
  createdBy?: string | null;
  /** Skip if an UNREAD notification of the same (user,type,resourceId) exists. */
  dedupe?: boolean;
}

/**
 * Emit one in-app notification. Returns the new notification id, or null when
 * suppressed (user opted out, or dedupe hit). Never throws on opt-out/dedupe;
 * SQL errors propagate to the caller (producers decide whether to swallow).
 */
export async function emitNotification(db: DbConnector, input: NotificationInput): Promise<string | null> {
  // 1. preference check — default-on if no row.
  const pref = await db.query<{ enabled: boolean }>(
    `SELECT preference_in_app_enabled AS enabled
       FROM sys.sys_notification_preferences
      WHERE preference_user_id = $1 AND preference_notification_type = $2`,
    [input.userId, input.type],
  );
  if (pref.rows[0] && pref.rows[0].enabled === false) return null;

  // 2. optional dedupe against an existing UNREAD of the same (user,type,resource).
  if (input.dedupe) {
    const dup = await db.query<{ notification_id: string }>(
      `SELECT notification_id
         FROM sys.sys_inbox_notifications
        WHERE notification_user_id = $1
          AND notification_type = $2
          AND notification_status = 'UNREAD'
          AND notification_resource_id IS NOT DISTINCT FROM $3
        LIMIT 1`,
      [input.userId, input.type, input.resourceId ?? null],
    );
    if (dup.rows[0]) return null;
  }

  // 3. insert.
  const res = await db.query<{ notification_id: string }>(
    `INSERT INTO sys.sys_inbox_notifications (
       notification_tenant_id, notification_user_id, notification_type,
       notification_subject, notification_body, notification_action_url,
       notification_resource_type, notification_resource_id,
       notification_priority, notification_status, notification_expires_at, created_by
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'UNREAD',$10,$11)
     RETURNING notification_id`,
    [
      input.tenantId,
      input.userId,
      input.type,
      input.subject,
      input.body ?? null,
      input.actionUrl ?? null,
      input.resourceType ?? null,
      input.resourceId ?? null,
      input.priority ?? "INFO",
      input.expiresAt ?? null,
      input.createdBy ?? null,
    ],
  );
  return res.rows[0]?.notification_id ?? null;
}

/**
 * Bulk-emit the SAME notification to many users in a FIXED number of queries
 * (QW-B1 / WS-B F-WS-B-1): one opt-out lookup + one set-based INSERT via unnest,
 * instead of N×emitNotification (2-3 queries each) — which serialised ~1000-1500
 * round-trips on the shared 20-conn pool for a 500-user SYSTEM broadcast.
 * Default-on preferences: a user is a target unless they have an explicit
 * in_app_enabled=false row for this type. Returns the number actually inserted.
 *
 * `body` may vary per recipient (unnested alongside uid/tenant) — producers that
 * personalise the text no longer have to fall back to the per-row path.
 *
 * `options.dedupe` mirrors emitNotification's dedupe EXACTLY (skip when an UNREAD
 * of the same user+type+resource exists) as a NOT EXISTS on the same set-based
 * INSERT, so a re-runnable producer stays one round-trip instead of 3×N.
 */
export async function emitNotificationsBulk(
  db: DbConnector,
  recipients: ReadonlyArray<{ userId: string; tenantId: string | null; body?: string | null }>,
  common: {
    type: NotificationType;
    subject: string;
    body?: string | null;
    priority?: NotificationPriority;
    actionUrl?: string | null;
    resourceType?: string | null;
    resourceId?: string | null;
    createdBy?: string | null;
  },
  options: { dedupe?: boolean } = {},
): Promise<number> {
  if (recipients.length === 0) return 0;
  const userIds = recipients.map((r) => r.userId);

  // 1. opt-out lookup (one query): users who disabled in-app for this type.
  const opted = await db.query<{ uid: string }>(
    `SELECT preference_user_id AS uid
       FROM sys.sys_notification_preferences
      WHERE preference_notification_type = $1
        AND preference_in_app_enabled = false
        AND preference_user_id = ANY($2)`,
    [common.type, userIds],
  );
  const optedOut = new Set(opted.rows.map((r) => r.uid));
  const targets = recipients.filter((r) => !optedOut.has(r.userId));
  if (targets.length === 0) return 0;

  // 2. set-based INSERT via unnest (one round-trip regardless of N).
  const dedupeClause = options.dedupe
    ? `WHERE NOT EXISTS (
         SELECT 1 FROM sys.sys_inbox_notifications n
          WHERE n.notification_user_id = t.uid
            AND n.notification_type = $3
            AND n.notification_status = 'UNREAD'
            AND n.notification_resource_id IS NOT DISTINCT FROM $7)`
    : "";
  const res = await db.query(
    `INSERT INTO sys.sys_inbox_notifications (
       notification_tenant_id, notification_user_id, notification_type,
       notification_subject, notification_body, notification_action_url,
       notification_resource_type, notification_resource_id,
       notification_priority, notification_status, created_by
     )
     SELECT t.tenant, t.uid, $3, $4, t.body, $5, $6, $7, $8, 'UNREAD', $9
       FROM unnest($1::uuid[], $2::uuid[], $10::text[]) AS t(uid, tenant, body)
     ${dedupeClause}`,
    [
      targets.map((t) => t.userId),
      targets.map((t) => t.tenantId),
      common.type,
      common.subject,
      common.actionUrl ?? null,
      common.resourceType ?? null,
      common.resourceId ?? null,
      common.priority ?? "INFO",
      common.createdBy ?? null,
      targets.map((t) => t.body ?? common.body ?? null),
    ],
  );
  return res.rowCount ?? 0;
}
