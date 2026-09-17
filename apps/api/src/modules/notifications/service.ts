/**
 * apps/api/src/modules/notifications/service.ts — 3.4 SYSTEM broadcast.
 * Admin-only producer for the SYSTEM notification type: emits one SYSTEM
 * notification per target user (honouring per-user preferences via the shared
 * emitter). I5: non-platform actors can only reach users in their own tenant.
 */
import { pool } from "../../db/client.js";
import type { ActorContext } from "../../lib/actor.js";
import { perimetroClienti } from "../../lib/actor.js";

export type { ActorContext };
import { emitNotificationsBulk } from "../../lib/notifications/emit.js";
import { listBroadcastAudit } from "./repository.js";
import type {
  BroadcastNotificationBody,
  BroadcastNotificationResponse,
  ListBroadcastsQuery,
  ListBroadcastsResponse,
} from "@heuresys/shared";

export const notificationsService = {
  async broadcast(actor: ActorContext, body: BroadcastNotificationBody): Promise<BroadcastNotificationResponse> {
    // Resolve recipients + their tenant; drop out-of-perimeter targets (I5; mandato K R-9,
    // D9=B: generalizzato da isPlatform-only a perimetroClienti, che copre anche i ruoli di
    // piattaforma assegnati a un sottoinsieme di clienti).
    const res = await pool.query<{ user_id: string; tenant: string | null }>(
      `SELECT user_id, user_tenant_id AS tenant FROM sys.sys_users WHERE user_id = ANY($1)`,
      [body.userIds],
    );
    const perimetro = perimetroClienti(actor);
    const recipients =
      perimetro === undefined
        ? res.rows
        : res.rows.filter((r) => r.tenant !== null && perimetro.has(r.tenant));

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

  /** #74 (ex D-70) — audit of sent SYSTEM broadcasts, one row per event.
   *  I5: an actor sees only broadcasts that reached a tenant in its perimeter
   *  (mandato K R-9: perimetroClienti, undefined = no filter for PLATFORM_ADMIN). */
  async listBroadcasts(actor: ActorContext, query: ListBroadcastsQuery): Promise<ListBroadcastsResponse> {
    const perimetro = perimetroClienti(actor);
    return listBroadcastAudit(pool, query, {
      tenantIds: perimetro === undefined ? undefined : [...perimetro],
    });
  },
};
