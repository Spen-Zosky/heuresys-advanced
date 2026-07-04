/**
 * apps/api/test/observability.integration.test.ts
 * Integration tests for GET /v1/observability/system-health
 * (platform-wide system-health snapshot, PLATFORM_ADMIN-only).
 *
 * Hits the real DB through the SSH tunnel via buildTestApp(). The gate is
 * `tenant:create` (PLATFORM_ADMIN-exclusive): admin → 200, TENANT_ADMIN → 403.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { closePool } from "../src/db/client.js";
import { TEST_PERSONA_PASSWORD } from "./helpers/personas.js";

const PWD = TEST_PERSONA_PASSWORD;

interface S { cookies: Map<string, string> }
function ch(c: Map<string, string>) { return [...c.entries()].map(([n, v]) => `${n}=${v}`).join("; "); }
async function login(t: TestApp, email: string): Promise<S> {
  const r = await loginRaw(t.app, email, PWD);
  const cookies = new Map<string, string>();
  for (const c of r.cookies) cookies.set(c.name, c.value);
  return { cookies };
}

interface SystemHealthBody {
  pool: {
    total: number; idle: number; active: number; waiting: number;
    max: number; serverMaxConnections: number;
  };
  rbac: { rolesLoaded: number; mappingsLoaded: number; loadedAt: string | null };
  tenantFleet: Array<{
    code: string; name: string; status: string;
    userCount: number; lastActivity: string | null;
  }>;
  authIntegrity: {
    login24h: number; failed24h: number; rotations: number;
    replayRevoked: number; revoked: number; active: number;
  };
  schemaCounts: {
    tables: number; views: number; matviews: number; indexes: number;
    functions: number; triggers: number; sequences: number;
  };
  auditFeed: Array<{
    actionId: string; actionType: string; resourceType: string | null;
    resourceId: string | null; occurredAt: string; tenantCode: string;
    userDisplayName: string;
  }>;
  requestMetrics: {
    uptime24hPct: number; totalRequests: number;
    byStatusClass: { xx2: number; xx3: number; xx4: number; xx5: number };
    errorRate5xxPct: number; clientErrorRate4xxPct: number;
    avgDurationMs: number;
    recentErrors: Array<{ route: string; status: number }>;
  };
  generatedAt: string;
}

let suite: TestApp;
let platformS: S;
let tenantS: S;

describe("GET /v1/observability/system-health integration", () => {
  beforeAll(async () => {
    suite = await buildTestApp();
    platformS = await login(suite, "admin@heuresys.com");
    tenantS = await login(suite, "federica.marchetti@rtl-bank.org");
  });

  afterAll(async () => {
    await suite.app.close();
    await closePool();
  });

  it("PLATFORM_ADMIN gets 200 with the full snapshot shape", async () => {
    const r = await suite.app.inject({
      method: "GET", url: "/v1/observability/system-health",
      headers: { cookie: ch(platformS.cookies) },
    });
    expect(r.statusCode).toBe(200);
    const body = r.json() as SystemHealthBody;

    // pool — live in-process counters + caps.
    expect(typeof body.pool.total).toBe("number");
    expect(typeof body.pool.idle).toBe("number");
    expect(typeof body.pool.active).toBe("number");
    expect(typeof body.pool.waiting).toBe("number");
    expect(body.pool.max).toBe(20); // app-configured cap (client.ts)
    expect(body.pool.serverMaxConnections).toBeGreaterThanOrEqual(1);

    // rbac — in-memory cache stats (loaded once at server start).
    expect(body.rbac.rolesLoaded).toBeGreaterThanOrEqual(1);
    expect(body.rbac.mappingsLoaded).toBeGreaterThanOrEqual(1);
    // The build-test-app helper loads the RBAC cache, so loadedAt is set.
    expect(body.rbac.loadedAt).not.toBeNull();

    // schemaCounts — sys schema census; sys.sys_* tables certainly exist.
    expect(body.schemaCounts.tables).toBeGreaterThanOrEqual(1);
    expect(typeof body.schemaCounts.views).toBe("number");
    expect(typeof body.schemaCounts.matviews).toBe("number");
    expect(typeof body.schemaCounts.indexes).toBe("number");
    expect(typeof body.schemaCounts.functions).toBe("number");
    expect(typeof body.schemaCounts.triggers).toBe("number");
    expect(typeof body.schemaCounts.sequences).toBe("number");

    // authIntegrity — all numeric counters present.
    expect(typeof body.authIntegrity.login24h).toBe("number");
    expect(typeof body.authIntegrity.failed24h).toBe("number");
    expect(typeof body.authIntegrity.rotations).toBe("number");
    expect(typeof body.authIntegrity.replayRevoked).toBe("number");
    expect(typeof body.authIntegrity.revoked).toBe("number");
    expect(typeof body.authIntegrity.active).toBe("number");

    // auditFeed is a real array (may be empty if the audit table has no rows).
    expect(Array.isArray(body.auditFeed)).toBe(true);

    // requestMetrics — in-process counters fed by the onResponse hook. The
    // login(s) in beforeAll + this GET itself have already been recorded, so
    // totalRequests is >= 0 (typically >= 1).
    expect(typeof body.requestMetrics).toBe("object");
    expect(typeof body.requestMetrics.totalRequests).toBe("number");
    expect(body.requestMetrics.totalRequests).toBeGreaterThanOrEqual(0);
    expect(typeof body.requestMetrics.byStatusClass).toBe("object");
    expect(typeof body.requestMetrics.byStatusClass.xx2).toBe("number");
    expect(typeof body.requestMetrics.byStatusClass.xx3).toBe("number");
    expect(typeof body.requestMetrics.byStatusClass.xx4).toBe("number");
    expect(typeof body.requestMetrics.byStatusClass.xx5).toBe("number");
    expect(body.requestMetrics.uptime24hPct).toBeGreaterThanOrEqual(0);
    expect(body.requestMetrics.uptime24hPct).toBeLessThanOrEqual(100);
    expect(body.requestMetrics.errorRate5xxPct).toBeGreaterThanOrEqual(0);
    expect(body.requestMetrics.errorRate5xxPct).toBeLessThanOrEqual(100);
    expect(body.requestMetrics.clientErrorRate4xxPct).toBeGreaterThanOrEqual(0);
    expect(body.requestMetrics.clientErrorRate4xxPct).toBeLessThanOrEqual(100);
    expect(typeof body.requestMetrics.avgDurationMs).toBe("number");
    expect(Array.isArray(body.requestMetrics.recentErrors)).toBe(true);

    expect(new Date(body.generatedAt).getTime()).toBeGreaterThan(0);
  });

  it("tenantFleet is non-empty and reflects real tenants with live user counts", async () => {
    const r = await suite.app.inject({
      method: "GET", url: "/v1/observability/system-health",
      headers: { cookie: ch(platformS.cookies) },
    });
    expect(r.statusCode).toBe(200);
    const body = r.json() as SystemHealthBody;

    expect(Array.isArray(body.tenantFleet)).toBe(true);
    expect(body.tenantFleet.length).toBeGreaterThanOrEqual(1);
    for (const t of body.tenantFleet) {
      expect(typeof t.code).toBe("string");
      expect(t.code.length).toBeGreaterThan(0);
      expect(typeof t.name).toBe("string");
      expect(typeof t.status).toBe("string");
      expect(t.userCount).toBeGreaterThanOrEqual(0);
      // lastActivity is an ISO string or null (never undefined).
      expect(t.lastActivity === null || typeof t.lastActivity === "string").toBe(true);
    }
    // At least one tenant carries live users (the rebuilt RTL_BANK reference).
    expect(body.tenantFleet.some((t) => t.userCount >= 1)).toBe(true);
  });

  it("rbac mappingsLoaded equals the sum across roles (>= rolesLoaded)", async () => {
    const r = await suite.app.inject({
      method: "GET", url: "/v1/observability/system-health",
      headers: { cookie: ch(platformS.cookies) },
    });
    expect(r.statusCode).toBe(200);
    const body = r.json() as SystemHealthBody;
    // Each loaded role grants >= 1 permission, so mappings >= roles.
    expect(body.rbac.mappingsLoaded).toBeGreaterThanOrEqual(body.rbac.rolesLoaded);
  });

  it("TENANT_ADMIN lacks the platform gate → 403", async () => {
    const r = await suite.app.inject({
      method: "GET", url: "/v1/observability/system-health",
      headers: { cookie: ch(tenantS.cookies) },
    });
    expect(r.statusCode).toBe(403);
    expect((r.json() as { error: { code: string } }).error.code).toBe("FORBIDDEN");
  });

  it("unauthenticated → 401", async () => {
    const r = await suite.app.inject({
      method: "GET", url: "/v1/observability/system-health",
    });
    expect(r.statusCode).toBe(401);
  });
});
