/**
 * apps/api/test/learning-paths.integration.test.ts
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { pool, closePool } from "../src/db/client.js";

const PWD = "Admin#PassW0rd!";
const SUITE_PREFIX = `IT_LP_${randomUUID().slice(0, 8).toUpperCase()}`;

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
let platformS: S;
let tenantS: S;
const createdPathIds: string[] = [];

describe("/v1/learning-paths integration", () => {
  beforeAll(async () => {
    suite = await buildTestApp();
    platformS = await login(suite, "admin@heuresys.com");
    tenantS = await login(suite, "federica.marchetti@rtl-bank.org");
  });

  afterAll(async () => {
    for (const id of createdPathIds) {
      try { await pool.query(`DELETE FROM sys.sys_learning_paths WHERE learning_path_id = $1`, [id]); }
      catch { /* ignore */ }
    }
    await suite.app.close();
    await closePool();
  });

  it("CREATE / LIST / GET as TENANT_ADMIN happy path", async () => {
    const created = await suite.app.inject({
      method: "POST", url: "/v1/learning-paths",
      headers: { cookie: ch(tenantS.cookies), "x-csrf-token": tenantS.csrfToken, "content-type": "application/json" },
      payload: { code: `${SUITE_PREFIX}_HP`, name: "Onboarding Track A", description: "Quick start" },
    });
    expect(created.statusCode).toBe(201);
    const p = created.json() as { learningPathId: string; isGlobal: boolean; tenantId: string | null };
    expect(p.isGlobal).toBe(false);
    expect(p.tenantId).not.toBeNull();
    createdPathIds.push(p.learningPathId);

    const got = await suite.app.inject({
      method: "GET", url: `/v1/learning-paths/${p.learningPathId}`,
      headers: { cookie: ch(tenantS.cookies) },
    });
    expect(got.statusCode).toBe(200);

    const list = await suite.app.inject({
      method: "GET", url: `/v1/learning-paths?search=${SUITE_PREFIX}`,
      headers: { cookie: ch(tenantS.cookies) },
    });
    expect(list.statusCode).toBe(200);
  });

  it("Global path requires PLATFORM_ADMIN to create", async () => {
    const g = await suite.app.inject({
      method: "POST", url: "/v1/learning-paths",
      headers: { cookie: ch(platformS.cookies), "x-csrf-token": platformS.csrfToken, "content-type": "application/json" },
      payload: { code: `${SUITE_PREFIX}_GLOBAL`, name: "Cross-tenant Path", isGlobal: true },
    });
    expect(g.statusCode).toBe(201);
    const gp = g.json() as { learningPathId: string; isGlobal: boolean; tenantId: string | null };
    expect(gp.isGlobal).toBe(true);
    expect(gp.tenantId).toBeNull();
    createdPathIds.push(gp.learningPathId);

    const patch = await suite.app.inject({
      method: "PATCH", url: `/v1/learning-paths/${gp.learningPathId}`,
      headers: { cookie: ch(tenantS.cookies), "x-csrf-token": tenantS.csrfToken, "content-type": "application/json" },
      payload: { name: "Hijack attempt" },
    });
    expect(patch.statusCode).toBe(403);
    expect((patch.json() as { error: { code: string } }).error.code).toBe("GLOBAL_LEARNING_PATH_EDIT_FORBIDDEN");
  });

  it("Duplicate code in same scope → 409 LEARNING_PATH_CODE_CONFLICT", async () => {
    const code = `${SUITE_PREFIX}_DUP`;
    const first = await suite.app.inject({
      method: "POST", url: "/v1/learning-paths",
      headers: { cookie: ch(tenantS.cookies), "x-csrf-token": tenantS.csrfToken, "content-type": "application/json" },
      payload: { code, name: "Dup-1" },
    });
    expect(first.statusCode).toBe(201);
    createdPathIds.push((first.json() as { learningPathId: string }).learningPathId);

    const dup = await suite.app.inject({
      method: "POST", url: "/v1/learning-paths",
      headers: { cookie: ch(tenantS.cookies), "x-csrf-token": tenantS.csrfToken, "content-type": "application/json" },
      payload: { code, name: "Dup-2" },
    });
    expect(dup.statusCode).toBe(409);
    expect((dup.json() as { error: { code: string } }).error.code).toBe("LEARNING_PATH_CODE_CONFLICT");
  });

  it("PATCH name then DELETE empty path", async () => {
    const created = await suite.app.inject({
      method: "POST", url: "/v1/learning-paths",
      headers: { cookie: ch(tenantS.cookies), "x-csrf-token": tenantS.csrfToken, "content-type": "application/json" },
      payload: { code: `${SUITE_PREFIX}_DEL`, name: "To Delete" },
    });
    const pid = (created.json() as { learningPathId: string }).learningPathId;
    createdPathIds.push(pid);

    const patched = await suite.app.inject({
      method: "PATCH", url: `/v1/learning-paths/${pid}`,
      headers: { cookie: ch(tenantS.cookies), "x-csrf-token": tenantS.csrfToken, "content-type": "application/json" },
      payload: { name: "Renamed" },
    });
    expect(patched.statusCode).toBe(200);
    expect((patched.json() as { name: string }).name).toBe("Renamed");

    const del = await suite.app.inject({
      method: "DELETE", url: `/v1/learning-paths/${pid}`,
      headers: { cookie: ch(tenantS.cookies), "x-csrf-token": tenantS.csrfToken },
    });
    expect(del.statusCode).toBe(204);
  });
});
