/**
 * apps/api/src/modules/observability/repository.ts
 * Read-only catalog/aggregate queries for GET /v1/observability/system-health.
 * No writes; composed at request time from pg_catalog / information_schema and
 * existing sys.* / audit.* tables. Every count is cast `::int`/`::text` and
 * narrowed via Number(...) per TS strict (noUncheckedIndexedAccess).
 */

import type { Pool, PoolClient } from "pg";
import type {
  ObservabilityAuditEvent,
  ObservabilityAuthIntegrity,
  ObservabilitySchemaCounts,
  ObservabilityTenantFleetEntry,
} from "@heuresys/shared";

export type DbConnector = Pool | PoolClient;

/** `SHOW max_connections` — the Postgres server global connection cap. */
export async function getServerMaxConnections(q: DbConnector): Promise<number> {
  const r = await q.query<{ max_connections: string }>("SHOW max_connections");
  return Number(r.rows[0]!.max_connections);
}

/**
 * One row per tenant: live user count + last LOGIN_SUCCESS activity.
 * Uses scalar subqueries (NOT LEFT JOINs of users × login_events) to avoid a
 * cartesian inflation of user_count.
 */
export async function getTenantFleet(
  q: DbConnector,
): Promise<ObservabilityTenantFleetEntry[]> {
  const r = await q.query<{
    code: string;
    name: string;
    status: string;
    user_count: number;
    last_activity: Date | null;
  }>(
    `SELECT t.tenant_code AS code,
            t.tenant_name AS name,
            t.tenant_status AS status,
            (SELECT count(*) FROM sys.sys_users u
              WHERE u.user_tenant_id = t.tenant_id)::int AS user_count,
            (SELECT max(le.created_at) FROM sys.sys_auth_login_events le
              WHERE le.auth_login_event_tenant_id = t.tenant_id
                AND le.auth_login_event_type = 'LOGIN_SUCCESS') AS last_activity
       FROM sys.sys_tenancies t
      ORDER BY t.tenant_code`,
  );

  return r.rows.map((row) => ({
    code: row.code,
    name: row.name,
    status: row.status,
    userCount: Number(row.user_count),
    lastActivity: row.last_activity ? row.last_activity.toISOString() : null,
  }));
}

/**
 * Auth-subsystem integrity: login events in the last 24h (single table) +
 * refresh-token state distribution (single table). Two queries, no joins.
 */
export async function getAuthIntegrity(
  q: DbConnector,
): Promise<ObservabilityAuthIntegrity> {
  const events = await q.query<{
    login_success_24h: string;
    login_failed_24h: string;
  }>(
    `SELECT
       count(*) FILTER (
         WHERE auth_login_event_type = 'LOGIN_SUCCESS'
           AND created_at >= now() - interval '24 hours'
       )::text AS login_success_24h,
       count(*) FILTER (
         WHERE auth_login_event_type IN ('LOGIN_FAILED', 'LOGIN_UNKNOWN_USER')
           AND created_at >= now() - interval '24 hours'
       )::text AS login_failed_24h
       FROM sys.sys_auth_login_events`,
  );

  const tokens = await q.query<{
    rotated: string;
    replay_revoked: string;
    revoked_total: string;
    active: string;
  }>(
    `SELECT
       count(*) FILTER (WHERE auth_refresh_token_used_at IS NOT NULL)::text AS rotated,
       count(*) FILTER (WHERE auth_refresh_token_revoke_reason = 'REPLAY_DETECTED')::text AS replay_revoked,
       count(*) FILTER (WHERE auth_refresh_token_revoked_at IS NOT NULL)::text AS revoked_total,
       count(*) FILTER (
         WHERE auth_refresh_token_used_at IS NULL
           AND auth_refresh_token_revoked_at IS NULL
           AND auth_refresh_token_expires_at > now()
       )::text AS active
       FROM sys.sys_auth_refresh_tokens`,
  );

  const e = events.rows[0]!;
  const t = tokens.rows[0]!;
  return {
    login24h: Number(e.login_success_24h),
    failed24h: Number(e.login_failed_24h),
    rotations: Number(t.rotated),
    replayRevoked: Number(t.replay_revoked),
    revoked: Number(t.revoked_total),
    active: Number(t.active),
  };
}

