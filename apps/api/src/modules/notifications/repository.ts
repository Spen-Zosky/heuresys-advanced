/**
 * apps/api/src/modules/notifications/repository.ts
 * #74 (ex D-70) — administrative audit of sent SYSTEM broadcasts.
 *
 * One audit row per broadcast EVENT, not per recipient: the bulk emitter
 * (lib/notifications/emit.ts) writes all recipient rows of one broadcast in a
 * single unnest INSERT, so the triple (created_by, subject, created_at) is a
 * faithful event key; recipients/readCount aggregate its per-user rows.
 *
 * I5 tenant scoping happens BEFORE grouping: a non-platform actor sees only
 * broadcasts that reached their own tenant, with counts limited to the rows of
 * that tenant (never cross-tenant recipient counts).
 */
import type { Pool } from "pg";
import type { ListBroadcastsQuery, BroadcastAuditItem } from "@heuresys/shared";

interface BroadcastAuditRow {
  subject: string;
  body: string | null;
  priority: string;
  action_url: string | null;
  created_by: string | null;
  created_by_email: string | null;
  emitted_at: Date;
  recipients: number;
  read_count: number;
  tenants: number;
  full_count: number;
}

export async function listBroadcastAudit(
  pool: Pool,
  q: ListBroadcastsQuery,
  scope: { tenantId: string | null; isPlatform: boolean },
): Promise<{ items: BroadcastAuditItem[]; total: number }> {
  const params: unknown[] = [];
  const where: string[] = [`n.notification_type = 'SYSTEM'`];

  if (!scope.isPlatform) {
    params.push(scope.tenantId);
    where.push(`n.notification_tenant_id = $${params.length}`);
  }
  if (q.from) {
    params.push(q.from);
    where.push(`n.created_at >= $${params.length}::date`);
  }
  if (q.to) {
    params.push(q.to);
    where.push(`n.created_at < ($${params.length}::date + 1)`);
  }

  params.push(q.limit, q.offset);
  const res = await pool.query<BroadcastAuditRow>(
    `SELECT n.notification_subject                      AS subject,
            max(n.notification_body)                    AS body,
            n.notification_priority                     AS priority,
            max(n.notification_action_url)              AS action_url,
            n.created_by,
            u.user_email                                AS created_by_email,
            n.created_at                                AS emitted_at,
            count(*)::int                               AS recipients,
            count(n.notification_read_at)::int          AS read_count,
            count(DISTINCT n.notification_tenant_id)::int AS tenants,
            count(*) OVER ()::int                       AS full_count
       FROM sys.sys_inbox_notifications n
       LEFT JOIN sys.sys_users u ON u.user_id = n.created_by
      WHERE ${where.join(" AND ")}
      GROUP BY n.notification_subject, n.notification_priority,
               n.created_by, u.user_email, n.created_at
      ORDER BY n.created_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );

  return {
    items: res.rows.map((r) => ({
      subject: r.subject,
      body: r.body,
      priority: r.priority as BroadcastAuditItem["priority"],
      actionUrl: r.action_url,
      createdByUserId: r.created_by,
      createdByEmail: r.created_by_email,
      emittedAt: r.emitted_at.toISOString(),
      recipients: r.recipients,
      readCount: r.read_count,
      tenants: r.tenants,
    })),
    total: res.rows[0]?.full_count ?? 0,
  };
}
