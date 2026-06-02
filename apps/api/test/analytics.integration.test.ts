/**
 * apps/api/test/analytics.integration.test.ts
 * Integration tests for the BI analytics Phase 1 endpoints (role-gated):
 *   GET /v1/analytics/workforce — headcount distribution
 *   GET /v1/analytics/kpi       — KPI achievement rollup
 *
 * Hits the live OCI VM DB through the tunnel (no mocks). The aggregate numbers
 * (headcount 161, kpi targets 248) are pinned against the live seed (S958).
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { closePool } from "../src/db/client.js";

const PWD = "Admin#PassW0rd!";

interface S {
  cookies: Map<string, string>;
}
function ch(c: Map<string, string>) {
  return [...c.entries()].map(([n, v]) => `${n}=${v}`).join("; ");
}
async function login(t: TestApp, email: string): Promise<S> {
  const r = await t.app.inject({
    method: "POST",
    url: "/v1/auth/login",
    payload: { email, password: PWD },
  });
  if (r.statusCode !== 200) throw new Error(`login ${email}: ${r.statusCode}`);
  const cookies = new Map<string, string>();
  for (const c of r.cookies) cookies.set(c.name, c.value);
  return { cookies };
}

let suite: TestApp;
let platformS: S;
let tenantS: S;
let employeeS: S;

describe("GET /v1/analytics/workforce + /v1/analytics/kpi integration", () => {
  beforeAll(async () => {
    suite = await buildTestApp();
    platformS = await login(suite, "admin@heuresys.com");
    tenantS = await login(suite, "federica.marchetti@rtl-bank.org");
    employeeS = await login(suite, "tommaso.fiore@rtl-bank.org");
  });

  afterAll(async () => {
    await suite.app.close();
    await closePool();
  });

  it("workforce: unauthenticated → 401", async () => {
    const r = await suite.app.inject({ method: "GET", url: "/v1/analytics/workforce" });
    expect(r.statusCode).toBe(401);
  });

  it("workforce: USER (employee) lacks analytics:view → 403", async () => {
    const r = await suite.app.inject({
      method: "GET",
      url: "/v1/analytics/workforce",
      headers: { cookie: ch(employeeS.cookies) },
    });
    expect(r.statusCode).toBe(403);
    expect((r.json() as { error: { code: string } }).error.code).toBe("FORBIDDEN");
  });

  it("workforce: PLATFORM_ADMIN sees full headcount (161)", async () => {
    const r = await suite.app.inject({
      method: "GET",
      url: "/v1/analytics/workforce",
      headers: { cookie: ch(platformS.cookies) },
    });
    expect(r.statusCode).toBe(200);
    const body = r.json() as {
      scope: { kind: string; tenantId: string | null };
      totalHeadcount: number;
      byOrgUnit: Array<{ dimension: string; headcount: number }>;
      byJobRole: Array<{ dimension: string; headcount: number }>;
      generatedAt: string;
    };
    expect(body.scope.kind).toBe("PLATFORM");
    expect(body.scope.tenantId).toBeNull();
    expect(body.totalHeadcount).toBe(161);
    expect(body.byOrgUnit.length).toBeGreaterThan(0);
    expect(body.byJobRole.length).toBeGreaterThan(0);
    // The OU rollup must sum to the total (one primary active assignment per user).
    const ouSum = body.byOrgUnit.reduce((acc, r2) => acc + r2.headcount, 0);
    expect(ouSum).toBe(161);
    expect(new Date(body.generatedAt).getTime()).toBeGreaterThan(0);
  });

  it("workforce: TENANT_ADMIN sees TENANT scope filtered to own tenant", async () => {
    const r = await suite.app.inject({
      method: "GET",
      url: "/v1/analytics/workforce",
      headers: { cookie: ch(tenantS.cookies) },
    });
    expect(r.statusCode).toBe(200);
    const body = r.json() as {
      scope: { kind: string; tenantId: string | null };
      totalHeadcount: number;
    };
    expect(body.scope.kind).toBe("TENANT");
    expect(body.scope.tenantId).not.toBeNull();
    // Own-tenant headcount is a strict subset of the platform total.
    expect(body.totalHeadcount).toBeGreaterThan(0);
    expect(body.totalHeadcount).toBeLessThanOrEqual(161);
  });

  it("kpi: PLATFORM_ADMIN sees the kpi rollup (248 targets)", async () => {
    const r = await suite.app.inject({
      method: "GET",
      url: "/v1/analytics/kpi",
      headers: { cookie: ch(platformS.cookies) },
    });
    expect(r.statusCode).toBe(200);
    const body = r.json() as {
      scope: { kind: string; tenantId: string | null };
      totalTargets: number;
      distinctKpis: number;
      byKpi: Array<{
        kpiCode: string;
        kpiName: string;
        targetsCount: number;
        avgAchievementPct: number | null;
      }>;
    };
    expect(body.scope.kind).toBe("PLATFORM");
    expect(body.totalTargets).toBe(248);
    expect(body.distinctKpis).toBeGreaterThan(0);
    expect(body.byKpi.length).toBeGreaterThan(0);
    // targetsCount across distinct KPIs sums to the total.
    const cntSum = body.byKpi.reduce((acc, k) => acc + k.targetsCount, 0);
    expect(cntSum).toBe(248);
  });

  it("kpi: USER (employee) lacks analytics:view → 403", async () => {
    const r = await suite.app.inject({
      method: "GET",
      url: "/v1/analytics/kpi",
      headers: { cookie: ch(employeeS.cookies) },
    });
    expect(r.statusCode).toBe(403);
  });
});
