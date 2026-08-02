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
import { loginRaw } from "./helpers/login.js";
import { pool, closePool } from "../src/db/client.js";
import { TEST_PERSONA_PASSWORD } from "./helpers/personas.js";

const PWD = TEST_PERSONA_PASSWORD;
const SUITE_PREFIX = `IT_VE_${randomUUID().slice(0, 8).toUpperCase()}`;

interface S { cookies: Map<string, string>; csrfToken: string }
function ch(c: Map<string, string>) { return [...c.entries()].map(([n, v]) => `${n}=${v}`).join("; "); }
async function login(t: TestApp, email: string): Promise<S> {
  const r = await loginRaw(t.app, email, PWD);
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

  // #36 (B5) — il motore. Prima di questo blocco la POST scriveva una riga di
  // registro e basta: l'export "esisteva" e non c'era niente da scaricare.
  describe("export engine (#36)", () => {
    let contentGraphId: string;
    let nodeA: string, nodeB: string;

    async function post(url: string, payload: unknown) {
      return suite.app.inject({
        method: "POST", url,
        headers: { cookie: ch(tenantAdminS.cookies), "x-csrf-token": tenantAdminS.csrfToken, "content-type": "application/json" },
        payload: payload as Record<string, unknown>,
      });
    }
    async function createExport(payload: Record<string, unknown>) {
      const r = await post("/v1/visualization-exports", payload);
      if (r.statusCode === 201) createdExportIds.push((r.json() as { exportId: string }).exportId);
      return r;
    }
    async function download(id: string) {
      return suite.app.inject({
        method: "GET", url: `/v1/visualization-exports/${id}/download`,
        headers: { cookie: ch(tenantAdminS.cookies) },
      });
    }

    beforeAll(async () => {
      const g = await post("/v1/visualization-graphs", {
        code: `${SUITE_PREFIX}_RENDER`, type: "ORG_CHART", name: "Grafo con contenuto",
      });
      contentGraphId = (g.json() as { graphId: string }).graphId;
      const a = await post("/v1/visualization-nodes", { graphId: contentGraphId, sourceEntityType: "UNIT", label: "Direzione Generale" });
      const b = await post("/v1/visualization-nodes", { graphId: contentGraphId, sourceEntityType: "UNIT", label: "Filiale Milano" });
      nodeA = (a.json() as { nodeId: string }).nodeId;
      nodeB = (b.json() as { nodeId: string }).nodeId;
      await post("/v1/visualization-edges", {
        graphId: contentGraphId, sourceNodeId: nodeA, targetNodeId: nodeB, type: "REPORTS_TO",
      });
    });

    afterAll(async () => {
      try { await pool.query(`DELETE FROM sys.sys_visualization_graphs WHERE graph_id = $1`, [contentGraphId]); }
      catch { /* ignore */ }
    });

    it("SVG: the record now carries a real document", async () => {
      const r = await createExport({ graphId: contentGraphId, format: "SVG" });
      expect(r.statusCode).toBe(201);
      const e = r.json() as { exportId: string; byteSize: number; contentType: string };
      expect(e.byteSize).toBeGreaterThan(0);
      expect(e.contentType).toContain("image/svg+xml");

      const d = await download(e.exportId);
      expect(d.statusCode).toBe(200);
      expect(d.headers["content-type"]).toContain("image/svg+xml");
      expect(String(d.headers["content-disposition"])).toContain("attachment");
      // Il documento contiene i dati REALI del grafo, non un modello vuoto.
      expect(d.body).toContain("<svg");
      expect(d.body).toContain("Direzione Generale");
      expect(d.body).toContain("Filiale Milano");
      expect(d.body).toContain("</svg>");
    });

    it("MERMAID: renders nodes and the edge between them", async () => {
      const r = await createExport({ graphId: contentGraphId, format: "MERMAID" });
      expect(r.statusCode).toBe(201);
      const d = await download((r.json() as { exportId: string }).exportId);
      expect(d.statusCode).toBe(200);
      expect(d.body).toContain("graph TD");
      expect(d.body).toContain("Direzione Generale");
      expect(d.body).toContain("-->");
    });

    it("REACT_FLOW_JSON: parses, and every edge endpoint is a node in the file", async () => {
      const r = await createExport({ graphId: contentGraphId, format: "REACT_FLOW_JSON" });
      const d = await download((r.json() as { exportId: string }).exportId);
      const doc = JSON.parse(d.body) as {
        nodes: Array<{ id: string; position: { x: number; y: number } }>;
        edges: Array<{ source: string; target: string }>;
      };
      expect(doc.nodes).toHaveLength(2);
      expect(doc.edges).toHaveLength(1);
      const ids = new Set(doc.nodes.map((n) => n.id));
      expect(ids.has(doc.edges[0]!.source)).toBe(true);
      expect(ids.has(doc.edges[0]!.target)).toBe(true);
      expect(typeof doc.nodes[0]!.position.x).toBe("number");
    });

    it("uses the SAVED positions when a layout is given", async () => {
      const l = await post("/v1/visualization-layouts", { graphId: contentGraphId, engine: "MANUAL" });
      const layoutId = (l.json() as { layoutId: string }).layoutId;
      // Coordinate riconoscibili: se il documento le contiene, viene dal layout
      // salvato e non dal calcolo di ripiego.
      for (const [nodeId, x, y] of [[nodeA, 4321, 8765], [nodeB, 1234, 5678]] as const) {
        await suite.app.inject({
          method: "PUT", url: "/v1/visualization-node-layouts",
          headers: { cookie: ch(tenantAdminS.cookies), "x-csrf-token": tenantAdminS.csrfToken, "content-type": "application/json" },
          payload: { layoutId, nodeId, x, y },
        });
      }

      const withLayout = await createExport({ graphId: contentGraphId, format: "SVG", layoutId });
      const d = await download((withLayout.json() as { exportId: string }).exportId);
      expect(d.body).toContain('x="4321"');
      expect(d.body).toContain('y="8765"');

      // Controprova: senza layout le stesse coordinate NON compaiono.
      const noLayout = await createExport({ graphId: contentGraphId, format: "SVG" });
      const d2 = await download((noLayout.json() as { exportId: string }).exportId);
      expect(d2.body).not.toContain('x="4321"');
    });

    it("PNG is refused with a typed error instead of an empty file", async () => {
      const r = await createExport({ graphId: contentGraphId, format: "PNG" });
      expect(r.statusCode).toBe(409);
      expect((r.json() as { error: { code: string } }).error.code).toBe("EXPORT_FORMAT_NOT_RENDERABLE");
    });

    it("an export recorded before the engine existed has nothing to download", async () => {
      // Esattamente la forma delle 3 righe storiche: un URI verso un archivio
      // che non esiste, nessun contenuto.
      const legacy = await pool.query<{ export_id: string }>(
        `INSERT INTO sys.sys_visualization_exports (export_graph_id, export_format, export_payload_uri)
         VALUES ($1, 'SVG', 'storage://legacy/senza-contenuto.svg') RETURNING export_id`,
        [contentGraphId],
      );
      const id = legacy.rows[0]!.export_id;
      createdExportIds.push(id);
      const d = await download(id);
      expect(d.statusCode).toBe(404);
    });
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
