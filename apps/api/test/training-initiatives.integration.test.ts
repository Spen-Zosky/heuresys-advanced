/**
 * apps/api/test/training-initiatives.integration.test.ts
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { pool, closePool } from "../src/db/client.js";

const PWD = "Admin#PassW0rd!";
const SUITE_PREFIX = `IT_TI_${randomUUID().slice(0, 8).toUpperCase()}`;

interface S { cookies: Map<string, string>; csrfToken: string; userId: string }
function ch(c: Map<string, string>) { return [...c.entries()].map(([n, v]) => `${n}=${v}`).join("; "); }
async function login(t: TestApp, email: string): Promise<S> {
  const r = await t.app.inject({ method: "POST", url: "/v1/auth/login", payload: { email, password: PWD } });
  if (r.statusCode !== 200) throw new Error(`login: ${r.statusCode}`);
  const cookies = new Map<string, string>();
  for (const c of r.cookies) cookies.set(c.name, c.value);
  const body = r.json() as { csrfToken: string; userId: string };
  return { cookies, csrfToken: body.csrfToken, userId: body.userId };
}

let suite: TestApp;
let platformS: S;
let tenantS: S;
let managerS: S;
let globalModuleId: string;
const createdTiIds: string[] = [];
const createdModuleIds: string[] = [];

describe("/v1/training-initiatives/* integration", () => {
  beforeAll(async () => {
    suite = await buildTestApp();
    platformS = await login(suite, "admin@heuresys.com");
    tenantS = await login(suite, "tenant_admin_test@rtl-bank.test");
    managerS = await login(suite, "manager_test@rtl-bank.test");
    const g = await suite.app.inject({
      method: "POST", url: "/v1/learning-modules",
      headers: { cookie: ch(platformS.cookies), "x-csrf-token": platformS.csrfToken, "content-type": "application/json" },
      payload: { code: `${SUITE_PREFIX}_GLOBAL_MOD`, title: "Global Cohort Module", isGlobal: true },
    });
    globalModuleId = (g.json() as { learningModuleId: string }).learningModuleId;
    createdModuleIds.push(globalModuleId);
  });

  afterAll(async () => {
    for (const id of createdTiIds) {
      try { await pool.query(`DELETE FROM sys.sys_training_initiatives WHERE training_initiative_id = $1`, [id]); }
      catch { /* ignore */ }
    }
    for (const id of createdModuleIds) {
      try { await pool.query(`DELETE FROM sys.sys_learning_modules WHERE learning_module_id = $1`, [id]); }
      catch { /* ignore */ }
    }
    await suite.app.close();
    await closePool();
  });

  it("CREATE / GET / LIST as TENANT_ADMIN happy path with global module + facilitator", async () => {
    const code = `${SUITE_PREFIX}_HP`;
    const created = await suite.app.inject({
      method: "POST", url: "/v1/training-initiatives",
      headers: { cookie: ch(tenantS.cookies), "x-csrf-token": tenantS.csrfToken, "content-type": "application/json" },
      payload: {
        moduleId: globalModuleId,
        code,
        cohortName: "Spring 2026",
        startDate: "2026-06-01",
        endDate: "2026-07-15",
        facilitatorUserId: managerS.userId,
        capacity: 20,
      },
    });
    expect(created.statusCode).toBe(201);
    const t = created.json() as { trainingInitiativeId: string; status: string; capacity: number };
    expect(t.status).toBe("PLANNED");
    expect(t.capacity).toBe(20);
    createdTiIds.push(t.trainingInitiativeId);

    const got = await suite.app.inject({
      method: "GET", url: `/v1/training-initiatives/${t.trainingInitiativeId}`,
      headers: { cookie: ch(tenantS.cookies) },
    });
    expect(got.statusCode).toBe(200);

    const list = await suite.app.inject({
      method: "GET", url: `/v1/training-initiatives?search=${SUITE_PREFIX}`,
      headers: { cookie: ch(tenantS.cookies) },
    });
    expect(list.statusCode).toBe(200);
    const body = list.json() as { items: Array<{ code: string }>; total: number };
    expect(body.items.some((i) => i.code === code)).toBe(true);
  });

  it("PATCH status to CANCELLED as TENANT_ADMIN", async () => {
    const code = `${SUITE_PREFIX}_CANCEL`;
    const created = await suite.app.inject({
      method: "POST", url: "/v1/training-initiatives",
      headers: { cookie: ch(tenantS.cookies), "x-csrf-token": tenantS.csrfToken, "content-type": "application/json" },
      payload: { moduleId: globalModuleId, code, startDate: "2026-06-15" },
    });
    expect(created.statusCode).toBe(201);
    const tid = (created.json() as { trainingInitiativeId: string }).trainingInitiativeId;
    createdTiIds.push(tid);

    const patched = await suite.app.inject({
      method: "PATCH", url: `/v1/training-initiatives/${tid}`,
      headers: { cookie: ch(tenantS.cookies), "x-csrf-token": tenantS.csrfToken, "content-type": "application/json" },
      payload: { status: "CANCELLED" },
    });
    expect(patched.statusCode).toBe(200);
    expect((patched.json() as { status: string }).status).toBe("CANCELLED");
  });

  it("Missing moduleId → 404", async () => {
    const r = await suite.app.inject({
      method: "POST", url: "/v1/training-initiatives",
      headers: { cookie: ch(tenantS.cookies), "x-csrf-token": tenantS.csrfToken, "content-type": "application/json" },
      payload: { moduleId: randomUUID(), code: `${SUITE_PREFIX}_ORPHAN`, startDate: "2026-06-01" },
    });
    expect(r.statusCode).toBe(404);
    expect((r.json() as { error: { code: string } }).error.code).toBe("NOT_FOUND");
  });

  it("Non-existent facilitator userId → 404 NOT_FOUND", async () => {
    const r = await suite.app.inject({
      method: "POST", url: "/v1/training-initiatives",
      headers: { cookie: ch(tenantS.cookies), "x-csrf-token": tenantS.csrfToken, "content-type": "application/json" },
      payload: {
        moduleId: globalModuleId,
        code: `${SUITE_PREFIX}_BAD_FAC`,
        startDate: "2026-06-01",
        facilitatorUserId: randomUUID(),
      },
    });
    expect(r.statusCode).toBe(404);
    expect((r.json() as { error: { code: string } }).error.code).toBe("NOT_FOUND");
  });

  it("Duplicate code in same tenant → 409 TRAINING_INITIATIVE_CODE_CONFLICT", async () => {
    const code = `${SUITE_PREFIX}_DUP`;
    const first = await suite.app.inject({
      method: "POST", url: "/v1/training-initiatives",
      headers: { cookie: ch(tenantS.cookies), "x-csrf-token": tenantS.csrfToken, "content-type": "application/json" },
      payload: { moduleId: globalModuleId, code, startDate: "2026-06-01" },
    });
    expect(first.statusCode).toBe(201);
    createdTiIds.push((first.json() as { trainingInitiativeId: string }).trainingInitiativeId);

    const dup = await suite.app.inject({
      method: "POST", url: "/v1/training-initiatives",
      headers: { cookie: ch(tenantS.cookies), "x-csrf-token": tenantS.csrfToken, "content-type": "application/json" },
      payload: { moduleId: globalModuleId, code, startDate: "2026-06-10" },
    });
    expect(dup.statusCode).toBe(409);
    expect((dup.json() as { error: { code: string } }).error.code).toBe("TRAINING_INITIATIVE_CODE_CONFLICT");
  });
});
