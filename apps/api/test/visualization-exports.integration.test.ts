/**
 * apps/api/test/visualization-exports.integration.test.ts
 *
 * Integration coverage for the /v1/visualization-exports module (3 endpoints:
 * GET / list, GET /:id, POST / create — append-only, no PATCH/DELETE).
 *
 * Visibility model (service.ts): global+tenant via the parent graph.
 *   - PLATFORM_ADMIN sees/creates against any graph.
 *   - non-platform actors are scoped to graphs of their own tenant.
 * RBAC is permission-gated only (no *_ADMIN_ONLY code):
 *   - GET routes require 'visualization:read' (held by ALL 8 roles).
 *   - POST requires 'visualization:create' (held by PLATFORM_ADMIN,
 *     TENANT_ADMIN, BLUEPRINT_MANAGER, HRMS_MANAGER — NOT MANAGER/USER).
 * Typed errors actually reachable here:
 *   - requirePermission denial → ForbiddenError default code "FORBIDDEN" (403).
 *   - missing/foreign graph or export → NotFoundError code "NOT_FOUND" (404).
 *   - missing CSRF token on a mutation → CsrfFailedError code "CSRF_FAIL" (403).
 *
 * A real parent graph is created in beforeAll (via the sibling
 * visualization-graphs module) so the create happy path has a visible graphId;
 * both the export rows and the graph are cleaned up in afterAll.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { pool, closePool } from "../src/db/client.js";

const PWD = "Admin#PassW0rd!";
const SUITE_PREFIX = `IT_VE_${randomUUID().slice(0, 8).toUpperCase()}`;

interface S { cookies: Map<string, string>; csrfToken: string }
function ch(c: Map<string, string>) { return [...c.entries()].map(([n, v]) => `${n}=${v}`).join("; "); }
async function login(t: TestApp, email: string): Promise<S> {
  const r = await t.app.inject({ method: "POST", url: "/v1/auth/login", payload: { email, password: PWD } });
  if (r.statusCode !== 200) throw new Error(`login: ${r.statusCode}`);
  const cookies = new Map<string, string>();
  for (const c of r.cookies) cookies.set(c.name, c.value);
  return { cookies, csrfToken: (r.json() as { csrfToken: string }).csrfToken };
}

let suite: TestApp;
let tenantAdminS: S;   // federica.marchetti@rtl-bank.org — TENANT_ADMIN (holds visualization:create + a tenant; PLATFORM_ADMIN can't create a graph without body.tenantId)
let managerS: S;    // paolo.caputo@rtl-bank.org — MANAGER (lacks visualization:create)
let graphId: string;
const createdExportIds: string[] = [];

describe("/v1/visualization-exports/* integration", () => {
  beforeAll(async () => {
    suite = await buildTestApp();
    tenantAdminS = await login(suite, "federica.marchetti@rtl-bank.org");
    managerS = await login(suite, "paolo.caputo@rtl-bank.org");

    // Create a real parent graph so exports have a visible graphId to hang off.
    const g = await suite.app.inject({
      method: "POST", url: "/v1/visualization-graphs",
      headers: { cookie: ch(tenantAdminS.cookies), "x-csrf-token": tenantAdminS.csrfToken, "content-type": "application/json" },
      payload: { code: `${SUITE_PREFIX}_GRAPH`, type: "ORG_CHART", name: "Export Parent Graph" },
    });
    if (g.statusCode !== 201) throw new Error(`graph setup failed: ${g.statusCode} ${g.body}`);
    graphId = (g.json() as { graphId: string }).graphId;
  });

  afterAll(async () => {
    for (const id of createdExportIds) {
      try { await pool.query(`DELETE FROM sys.sys_visualization_exports WHERE export_id = $1`, [id]); }
      catch { /* ignore */ }
    }
    if (graphId) {
      try { await pool.query(`DELETE FROM sys.sys_visualization_graphs WHERE graph_id = $1`, [graphId]); }
      catch { /* ignore */ }
    }
    await suite.app.close();
    await closePool();
  });

  it("unauthenticated GET / → 401 UNAUTHORIZED", async () => {
    const r = await suite.app.inject({ method: "GET", url: "/v1/visualization-exports" });
    expect(r.statusCode).toBe(401);
    expect((r.json() as { error: { code: string } }).error.code).toBe("UNAUTHORIZED");
  });

  it("MANAGER lacking visualization:create → 403 FORBIDDEN on POST", async () => {
    const r = await suite.app.inject({
      method: "POST", url: "/v1/visualization-exports",
      headers: { cookie: ch(managerS.cookies), "x-csrf-token": managerS.csrfToken, "content-type": "application/json" },
      payload: { graphId, format: "SVG" },
    });
    expect(r.statusCode).toBe(403);
    expect((r.json() as { error: { code: string } }).error.code).toBe("FORBIDDEN");
  });

  it("LIST as TENANT_ADMIN → 200 with { items: [], total } shape", async () => {
    const r = await suite.app.inject({
      method: "GET", url: "/v1/visualization-exports",
      headers: { cookie: ch(tenantAdminS.cookies) },
    });
    expect(r.statusCode).toBe(200);
    const body = r.json() as { items: unknown[]; total: number };
    expect(Array.isArray(body.items)).toBe(true);
    expect(typeof body.total).toBe("number");
  });

  it("CREATE then GET /:id round-trip as TENANT_ADMIN → 201 / 200", async () => {
    const created = await suite.app.inject({
      method: "POST", url: "/v1/visualization-exports",
      headers: { cookie: ch(tenantAdminS.cookies), "x-csrf-token": tenantAdminS.csrfToken, "content-type": "application/json" },
      payload: { graphId, format: "GENERIC_JSON", metadata: { suite: SUITE_PREFIX } },
    });
    expect(created.statusCode).toBe(201);
    const c = created.json() as { exportId: string; graphId: string; format: string };
    expect(typeof c.exportId).toBe("string");
    expect(c.graphId).toBe(graphId);
    expect(c.format).toBe("GENERIC_JSON");
    createdExportIds.push(c.exportId);

    const got = await suite.app.inject({
      method: "GET", url: `/v1/visualization-exports/${c.exportId}`,
      headers: { cookie: ch(tenantAdminS.cookies) },
    });
    expect(got.statusCode).toBe(200);
    const g = got.json() as { exportId: string; graphId: string };
    expect(g.exportId).toBe(c.exportId);
    expect(g.graphId).toBe(graphId);
  });

  it("GET /:id for a random uuid → 404 NOT_FOUND", async () => {
    const r = await suite.app.inject({
      method: "GET", url: `/v1/visualization-exports/${randomUUID()}`,
      headers: { cookie: ch(tenantAdminS.cookies) },
    });
    expect(r.statusCode).toBe(404);
    expect((r.json() as { error: { code: string } }).error.code).toBe("NOT_FOUND");
  });

  it("CREATE against a non-existent graphId → 404 NOT_FOUND", async () => {
    const r = await suite.app.inject({
      method: "POST", url: "/v1/visualization-exports",
      headers: { cookie: ch(tenantAdminS.cookies), "x-csrf-token": tenantAdminS.csrfToken, "content-type": "application/json" },
      payload: { graphId: randomUUID(), format: "PNG" },
    });
    expect(r.statusCode).toBe(404);
    expect((r.json() as { error: { code: string } }).error.code).toBe("NOT_FOUND");
  });

  it("POST without x-csrf-token header → 403 CSRF_FAIL", async () => {
    const r = await suite.app.inject({
      method: "POST", url: "/v1/visualization-exports",
      headers: { cookie: ch(tenantAdminS.cookies), "content-type": "application/json" },
      payload: { graphId, format: "PDF" },
    });
    expect(r.statusCode).toBe(403);
    expect((r.json() as { error: { code: string } }).error.code).toBe("CSRF_FAIL");
  });
});
