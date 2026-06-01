/**
 * apps/api/test/brownfield-table-mappings.integration.test.ts
 *
 * Module: brownfield-table-mappings — /v1/brownfield-table-mappings/*
 *   GET  /        → requirePermission("brownfield_adaptation:read")
 *   GET  /:id     → requirePermission("brownfield_adaptation:read")
 *   PATCH /:id    → [app.verifyCsrf, requirePermission("brownfield_adaptation:approve")]
 *                   + service-level PLATFORM_ADMIN gate
 *
 * No create endpoint exists (rows are produced by the ingestion pipeline), so
 * there is no create-then-readback happy path and nothing to clean up. Tests
 * assert only on deterministic things: HTTP status, typed error codes, and the
 * response body STRUCTURE of the list view.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { closePool } from "../src/db/client.js";

const PWD = "Admin#PassW0rd!";

interface S { cookies: Map<string, string>; csrfToken: string }
function ch(c: Map<string, string>) { return [...c.entries()].map(([n, v]) => `${n}=${v}`).join("; "); }
async function login(t: TestApp, email: string): Promise<S> {
  const r = await t.app.inject({ method: "POST", url: "/v1/auth/login", payload: { email, password: PWD } });
  if (r.statusCode !== 200) throw new Error(`login: ${r.statusCode}`);
  const cookies = new Map<string, string>();
  for (const c of r.cookies) cookies.set(c.name, c.value);
  return { cookies, csrfToken: (r.json() as { csrfToken: string }).csrfToken };
}

const BASE = "/v1/brownfield-table-mappings";

let suite: TestApp;
let platformS: S; // admin@heuresys.com — PLATFORM_ADMIN (has read + approve)
let tenantS: S;   // federica.marchetti@rtl-bank.org — TENANT_ADMIN (has read, LACKS approve)
let userS: S;     // tommaso.fiore@rtl-bank.org — USER (LACKS read)

describe("/v1/brownfield-table-mappings/* integration", () => {
  beforeAll(async () => {
    suite = await buildTestApp();
    platformS = await login(suite, "admin@heuresys.com");
    tenantS = await login(suite, "federica.marchetti@rtl-bank.org");
    userS = await login(suite, "tommaso.fiore@rtl-bank.org");
  });

  afterAll(async () => {
    await suite.app.close();
    await closePool();
  });

  it("unauthenticated LIST → 401 UNAUTHORIZED", async () => {
    const r = await suite.app.inject({ method: "GET", url: BASE });
    expect(r.statusCode).toBe(401);
    expect((r.json() as { error: { code: string } }).error.code).toBe("UNAUTHORIZED");
  });

  it("USER (lacks brownfield_adaptation:read) LIST → 403 FORBIDDEN", async () => {
    const r = await suite.app.inject({ method: "GET", url: BASE, headers: { cookie: ch(userS.cookies) } });
    expect(r.statusCode).toBe(403);
    expect((r.json() as { error: { code: string } }).error.code).toBe("FORBIDDEN");
  });

  it("PLATFORM_ADMIN LIST → 200 + { items: [], total } shape", async () => {
    const r = await suite.app.inject({ method: "GET", url: BASE, headers: { cookie: ch(platformS.cookies) } });
    expect(r.statusCode).toBe(200);
    const body = r.json() as { items: unknown[]; total: number };
    expect(Array.isArray(body.items)).toBe(true);
    expect(typeof body.total).toBe("number");
    // Structural check only on items that exist — never assert a count.
    for (const raw of body.items) {
      const item = raw as Record<string, unknown>;
      expect(typeof item.tableMappingId).toBe("string");
      expect(typeof item.targetSchema).toBe("string");
      expect(typeof item.approvalStatus).toBe("string");
    }
  });

  it("PLATFORM_ADMIN LIST accepts a valid approvalStatus filter → 200", async () => {
    const r = await suite.app.inject({
      method: "GET", url: `${BASE}?approvalStatus=PROPOSED&limit=5`,
      headers: { cookie: ch(platformS.cookies) },
    });
    expect(r.statusCode).toBe(200);
    const body = r.json() as { items: Array<{ approvalStatus: string }>; total: number };
    expect(Array.isArray(body.items)).toBe(true);
    for (const item of body.items) expect(item.approvalStatus).toBe("PROPOSED");
  });

  it("GET /:id with a random uuid → 404 NOT_FOUND", async () => {
    const r = await suite.app.inject({
      method: "GET", url: `${BASE}/${randomUUID()}`,
      headers: { cookie: ch(platformS.cookies) },
    });
    expect(r.statusCode).toBe(404);
    expect((r.json() as { error: { code: string } }).error.code).toBe("NOT_FOUND");
  });

  it("PATCH /:id without x-csrf-token → 403 CSRF_FAIL", async () => {
    const r = await suite.app.inject({
      method: "PATCH", url: `${BASE}/${randomUUID()}`,
      headers: { cookie: ch(platformS.cookies), "content-type": "application/json" },
      payload: { approvalStatus: "APPROVED" },
    });
    expect(r.statusCode).toBe(403);
    expect((r.json() as { error: { code: string } }).error.code).toBe("CSRF_FAIL");
  });

  it("TENANT_ADMIN PATCH (lacks brownfield_adaptation:approve) → 403 FORBIDDEN", async () => {
    const r = await suite.app.inject({
      method: "PATCH", url: `${BASE}/${randomUUID()}`,
      headers: { cookie: ch(tenantS.cookies), "x-csrf-token": tenantS.csrfToken, "content-type": "application/json" },
      payload: { approvalStatus: "APPROVED" },
    });
    expect(r.statusCode).toBe(403);
    expect((r.json() as { error: { code: string } }).error.code).toBe("FORBIDDEN");
  });
});
