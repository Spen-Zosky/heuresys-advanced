/**
 * apps/api/src/modules/notifications/service.ts — 3.4 SYSTEM broadcast.
 * Admin-only producer for the SYSTEM notification type: emits one SYSTEM
 * notification per target user (honouring per-user preferences via the shared
 * emitter). I5: non-platform actors can only reach users in their own tenant.
 */
import { pool } from "../../db/client.js";
import { emitNotificationsBulk } from "../../lib/notifications/emit.js";
import type { RoleCode } from "../../config/constants.js";
import type { BroadcastNotificationBody, BroadcastNotificationResponse } from "@heuresys/shared";

export interface ActorContext {
  userId: string;
  tenantId: string | null;
  roles: RoleCode[];
}

const isPlatform = (a: ActorContext): boolean => a.roles.includes("PLATFORM_ADMIN");

export const notificationsService = {
  async broadcast(actor: ActorContext, body: BroadcastNotificationBody): Promise<BroadcastNotificationResponse> {
    // Resolve recipients + their tenant; drop cross-tenant targets for non-platform actors (I5).
    const res = await pool.query<{ user_id: string; tenant: string | null }>(
      `SELECT user_id, user_tenant_id AS tenant FROM sys.sys_users WHERE user_id = ANY($1)`,
      [body.userIds],
    );
    const recipients = isPlatform(actor)
      ? res.rows
      : res.rows.filter((r) => r.tenant === actor.tenantId);

    // QW-B1 (WS-B F-WS-B-1): set-based bulk emit — opt-out lookup + one unnest
    // INSERT, a fixed 3 queries total (recipients + opt-out + insert) regardless
    // of the up-to-500 userIds, instead of the prior N×emitNotification N+1.
    const emitted = await emitNotificationsBulk(
      pool,
      recipients.map((r) => ({ userId: r.user_id, tenantId: r.tenant })),
      {
        type: "SYSTEM",
        subject: body.subject,
        body: body.body ?? null,
        priority: body.priority ?? "INFO",
        actionUrl: body.actionUrl ?? null,
        createdBy: actor.userId,
      },
    );
    return { requested: body.userIds.length, emitted };
  },
};
