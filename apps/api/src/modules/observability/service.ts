/**
 * apps/api/src/modules/observability/service.ts
 * Platform-wide system-health aggregator. Assembles the SystemHealthResponse
 * from in-process probes (pg.Pool live counters + in-memory RBAC cache) and
 * read-only DB reads. Gated via requirePermission("observability:read"),
 * held by PLATFORM_ADMIN (unfiltered) and PLATFORM_OPERATOR (mandato K, R-0b:
 * `tenantFleet`/`auditFeed` carry a per-tenant dimension and are filtered by
 * `perimetroClienti` — a PLATFORM_OPERATOR sees only its assigned tenants,
 * never all). `pool`/`rbac`/`schemaCounts` and the two B7 endpoints below stay
 * platform-wide by construction: DB/process-wide aggregates, no tenant per row.
 */

import { pool } from "../../db/client.js";
import { perimetroClienti, type ActorContext } from "../../lib/actor.js";

export type { ActorContext };
import { rbacCacheStats } from "../../middleware/rbac.js";
import type {
  RequestSeriesQuery,
  RequestSeriesResponse,
  SlowQueriesQuery,
  SlowQueriesResponse,
  SystemHealthResponse,
} from "@heuresys/shared";
import * as repo from "./repository.js";
import { metricsStore } from "./metrics-store.js";

/**
 * App-configured pool client cap. Mirrors `max: 20` in db/client.ts — pg.Pool
 * does not expose the configured max as a public instance property, so we keep
 * a single source-of-truth const here.
 */
const POOL_MAX_CLIENTS = 20;

/** Number of recent audit events surfaced in the feed. */
const AUDIT_FEED_LIMIT = 20;

export const observabilityService = {
  async getSystemHealth(actor: ActorContext): Promise<SystemHealthResponse> {
    // In-process probes (synchronous reads from live in-memory state).
    const rbac = rbacCacheStats();
    const poolTotal = pool.totalCount;
    const poolIdle = pool.idleCount;
    const poolWaiting = pool.waitingCount;

    // Request-metrics rollup (last 24h) from the in-memory store fed by the
    // onResponse hook. Pure in-process, never throws.
    const metrics = metricsStore.aggregate(1440);
    const recentErrors = metricsStore
      .recentErrors()
      .map((e) => ({ route: e.route, status: e.status }));

    // R-0b: undefined = no filter (PLATFORM_ADMIN); a Set (even empty) = only
    // those tenants (PLATFORM_OPERATOR, mandato K, D9=B).
    const perimetro = perimetroClienti(actor);

    // Read-only DB reads (parallelised).
    const [
      serverMaxConnections,
      tenantFleet,
      authIntegrity,
      schemaCounts,
      auditFeed,
    ] = await Promise.all([
      repo.getServerMaxConnections(pool),
      repo.getTenantFleet(pool, perimetro),
      repo.getAuthIntegrity(pool),
      repo.getSchemaCounts(pool),
      repo.getAuditFeed(pool, AUDIT_FEED_LIMIT, perimetro),
    ]);

    return {
      pool: {
        total: poolTotal,
        idle: poolIdle,
        // active = checked-out clients; clamp at 0 (idle can momentarily exceed
        // total across async boundaries on some pg versions).
        active: Math.max(0, poolTotal - poolIdle),
        waiting: poolWaiting,
        max: POOL_MAX_CLIENTS,
        serverMaxConnections,
      },
      rbac: {
        rolesLoaded: rbac.rolesLoaded,
        mappingsLoaded: rbac.mappingsLoaded,
        loadedAt: rbac.loadedAt,
      },
      tenantFleet,
      authIntegrity,
      schemaCounts,
      auditFeed,
      requestMetrics: {
        uptime24hPct: metrics.uptimePct,
        totalRequests: metrics.totalRequests,
        byStatusClass: metrics.byStatusClass,
        errorRate5xxPct: metrics.errorRate5xxPct,
        clientErrorRate4xxPct: metrics.clientErrorRate4xxPct,
        avgDurationMs: metrics.avgDurationMs,
        recentErrors,
      },
      generatedAt: new Date().toISOString(),
    };
  },

  /* --- #35 B7 (S1028) ----------------------------------------------------- */

  /** Top statements by mean exec time from pg_stat_statements (platform-only). */
  async getSlowQueries(
    _actor: ActorContext,
    q: SlowQueriesQuery,
  ): Promise<SlowQueriesResponse & { degradedReason?: string }> {
    const { rows, totalTracked, statsSince, extensionAvailable, degradedReason } =
      await repo.readSlowQueries(pool, q.limit, q.minCalls);
    return {
      items: rows.map((r, i) => ({
        rank: i + 1,
        query: r.query,
        calls: Number(r.calls),
        meanMs: r.mean_ms,
        stddevMs: r.stddev_ms,
        maxMs: r.max_ms,
        totalMs: r.total_ms,
        rowsReturned: Number(r.rows_returned),
        sharedBlksHit: Number(r.shared_blks_hit),
        sharedBlksRead: Number(r.shared_blks_read),
      })),
      totalTracked,
      statsSince,
      extensionAvailable,
      // Carried out of the service so the route can log it; the Zod response
      // schema does not declare it, so it never reaches the wire.
      ...(degradedReason ? { degradedReason } : {}),
      generatedAt: new Date().toISOString(),
    };
  },

  /** Request time-series from the in-RAM 24h ring (B7 sparklines backend). */
  getRequestSeries(_actor: ActorContext, q: RequestSeriesQuery): RequestSeriesResponse {
    const points = metricsStore.series(q.windowMinutes, q.stepMinutes);
    return {
      points: points.map((p) => ({
        ts: new Date(p.minute * 60000).toISOString(),
        total: p.total,
        xx2: p.xx2,
        xx4: p.xx4,
        xx5: p.xx5,
        avgDurationMs: p.avgDurationMs,
      })),
      windowMinutes: q.windowMinutes,
      stepMinutes: q.stepMinutes,
      generatedAt: new Date().toISOString(),
    };
  },
};
