/**
 * apps/api/test/visualization-nodes.integration.test.ts
 *
 * Integration coverage for /v1/visualization-nodes/* (full CRUD module).
 * Visibility model: a node inherits tenant from its parent graph
 * (sys.sys_visualization_graphs). PLATFORM_ADMIN sees all graphs; a tenant
 * user only sees graphs in their own tenant. Mutations are gated by
 * `visualization:create` (POST) and `visualization:update_layout` (PATCH/DELETE);
 * a plain USER only holds `visualization:read`.
 *
 * Tests hit the real DB through the SSH tunnel (no mocks). Any node row created
 * here is deleted in afterAll, and the parent graph created in beforeAll is
 * cleaned up too.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { pool, closePool } from "../src/db/client.js";
import { TEST_PERSONA_PASSWORD } from "./helpers/personas.js";

const PWD = TEST_PERSONA_PASSWORD;
const SUITE_PREFIX = `IT_VN_${randomUUID().slice(0, 8).toUpperCase()}`;

interface S {
  cookies: Map<string, string>;
  csrfToken: string;
}
function ch(c: Map<string, string>): string {
  return [...c.entries()].map(([n, v]) => `${n}=${v}`).join("; ");
}
async function login(t: TestApp, email: string): Promise<S> {
  const r = await loginRaw(t.app, email, PWD);
  const cookies = new Map<string, string>();
  for (const c of r.cookies) cookies.set(c.name, c.value);
  return { cookies, csrfToken: (r.json() as { csrfToken: string }).csrfToken };
}

interface ErrEnvelope {
  error: { code: string; message: string };
}
interface NodeResponse {
  nodeId: string;
  graphId: string;
  label: string;
  type: string | null;
  groupKey: string | null;
  metadata: Record<string, unknown>;
}
interface ListResponse {
  items: NodeResponse[];
  total: number;
}

let suite: TestApp;
let platformS: S;
let tenantS: S;
let userS: S;
let graphId: string;
const createdNodeIds: string[] = [];

describe("/v1/visualization-nodes/* integration", () => {
  beforeAll(async () => {
    suite = await buildTestApp();
    platformS = await login(suite, "enzo.spenuso@heuresys.com");
    tenantS = await login(suite, "federica.marchetti@rtl-bank.org");
    userS = await login(suite, "tommaso.fiore@rtl-bank.org");

    // Parent graph created by TENANT_ADMIN (federica) so it lives in her real
    // tenant; PLATFORM_ADMIN can then operate on it via the platform bypass.
    const g = await suite.app.inject({
      method: "POST",
      url: "/v1/visualization-graphs",
      headers: { cookie: ch(tenantS.cookies), "x-csrf-token": tenantS.csrfToken, "content-type": "application/json" },
      payload: { code: `${SUITE_PREFIX}_GRAPH`, type: "ORG_CHART", name: "VN Parent Graph" },
    });
    if (g.statusCode !== 201) throw new Error(`parent graph create failed: ${g.statusCode} ${g.body}`);
    graphId = (g.json() as { graphId: string }).graphId;
  });

  afterAll(async () => {
    for (const id of createdNodeIds) {
      try {
        await pool.query(`DELETE FROM sys.sys_visualization_nodes WHERE node_id = $1`, [id]);
      } catch {
        /* ignore */
      }
    }
    try {
      await pool.query(`DELETE FROM sys.sys_visualization_graphs WHERE graph_id = $1`, [graphId]);
    } catch {
      /* ignore */
    }
    await suite.app.close();
    await closePool();
  });

  it("unauthenticated LIST → 401 UNAUTHORIZED", async () => {
    const r = await suite.app.inject({ method: "GET", url: "/v1/visualization-nodes" });
    expect(r.statusCode).toBe(401);
    expect((r.json() as ErrEnvelope).error.code).toBe("UNAUTHORIZED");
  });

  it("LIST as PLATFORM_ADMIN → 200 with { items, total } shape", async () => {
    const r = await suite.app.inject({
      method: "GET",
      url: "/v1/visualization-nodes",
      headers: { cookie: ch(platformS.cookies) },
    });
    expect(r.statusCode).toBe(200);
    const body = r.json() as ListResponse;
    expect(Array.isArray(body.items)).toBe(true);
    expect(typeof body.total).toBe("number");
  });

  it("USER lacking visualization:create cannot POST → 403 FORBIDDEN", async () => {
    // Valid CSRF header so the request reaches the RBAC preHandler (CSRF runs first).
    const r = await suite.app.inject({
      method: "POST",
      url: "/v1/visualization-nodes",
      headers: { cookie: ch(userS.cookies), "x-csrf-token": userS.csrfToken, "content-type": "application/json" },
      payload: { graphId, sourceEntityType: "GENERIC", label: "Denied node" },
    });
    expect(r.statusCode).toBe(403);
    expect((r.json() as ErrEnvelope).error.code).toBe("FORBIDDEN");
  });

  it("POST without x-csrf-token → 403 CSRF_FAIL", async () => {
    const r = await suite.app.inject({
      method: "POST",
      url: "/v1/visualization-nodes",
      headers: { cookie: ch(platformS.cookies), "content-type": "application/json" },
      payload: { graphId, sourceEntityType: "GENERIC", label: "No csrf node" },
    });
    expect(r.statusCode).toBe(403);
    expect((r.json() as ErrEnvelope).error.code).toBe("CSRF_FAIL");
  });

  it("CREATE → GET by id happy path as PLATFORM_ADMIN", async () => {
    const label = `${SUITE_PREFIX}_HP`;
    const created = await suite.app.inject({
      method: "POST",
      url: "/v1/visualization-nodes",
      headers: { cookie: ch(platformS.cookies), "x-csrf-token": platformS.csrfToken, "content-type": "application/json" },
      payload: { graphId, sourceEntityType: "POSITION", label, type: "box", groupKey: "g1" },
    });
    expect(created.statusCode).toBe(201);
    const node = created.json() as NodeResponse;
    expect(typeof node.nodeId).toBe("string");
    expect(node.graphId).toBe(graphId);
    expect(node.label).toBe(label);
    createdNodeIds.push(node.nodeId);

    const got = await suite.app.inject({
      method: "GET",
      url: `/v1/visualization-nodes/${node.nodeId}`,
      headers: { cookie: ch(platformS.cookies) },
    });
    expect(got.statusCode).toBe(200);
    expect((got.json() as NodeResponse).nodeId).toBe(node.nodeId);
  });

  it("GET by random uuid → 404 NOT_FOUND", async () => {
    const r = await suite.app.inject({
      method: "GET",
      url: `/v1/visualization-nodes/${randomUUID()}`,
      headers: { cookie: ch(platformS.cookies) },
    });
    expect(r.statusCode).toBe(404);
    expect((r.json() as ErrEnvelope).error.code).toBe("NOT_FOUND");
  });

  it("PATCH updates label then DELETE removes the node (404 on re-GET)", async () => {
    const created = await suite.app.inject({
      method: "POST",
      url: "/v1/visualization-nodes",
      headers: { cookie: ch(platformS.cookies), "x-csrf-token": platformS.csrfToken, "content-type": "application/json" },
      payload: { graphId, sourceEntityType: "GENERIC", label: `${SUITE_PREFIX}_MUT` },
    });
    expect(created.statusCode).toBe(201);
    const node = created.json() as NodeResponse;
    createdNodeIds.push(node.nodeId);

    const patched = await suite.app.inject({
      method: "PATCH",
      url: `/v1/visualization-nodes/${node.nodeId}`,
      headers: { cookie: ch(platformS.cookies), "x-csrf-token": platformS.csrfToken, "content-type": "application/json" },
      payload: { label: `${SUITE_PREFIX}_MUT2` },
    });
    expect(patched.statusCode).toBe(200);
    expect((patched.json() as NodeResponse).label).toBe(`${SUITE_PREFIX}_MUT2`);

    const del = await suite.app.inject({
      method: "DELETE",
      url: `/v1/visualization-nodes/${node.nodeId}`,
      headers: { cookie: ch(platformS.cookies), "x-csrf-token": platformS.csrfToken },
    });
    expect(del.statusCode).toBe(204);

    const reGet = await suite.app.inject({
      method: "GET",
      url: `/v1/visualization-nodes/${node.nodeId}`,
      headers: { cookie: ch(platformS.cookies) },
    });
    expect(reGet.statusCode).toBe(404);
    expect((reGet.json() as ErrEnvelope).error.code).toBe("NOT_FOUND");
  });
});
