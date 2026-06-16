/**
 * apps/api/src/modules/notifications/service.ts — 3.4 SYSTEM broadcast.
 * Admin-only producer for the SYSTEM notification type: emits one SYSTEM
 * notification per target user (honouring per-user preferences via the shared
 * emitter). I5: non-platform actors can only reach users in their own tenant.
 */
import { pool } from "../../db/client.js";
import { emitNotification } from "../../lib/notifications/emit.js";
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

    let emitted = 0;
    for (const r of recipients) {
      const id = await emitNotification(pool, {
        tenantId: r.tenant,
        userId: r.user_id,
        type: "SYSTEM",
        subject: body.subject,
        body: body.body ?? null,
        priority: body.priority ?? "INFO",
        actionUrl: body.actionUrl ?? null,
        createdBy: actor.userId,
      });
      if (id) emitted++;
    }
    return { requested: body.userIds.length, emitted };
  },
};
