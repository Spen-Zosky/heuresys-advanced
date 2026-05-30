/**
 * apps/api/test/learning-path-steps.integration.test.ts
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { pool, closePool } from "../src/db/client.js";

const PWD = "Admin#PassW0rd!";
const SUITE_PREFIX = `IT_LPS_${randomUUID().slice(0, 8).toUpperCase()}`;

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
let pathId: string;
let moduleId: string;
const createdStepIds: string[] = [];
const createdPathIds: string[] = [];
const createdModuleIds: string[] = [];

describe("/v1/learning-path-steps integration", () => {
  beforeAll(async () => {
    suite = await buildTestApp();
    tenantS = await login(suite, "federica.marchetti@rtl-bank.org");

    const mr = await suite.app.inject({
      method: "POST", url: "/v1/learning-modules",
      headers: { cookie: ch(tenantS.cookies), "x-csrf-token": tenantS.csrfToken, "content-type": "application/json" },
      payload: { code: `${SUITE_PREFIX}_MOD`, title: "Step Module" },
    });
    if (mr.statusCode !== 201) throw new Error(`module setup: ${mr.statusCode}`);
    moduleId = (mr.json() as { learningModuleId: string }).learningModuleId;
    createdModuleIds.push(moduleId);

    const pr = await suite.app.inject({
      method: "POST", url: "/v1/learning-paths",
      headers: { cookie: ch(tenantS.cookies), "x-csrf-token": tenantS.csrfToken, "content-type": "application/json" },
      payload: { code: `${SUITE_PREFIX}_PATH`, name: "Path for steps" },
    });
    if (pr.statusCode !== 201) throw new Error(`path setup: ${pr.statusCode}`);
    pathId = (pr.json() as { learningPathId: string }).learningPathId;
    createdPathIds.push(pathId);
  });

  afterAll(async () => {
    for (const id of createdStepIds) {
      try { await pool.query(`DELETE FROM sys.sys_learning_path_steps WHERE learning_path_step_id = $1`, [id]); }
      catch { /* ignore */ }
    }
    for (const id of createdPathIds) {
      try { await pool.query(`DELETE FROM sys.sys_learning_paths WHERE learning_path_id = $1`, [id]); }
      catch { /* ignore */ }
    }
    for (const id of createdModuleIds) {
      try { await pool.query(`DELETE FROM sys.sys_learning_modules WHERE learning_module_id = $1`, [id]); }
      catch { /* ignore */ }
    }
    await suite.app.close();
    await closePool();
  });

  it("CREATE happy path then LIST shows step in path", async () => {
    const c = await suite.app.inject({
      method: "POST", url: "/v1/learning-path-steps",
      headers: { cookie: ch(tenantS.cookies), "x-csrf-token": tenantS.csrfToken, "content-type": "application/json" },
      payload: { pathId, moduleId, ordinal: 1 },
    });
    expect(c.statusCode).toBe(201);
    const s = c.json() as { learningPathStepId: string; ordinal: number };
    expect(s.ordinal).toBe(1);
    createdStepIds.push(s.learningPathStepId);

    const list = await suite.app.inject({
      method: "GET", url: `/v1/learning-path-steps?pathId=${pathId}`,
      headers: { cookie: ch(tenantS.cookies) },
    });
    expect(list.statusCode).toBe(200);
    const body = list.json() as { items: Array<{ learningPathStepId: string }>; total: number };
    expect(body.total).toBeGreaterThanOrEqual(1);
  });

  it("Duplicate ordinal in same path → 409 LEARNING_PATH_STEP_ORDINAL_CONFLICT", async () => {
    const dup = await suite.app.inject({
      method: "POST", url: "/v1/learning-path-steps",
      headers: { cookie: ch(tenantS.cookies), "x-csrf-token": tenantS.csrfToken, "content-type": "application/json" },
      payload: { pathId, moduleId, ordinal: 1 },
    });
    expect(dup.statusCode).toBe(409);
    expect((dup.json() as { error: { code: string } }).error.code).toBe("LEARNING_PATH_STEP_ORDINAL_CONFLICT");
  });

  it("Non-existent module → 404 LearningModule", async () => {
    const r = await suite.app.inject({
      method: "POST", url: "/v1/learning-path-steps",
      headers: { cookie: ch(tenantS.cookies), "x-csrf-token": tenantS.csrfToken, "content-type": "application/json" },
      payload: { pathId, moduleId: randomUUID(), ordinal: 99 },
    });
    expect(r.statusCode).toBe(404);
    expect((r.json() as { error: { code: string } }).error.code).toBe("NOT_FOUND");
  });

  it("Parent path with steps cannot be deleted → 409 LEARNING_PATH_HAS_STEPS", async () => {
    const r = await suite.app.inject({
      method: "DELETE", url: `/v1/learning-paths/${pathId}`,
      headers: { cookie: ch(tenantS.cookies), "x-csrf-token": tenantS.csrfToken },
    });
    expect(r.statusCode).toBe(409);
    expect((r.json() as { error: { code: string } }).error.code).toBe("LEARNING_PATH_HAS_STEPS");
  });

  it("PATCH ordinal moves step", async () => {
    const c = await suite.app.inject({
      method: "POST", url: "/v1/learning-path-steps",
      headers: { cookie: ch(tenantS.cookies), "x-csrf-token": tenantS.csrfToken, "content-type": "application/json" },
      payload: { pathId, moduleId, ordinal: 7 },
    });
    expect(c.statusCode).toBe(201);
    const sid = (c.json() as { learningPathStepId: string }).learningPathStepId;
    createdStepIds.push(sid);

    const p = await suite.app.inject({
      method: "PATCH", url: `/v1/learning-path-steps/${sid}`,
      headers: { cookie: ch(tenantS.cookies), "x-csrf-token": tenantS.csrfToken, "content-type": "application/json" },
      payload: { ordinal: 8 },
    });
    expect(p.statusCode).toBe(200);
    expect((p.json() as { ordinal: number }).ordinal).toBe(8);
  });
});
