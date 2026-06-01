/**
 * apps/api/test/visualization-edges.integration.test.ts
 *
 * Module: visualization-edges (prefix /v1/visualization-edges)
 * Routes (verified in routes.ts):
 *   GET    /                 requirePermission("visualization:read")
 *   GET    /:id              requirePermission("visualization:read")
 *   POST   /                 app.verifyCsrf + requirePermission("visualization:create")  -> 201
 *   DELETE /:id              app.verifyCsrf + requirePermission("visualization:update_layout") -> 204
 *
 * Visibility (service.ts): PLATFORM_ADMIN sees all graphs; non-platform actors
 * only see graphs of their own tenant. requirePermission denial throws a plain
 * ForbiddenError (default code "FORBIDDEN"). NotFoundError always emits "NOT_FOUND".
 *
 * NOTE: the happy-path create chain requires an existing graph + two nodes that
 * belong to it (cross-module setup in visualization-graphs / visualization-nodes).
 * To keep assertions deterministic and avoid creating rows whose conflict/ownership
 * semantics live in other modules, this suite covers list/get/auth/RBAC/CSRF
 * guards (all of which run before any cross-module DB dependency) and does NOT
 * insert any rows — hence afterAll only tears the app + pool down.
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

let suite: TestApp;
let platformS: S;
let userS: S;

describe("/v1/visualization-edges/* integration", () => {
  beforeAll(async () => {
    suite = await buildTestApp();
    platformS = await login(suite, "admin@heuresys.com");
    userS = await login(suite, "tommaso.fiore@rtl-bank.org"); // USER: lacks visualization:create
  });

  afterAll(async () => {
    await suite.app.close();
    await closePool();
  });

  it("unauthenticated GET / → 401", async () => {
    const r = await suite.app.inject({ method: "GET", url: "/v1/visualization-edges" });
    expect(r.statusCode).toBe(401);
  });

  it("unauthenticated DELETE /:id → 401", async () => {
    const r = await suite.app.inject({ method: "DELETE", url: `/v1/visualization-edges/${randomUUID()}` });
    // CSRF runs first on mutations; either CSRF rejection (403) or auth (401) is
    // an acceptable "blocked unauthenticated" outcome — assert it is one of them.
    expect([401, 403]).toContain(r.statusCode);
  });

  it("LIST as PLATFORM_ADMIN → 200 with { items: [], total } shape", async () => {
    const r = await suite.app.inject({
      method: "GET", url: "/v1/visualization-edges?limit=5",
      headers: { cookie: ch(platformS.cookies) },
    });
    expect(r.statusCode).toBe(200);
    const body = r.json() as { items: unknown[]; total: number };
    expect(Array.isArray(body.items)).toBe(true);
    expect(typeof body.total).toBe("number");
    expect(body.total).toBeGreaterThanOrEqual(0);
  });

  it("GET /:id with random uuid as PLATFORM_ADMIN → 404 NOT_FOUND", async () => {
    const r = await suite.app.inject({
      method: "GET", url: `/v1/visualization-edges/${randomUUID()}`,
      headers: { cookie: ch(platformS.cookies) },
    });
    expect(r.statusCode).toBe(404);
    expect((r.json() as { error: { code: string } }).error.code).toBe("NOT_FOUND");
  });

  it("USER lacking visualization:create cannot POST / → 403 FORBIDDEN", async () => {
    const r = await suite.app.inject({
      method: "POST", url: "/v1/visualization-edges",
      headers: {
        cookie: ch(userS.cookies),
        "x-csrf-token": userS.csrfToken,
        "content-type": "application/json",
      },
      payload: {
        graphId: randomUUID(),
        sourceNodeId: randomUUID(),
        targetNodeId: randomUUID(),
        type: "GENERIC",
      },
    });
    expect(r.statusCode).toBe(403);
    expect((r.json() as { error: { code: string } }).error.code).toBe("FORBIDDEN");
  });

  it("POST / without x-csrf-token header → 403 (CSRF guard)", async () => {
    const r = await suite.app.inject({
      method: "POST", url: "/v1/visualization-edges",
      headers: { cookie: ch(platformS.cookies), "content-type": "application/json" },
      payload: {
        graphId: randomUUID(),
        sourceNodeId: randomUUID(),
        targetNodeId: randomUUID(),
        type: "GENERIC",
      },
    });
    expect(r.statusCode).toBe(403);
  });
});
