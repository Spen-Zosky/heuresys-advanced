/**
 * apps/api/test/visualization-styles.integration.test.ts
 *
 * Integration tests for the /v1/visualization-styles module.
 * Styles hang off a parent visualization-graph and inherit its tenant visibility:
 * PLATFORM_ADMIN sees all; non-platform actors only see styles whose parent graph
 * belongs to their own tenant (service.ensureGraphVisible). A style for a graph the
 * actor cannot see surfaces as NOT_FOUND (not FORBIDDEN) by design.
 *
 * Verbs: GET / (list) | GET /:id | POST / | DELETE /:id  (no PATCH — rows immutable).
 * Permissions: visualization:read (GETs), visualization:create (POST),
 *              visualization:update_layout (DELETE).
 * Error codes thrown: NOT_FOUND (NotFoundError), FORBIDDEN (requirePermission default),
 *                     CSRF_FAIL (CsrfFailedError).
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { pool, closePool } from "../src/db/client.js";
import { TEST_PERSONA_PASSWORD } from "./helpers/personas.js";

const PWD = TEST_PERSONA_PASSWORD;
const SUITE_PREFIX = `IT_VS_${randomUUID().slice(0, 8).toUpperCase()}`;

interface S { cookies: Map<string, string>; csrfToken: string }
function ch(c: Map<string, string>) { return [...c.entries()].map(([n, v]) => `${n}=${v}`).join("; "); }
async function login(t: TestApp, email: string): Promise<S> {
  const r = await loginRaw(t.app, email, PWD);
  const cookies = new Map<string, string>();
  for (const c of r.cookies) cookies.set(c.name, c.value);
  return { cookies, csrfToken: (r.json() as { csrfToken: string }).csrfToken };
}

let suite: TestApp;
let tenantS: S;     // federica.marchetti@rtl-bank.org — TENANT_ADMIN (has visualization:create + update_layout)
let userS: S;       // tommaso.fiore@rtl-bank.org — USER (visualization:read only, no create/update_layout)
let graphId: string;                       // parent graph created in beforeAll (RTL tenant scope)
const createdStyleIds: string[] = [];

describe("/v1/visualization-styles/* integration", () => {
  beforeAll(async () => {
    suite = await buildTestApp();
    tenantS = await login(suite, "federica.marchetti@rtl-bank.org");
    userS = await login(suite, "tommaso.fiore@rtl-bank.org");

    // Parent graph: tenant-scoped, owned by federica's RTL tenant so styles are visible to her.
    const g = await suite.app.inject({
      method: "POST", url: "/v1/visualization-graphs",
      headers: { cookie: ch(tenantS.cookies), "x-csrf-token": tenantS.csrfToken, "content-type": "application/json" },
      payload: { code: `${SUITE_PREFIX}_GRAPH`, type: "ORG_CHART", name: "Styles Parent Graph" },
    });
    if (g.statusCode !== 201) throw new Error(`parent graph create: ${g.statusCode}`);
    graphId = (g.json() as { graphId: string }).graphId;
  });

  afterAll(async () => {
    for (const id of createdStyleIds) {
      try { await pool.query(`DELETE FROM sys.sys_visualization_styles WHERE style_id = $1`, [id]); }
      catch { /* ignore */ }
    }
    try { await pool.query(`DELETE FROM sys.sys_visualization_graphs WHERE graph_id = $1`, [graphId]); }
    catch { /* ignore */ }
    await suite.app.close();
    await closePool();
  });

  it("unauthenticated GET / → 401", async () => {
    const r = await suite.app.inject({ method: "GET", url: "/v1/visualization-styles" });
    expect(r.statusCode).toBe(401);
  });

  it("USER lacking visualization:create cannot POST → 403 FORBIDDEN", async () => {
    const r = await suite.app.inject({
      method: "POST", url: "/v1/visualization-styles",
      headers: { cookie: ch(userS.cookies), "x-csrf-token": userS.csrfToken, "content-type": "application/json" },
      payload: { graphId, nodeType: "ROLE", color: "#FF0000" },
    });
    expect(r.statusCode).toBe(403);
    expect((r.json() as { error: { code: string } }).error.code).toBe("FORBIDDEN");
  });

  it("LIST GET / as TENANT_ADMIN → 200 + { items, total } shape", async () => {
    const r = await suite.app.inject({
      method: "GET", url: `/v1/visualization-styles?graphId=${graphId}`,
      headers: { cookie: ch(tenantS.cookies) },
    });
    expect(r.statusCode).toBe(200);
    const body = r.json() as { items: unknown[]; total: number };
    expect(Array.isArray(body.items)).toBe(true);
    expect(typeof body.total).toBe("number");
  });

  it("CREATE then GET /:id happy path; random uuid → 404 NOT_FOUND", async () => {
    const created = await suite.app.inject({
      method: "POST", url: "/v1/visualization-styles",
      headers: { cookie: ch(tenantS.cookies), "x-csrf-token": tenantS.csrfToken, "content-type": "application/json" },
      payload: { graphId, nodeType: "ROLE", color: "#00AA55", icon: "user", metadata: { tag: SUITE_PREFIX } },
    });
    expect(created.statusCode).toBe(201);
    const st = created.json() as { styleId: string; graphId: string; nodeType: string | null; color: string | null };
    expect(st.graphId).toBe(graphId);
    expect(st.nodeType).toBe("ROLE");
    expect(st.color).toBe("#00AA55");
    createdStyleIds.push(st.styleId);

    const readback = await suite.app.inject({
      method: "GET", url: `/v1/visualization-styles/${st.styleId}`,
      headers: { cookie: ch(tenantS.cookies) },
    });
    expect(readback.statusCode).toBe(200);
    expect((readback.json() as { styleId: string }).styleId).toBe(st.styleId);

    const missing = await suite.app.inject({
      method: "GET", url: `/v1/visualization-styles/${randomUUID()}`,
      headers: { cookie: ch(tenantS.cookies) },
    });
    expect(missing.statusCode).toBe(404);
    expect((missing.json() as { error: { code: string } }).error.code).toBe("NOT_FOUND");
  });

  it("DELETE /:id as TENANT_ADMIN removes the style; subsequent GET → 404 NOT_FOUND", async () => {
    const created = await suite.app.inject({
      method: "POST", url: "/v1/visualization-styles",
      headers: { cookie: ch(tenantS.cookies), "x-csrf-token": tenantS.csrfToken, "content-type": "application/json" },
      payload: { graphId, nodeType: "DEPT", color: "#123456" },
    });
    expect(created.statusCode).toBe(201);
    const styleId = (created.json() as { styleId: string }).styleId;

    const del = await suite.app.inject({
      method: "DELETE", url: `/v1/visualization-styles/${styleId}`,
      headers: { cookie: ch(tenantS.cookies), "x-csrf-token": tenantS.csrfToken },
    });
    expect(del.statusCode).toBe(204);

    const gone = await suite.app.inject({
      method: "GET", url: `/v1/visualization-styles/${styleId}`,
      headers: { cookie: ch(tenantS.cookies) },
    });
    expect(gone.statusCode).toBe(404);
    expect((gone.json() as { error: { code: string } }).error.code).toBe("NOT_FOUND");
  });

  it("POST without x-csrf-token header → 403 (CSRF)", async () => {
    const r = await suite.app.inject({
      method: "POST", url: "/v1/visualization-styles",
      headers: { cookie: ch(tenantS.cookies), "content-type": "application/json" },
      payload: { graphId, nodeType: "NOCSRF", color: "#999999" },
    });
    expect(r.statusCode).toBe(403);
  });
});
