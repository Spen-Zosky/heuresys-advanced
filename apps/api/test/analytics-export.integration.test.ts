/**
 * apps/api/test/analytics-export.integration.test.ts
 * Integration tests for the analytics export endpoint:
 *   GET /v1/analytics/:view/export?format=csv|json
 *
 * Hits the live OCI VM DB through the tunnel (no mocks). Asserts the same RBAC
 * gate as the views, the multi-section CSV shape, the JSON download envelope,
 * and Zod 400s on bad slug/format. The headcount is derived live (no pinned counts).
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { closePool, pool } from "../src/db/client.js";
import { TEST_PERSONA_PASSWORD } from "./helpers/personas.js";

const PWD = TEST_PERSONA_PASSWORD;

interface S {
  cookies: Map<string, string>;
}
function ch(c: Map<string, string>) {
  return [...c.entries()].map(([n, v]) => `${n}=${v}`).join("; ");
}
async function login(t: TestApp, email: string): Promise<S> {
  const r = await loginRaw(t.app, email, PWD);
  const cookies = new Map<string, string>();
  for (const c of r.cookies) cookies.set(c.name, c.value);
  return { cookies };
}

let suite: TestApp;
let platformS: S;
let employeeS: S;

describe("GET /v1/analytics/:view/export integration", () => {
  beforeAll(async () => {
    suite = await buildTestApp();
    platformS = await login(suite, "admin@heuresys.com");
    employeeS = await login(suite, "tommaso.fiore@rtl-bank.org");
  });

  afterAll(async () => {
    await suite.app.close();
    await closePool();
  });

  it("unauthenticated → 401", async () => {
    const r = await suite.app.inject({ method: "GET", url: "/v1/analytics/workforce/export" });
    expect(r.statusCode).toBe(401);
  });

  it("USER (employee) lacks analytics:view → 403", async () => {
    const r = await suite.app.inject({
      method: "GET",
      url: "/v1/analytics/workforce/export",
      headers: { cookie: ch(employeeS.cookies) },
    });
    expect(r.statusCode).toBe(403);
    expect((r.json() as { error: { code: string } }).error.code).toBe("FORBIDDEN");
  });

  it("invalid view slug → 400 (Zod)", async () => {
    const r = await suite.app.inject({
      method: "GET",
      url: "/v1/analytics/not-a-view/export",
      headers: { cookie: ch(platformS.cookies) },
    });
    expect(r.statusCode).toBe(400);
  });

  it("invalid format → 400 (Zod)", async () => {
    const r = await suite.app.inject({
      method: "GET",
      url: "/v1/analytics/workforce/export?format=xml",
      headers: { cookie: ch(platformS.cookies) },
    });
    expect(r.statusCode).toBe(400);
  });

  it("workforce CSV (default format): multi-section + live data + download headers", async () => {
    const r = await suite.app.inject({
      method: "GET",
      url: "/v1/analytics/workforce/export",
      headers: { cookie: ch(platformS.cookies) },
    });
    expect(r.statusCode).toBe(200);
    expect(r.headers["content-type"]).toContain("text/csv");
    expect(r.headers["content-disposition"]).toContain('attachment; filename="analytics-workforce-');
    expect(r.headers["content-disposition"]).toContain('.csv"');
    const body = r.body;
    // summary section carries the scalars (flattened scope.* + totalHeadcount).
    expect(body).toContain("# summary");
    expect(body).toContain("key,value");
    expect(body).toContain("scope.kind,PLATFORM");
    const { rows } = await pool.query<{ n: string }>(`SELECT count(*)::text AS n FROM sys.sys_users`);
    expect(body).toContain(`totalHeadcount,${rows[0]!.n}`);
    // breakdown arrays become their own sections.
    expect(body).toContain("# byOrgUnit");
    expect(body).toContain("# byJobRole");
    expect(body).toContain("dimension,headcount");
  });

  it("workforce JSON: download envelope + parseable payload (headcount derived live)", async () => {
    const r = await suite.app.inject({
      method: "GET",
      url: "/v1/analytics/workforce/export?format=json",
      headers: { cookie: ch(platformS.cookies) },
    });
    expect(r.statusCode).toBe(200);
    expect(r.headers["content-type"]).toContain("application/json");
    expect(r.headers["content-disposition"]).toContain('analytics-workforce-');
    expect(r.headers["content-disposition"]).toContain('.json"');
    const parsed = JSON.parse(r.body) as { totalHeadcount: number; scope: { kind: string } };
    const { rows } = await pool.query<{ n: string }>(`SELECT count(*)::text AS n FROM sys.sys_users`);
    expect(parsed.totalHeadcount).toBe(Number(rows[0]!.n));
    expect(parsed.scope.kind).toBe("PLATFORM");
  });

  it("skills-group-share CSV: flattener handles a different view shape", async () => {
    const r = await suite.app.inject({
      method: "GET",
      url: "/v1/analytics/skills-group-share/export?format=csv",
      headers: { cookie: ch(platformS.cookies) },
    });
    expect(r.statusCode).toBe(200);
    expect(r.headers["content-type"]).toContain("text/csv");
    const body = r.body;
    expect(body).toContain("# summary");
    expect(body).toContain("totalSkills,");
    expect(body).toContain("# groups");
  });
});
