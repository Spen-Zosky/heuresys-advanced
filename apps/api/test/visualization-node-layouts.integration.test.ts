/**
 * apps/api/test/visualization-node-layouts.integration.test.ts
 *
 * Integration tests for the visualization-node-layouts module.
 * Routes (prefix /v1/visualization-node-layouts):
 *   GET    /        requirePermission('visualization:read')
 *   GET    /:id     requirePermission('visualization:read')
 *   PUT    /        verifyCsrf + requirePermission('visualization:update_layout')
 *   DELETE /:id     verifyCsrf + requirePermission('visualization:update_layout')
 *
 * Visibility model (service.ts): PLATFORM_ADMIN sees all graphs; tenant users
 * see only layouts whose graph.tenantId === their tenantId. The upsert path
 * requires a real existing layoutId + nodeId belonging to the SAME graph — we
 * do NOT create rows here (cannot hardcode seeded layout/node ids per repo
 * rules), so there is no afterAll row cleanup. Mutation coverage exercises the
 * deterministic error paths (RBAC denial, CSRF rejection, NOT_FOUND on a random
 * layout id) which create nothing in the DB.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { closePool } from "../src/db/client.js";

const PWD = "Admin#PassW0rd!";

interface S { cookies: Map<string, string>; csrfToken: string }
function ch(c: Map<string, string>): string {
  return [...c.entries()].map(([n, v]) => `${n}=${v}`).join("; ");
}
async function login(t: TestApp, email: string): Promise<S> {
  const r = await t.app.inject({ method: "POST", url: "/v1/auth/login", payload: { email, password: PWD } });
  if (r.statusCode !== 200) throw new Error(`login ${email}: ${r.statusCode}`);
  const cookies = new Map<string, string>();
  for (const c of r.cookies) cookies.set(c.name, c.value);
  return { cookies, csrfToken: (r.json() as { csrfToken: string }).csrfToken };
}

const BASE = "/v1/visualization-node-layouts";

let suite: TestApp;
let platformS: S; // admin@heuresys.com — PLATFORM_ADMIN (has read + update_layout)
let userS: S;     // tommaso.fiore@rtl-bank.org — USER (has visualization:read, NOT update_layout)

describe(`${BASE}/* integration`, () => {
  beforeAll(async () => {
    suite = await buildTestApp();
    platformS = await login(suite, "admin@heuresys.com");
    userS = await login(suite, "tommaso.fiore@rtl-bank.org");
  });

  afterAll(async () => {
    await suite.app.close();
    await closePool();
  });

  it("unauthenticated GET / → 401", async () => {
    const r = await suite.app.inject({ method: "GET", url: BASE });
    expect(r.statusCode).toBe(401);
  });

  it("LIST as PLATFORM_ADMIN → 200 with { items: [], total } shape", async () => {
    const r = await suite.app.inject({
      method: "GET", url: BASE,
      headers: { cookie: ch(platformS.cookies) },
    });
    expect(r.statusCode).toBe(200);
    const body = r.json() as { items: unknown[]; total: number };
    expect(Array.isArray(body.items)).toBe(true);
    expect(typeof body.total).toBe("number");
    expect(body.total).toBeGreaterThanOrEqual(0);
  });

  it("GET /:id with a random uuid → 404 NOT_FOUND", async () => {
    const r = await suite.app.inject({
      method: "GET", url: `${BASE}/${randomUUID()}`,
      headers: { cookie: ch(platformS.cookies) },
    });
    expect(r.statusCode).toBe(404);
    expect((r.json() as { error: { code: string } }).error.code).toBe("NOT_FOUND");
  });

  it("USER lacking visualization:update_layout cannot PUT → 403 FORBIDDEN", async () => {
    const r = await suite.app.inject({
      method: "PUT", url: BASE,
      headers: { cookie: ch(userS.cookies), "x-csrf-token": userS.csrfToken, "content-type": "application/json" },
      payload: { layoutId: randomUUID(), nodeId: randomUUID(), x: 1, y: 2 },
    });
    expect(r.statusCode).toBe(403);
    expect((r.json() as { error: { code: string } }).error.code).toBe("FORBIDDEN");
  });

  it("PUT without x-csrf-token → 403 (CSRF rejected)", async () => {
    const r = await suite.app.inject({
      method: "PUT", url: BASE,
      headers: { cookie: ch(platformS.cookies), "content-type": "application/json" },
      payload: { layoutId: randomUUID(), nodeId: randomUUID(), x: 1, y: 2 },
    });
    expect(r.statusCode).toBe(403);
  });

  it("PUT (PLATFORM_ADMIN, csrf ok) referencing a non-existent layout → 404 NOT_FOUND", async () => {
    const r = await suite.app.inject({
      method: "PUT", url: BASE,
      headers: { cookie: ch(platformS.cookies), "x-csrf-token": platformS.csrfToken, "content-type": "application/json" },
      payload: { layoutId: randomUUID(), nodeId: randomUUID(), x: 10, y: 20, z: null, locked: false },
    });
    expect(r.statusCode).toBe(404);
    expect((r.json() as { error: { code: string } }).error.code).toBe("NOT_FOUND");
  });
});
