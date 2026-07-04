/**
 * apps/api/test/me-permissions.integration.test.ts
 * GET /v1/me/permissions — reflects the caller's OWN flattened RBAC permission
 * codes (D4 RBAC->UI port; drives the web sidebar). Authenticated-only.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { TEST_PERSONA_PASSWORD } from "./helpers/personas.js";

const PWD = TEST_PERSONA_PASSWORD;
function ch(c: Map<string, string>) {
  return [...c.entries()].map(([n, v]) => `${n}=${v}`).join("; ");
}
async function login(t: TestApp, email: string): Promise<Map<string, string>> {
  const r = await loginRaw(t.app, email, PWD);
  const cookies = new Map<string, string>();
  for (const c of r.cookies) cookies.set(c.name, c.value);
  return cookies;
}

let suite: TestApp;
let adminC: Map<string, string>;
let employeeC: Map<string, string>;

describe("/v1/me/permissions", () => {
  beforeAll(async () => {
    suite = await buildTestApp();
    adminC = await login(suite, "admin@heuresys.com");
    employeeC = await login(suite, "tommaso.fiore@rtl-bank.org");
  });
  // Do NOT closePool here — the shared pool is owned by the wider suite.
  afterAll(async () => { await suite.app.close(); });

  it("returns the caller's flattened, sorted, deduped roles + permissions (PLATFORM_ADMIN)", async () => {
    const r = await suite.app.inject({ method: "GET", url: "/v1/me/permissions", headers: { cookie: ch(adminC) } });
    expect(r.statusCode).toBe(200);
    const b = r.json() as { roles: string[]; permissions: string[] };
    expect(b.roles).toContain("PLATFORM_ADMIN");
    expect(Array.isArray(b.permissions)).toBe(true);
    expect(b.permissions).toContain("tenant:read");
    expect(b.permissions).toContain("user:read");
    expect(b.permissions.length).toBeGreaterThan(50);
    expect([...b.permissions].sort()).toEqual(b.permissions);          // sorted
    expect(new Set(b.permissions).size).toBe(b.permissions.length);     // deduped
  });

  it("a USER persona gets self-scoped grants and a strictly narrower set than an admin", async () => {
    // NOTE: in the current v5 seed the USER role holds broad :read grants (tenant/user/position/
    // org/skill/blueprint/... — 12 non-self reads + self perms = 35). So we assert the self grants
    // and that the set is materially smaller than PLATFORM_ADMIN (99), NOT the absence of :read.
    const r = await suite.app.inject({ method: "GET", url: "/v1/me/permissions", headers: { cookie: ch(employeeC) } });
    expect(r.statusCode).toBe(200);
    const b = r.json() as { roles: string[]; permissions: string[] };
    expect(b.roles).toContain("USER");
    expect(b.permissions).toContain("assessment:read:self");   // self-service grants present
    expect(b.permissions.length).toBeGreaterThan(0);
    expect(b.permissions.length).toBeLessThan(50);              // narrower than PLATFORM_ADMIN (99)
  });

  it("unauthenticated → 401", async () => {
    const r = await suite.app.inject({ method: "GET", url: "/v1/me/permissions" });
    expect(r.statusCode).toBe(401);
  });
});