/** Object-count census of the `sys` schema from pg_catalog / information_schema. */
export async function getSchemaCounts(
  q: DbConnector,
): Promise<ObservabilitySchemaCounts> {
  const r = await q.query<{
    tables: string;
    views: string;
    matviews: string;
    indexes: string;
    sequences: string;
    functions: string;
    triggers: string;
  }>(
    `SELECT
       (SELECT count(*) FROM pg_catalog.pg_tables   WHERE schemaname = 'sys')::text AS tables,
       (SELECT count(*) FROM pg_catalog.pg_views    WHERE schemaname = 'sys')::text AS views,
       (SELECT count(*) FROM pg_catalog.pg_matviews WHERE schemaname = 'sys')::text AS matviews,
       (SELECT count(*) FROM pg_catalog.pg_indexes  WHERE schemaname = 'sys')::text AS indexes,
       (SELECT count(*) FROM information_schema.sequences WHERE sequence_schema = 'sys')::text AS sequences,
       (SELECT count(*) FROM pg_proc p
          JOIN pg_namespace n ON n.oid = p.pronamespace
         WHERE n.nspname = 'sys')::text AS functions,
       (SELECT count(*) FROM pg_trigger tg
          JOIN pg_class c ON c.oid = tg.tgrelid
          JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = 'sys' AND NOT tg.tgisinternal)::text AS triggers`,
  );

  const row = r.rows[0]!;
  return {
    tables: Number(row.tables),
    views: Number(row.views),
    matviews: Number(row.matviews),
    indexes: Number(row.indexes),
    sequences: Number(row.sequences),
    functions: Number(row.functions),
    triggers: Number(row.triggers),
  };
}

/**
 * Most-recent self-service audit events, newest-first. The table exists but may
 * be empty — in which case this returns `[]` (a real empty-state).
 */
export async function getAuditFeed(
  q: DbConnector,
  limit: number,
): Promise<ObservabilityAuditEvent[]> {
  const r = await q.query<{
    action_id: string;
    action_type: string;
    action_resource_type: string | null;
    action_resource_id: string | null;
    created_at: Date;
    tenant_code: string;
    user_display_name: string;
  }>(
    `SELECT a.action_id,
            a.action_type,
            a.action_resource_type,
            a.action_resource_id,
            a.created_at,
            t.tenant_code,
            u.user_display_name
       FROM audit.user_self_service_actions a
       JOIN sys.sys_tenancies t ON t.tenant_id = a.action_tenant_id
       JOIN sys.sys_users    u ON u.user_id   = a.action_user_id
      ORDER BY a.created_at DESC
      LIMIT $1`,
    [limit],
  );

  return r.rows.map((row) => ({
    actionId: row.action_id,
    actionType: row.action_type,
    resourceType: row.action_resource_type,
    resourceId: row.action_resource_id,
    occurredAt: row.created_at.toISOString(),
    tenantCode: row.tenant_code,
    userDisplayName: row.user_display_name,
  }));
}

/* --- #35 B7 (S1028): slow queries from pg_stat_statements ------------------ */

export interface SlowQueryRow {
  query: string;
  calls: string;
  mean_ms: number;
  stddev_ms: number;
  max_ms: number;
  total_ms: number;
  rows_returned: string;
  shared_blks_hit: string;
  shared_blks_read: string;
}

/** Outcome of a slow-query read: the payload plus WHY it degraded, if it did. */
export interface SlowQueriesRead {
  rows: SlowQueryRow[];
  totalTracked: number;
  statsSince: string | null;
  extensionAvailable: boolean;
  /** SQLSTATE (or `NOT_INSTALLED`) when degraded — logged by the caller so the
   *  degradation is never silent. `undefined` on the healthy path. */
  degradedReason?: string;
}

/**
 * SQLSTATEs that mean "the pg_stat_statements VIEW itself is not usable here".
 * Deliberately narrow: they are only honoured on the statement read, never on
 * the ancillary `pg_stat_statements_info` lookup (which is absent below
 * extension v1.9 and must not be able to hide a perfectly working view).
 */
const PGSS_UNAVAILABLE_CODES = new Set([
  "55000", // object_not_in_prerequisite_state — "must be loaded via shared_preload_libraries"
  "42P01", // undefined_table — the view is not there at all
]);

function unavailableCode(err: unknown): string | undefined {
  const code = (err as { code?: unknown } | null)?.code;
  return typeof code === "string" && PGSS_UNAVAILABLE_CODES.has(code) ? code : undefined;
}

