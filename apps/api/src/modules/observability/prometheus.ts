/**
 * apps/api/src/modules/observability/prometheus.ts
 * D-09 — Prometheus registry: HTTP request histogram (route-labeled, real
 * p50/p95/p99), default process metrics (event-loop lag, heap, GC, fd), and an
 * auth-event counter. ADDITIVE to the in-RAM metrics-store (which still powers
 * the admin `/v1/observability/system-health` view) — this adds the standard
 * scrapable text format the ring buffer never had.
 *
 * PROD-SAFE: everything is a no-op until `enablePrometheus()` is called (only
 * when env.PROM_METRICS_ENABLED=true). OFF = zero timers, zero collection, zero
 * exposure. The `/metrics` text endpoint (registered in app.ts) is additionally
 * loopback-only + 404 when disabled. Metrics must never break a response, so
 * every recording path is guarded.
 */
import { Registry, Histogram, Counter, collectDefaultMetrics } from "prom-client";

export const registry = new Registry();
registry.setDefaultLabels({ app: "heuresys-api" });

export const httpRequestDuration = new Histogram({
  name: "http_request_duration_seconds",
  help: "HTTP request duration in seconds by method, route pattern and status",
  labelNames: ["method", "route", "status"] as const,
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  registers: [registry],
});

export const authEventCounter = new Counter({
  name: "auth_events_total",
  help: "Authentication events by type (LOGIN_SUCCESS, LOGIN_FAILURE, MFA_FAIL, REFRESH, ...)",
  labelNames: ["type"] as const,
  registers: [registry],
});

/**
 * #4 W4 — trappole anti-bot scattate, per superficie pubblica.
 *
 * Perché un contatore e non un log: la trappola scatta di continuo su un sito
 * esposto, e il valore informativo non è il singolo evento ma l'ANDAMENTO — un
 * picco dice che qualcuno sta insistendo. Un log per ogni tentativo produrrebbe
 * rumore che nessuno rilegge, e un evento senza serie storica non si sa se sia
 * normale o anomalo.
 *
 * La risposta al bot resta identica (accettata e non memorizzata): l'osservabilità
 * è per noi, non per lui.
 */
export const honeypotTripCounter = new Counter({
  name: "honeypot_trips_total",
  help: "Anti-bot honeypot trips on public forms, by surface (leads, whistleblowing)",
  labelNames: ["surface"] as const,
  registers: [registry],
});

let enabled = false;

/** Idempotent. Turns collection ON (default process metrics + our custom ones). */
export function enablePrometheus(): void {
  if (enabled) return;
  collectDefaultMetrics({ register: registry });
  enabled = true;
}

/** True once enablePrometheus() ran (env.PROM_METRICS_ENABLED). */
export function isPrometheusEnabled(): boolean {
  return enabled;
}

/**
 * Record one HTTP response. `route` MUST be the route PATTERN (e.g.
 * /v1/users/:userId), never the concrete URL, to bound label cardinality.
 * No-op when disabled; never throws.
 */
export function observeHttp(method: string, route: string, status: number, elapsedMs: number): void {
  if (!enabled) return;
  try {
    httpRequestDuration.observe(
      { method, route, status: String(status) },
      Math.max(elapsedMs, 0) / 1000,
    );
  } catch {
    /* metrics must never break the response */
  }
}

/** Registra una trappola scattata. No-op se le metriche sono spente; non lancia mai. */
export function recordHoneypotTrip(surface: string): void {
  if (!enabled) return;
  try {
    honeypotTripCounter.inc({ surface });
  } catch {
    /* never throw */
  }
}

/** Increment the auth-event counter for the given event type. No-op when disabled; never throws. */
export function recordAuthEvent(type: string): void {
  if (!enabled) return;
  try {
    authEventCounter.inc({ type });
  } catch {
    /* never throw */
  }
}
