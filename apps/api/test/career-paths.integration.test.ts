/**
 * apps/api/test/career-paths.integration.test.ts
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { pool, closePool } from "../src/db/client.js";

const PWD = "Admin#PassW0rd!";
const SUITE_PREFIX = `IT_CP_${randomUUID().slice(0, 8).toUpperCase()}`;

interface S { cookies: Map<string, string>; csrfToken: string; userId: string }
function ch(c: Map<string, string>) { return [...c.entries()].map(([n, v]) => `${n}=${v}`).join("; "); }
async function login(t: TestApp, email: string): Promise<S> {
  const r = await loginRaw(t.app, email, PWD);
  const cookies = new Map<string, string>();
  for (const c of r.cookies) cookies.set(c.name, c.value);
  const body = r.json() as { csrfToken: string; user: { userId: string } };
  return { cookies, csrfToken: body.csrfToken, userId: body.user.userId };
}

let suite: TestApp;
let platformS: S;
let tenantS: S;
const createdIds: string[] = [];

describe("/v1/career-paths integration", () => {
  beforeAll(async () => {
    suite = await buildTestApp();
    platformS = await login(suite, "admin@heuresys.com");
    tenantS = await login(suite, "federica.marchetti@rtl-bank.org");
  });

  afterAll(async () => {
    for (const id of createdIds) {
      try { await pool.query(`DELETE FROM sys.sys_career_paths WHERE career_path_id = $1`, [id]); }
      catch { /* ignore */ }
    }
    await suite.app.close();
    await closePool();
  });

  it("CREATE / LIST / GET as TENANT_ADMIN", async () => {
    const c = await suite.app.inject({
      method: "POST", url: "/v1/career-paths",
      headers: { cookie: ch(tenantS.cookies), "x-csrf-token": tenantS.csrfToken, "content-type": "application/json" },
      payload: { code: `${SUITE_PREFIX}_HP`, name: "Junior to Senior", kind: "VERTICAL" },
    });
    expect(c.statusCode).toBe(201);
    const p = c.json() as { careerPathId: string; isGlobal: boolean; kind: string };
    expect(p.kind).toBe("VERTICAL");
    expect(p.isGlobal).toBe(false);
    createdIds.push(p.careerPathId);

    const got = await suite.app.inject({
      method: "GET", url: `/v1/career-paths/${p.careerPathId}`,
      headers: { cookie: ch(tenantS.cookies) },
    });
    expect(got.statusCode).toBe(200);
  });

  it("Global path: PLATFORM_ADMIN may create; non-platform cannot edit it", async () => {
    const c = await suite.app.inject({
      method: "POST", url: "/v1/career-paths",
      headers: { cookie: ch(platformS.cookies), "x-csrf-token": platformS.csrfToken, "content-type": "application/json" },
      payload: { code: `${SUITE_PREFIX}_GLOBAL`, name: "Universal Lead Track", kind: "MANAGERIAL", isGlobal: true },
    });
    expect(c.statusCode).toBe(201);
    const p = c.json() as { careerPathId: string; isGlobal: boolean };
    expect(p.isGlobal).toBe(true);
    createdIds.push(p.careerPathId);

    const patch = await suite.app.inject({
      method: "PATCH", url: `/v1/career-paths/${p.careerPathId}`,
      headers: { cookie: ch(tenantS.cookies), "x-csrf-token": tenantS.csrfToken, "content-type": "application/json" },
      payload: { name: "Hijack" },
    });
    expect(patch.statusCode).toBe(403);
    expect((patch.json() as { error: { code: string } }).error.code).toBe("GLOBAL_CAREER_PATH_EDIT_FORBIDDEN");
  });

  it("Duplicate code in same scope → 409 CAREER_PATH_CODE_CONFLICT", async () => {
    const code = `${SUITE_PREFIX}_DUP`;
    const first = await suite.app.inject({
      method: "POST", url: "/v1/career-paths",
      headers: { cookie: ch(tenantS.cookies), "x-csrf-token": tenantS.csrfToken, "content-type": "application/json" },
      payload: { code, name: "Dup-1" },
    });
    expect(first.statusCode).toBe(201);
    createdIds.push((first.json() as { careerPathId: string }).careerPathId);

    const dup = await suite.app.inject({
      method: "POST", url: "/v1/career-paths",
      headers: { cookie: ch(tenantS.cookies), "x-csrf-token": tenantS.csrfToken, "content-type": "application/json" },
      payload: { code, name: "Dup-2" },
    });
    expect(dup.statusCode).toBe(409);
    expect((dup.json() as { error: { code: string } }).error.code).toBe("CAREER_PATH_CODE_CONFLICT");
  });

  it("PATCH then DELETE empty path", async () => {
    const c = await suite.app.inject({
      method: "POST", url: "/v1/career-paths",
      headers: { cookie: ch(tenantS.cookies), "x-csrf-token": tenantS.csrfToken, "content-type": "application/json" },
      payload: { code: `${SUITE_PREFIX}_DEL`, name: "To delete" },
    });
    const pid = (c.json() as { careerPathId: string }).careerPathId;
    createdIds.push(pid);

    const p = await suite.app.inject({
      method: "PATCH", url: `/v1/career-paths/${pid}`,
      headers: { cookie: ch(tenantS.cookies), "x-csrf-token": tenantS.csrfToken, "content-type": "application/json" },
      payload: { name: "Renamed", kind: "LATERAL" },
    });
    expect(p.statusCode).toBe(200);
    expect((p.json() as { kind: string }).kind).toBe("LATERAL");

    const del = await suite.app.inject({
      method: "DELETE", url: `/v1/career-paths/${pid}`,
      headers: { cookie: ch(tenantS.cookies), "x-csrf-token": tenantS.csrfToken },
    });
    expect(del.statusCode).toBe(204);
  });
});