/**
 * Top statements by mean execution time, app-database scope. The app user sees
 * its own statements (all API traffic); rows it cannot read surface as
 * "<insufficient privilege>" and are filtered out. The normalized query text
 * is $n-parameterized by pg_stat_statements — no literal values ever leave.
 *
 * `pg_stat_statements` is an OPTIONAL extension: a database where it is absent
 * (or created but missing from `shared_preload_libraries`) degrades to an empty
 * result with `extensionAvailable: false` — it never surfaces as a 500. The probe
 * on `pg_extension` cannot fail; the reads run inside a transaction so that the
 * residual "loaded?" failure rolls back cleanly (and, under the D-52 test
 * isolation, becomes a savepoint rollback that leaves the file tx usable).
 * Degradation always carries a `degradedReason` — a silent empty panel would be
 * indistinguishable from a healthy database with no traffic.
 */
export async function readSlowQueries(
  pool: Pool,
  limit: number,
  minCalls: number,
): Promise<SlowQueriesRead> {
  const degraded = (reason: string): SlowQueriesRead => ({
    rows: [],
    totalTracked: 0,
    statsSince: null,
    extensionAvailable: false,
    degradedReason: reason,
  });

  const installed = await pool.query<{ installed: boolean }>(
    `SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_stat_statements') AS installed`,
  );
  if (!installed.rows[0]?.installed) return degraded("NOT_INSTALLED");

  try {
    return await readSlowQueryRows(pool, limit, minCalls);
  } catch (err) {
    const code = unavailableCode(err);
    if (code) return degraded(code);
    throw err;
  }
}

async function readSlowQueryRows(
  pool: Pool,
  limit: number,
  minCalls: number,
): Promise<SlowQueriesRead> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await readSlowQueryRowsOn(client, limit, minCalls);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    // A failed ROLLBACK (connection already gone) must NOT replace the error that
    // actually explains the failure — the caller classifies on `err`, and losing
    // it here would turn a degradable 55000 back into a 500.
    try {
      await client.query("ROLLBACK");
    } catch {
      /* connection is unusable; `err` is the diagnostic that matters */
    }
    throw err;
  } finally {
    client.release();
  }
}

async function readSlowQueryRowsOn(
  client: PoolClient,
  limit: number,
  minCalls: number,
): Promise<SlowQueriesRead> {
  const items = await client.query<SlowQueryRow>(
    `SELECT s.query,
            s.calls::text AS calls,
            round(s.mean_exec_time::numeric, 2)::float8   AS mean_ms,
            round(s.stddev_exec_time::numeric, 2)::float8 AS stddev_ms,
            round(s.max_exec_time::numeric, 2)::float8    AS max_ms,
            round(s.total_exec_time::numeric, 2)::float8  AS total_ms,
            s.rows::text AS rows_returned,
            s.shared_blks_hit::text  AS shared_blks_hit,
            s.shared_blks_read::text AS shared_blks_read
       FROM pg_stat_statements s
      WHERE s.dbid = (SELECT oid FROM pg_database WHERE datname = current_database())
        AND s.calls >= $2
        AND s.query NOT LIKE '<insufficient privilege>%'
        AND s.query NOT ILIKE '%pg_stat_statements%'
        AND s.toplevel
      ORDER BY s.mean_exec_time DESC
      LIMIT $1`,
    [limit, minCalls],
  );
  // The statement rows above are the payload. `pg_stat_statements_info` only adds
  // the stats-reset timestamp and does NOT exist before extension v1.9 — letting
  // its absence degrade the whole endpoint would report "extension not loaded"
  // while the extension is demonstrably loaded and serving rows. It gets its own
  // savepoint so that its failure cannot poison the surrounding transaction.
  let totalTracked = items.rows.length;
  let statsSince: string | null = null;
  await client.query("SAVEPOINT pgss_meta");
  try {
    const meta = await client.query<{ n: string; since: Date | null }>(
      `SELECT (SELECT count(*)::text FROM pg_stat_statements
                WHERE dbid = (SELECT oid FROM pg_database WHERE datname = current_database())) AS n,
              (SELECT stats_reset FROM pg_stat_statements_info) AS since`,
    );
    await client.query("RELEASE SAVEPOINT pgss_meta");
    totalTracked = Number(meta.rows[0]?.n ?? 0);
    statsSince = meta.rows[0]?.since ? meta.rows[0].since.toISOString() : null;
  } catch {
    // keep the rows we already have; totalTracked falls back to what we can see
    await client.query("ROLLBACK TO SAVEPOINT pgss_meta; RELEASE SAVEPOINT pgss_meta");
  }

  return { rows: items.rows, totalTracked, statsSince, extensionAvailable: true };
}
