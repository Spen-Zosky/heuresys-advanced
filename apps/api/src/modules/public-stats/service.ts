/**
 * apps/api/src/modules/public-stats/service.ts — public stats with a short
 * in-process TTL cache (the endpoint is public; stale-by-≤5-min is fine).
 */
import type { PlatformStatsResponse } from "@heuresys/shared";
import * as repo from "./repository.js";

const TTL_MS = 5 * 60 * 1000;
let cache: { at: number; data: PlatformStatsResponse } | null = null;

export const publicStatsService = {
  async get(): Promise<PlatformStatsResponse> {
    const now = Date.now();
    if (cache && now - cache.at < TTL_MS) return cache.data;
    const data = await repo.fetchStats();
    cache = { at: now, data };
    return data;
  },
  /** test seam */
  _reset() { cache = null; },
};
