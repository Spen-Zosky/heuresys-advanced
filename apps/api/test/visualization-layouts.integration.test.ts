/**
 * apps/api/test/visualization-layouts.integration.test.ts
 *
 * Integration tests for the /v1/visualization-layouts/* module.
 *
 * Module surface (verified against routes.ts):
 *   GET    /                 requirePermission('visualization:read')
 *   GET    /:id              requirePermission('visualization:read')
 *   POST   /                 verifyCsrf + requirePermission('visualization:create')   -> 201
 *   PATCH  /:id              verifyCsrf + requirePermission('visualization:update_layout')
 *   DELETE /:id              verifyCsrf + requirePermission('visualization:update_layout') -> 204
 *
 * Visibility (service.ts): tenant-scoped via the PARENT graph. PLATFORM_ADMIN sees
 * everything; a non-platform actor only sees layouts whose graph belongs to their
 * tenant. The ONLY typed error code thrown by the layouts service is NOT_FOUND
 * (NotFoundError("VizLayout") / NotFoundError("VizGraph")). There is no *_ADMIN_ONLY
 * and no *_CONFLICT in this service.
 *
 * Tests hit the real DB through the SSH tunnel (no mocks). A parent graph is created
 * as TENANT_ADMIN (federica) so it lands in a real tenant; layout rows we create are
 * deleted in afterAll (the graph FK is ON DELETE CASCADE, but we delete explicitly).
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { pool, closePool } from "../src/db/client.js";
import { TEST_PERSONA_PASSWORD } from "./helpers/personas.js";

const PWD = TEST_PERSONA_PASSWORD;
const SUITE_PREFIX = `IT_VL_${randomUUID().slice(0, 8).toUpperCase()}`;

interface S { cookies: Map<string, string>; csrfToken: string }
function ch(c: Map<string, string>) { return [...c.entries()].map(([n, v]) => `${n}=${v}`).join("; "); }
async function login(t: TestApp, email: string): Promise<S> {
  const r = await loginRaw(t.app, email, PWD);
  const cookies = new Map<string, string>();
  for (const c of r.cookies) cookies.set(c.name, c.value);
  return { cookies, csrfToken: (r.json() as { csrfToken: string }).csrfToken };
}

let suite: TestApp;
let platformS: S;
let tenantS: S;
let userS: S;
let graphId: string;
const createdLayoutIds: string[] = [];

describe("/v1/visualization-layouts/* integration", () => {
  beforeAll(async () => {
    suite = await buildTestApp();
    platformS = await login(suite, "admin@heuresys.com");
    tenantS = await login(suite, "federica.marchetti@rtl-bank.org");
    userS = await login(suite, "tommaso.fiore@rtl-bank.org");

    // Create a parent graph as TENANT_ADMIN so it lands in a real tenant.
    const g = await suite.app.inject({
      method: "POST", url: "/v1/visualization-graphs",
      headers: { cookie: ch(tenantS.cookies), "x-csrf-token": tenantS.csrfToken, "content-type": "application/json" },
      payload: { code: `${SUITE_PREFIX}_GRAPH`, type: "ORG_CHART", name: "Layout Test Graph" },
    });
    if (g.statusCode !== 201) throw new Error(`graph setup failed: ${g.statusCode} ${g.body}`);
    graphId = (g.json() as { graphId: string }).graphId;
  });

  afterAll(async () => {
    for (const id of createdLayoutIds) {
      try { await pool.query(`DELETE FROM sys.sys_visualization_layouts WHERE layout_id = $1`, [id]); }
      catch { /* ignore */ }
    }
    try { await pool.query(`DELETE FROM sys.sys_visualization_graphs WHERE graph_id = $1`, [graphId]); }
    catch { /* ignore */ }
    await suite.app.close();
    await closePool();
  });

  it("unauthenticated LIST → 401", async () => {
    const r = await suite.app.inject({ method: "GET", url: "/v1/visualization-layouts" });
    expect(r.statusCode).toBe(401);
  });

  it("USER lacking visualization:create cannot POST → 403", async () => {
    const r = await suite.app.inject({
      method: "POST", url: "/v1/visualization-layouts",
      headers: { cookie: ch(userS.cookies), "x-csrf-token": userS.csrfToken, "content-type": "application/json" },
      payload: { graphId, engine: "DAGRE" },
    });
    expect(r.statusCode).toBe(403);
  });

  it("POST without x-csrf-token header → 403 (CSRF)", async () => {
    const r = await suite.app.inject({
      method: "POST", url: "/v1/visualization-layouts",
      headers: { cookie: ch(platformS.cookies), "content-type": "application/json" },
      payload: { graphId, engine: "TREE" },
    });
    expect(r.statusCode).toBe(403);
  });

  it("CREATE then GET-by-id then LIST as PLATFORM_ADMIN happy path", async () => {
    const created = await suite.app.inject({
      method: "POST", url: "/v1/visualization-layouts",
      headers: { cookie: ch(platformS.cookies), "x-csrf-token": platformS.csrfToken, "content-type": "application/json" },
      payload: { graphId, engine: "HIERARCHICAL", isDefault: false, metadata: { suite: SUITE_PREFIX } },
    });
    expect(created.statusCode).toBe(201);
    const l = created.json() as { layoutId: string; graphId: string; engine: string; version: number; isDefault: boolean };
    expect(l.graphId).toBe(graphId);
    expect(l.engine).toBe("HIERARCHICAL");
    expect(typeof l.layoutId).toBe("string");
    createdLayoutIds.push(l.layoutId);

    // GET /:id for the row we just created
    const one = await suite.app.inject({
      method: "GET", url: `/v1/visualization-layouts/${l.layoutId}`,
      headers: { cookie: ch(platformS.cookies) },
    });
    expect(one.statusCode).toBe(200);
    const got = one.json() as { layoutId: string };
    expect(got.layoutId).toBe(l.layoutId);

    // LIST scoped to the parent graph — deterministic shape, no seed-volume assumption
    const list = await suite.app.inject({
      method: "GET", url: `/v1/visualization-layouts?graphId=${graphId}`,
      headers: { cookie: ch(platformS.cookies) },
    });
    expect(list.statusCode).toBe(200);
    const body = list.json() as { items: Array<{ layoutId: string }>; total: number };
    expect(Array.isArray(body.items)).toBe(true);
    expect(typeof body.total).toBe("number");
    expect(body.items.some((i) => i.layoutId === l.layoutId)).toBe(true);
  });

  it("GET /:id for a random uuid → 404 NOT_FOUND", async () => {
    const r = await suite.app.inject({
      method: "GET", url: `/v1/visualization-layouts/${randomUUID()}`,
      headers: { cookie: ch(platformS.cookies) },
    });
    expect(r.statusCode).toBe(404);
    expect((r.json() as { error: { code: string } }).error.code).toBe("NOT_FOUND");
  });

  it("PATCH then DELETE as PLATFORM_ADMIN happy path", async () => {
    const created = await suite.app.inject({
      method: "POST", url: "/v1/visualization-layouts",
      headers: { cookie: ch(platformS.cookies), "x-csrf-token": platformS.csrfToken, "content-type": "application/json" },
      payload: { graphId, engine: "ELK" },
    });
    expect(created.statusCode).toBe(201);
    const id = (created.json() as { layoutId: string }).layoutId;
    createdLayoutIds.push(id);

    const patched = await suite.app.inject({
      method: "PATCH", url: `/v1/visualization-layouts/${id}`,
      headers: { cookie: ch(platformS.cookies), "x-csrf-token": platformS.csrfToken, "content-type": "application/json" },
      payload: { engine: "FORCE_DIRECTED" },
    });
    expect(patched.statusCode).toBe(200);
    expect((patched.json() as { engine: string }).engine).toBe("FORCE_DIRECTED");

    const del = await suite.app.inject({
      method: "DELETE", url: `/v1/visualization-layouts/${id}`,
      headers: { cookie: ch(platformS.cookies), "x-csrf-token": platformS.csrfToken },
    });
    expect(del.statusCode).toBe(204);

    // Confirm gone via re-fetch
    const after = await suite.app.inject({
      method: "GET", url: `/v1/visualization-layouts/${id}`,
      headers: { cookie: ch(platformS.cookies) },
    });
    expect(after.statusCode).toBe(404);
  });
});
