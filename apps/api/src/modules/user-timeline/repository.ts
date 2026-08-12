/**
 * apps/api/src/modules/user-timeline/repository.ts
 * D5 (#49) — SQL su sys.sys_user_timeline_events. Sola lettura: la tabella si
 * popola dall'import (docs/archive/etl-brownfield-ritirato/scripts/import-d5-timeline.sh (ritirato #170)), mai dall'API.
 */
import type { Pool, PoolClient } from "pg";
import type {
  UserTimelineEvent, UserTimelineEventType,
  UserTimelineListQuery, UserTimelineSummaryResponse,
} from "@heuresys/shared";

export type DbConnector = Pool | PoolClient;

interface Row {
  user_timeline_event_id: string;
  user_timeline_event_tenant_id: string;
  user_timeline_event_user_id: string;
  user_timeline_event_type: UserTimelineEventType;
  user_timeline_event_occurred_at: Date;
  user_timeline_event_source_table: string | null;
  user_timeline_event_source_id: string | null;
  user_timeline_event_summary: string | null;
  user_timeline_event_payload: Record<string, unknown>;
}

const COLS = `user_timeline_event_id, user_timeline_event_tenant_id,
  user_timeline_event_user_id, user_timeline_event_type,
  user_timeline_event_occurred_at, user_timeline_event_source_table,
  user_timeline_event_source_id, user_timeline_event_summary,
  user_timeline_event_payload`;

function toEvent(r: Row): UserTimelineEvent {
  return {
    userTimelineEventId: r.user_timeline_event_id,
    tenantId: r.user_timeline_event_tenant_id,
    userId: r.user_timeline_event_user_id,
    type: r.user_timeline_event_type,
    occurredAt: r.user_timeline_event_occurred_at.toISOString(),
    sourceTable: r.user_timeline_event_source_table,
    sourceId: r.user_timeline_event_source_id,
    summary: r.user_timeline_event_summary,
    payload: r.user_timeline_event_payload ?? {},
  };
}

/**
 * `userIdAllowList` è il cancello organizzativo risolto dal service: una lista
 * VUOTA significa "nessuno visibile" e deve restituire zero righe, non tutte.
 */
function buildWhere(filter: {
  tenantId?: string;
  userIdAllowList?: string[];
  query: UserTimelineListQuery;
}): { where: string; params: unknown[]; impossible: boolean } {
  const where: string[] = [];
  const params: unknown[] = [];
  if (filter.tenantId) {
    params.push(filter.tenantId);
    where.push(`user_timeline_event_tenant_id = $${params.length}`);
  }
  if (filter.userIdAllowList) {
    if (filter.userIdAllowList.length === 0) return { where: "", params: [], impossible: true };
    params.push(filter.userIdAllowList);
    where.push(`user_timeline_event_user_id = ANY($${params.length}::uuid[])`);
  }
  if (filter.query.userId) {
    params.push(filter.query.userId);
    where.push(`user_timeline_event_user_id = $${params.length}`);
  }
  if (filter.query.type) {
    params.push(filter.query.type);
    where.push(`user_timeline_event_type = $${params.length}`);
  }
  if (filter.query.from) {
    params.push(filter.query.from);
    where.push(`user_timeline_event_occurred_at >= $${params.length}::timestamptz`);
  }
  if (filter.query.to) {
    params.push(filter.query.to);
    where.push(`user_timeline_event_occurred_at <= $${params.length}::timestamptz`);
  }
  return { where: where.length ? `WHERE ${where.join(" AND ")}` : "", params, impossible: false };
}

export async function listTimeline(
  q: DbConnector,
  filter: { tenantId?: string; userIdAllowList?: string[]; query: UserTimelineListQuery },
): Promise<{ items: UserTimelineEvent[]; total: number }> {
  const { where, params, impossible } = buildWhere(filter);
  if (impossible) return { items: [], total: 0 };

  const tr = await q.query<{ total: string }>(
    `SELECT count(*)::text AS total FROM sys.sys_user_timeline_events ${where}`,
    params,
  );
  const p = [...params];
  p.push(filter.query.limit); const lim = p.length;
  p.push(filter.query.offset); const off = p.length;
  const res = await q.query<Row>(
    `SELECT ${COLS} FROM sys.sys_user_timeline_events ${where}
      ORDER BY user_timeline_event_occurred_at DESC, user_timeline_event_id
      LIMIT $${lim} OFFSET $${off}`,
    p,
  );
  return { items: res.rows.map(toEvent), total: Number(tr.rows[0]?.total ?? 0) };
}

/** Conteggi per tipo + estremi del periodo, sullo STESSO filtro della lista. */
export async function summarizeTimeline(
  q: DbConnector,
  filter: { tenantId?: string; userIdAllowList?: string[]; query: UserTimelineListQuery },
): Promise<UserTimelineSummaryResponse> {
  const { where, params, impossible } = buildWhere(filter);
  if (impossible) return { items: [], total: 0, firstEventAt: null, lastEventAt: null };

  const res = await q.query<{ type: UserTimelineEventType; count: string }>(
    `SELECT user_timeline_event_type AS type, count(*)::text AS count
       FROM sys.sys_user_timeline_events ${where}
      GROUP BY 1 ORDER BY count(*) DESC, 1`,
    params,
  );
  const bounds = await q.query<{ first: Date | null; last: Date | null }>(
    `SELECT min(user_timeline_event_occurred_at) AS first,
            max(user_timeline_event_occurred_at) AS last
       FROM sys.sys_user_timeline_events ${where}`,
    params,
  );
  const items = res.rows.map((r) => ({ type: r.type, count: Number(r.count) }));
  const b = bounds.rows[0];
  return {
    items,
    total: items.reduce((s, i) => s + i.count, 0),
    firstEventAt: b?.first ? b.first.toISOString() : null,
    lastEventAt: b?.last ? b.last.toISOString() : null,
  };
}
