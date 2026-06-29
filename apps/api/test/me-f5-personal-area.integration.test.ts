/**
 * apps/api/test/me-f5-personal-area.integration.test.ts
 * S1011 F5 — Personal area completion endpoints:
 *   GET /v1/me/analytics  (user_profile:read:self) — attendance trend + summary KPIs
 *   GET /v1/me/approvals  (approval:read:self, mig 000168) — own approval requests (track-only)
 * (F5.2 org-chart is page-only, reusing /v1/visualization-graphs + /v1/me/positions.)
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { closePool } from "../src/db/client.js";
import type { MeAnalyticsResponse, MeApprovalsResponse } from "@heuresys/shared";

const PWD = "Admin#PassW0rd!";
async function cookie(t: TestApp, email: string): Promise<string> {
  const r = await loginRaw(t.app, email, PWD);
  return r.cookies.map((c) => `${c.name}=${c.value}`).join("; ");
}
function get(t: TestApp, c: string, url: string) {
  return t.app.inject({ method: "GET", url, headers: { cookie: c } });
}

let suite: TestApp;
let employee: string; // tommaso.fiore — real attendance + goals

describe("/v1/me/{analytics,approvals} — F5 personal area", () => {
  beforeAll(async () => {
    suite = await buildTestApp();
    employee = await cookie(suite, "tommaso.fiore@rtl-bank.org");
  });
  afterAll(async () => { await suite.app.close(); await closePool(); });

  it("GET /v1/me/analytics returns the caller's attendance trend + summary (real data)", async () => {
    const r = await get(suite, employee, "/v1/me/analytics");
    expect(r.statusCode).toBe(200);
    const body = r.json() as MeAnalyticsResponse;
    expect(Array.isArray(body.attendanceTrend)).toBe(true);
    expect(body.attendanceTrend.length).toBeGreaterThan(0); // tommaso has attendance
    expect(body.attendanceTrend[0]).toHaveProperty("month");
    expect(body.attendanceTrend[0]).toHaveProperty("regularHours");
    expect(body.summary.goalsCount).toBeGreaterThanOrEqual(0);
    expect(typeof body.summary.skillsCount).toBe("number");
  });

  it("GET /v1/me/approvals returns the caller's own requests (track-only) with status buckets", async () => {
    const r = await get(suite, employee, "/v1/me/approvals");
    expect(r.statusCode).toBe(200);
    const body = r.json() as MeApprovalsResponse;
    expect(body.total).toBe(body.items.length);
    expect(body.byStatus).toHaveProperty("pending");
    expect(body.byStatus).toHaveProperty("approved");
    expect(body.byStatus).toHaveProperty("rejected");
    expect(body.byStatus.pending + body.byStatus.approved + body.byStatus.rejected).toBe(body.total);
  });

  it("rejects unauthenticated access to both", async () => {
    expect([401, 403]).toContain((await suite.app.inject({ method: "GET", url: "/v1/me/analytics" })).statusCode);
    expect([401, 403]).toContain((await suite.app.inject({ method: "GET", url: "/v1/me/approvals" })).statusCode);
  });
});
