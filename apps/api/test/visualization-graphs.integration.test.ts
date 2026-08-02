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
import { TEST_PERSONA_PASSWORD } from "./helpers/personas.js";

const PWD = TEST_PERSONA_PASSWORD;
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

  // #36 (B5) — versionamento. graph_version esisteva a schema ma nessun
  // endpoint la incrementava: ogni grafo restava a v1 per sempre.
  describe("versioning (#36)", () => {
    let graphId: string;
    let nodeA: string, nodeB: string;

    async function post(url: string, payload: unknown) {
      return suite.app.inject({
        method: "POST", url,
        headers: { cookie: ch(tenantS.cookies), "x-csrf-token": tenantS.csrfToken, "content-type": "application/json" },
        payload: payload as Record<string, unknown>,
      });
    }

    beforeAll(async () => {
      const g = await post("/v1/visualization-graphs", {
        code: `${SUITE_PREFIX}_VER`, type: "ORG_CHART", name: "Grafo da versionare",
      });
      graphId = (g.json() as { graphId: string }).graphId;
      createdGraphIds.push(graphId);

      const a = await post("/v1/visualization-nodes", { graphId, sourceEntityType: "UNIT", label: "Radice" });
      const b = await post("/v1/visualization-nodes", { graphId, sourceEntityType: "UNIT", label: "Figlia" });
      nodeA = (a.json() as { nodeId: string }).nodeId;
      nodeB = (b.json() as { nodeId: string }).nodeId;
      await post("/v1/visualization-edges", {
        graphId, sourceNodeId: nodeA, targetNodeId: nodeB, type: "REPORTS_TO",
      });
    });

    it("creates version 2 as an independent copy of nodes and edges", async () => {
      const r = await post(`/v1/visualization-graphs/${graphId}/versions`, {});
      expect(r.statusCode).toBe(201);
      const body = r.json() as {
        graph: { graphId: string; version: number; code: string };
        copiedNodes: number; copiedEdges: number;
      };
      createdGraphIds.push(body.graph.graphId);

      expect(body.graph.version).toBe(2);
      expect(body.graph.graphId).not.toBe(graphId);
      expect(body.copiedNodes).toBe(2);
      expect(body.copiedEdges).toBe(1);

      // Il punto che conta: l'arco della v2 deve puntare ai nodi DELLA v2.
      // Se puntasse a quelli della v1 le due versioni sarebbero intrecciate e
      // modificare l'una cambierebbe l'altra.
      const render = await suite.app.inject({
        method: "GET", url: `/v1/visualization-graphs/${body.graph.graphId}/render`,
        headers: { cookie: ch(tenantS.cookies) },
      });
      const r2 = render.json() as {
        nodes: Array<{ nodeId: string; label: string }>;
        edges: Array<{ sourceNodeId: string; targetNodeId: string }>;
      };
      const newIds = new Set(r2.nodes.map((n) => n.nodeId));
      expect(newIds.has(nodeA)).toBe(false);
      expect(newIds.has(nodeB)).toBe(false);
      expect(r2.edges).toHaveLength(1);
      expect(newIds.has(r2.edges[0]!.sourceNodeId)).toBe(true);
      expect(newIds.has(r2.edges[0]!.targetNodeId)).toBe(true);
      // e le etichette sono state conservate
      expect(r2.nodes.map((n) => n.label).sort()).toEqual(["Figlia", "Radice"]);
    });

    it("the source version is left untouched", async () => {
      const render = await suite.app.inject({
        method: "GET", url: `/v1/visualization-graphs/${graphId}/render`,
        headers: { cookie: ch(tenantS.cookies) },
      });
      const r1 = render.json() as { graph: { version: number }; nodes: unknown[]; edges: unknown[] };
      expect(r1.graph.version).toBe(1);
      expect(r1.nodes).toHaveLength(2);
      expect(r1.edges).toHaveLength(1);
    });

    it("lists every version sharing the code, newest first", async () => {
      const r = await suite.app.inject({
        method: "GET", url: `/v1/visualization-graphs/${graphId}/versions`,
        headers: { cookie: ch(tenantS.cookies) },
      });
      expect(r.statusCode).toBe(200);
      const body = r.json() as { items: Array<{ version: number }>; total: number };
      expect(body.total).toBeGreaterThanOrEqual(2);
      expect(body.items[0]!.version).toBeGreaterThan(body.items[1]!.version);
    });

    it("copyContent=false yields an empty version, and versions keep incrementing", async () => {
      const r = await post(`/v1/visualization-graphs/${graphId}/versions`, { copyContent: false });
      expect(r.statusCode).toBe(201);
      const body = r.json() as { graph: { graphId: string; version: number }; copiedNodes: number };
      createdGraphIds.push(body.graph.graphId);
      expect(body.graph.version).toBe(3);
      expect(body.copiedNodes).toBe(0);
    });

    it("MANAGER cannot create a version (needs visualization:create)", async () => {
      const r = await suite.app.inject({
        method: "POST", url: `/v1/visualization-graphs/${graphId}/versions`,
        headers: { cookie: ch(managerS.cookies), "x-csrf-token": managerS.csrfToken, "content-type": "application/json" },
        payload: {},
      });
      expect(r.statusCode).toBe(403);
    });
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
