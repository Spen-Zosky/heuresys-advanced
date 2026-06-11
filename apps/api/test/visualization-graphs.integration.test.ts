/**
 * apps/api/test/visualization-graphs.integration.test.ts
 *
 * Integration tests for the /v1/visualization-graphs module.
 * Module is tenant-scoped (PLATFORM_ADMIN sees all; non-platform sees own tenant).
 * Verbs: GET (/, /summary, /:id, /:id/render) | POST / | PATCH /:id | DELETE /:id.
 * Permissions: visualization:read (GETs), visualization:create (POST),
 *              visualization:update_layout (PATCH/DELETE).
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { pool, closePool } from "../src/db/client.js";

const PWD = "Admin#PassW0rd!";
const SUITE_PREFIX = `IT_VG_${randomUUID().slice(0, 8).toUpperCase()}`;

interface S { cookies: Map<string, string>; csrfToken: string }
function ch(c: Map<string, string>) { return [...c.entries()].map(([n, v]) => `${n}=${v}`).join("; "); }
async function login(t: TestApp, email: string): Promise<S> {
  const r = await loginRaw(t.app, email, PWD);
  const cookies = new Map<string, string>();
  for (const c of r.cookies) cookies.set(c.name, c.value);
  return { cookies, csrfToken: (r.json() as { csrfToken: string }).csrfToken };
}

let suite: TestApp;
let tenantS: S;     // federica.marchetti@rtl-bank.org — TENANT_ADMIN (has visualization:create)
let managerS: S;    // paolo.caputo@rtl-bank.org — MANAGER (lacks visualization:create)
const createdGraphIds: string[] = [];

describe("/v1/visualization-graphs/* integration", () => {
  beforeAll(async () => {
    suite = await buildTestApp();
    tenantS = await login(suite, "federica.marchetti@rtl-bank.org");
    managerS = await login(suite, "paolo.caputo@rtl-bank.org");
  });

  afterAll(async () => {
    for (const id of createdGraphIds) {
      try { await pool.query(`DELETE FROM sys.sys_visualization_graphs WHERE graph_id = $1`, [id]); }
      catch { /* ignore */ }
    }
    await suite.app.close();
    await closePool();
  });

  it("unauthenticated GET / → 401", async () => {
    const r = await suite.app.inject({ method: "GET", url: "/v1/visualization-graphs" });
    expect(r.statusCode).toBe(401);
  });

  it("MANAGER lacking visualization:create cannot POST → 403 FORBIDDEN", async () => {
    const r = await suite.app.inject({
      method: "POST", url: "/v1/visualization-graphs",
      headers: { cookie: ch(managerS.cookies), "x-csrf-token": managerS.csrfToken, "content-type": "application/json" },
      payload: { code: `${SUITE_PREFIX}_DENY`, type: "ORG_CHART", name: "Denied Graph" },
    });
    expect(r.statusCode).toBe(403);
    expect((r.json() as { error: { code: string } }).error.code).toBe("FORBIDDEN");
  });

  it("LIST GET / as TENANT_ADMIN → 200 + { items, total } shape", async () => {
    const r = await suite.app.inject({
      method: "GET", url: "/v1/visualization-graphs",
      headers: { cookie: ch(tenantS.cookies) },
    });
    expect(r.statusCode).toBe(200);
    const body = r.json() as { items: unknown[]; total: number };
    expect(Array.isArray(body.items)).toBe(true);
    expect(typeof body.total).toBe("number");
  });

  it("GET /summary as TENANT_ADMIN → 200 + { items, total } distribution shape", async () => {
    const r = await suite.app.inject({
      method: "GET", url: "/v1/visualization-graphs/summary",
      headers: { cookie: ch(tenantS.cookies) },
    });
    expect(r.statusCode).toBe(200);
    const body = r.json() as { items: Array<{ type: string; count: number }>; total: number };
    expect(Array.isArray(body.items)).toBe(true);
    expect(typeof body.total).toBe("number");
  });

  it("CREATE then GET /:id happy path; random uuid → 404 NOT_FOUND", async () => {
    const code = `${SUITE_PREFIX}_HP`;
    const created = await suite.app.inject({
      method: "POST", url: "/v1/visualization-graphs",
      headers: { cookie: ch(tenantS.cookies), "x-csrf-token": tenantS.csrfToken, "content-type": "application/json" },
      payload: { code, type: "ORG_CHART", name: "Happy Viz Graph" },
    });
    expect(created.statusCode).toBe(201);
    const g = created.json() as { graphId: string; code: string; version: number; type: string };
    expect(g.code).toBe(code);
    expect(g.type).toBe("ORG_CHART");
    expect(g.version).toBe(1);
    createdGraphIds.push(g.graphId);

    const readback = await suite.app.inject({
      method: "GET", url: `/v1/visualization-graphs/${g.graphId}`,
      headers: { cookie: ch(tenantS.cookies) },
    });
    expect(readback.statusCode).toBe(200);
    expect((readback.json() as { graphId: string }).graphId).toBe(g.graphId);

    const missing = await suite.app.inject({
      method: "GET", url: `/v1/visualization-graphs/${randomUUID()}`,
      headers: { cookie: ch(tenantS.cookies) },
    });
    expect(missing.statusCode).toBe(404);
    expect((missing.json() as { error: { code: string } }).error.code).toBe("NOT_FOUND");
  });

  it("duplicate (tenant, code, v1) → 409 VIZ_GRAPH_CODE_CONFLICT", async () => {
    const code = `${SUITE_PREFIX}_DUP`;
    const first = await suite.app.inject({
      method: "POST", url: "/v1/visualization-graphs",
      headers: { cookie: ch(tenantS.cookies), "x-csrf-token": tenantS.csrfToken, "content-type": "application/json" },
      payload: { code, type: "PROCESS_FLOW", name: "First Dup" },
    });
    expect(first.statusCode).toBe(201);
    createdGraphIds.push((first.json() as { graphId: string }).graphId);

    const dup = await suite.app.inject({
      method: "POST", url: "/v1/visualization-graphs",
      headers: { cookie: ch(tenantS.cookies), "x-csrf-token": tenantS.csrfToken, "content-type": "application/json" },
      payload: { code, type: "PROCESS_FLOW", name: "Second Dup" },
    });
    expect(dup.statusCode).toBe(409);
    expect((dup.json() as { error: { code: string } }).error.code).toBe("VIZ_GRAPH_CODE_CONFLICT");
  });

  it("POST without x-csrf-token header → 403 (CSRF)", async () => {
    const r = await suite.app.inject({
      method: "POST", url: "/v1/visualization-graphs",
      headers: { cookie: ch(tenantS.cookies), "content-type": "application/json" },
      payload: { code: `${SUITE_PREFIX}_NOCSRF`, type: "ORG_CHART", name: "No CSRF" },
    });
    expect(r.statusCode).toBe(403);
  });
});
