/**
 * apps/api/test/visualizations.integration.test.ts
 * Single suite exercises the full visualization pipeline:
 *   graph → nodes → edge → layout → node_layout → style → export.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { pool, closePool } from "../src/db/client.js";

const PWD = "Admin#PassW0rd!";
const SUITE_PREFIX = `IT_VIZ_${randomUUID().slice(0, 8).toUpperCase()}`;

interface S { cookies: Map<string, string>; csrfToken: string; userId: string }
function ch(c: Map<string, string>) { return [...c.entries()].map(([n, v]) => `${n}=${v}`).join("; "); }
async function login(t: TestApp, email: string): Promise<S> {
  const r = await t.app.inject({ method: "POST", url: "/v1/auth/login", payload: { email, password: PWD } });
  if (r.statusCode !== 200) throw new Error(`login ${email}: ${r.statusCode}`);
  const cookies = new Map<string, string>();
  for (const c of r.cookies) cookies.set(c.name, c.value);
  const body = r.json() as { csrfToken: string; user: { userId: string } };
  return { cookies, csrfToken: body.csrfToken, userId: body.user.userId };
}

let suite: TestApp;
let tenantS: S;
let graphId: string;
let nodeAId: string;
let nodeBId: string;
let edgeId: string;
let layoutId: string;
let nodeLayoutId: string;
let styleId: string;
let exportId: string;

describe("/v1/visualization-* end-to-end pipeline", () => {
  beforeAll(async () => {
    suite = await buildTestApp();
    tenantS = await login(suite, "federica.marchetti@rtl-bank.org");
  });

  afterAll(async () => {
    // Cascade delete via graph FKs handles everything except the graph itself.
    if (graphId) {
      try { await pool.query(`DELETE FROM sys.sys_visualization_graphs WHERE graph_id = $1`, [graphId]); }
      catch { /* ignore */ }
    }
    await suite.app.close();
    await closePool();
  });

  it("creates graph + 2 nodes + edge + layout + node_layout + style + export", async () => {
    const g = await suite.app.inject({
      method: "POST", url: "/v1/visualization-graphs",
      headers: { cookie: ch(tenantS.cookies), "x-csrf-token": tenantS.csrfToken, "content-type": "application/json" },
      payload: { code: `${SUITE_PREFIX}_GRAPH`, type: "ORG_CHART", name: "End-to-end test graph" },
    });
    expect(g.statusCode).toBe(201);
    graphId = (g.json() as { graphId: string }).graphId;

    const nA = await suite.app.inject({
      method: "POST", url: "/v1/visualization-nodes",
      headers: { cookie: ch(tenantS.cookies), "x-csrf-token": tenantS.csrfToken, "content-type": "application/json" },
      payload: { graphId, sourceEntityType: "POSITION", label: "CEO", type: "ROOT" },
    });
    expect(nA.statusCode).toBe(201);
    nodeAId = (nA.json() as { nodeId: string }).nodeId;

    const nB = await suite.app.inject({
      method: "POST", url: "/v1/visualization-nodes",
      headers: { cookie: ch(tenantS.cookies), "x-csrf-token": tenantS.csrfToken, "content-type": "application/json" },
      payload: { graphId, sourceEntityType: "POSITION", label: "CTO" },
    });
    expect(nB.statusCode).toBe(201);
    nodeBId = (nB.json() as { nodeId: string }).nodeId;

    const e = await suite.app.inject({
      method: "POST", url: "/v1/visualization-edges",
      headers: { cookie: ch(tenantS.cookies), "x-csrf-token": tenantS.csrfToken, "content-type": "application/json" },
      payload: { graphId, sourceNodeId: nodeBId, targetNodeId: nodeAId, type: "REPORTS_TO", weight: 1.0 },
    });
    expect(e.statusCode).toBe(201);
    edgeId = (e.json() as { edgeId: string }).edgeId;

    const l = await suite.app.inject({
      method: "POST", url: "/v1/visualization-layouts",
      headers: { cookie: ch(tenantS.cookies), "x-csrf-token": tenantS.csrfToken, "content-type": "application/json" },
      payload: { graphId, engine: "DAGRE", isDefault: true },
    });
    expect(l.statusCode).toBe(201);
    layoutId = (l.json() as { layoutId: string }).layoutId;

    const nl = await suite.app.inject({
      method: "PUT", url: "/v1/visualization-node-layouts",
      headers: { cookie: ch(tenantS.cookies), "x-csrf-token": tenantS.csrfToken, "content-type": "application/json" },
      payload: { layoutId, nodeId: nodeAId, x: 100, y: 200, locked: true },
    });
    expect(nl.statusCode).toBe(200);
    nodeLayoutId = (nl.json() as { nodeLayoutId: string }).nodeLayoutId;

    const s = await suite.app.inject({
      method: "POST", url: "/v1/visualization-styles",
      headers: { cookie: ch(tenantS.cookies), "x-csrf-token": tenantS.csrfToken, "content-type": "application/json" },
      payload: { graphId, nodeType: "ROOT", color: "#0a84ff", icon: "crown" },
    });
    expect(s.statusCode).toBe(201);
    styleId = (s.json() as { styleId: string }).styleId;

    const ex = await suite.app.inject({
      method: "POST", url: "/v1/visualization-exports",
      headers: { cookie: ch(tenantS.cookies), "x-csrf-token": tenantS.csrfToken, "content-type": "application/json" },
      payload: { graphId, layoutId, format: "REACT_FLOW_JSON", payloadUri: "memory://test.json" },
    });
    expect(ex.statusCode).toBe(201);
    exportId = (ex.json() as { exportId: string }).exportId;
  });

  it("list endpoints return the seeded entities", async () => {
    const checks: Array<{ url: string; expectId: string }> = [
      { url: `/v1/visualization-nodes?graphId=${graphId}`, expectId: nodeAId },
      { url: `/v1/visualization-edges?graphId=${graphId}`, expectId: edgeId },
      { url: `/v1/visualization-layouts?graphId=${graphId}`, expectId: layoutId },
      { url: `/v1/visualization-node-layouts?layoutId=${layoutId}`, expectId: nodeLayoutId },
      { url: `/v1/visualization-styles?graphId=${graphId}`, expectId: styleId },
      { url: `/v1/visualization-exports?graphId=${graphId}`, expectId: exportId },
    ];
    for (const c of checks) {
      const r = await suite.app.inject({ method: "GET", url: c.url, headers: { cookie: ch(tenantS.cookies) } });
      expect(r.statusCode).toBe(200);
      const body = r.json() as { items: Array<{ [k: string]: string }>; total: number };
      expect(body.total).toBeGreaterThanOrEqual(1);
    }
  });

  it("edge with node from another graph → 403 EDGE_NODE_GRAPH_MISMATCH", async () => {
    const g2 = await suite.app.inject({
      method: "POST", url: "/v1/visualization-graphs",
      headers: { cookie: ch(tenantS.cookies), "x-csrf-token": tenantS.csrfToken, "content-type": "application/json" },
      payload: { code: `${SUITE_PREFIX}_G2`, type: "PROCESS_FLOW", name: "Second graph" },
    });
    expect(g2.statusCode).toBe(201);
    const g2Id = (g2.json() as { graphId: string }).graphId;

    const orphanNode = await suite.app.inject({
      method: "POST", url: "/v1/visualization-nodes",
      headers: { cookie: ch(tenantS.cookies), "x-csrf-token": tenantS.csrfToken, "content-type": "application/json" },
      payload: { graphId: g2Id, sourceEntityType: "GENERIC", label: "Orphan" },
    });
    const orphanNodeId = (orphanNode.json() as { nodeId: string }).nodeId;

    const bad = await suite.app.inject({
      method: "POST", url: "/v1/visualization-edges",
      headers: { cookie: ch(tenantS.cookies), "x-csrf-token": tenantS.csrfToken, "content-type": "application/json" },
      payload: { graphId, sourceNodeId: orphanNodeId, targetNodeId: nodeAId, type: "GENERIC" },
    });
    expect(bad.statusCode).toBe(403);
    expect((bad.json() as { error: { code: string } }).error.code).toBe("EDGE_NODE_GRAPH_MISMATCH");

    await pool.query(`DELETE FROM sys.sys_visualization_graphs WHERE graph_id = $1`, [g2Id]);
  });

  it("PUT node-layout is idempotent on (layout, node)", async () => {
    const second = await suite.app.inject({
      method: "PUT", url: "/v1/visualization-node-layouts",
      headers: { cookie: ch(tenantS.cookies), "x-csrf-token": tenantS.csrfToken, "content-type": "application/json" },
      payload: { layoutId, nodeId: nodeAId, x: 150, y: 250, locked: false },
    });
    expect(second.statusCode).toBe(200);
    const r = second.json() as { nodeLayoutId: string; x: number; locked: boolean };
    expect(r.nodeLayoutId).toBe(nodeLayoutId);
    expect(r.x).toBe(150);
    expect(r.locked).toBe(false);
  });

  it("GET /summary as TENANT_ADMIN → 200 with seeded ORG_CHART bucket", async () => {
    const r = await suite.app.inject({
      method: "GET", url: `/v1/visualization-graphs/summary`,
      headers: { cookie: ch(tenantS.cookies) },
    });
    expect(r.statusCode).toBe(200);
    const body = r.json() as { total: number; items: Array<{ type: string; count: number }> };
    expect(body.total).toBeGreaterThanOrEqual(1);
    const org = body.items.find((i) => i.type === "ORG_CHART");
    expect(org).toBeDefined();
    expect(org!.count).toBeGreaterThanOrEqual(1);
    expect(body.items.reduce((s, i) => s + i.count, 0)).toBe(body.total);
  });

  it("GET /:id/render returns the graph with its nodes and edges", async () => {
    const r = await suite.app.inject({
      method: "GET", url: `/v1/visualization-graphs/${graphId}/render`,
      headers: { cookie: ch(tenantS.cookies) },
    });
    expect(r.statusCode).toBe(200);
    const body = r.json() as { graph: { graphId: string }; nodes: unknown[]; edges: unknown[] };
    expect(body.graph.graphId).toBe(graphId);
    expect(body.nodes.length).toBeGreaterThanOrEqual(2);
    expect(body.edges.length).toBeGreaterThanOrEqual(1);
  });
});
