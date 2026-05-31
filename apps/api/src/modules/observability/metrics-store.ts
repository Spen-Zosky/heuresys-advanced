/**
 * apps/api/src/modules/observability/metrics-store.ts
 * In-process request-metrics store. Phase-2 observability cross-cut.
 *
 * Pure in-memory, no DB, never throws. Fed by the `onResponse` lifecycle hook
 * in app.ts (one record() per completed response) and read by the observability
 * service's system-health aggregator (aggregate() + recentErrors()).
 *
 * The store is a fixed ring of 1440 minute-buckets (24h). The current
 * epoch-minute is derived from the runtime ms clock (floor(Date.now()/60000));
 * a bucket whose stored minute is stale is reset before it is updated, so the
 * ring is self-pruning without a timer. Standard Node runtime (Date, Math) is
 * available here — this is ordinary application source, not a workflow script.
 */

/** Minutes retained in the ring (24h). */
const RING_SIZE = 1440;

/** Max recent non-2xx entries kept for the error feed. */
const RECENT_ERRORS_SIZE = 20;

/** One minute-bucket of request counters. */
interface MinuteBucket {
  /** Epoch-minute this bucket currently represents (floor(ms/60000)). */
  minute: number;
  total: number;
  c2xx: number;
  c3xx: number;
  c4xx: number;
  c5xx: number;
  sumDurationMs: number;
}

/** One recent non-2xx response, for the error feed. */
export interface RecentError {
  route: string;
  status: number;
  minute: number;
}

/** Aggregated request metrics over a trailing window. */
export interface RequestMetricsAggregate {
  /** 100 * (total - c5xx) / total, or 100 when there is no traffic. */
  uptimePct: number;
  totalRequests: number;
  byStatusClass: { xx2: number; xx3: number; xx4: number; xx5: number };
  errorRate5xxPct: number;
  clientErrorRate4xxPct: number;
  avgDurationMs: number;
}

function emptyBucket(minute: number): MinuteBucket {
  return {
    minute,
    total: 0,
    c2xx: 0,
    c3xx: 0,
    c4xx: 0,
    c5xx: 0,
    sumDurationMs: 0,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

class RequestMetricsStore {
  private readonly ring: MinuteBucket[];
  private readonly recent: RecentError[] = [];

  constructor() {
    // Seed every slot with an impossible minute (-1) so the first real
    // record() into any slot resets it cleanly.
    this.ring = new Array<MinuteBucket>(RING_SIZE);
    for (let i = 0; i < RING_SIZE; i++) {
      this.ring[i] = emptyBucket(-1);
    }
  }

  /** Current epoch-minute from the runtime ms clock. */
  private static currentMinute(): number {
    return Math.floor(Date.now() / 60000);
  }

  /**
   * Record one completed response into the CURRENT minute bucket. If the ring
   * slot holds an older minute it is reset first (self-pruning). Never throws.
   */
  record(statusCode: number, durationMs: number, route: string): void {
    const minute = RequestMetricsStore.currentMinute();
    const slot = minute % RING_SIZE;
    // `slot` is always a valid index (0..RING_SIZE-1); narrow for strict mode.
    let bucket = this.ring[slot];
    if (bucket === undefined || bucket.minute !== minute) {
      bucket = emptyBucket(minute);
      this.ring[slot] = bucket;
    }

    const dur =
      typeof durationMs === "number" && Number.isFinite(durationMs) && durationMs >= 0
        ? durationMs
        : 0;

    bucket.total += 1;
    bucket.sumDurationMs += dur;
    if (statusCode >= 500) bucket.c5xx += 1;
    else if (statusCode >= 400) bucket.c4xx += 1;
    else if (statusCode >= 300) bucket.c3xx += 1;
    else if (statusCode >= 200) bucket.c2xx += 1;

    if (statusCode >= 300) {
      this.recent.push({ route, status: statusCode, minute });
      if (this.recent.length > RECENT_ERRORS_SIZE) {
        this.recent.shift();
      }
    }
  }

  /**
   * Aggregate the trailing `windowMinutes` buckets (default 24h). Empty-traffic
   * guard: when no requests are in-window, uptime is 100 and all rates are 0.
   */
  aggregate(windowMinutes: number = RING_SIZE): RequestMetricsAggregate {
    const window = Math.max(1, Math.min(windowMinutes, RING_SIZE));
    const cutoff = RequestMetricsStore.currentMinute() - window + 1;

    let total = 0;
    let c2xx = 0;
    let c3xx = 0;
    let c4xx = 0;
    let c5xx = 0;
    let sumDurationMs = 0;

    for (let i = 0; i < RING_SIZE; i++) {
      const bucket = this.ring[i];
      if (bucket === undefined || bucket.minute < cutoff || bucket.minute < 0) {
        continue;
      }
      total += bucket.total;
      c2xx += bucket.c2xx;
      c3xx += bucket.c3xx;
      c4xx += bucket.c4xx;
      c5xx += bucket.c5xx;
      sumDurationMs += bucket.sumDurationMs;
    }

    if (total === 0) {
      return {
        uptimePct: 100,
        totalRequests: 0,
        byStatusClass: { xx2: 0, xx3: 0, xx4: 0, xx5: 0 },
        errorRate5xxPct: 0,
        clientErrorRate4xxPct: 0,
        avgDurationMs: 0,
      };
    }

    return {
      uptimePct: round2((100 * (total - c5xx)) / total),
      totalRequests: total,
      byStatusClass: { xx2: c2xx, xx3: c3xx, xx4: c4xx, xx5: c5xx },
      errorRate5xxPct: round2((100 * c5xx) / total),
      clientErrorRate4xxPct: round2((100 * c4xx) / total),
      avgDurationMs: round2(sumDurationMs / total),
    };
  }

  /** Last (up to 20) non-2xx responses, oldest-first. Returns a copy. */
  recentErrors(): RecentError[] {
    return this.recent.map((e) => ({ ...e }));
  }
}

/** Singleton store shared by the onResponse hook and the observability service. */
export const metricsStore = new RequestMetricsStore();
