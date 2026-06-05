/**
 * packages/shared/src/schemas/observability.ts
 * Schema for GET /v1/observability/system-health — platform-wide system health
 * snapshot. PLATFORM_ADMIN-only. NOT a persisted view: composed at request time
 * from in-process probes (pg.Pool live counters + in-memory RBAC cache) and
 * read-only catalog/aggregate SQL against the live DB. No tenant scoping.
 */

import { z } from "zod";

/** Live pg.Pool counters + the configured app cap + the server's max_connections. */
export const ObservabilityPoolSchema = z.object({
  /** pool.totalCount — total clients (idle + in-use) currently in the pool. */
  total: z.number().int().min(0),
  /** pool.idleCount — idle clients available for checkout. */
  idle: z.number().int().min(0),
  /** Derived: total - idle — clients currently checked out / in use. */
  active: z.number().int().min(0),
  /** pool.waitingCount — queued acquire requests waiting for a client. */
  waiting: z.number().int().min(0),
  /** App-configured pool cap (client.ts `max`). */
  max: z.number().int().min(1),
  /** Server-side `SHOW max_connections` (Postgres global cap). */
  serverMaxConnections: z.number().int().min(1),
});
export type ObservabilityPool = z.infer<typeof ObservabilityPoolSchema>;

/** In-memory RBAC permission cache stats (loaded once at server start). */
export const ObservabilityRbacSchema = z.object({
  /** Number of role codes in the cache (rolePermissionCache.size). */
  rolesLoaded: z.number().int().min(0),
  /** Sum of permission-code Set sizes across all roles. */
  mappingsLoaded: z.number().int().min(0),
  /** ISO timestamp of last cache population; null if never loaded. */
  loadedAt: z.iso.datetime().nullable(),
});
export type ObservabilityRbac = z.infer<typeof ObservabilityRbacSchema>;

/** One row per tenant in the fleet, with live user count + last login activity. */
export const ObservabilityTenantFleetEntrySchema = z.object({
  code: z.string(),
  name: z.string(),
  status: z.string(),
  userCount: z.number().int().min(0),
  /** Last LOGIN_SUCCESS timestamp for the tenant; null when none. */
  lastActivity: z.iso.datetime().nullable(),
});
export type ObservabilityTenantFleetEntry = z.infer<
  typeof ObservabilityTenantFleetEntrySchema
>;

/** Auth-subsystem integrity counters: login events (24h) + refresh-token state. */
export const ObservabilityAuthIntegritySchema = z.object({
  /** LOGIN_SUCCESS events in the last 24h. */
  login24h: z.number().int().min(0),
  /** LOGIN_FAILED + LOGIN_UNKNOWN_USER events in the last 24h. */
  failed24h: z.number().int().min(0),
  /** Refresh tokens that have been rotated (used_at IS NOT NULL). */
  rotations: z.number().int().min(0),
  /** Refresh tokens revoked due to REPLAY_DETECTED. */
  replayRevoked: z.number().int().min(0),
  /** Refresh tokens revoked for any reason (revoked_at IS NOT NULL). */
  revoked: z.number().int().min(0),
  /** Refresh tokens still live (not used, not revoked, not expired). */
  active: z.number().int().min(0),
});
export type ObservabilityAuthIntegrity = z.infer<
  typeof ObservabilityAuthIntegritySchema
>;

/** Object-count census of the `sys` schema (structural footprint). */
export const ObservabilitySchemaCountsSchema = z.object({
  tables: z.number().int().min(0),
  views: z.number().int().min(0),
  matviews: z.number().int().min(0),
  indexes: z.number().int().min(0),
  functions: z.number().int().min(0),
  triggers: z.number().int().min(0),
  sequences: z.number().int().min(0),
});
export type ObservabilitySchemaCounts = z.infer<
  typeof ObservabilitySchemaCountsSchema
>;

/**
 * One recent self-service audit event. Backed by audit.user_self_service_actions
 * — the table exists but may be empty, in which case auditFeed is `[]` (a real
 * empty-state, never a placeholder).
 */
export const ObservabilityAuditEventSchema = z.object({
  actionId: z.uuid(),
  actionType: z.string(),
  resourceType: z.string().nullable(),
  resourceId: z.string().nullable(),
  occurredAt: z.iso.datetime(),
  tenantCode: z.string(),
  userDisplayName: z.string(),
});
export type ObservabilityAuditEvent = z.infer<
  typeof ObservabilityAuditEventSchema
>;

/**
 * In-process request-metrics rollup (last 24h) fed by the `onResponse`
 * lifecycle hook. Pure in-memory probe — never persisted, resets on restart.
 * The empty-traffic guard yields uptime 100 / all rates 0 (never NaN).
 */
export const ObservabilityRequestMetricsSchema = z.object({
  /** 100 * (total - 5xx) / total over the last 24h; 100 with no traffic. */
  uptime24hPct: z.number().min(0).max(100),
  /** Total responses recorded in the trailing 24h window. */
  totalRequests: z.number().int().min(0),
  /** Response counts grouped by status class. */
  byStatusClass: z.object({
    xx2: z.number().int().min(0),
    xx3: z.number().int().min(0),
    xx4: z.number().int().min(0),
    xx5: z.number().int().min(0),
  }),
  /** Percentage of in-window responses that were 5xx. */
  errorRate5xxPct: z.number().min(0).max(100),
  /** Percentage of in-window responses that were 4xx. */
  clientErrorRate4xxPct: z.number().min(0).max(100),
  /** Mean response duration (ms) across in-window responses. */
  avgDurationMs: z.number().min(0),
  /** Last (up to 20) non-2xx responses, oldest-first. */
  recentErrors: z.array(
    z.object({
      route: z.string(),
      status: z.number().int(),
    }),
  ),
});
export type ObservabilityRequestMetrics = z.infer<
  typeof ObservabilityRequestMetricsSchema
>;

/**
 * Full platform-wide system-health snapshot. Every field is backed by live data
 * (in-process counters + read-only DB reads); there are no fabricated values.
 */
export const SystemHealthResponseSchema = z.object({
  pool: ObservabilityPoolSchema,
  rbac: ObservabilityRbacSchema,
  tenantFleet: z.array(ObservabilityTenantFleetEntrySchema),
  authIntegrity: ObservabilityAuthIntegritySchema,
  schemaCounts: ObservabilitySchemaCountsSchema,
  auditFeed: z.array(ObservabilityAuditEventSchema),
  requestMetrics: ObservabilityRequestMetricsSchema,
  generatedAt: z.iso.datetime(),
});
export type SystemHealthResponse = z.infer<typeof SystemHealthResponseSchema>;
