import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildTestApp } from "./helpers/build-test-app.js";
import {
  enablePrometheus,
  observeHttp,
  recordAuthEvent,
  registry,
} from "../src/modules/observability/prometheus.js";

/**
 * D-09 — /metrics Prometheus endpoint.
 * Prod-safe contract: OFF by default (404), loopback-only, standard text format
 * once enabled. The endpoint is not under /v1 and carries no auth.
 */
describe("D-09 observability /metrics (Prometheus)", () => {
  let app: FastifyInstance;
  beforeAll(async () => {
    app = (await buildTestApp()).app;
  });
  afterAll(async () => {
    await app.close();
  });

  it("GET /metrics -> 404 when PROM_METRICS_ENABLED is off (prod-safe default)", async () => {
    const res = await app.inject({ method: "GET", url: "/metrics", remoteAddress: "127.0.0.1" });
    expect(res.statusCode).toBe(404);
  });

  it("GET /metrics -> 404 for a non-loopback peer (never publicly observable)", async () => {
    const res = await app.inject({ method: "GET", url: "/metrics", remoteAddress: "203.0.113.7" });
    expect(res.statusCode).toBe(404);
  });

  it("the registry emits the metric families in Prometheus text format once enabled", async () => {
    enablePrometheus();
    observeHttp("GET", "/v1/users/:userId", 200, 42);
    recordAuthEvent("LOGIN_SUCCESS");

    const text = await registry.metrics();
    expect(text).toContain("http_request_duration_seconds");
    expect(text).toContain("auth_events_total");
    // default process metrics present (event-loop lag / cpu / heap)
    expect(text).toMatch(/process_cpu_seconds_total|nodejs_eventloop_lag_seconds/);
    // route label carries the PATTERN, never a concrete id (bounded cardinality)
    expect(text).toContain('route="/v1/users/:userId"');
  });

  it("observeHttp / recordAuthEvent never throw on odd input", () => {
    expect(() => observeHttp("GET", "/x", 200, -5)).not.toThrow();
    expect(() => recordAuthEvent("WHATEVER")).not.toThrow();
  });
});
