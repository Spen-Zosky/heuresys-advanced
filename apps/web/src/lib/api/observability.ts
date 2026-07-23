/**
 * apps/web/src/lib/api/observability.ts
 *
 * TanStack Query hooks for the platform observability surface (PLATFORM_ADMIN).
 *   useSystemHealth()    — GET /v1/observability/system-health (live snapshot:
 *                          pg.Pool counters, RBAC cache, tenant fleet, auth
 *                          integrity, sys-schema census, audit feed, 24h request
 *                          metrics). Service comment: "All data is live; nothing
 *                          is fabricated."
 *   useRolePermissions() — GET /v1/auth/role-permissions (flat role×permission map).
 *
 * Both endpoints already exist and are integration-tested; these hooks are the
 * frontend wiring that replaces the former hardcoded /system-health mock (F7).
 */

import { useQuery } from "@tanstack/react-query";
import type { SystemHealthResponse, RolePermissionsResponse } from "@heuresys/shared";
import { apiFetch } from "./fetch";

export type { SystemHealthResponse, RolePermissionsResponse } from "@heuresys/shared";

export const SYSTEM_HEALTH_QUERY_KEY = ["observability", "system-health"] as const;

export function useSystemHealth() {
  return useQuery({
    queryKey: SYSTEM_HEALTH_QUERY_KEY,
    queryFn: ({ signal }) =>
      apiFetch<SystemHealthResponse>("/v1/observability/system-health", { signal }),
    staleTime: 15_000,
    retry: 0,
  });
}

export const ROLE_PERMISSIONS_QUERY_KEY = ["auth", "role-permissions"] as const;

export function useRolePermissions() {
  return useQuery({
    queryKey: ROLE_PERMISSIONS_QUERY_KEY,
    queryFn: ({ signal }) =>
      apiFetch<RolePermissionsResponse>("/v1/auth/role-permissions", { signal }),
    staleTime: 60_000,
    retry: 0,
  });
}

/* --- #35 B7 (S1028): slow queries + request time-series -------------------- */

export type { SlowQueriesResponse, RequestSeriesResponse } from "@heuresys/shared";
import type { SlowQueriesResponse, RequestSeriesResponse } from "@heuresys/shared";

export const SLOW_QUERIES_QUERY_KEY = ["observability", "slow-queries"] as const;

/** GET /v1/observability/slow-queries — live pg_stat_statements top-N. */
export function useSlowQueries(limit = 10) {
  return useQuery({
    queryKey: [...SLOW_QUERIES_QUERY_KEY, limit],
    queryFn: ({ signal }) =>
      apiFetch<SlowQueriesResponse>(`/v1/observability/slow-queries?limit=${limit}`, { signal }),
    staleTime: 30_000,
    retry: 0,
  });
}

export const REQUEST_SERIES_QUERY_KEY = ["observability", "request-series"] as const;

/** GET /v1/observability/request-series — in-RAM 24h ring, sparkline-ready. */
export function useRequestSeries(windowMinutes = 180, stepMinutes = 5) {
  return useQuery({
    queryKey: [...REQUEST_SERIES_QUERY_KEY, windowMinutes, stepMinutes],
    queryFn: ({ signal }) =>
      apiFetch<RequestSeriesResponse>(
        `/v1/observability/request-series?windowMinutes=${windowMinutes}&stepMinutes=${stepMinutes}`,
        { signal },
      ),
    staleTime: 30_000,
    retry: 0,
  });
}
