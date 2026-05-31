/**
 * apps/api/src/modules/observability/service.ts
 * Platform-wide system-health aggregator. Assembles the SystemHealthResponse
 * from in-process probes (pg.Pool live counters + in-memory RBAC cache) and
 * read-only DB reads. No tenant scoping — PLATFORM_ADMIN-only (gated at the
 * route via requirePermission). All data is live; nothing is fabricated.
 */

import { pool } from "../../db/client.js";
import { rbacCacheStats } from "../../middleware/rbac.js";
import type { RoleCode } from "../../config/constants.js";
import type { SystemHealthResponse } from "@heuresys/shared";
import * as repo from "./repository.js";
import { metricsStore } from "./metrics-store.js";

export interface ActorContext {
  userId: string;
  tenantId: string | null;
  roles: RoleCode[];
}

/**
 * App-configured pool client cap. Mirrors `max: 20` in db/client.ts — pg.Pool
 * does not expose the configured max as a public instance property, so we keep
 * a single source-of-truth const here.
 */
const POOL_MAX_CLIENTS = 20;

/** Number of recent audit events surfaced in the feed. */
const AUDIT_FEED_LIMIT = 20;

export const observabilityService = {
  async getSystemHealth(_actor: ActorContext): Promise<SystemHealthResponse> {
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

    // Read-only DB reads (parallelised).
    const [
      serverMaxConnections,
      tenantFleet,
      authIntegrity,
      schemaCounts,
      auditFeed,
    ] = await Promise.all([
      repo.getServerMaxConnections(pool),
      repo.getTenantFleet(pool),
      repo.getAuthIntegrity(pool),
      repo.getSchemaCounts(pool),
      repo.getAuditFeed(pool, AUDIT_FEED_LIMIT),
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
};
