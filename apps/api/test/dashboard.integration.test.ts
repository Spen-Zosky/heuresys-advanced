/**
 * apps/api/test/dashboard.integration.test.ts
 * Integration tests for GET /v1/dashboard/widgets (role-gated aggregator).
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { closePool } from "../src/db/client.js";

const PWD = "Admin#PassW0rd!";

interface S { cookies: Map<string, string> }
function ch(c: Map<string, string>) { return [...c.entries()].map(([n, v]) => `${n}=${v}`).join("; "); }
async function login(t: TestApp, email: string): Promise<S> {
  const r = await t.app.inject({ method: "POST", url: "/v1/auth/login", payload: { email, password: PWD } });
  if (r.statusCode !== 200) throw new Error(`login ${email}: ${r.statusCode}`);
  const cookies = new Map<string, string>();
  for (const c of r.cookies) cookies.set(c.name, c.value);
  return { cookies };
}

let suite: TestApp;
let platformS: S;
let tenantS: S;
let managerS: S;
let employeeS: S;

describe("GET /v1/dashboard/widgets integration", () => {
  beforeAll(async () => {
    suite = await buildTestApp();
    platformS = await login(suite, "admin@heuresys.com");
    tenantS = await login(suite, "tenant_admin_test@rtl-bank.test");
    managerS = await login(suite, "manager_test@rtl-bank.test");
    employeeS = await login(suite, "employee_test@rtl-bank.test");
  });

  afterAll(async () => {
    await suite.app.close();
    await closePool();
  });

  it("PLATFORM_ADMIN sees PLATFORM scope with tenants counter populated", async () => {
    const r = await suite.app.inject({
      method: "GET", url: "/v1/dashboard/widgets",
      headers: { cookie: ch(platformS.cookies) },
    });
    expect(r.statusCode).toBe(200);
    const body = r.json() as {
      role: string;
      scope: { kind: string; tenantId: string | null; teamPositionIds: string[] };
      counters: {
        tenants: number | null;
        users: number;
        positions: number;
        blueprints: number | null;
      };
      generatedAt: string;
    };
    expect(body.role).toBe("PLATFORM_ADMIN");
    expect(body.scope.kind).toBe("PLATFORM");
    expect(body.scope.tenantId).toBeNull();
    expect(body.counters.tenants).not.toBeNull();
    expect(body.counters.tenants!).toBeGreaterThanOrEqual(1);
    expect(body.counters.users).toBeGreaterThanOrEqual(5); // 5 test personas
    expect(body.counters.positions).toBeGreaterThanOrEqual(3); // TEST positions
    expect(body.counters.blueprints).not.toBeNull();
    expect(new Date(body.generatedAt).getTime()).toBeGreaterThan(0);
  });

  it("TENANT_ADMIN sees TENANT scope filtered to own tenant", async () => {
    const r = await suite.app.inject({
      method: "GET", url: "/v1/dashboard/widgets",
      headers: { cookie: ch(tenantS.cookies) },
    });
    expect(r.statusCode).toBe(200);
    const body = r.json() as {
      role: string;
      scope: { kind: string; tenantId: string | null };
      counters: { tenants: number | null; users: number; positions: number };
    };
    expect(body.role).toBe("TENANT_ADMIN");
    expect(body.scope.kind).toBe("TENANT");
    expect(body.scope.tenantId).not.toBeNull();
    // No cross-tenant tenants counter for non-platform.
    expect(body.counters.tenants).toBeNull();
    expect(body.counters.users).toBeGreaterThanOrEqual(4); // RTL personas
    expect(body.counters.positions).toBeGreaterThanOrEqual(1);
  });

  it("MANAGER sees TEAM scope with own owned position(s)", async () => {
    const r = await suite.app.inject({
      method: "GET", url: "/v1/dashboard/widgets",
      headers: { cookie: ch(managerS.cookies) },
    });
    expect(r.statusCode).toBe(200);
    const body = r.json() as {
      role: string;
      scope: { kind: string; teamPositionIds: string[] };
      counters: { users: number; positions: number };
    };
    expect(body.role).toBe("MANAGER");
    expect(body.scope.kind).toBe("TEAM");
    // manager_test owns TEST_MGR_POS (per seed-test-admin).
    expect(body.scope.teamPositionIds.length).toBeGreaterThanOrEqual(1);
    // positions count == owned positions count.
    expect(body.counters.positions).toBe(body.scope.teamPositionIds.length);
  });

  it("USER (employee) has no dashboard:view permission → 403", async () => {
    const r = await suite.app.inject({
      method: "GET", url: "/v1/dashboard/widgets",
      headers: { cookie: ch(employeeS.cookies) },
    });
    expect(r.statusCode).toBe(403);
    expect((r.json() as { error: { code: string } }).error.code).toBe("FORBIDDEN");
  });

  it("unauthenticated → 401", async () => {
    const r = await suite.app.inject({
      method: "GET", url: "/v1/dashboard/widgets",
    });
    expect(r.statusCode).toBe(401);
  });
});
