/**
 * apps/api/test/learning-modules.integration.test.ts
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { pool, closePool } from "../src/db/client.js";
import { TEST_PERSONA_PASSWORD } from "./helpers/personas.js";

const PWD = TEST_PERSONA_PASSWORD;
const SUITE_PREFIX = `IT_LM_${randomUUID().slice(0, 8).toUpperCase()}`;

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
const createdIds: string[] = [];

describe("/v1/learning-modules/* integration", () => {
  beforeAll(async () => {
    suite = await buildTestApp();
    platformS = await login(suite, "admin@heuresys.com");
    tenantS = await login(suite, "federica.marchetti@rtl-bank.org");
  });

  afterAll(async () => {
    for (const id of createdIds) {
      try { await pool.query(`DELETE FROM sys.sys_learning_modules WHERE learning_module_id = $1`, [id]); }
      catch { /* ignore */ }
    }
    await suite.app.close();
    await closePool();
  });

  it("CREATE tenant learning module as TENANT_ADMIN; LIST returns it", async () => {
    const code = `${SUITE_PREFIX}_TENANT`;
    const created = await suite.app.inject({
      method: "POST", url: "/v1/learning-modules",
      headers: { cookie: ch(tenantS.cookies), "x-csrf-token": tenantS.csrfToken, "content-type": "application/json" },
      payload: { code, title: "Tenant Course", kind: "COURSE", delivery: "SELF_PACED", durationMinutes: 120 },
    });
    expect(created.statusCode).toBe(201);
    const m = created.json() as { learningModuleId: string; isGlobal: boolean; durationMinutes: number };
    expect(m.isGlobal).toBe(false);
    expect(m.durationMinutes).toBe(120);
    createdIds.push(m.learningModuleId);
  });

  it("CREATE global module as PLATFORM_ADMIN; visible to tenant admin", async () => {
    const code = `${SUITE_PREFIX}_GLOBAL`;
    const created = await suite.app.inject({
      method: "POST", url: "/v1/learning-modules",
      headers: { cookie: ch(platformS.cookies), "x-csrf-token": platformS.csrfToken, "content-type": "application/json" },
      payload: { code, title: "Global Workshop", kind: "WORKSHOP", delivery: "INSTRUCTOR_LED", isGlobal: true },
    });
    expect(created.statusCode).toBe(201);
    const m = created.json() as { learningModuleId: string; isGlobal: boolean };
    expect(m.isGlobal).toBe(true);
    createdIds.push(m.learningModuleId);

    const visible = await suite.app.inject({
      method: "GET", url: `/v1/learning-modules/${m.learningModuleId}`,
      headers: { cookie: ch(tenantS.cookies) },
    });
    expect(visible.statusCode).toBe(200);
  });

  it("Update global as TENANT_ADMIN → 403 GLOBAL_LEARNING_EDIT_FORBIDDEN", async () => {
    const code = `${SUITE_PREFIX}_LOCKED`;
    const created = await suite.app.inject({
      method: "POST", url: "/v1/learning-modules",
      headers: { cookie: ch(platformS.cookies), "x-csrf-token": platformS.csrfToken, "content-type": "application/json" },
      payload: { code, title: "Locked", isGlobal: true },
    });
    const { learningModuleId } = created.json() as { learningModuleId: string };
    createdIds.push(learningModuleId);

    const blocked = await suite.app.inject({
      method: "PATCH", url: `/v1/learning-modules/${learningModuleId}`,
      headers: { cookie: ch(tenantS.cookies), "x-csrf-token": tenantS.csrfToken, "content-type": "application/json" },
      payload: { title: "Try Rename" },
    });
    expect(blocked.statusCode).toBe(403);
    expect((blocked.json() as { error: { code: string } }).error.code).toBe("GLOBAL_LEARNING_EDIT_FORBIDDEN");
  });

  it("Invalid kind value → 400 VALIDATION_ERROR", async () => {
    const r = await suite.app.inject({
      method: "POST", url: "/v1/learning-modules",
      headers: { cookie: ch(tenantS.cookies), "x-csrf-token": tenantS.csrfToken, "content-type": "application/json" },
      payload: { code: `${SUITE_PREFIX}_BAD`, title: "Bad", kind: "NOPE" },
    });
    expect(r.statusCode).toBe(400);
    expect((r.json() as { error: { code: string } }).error.code).toBe("VALIDATION_ERROR");
  });
});
