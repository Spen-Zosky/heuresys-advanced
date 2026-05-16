/**
 * apps/api/test/user-career-plans.integration.test.ts
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { pool, closePool } from "../src/db/client.js";

const PWD = "Admin#PassW0rd!";
const SUITE_PREFIX = `IT_UCP_${randomUUID().slice(0, 8).toUpperCase()}`;

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
let managerS: S;
let pathId: string;
const createdPlanIds: string[] = [];
const createdPathIds: string[] = [];

describe("/v1/user-career-plans integration", () => {
  beforeAll(async () => {
    suite = await buildTestApp();
    tenantS = await login(suite, "tenant_admin_test@rtl-bank.test");
    managerS = await login(suite, "manager_test@rtl-bank.test");

    const pr = await suite.app.inject({
      method: "POST", url: "/v1/career-paths",
      headers: { cookie: ch(tenantS.cookies), "x-csrf-token": tenantS.csrfToken, "content-type": "application/json" },
      payload: { code: `${SUITE_PREFIX}_PATH`, name: "Plan FK test path" },
    });
    if (pr.statusCode !== 201) throw new Error(`path setup: ${pr.statusCode}`);
    pathId = (pr.json() as { careerPathId: string }).careerPathId;
    createdPathIds.push(pathId);
  });

  afterAll(async () => {
    for (const id of createdPlanIds) {
      try { await pool.query(`DELETE FROM sys.sys_user_career_plans WHERE user_career_plan_id = $1`, [id]); }
      catch { /* ignore */ }
    }
    for (const id of createdPathIds) {
      try { await pool.query(`DELETE FROM sys.sys_career_paths WHERE career_path_id = $1`, [id]); }
      catch { /* ignore */ }
    }
    await suite.app.close();
    await closePool();
  });

  it("CREATE / LIST / GET happy path", async () => {
    const c = await suite.app.inject({
      method: "POST", url: "/v1/user-career-plans",
      headers: { cookie: ch(tenantS.cookies), "x-csrf-token": tenantS.csrfToken, "content-type": "application/json" },
      payload: {
        userId: managerS.userId,
        pathId,
        horizonMonths: 24,
        metadata: { suitePrefix: SUITE_PREFIX },
      },
    });
    expect(c.statusCode).toBe(201);
    const p = c.json() as { userCareerPlanId: string; status: string; horizonMonths: number | null };
    expect(p.status).toBe("ACTIVE");
    expect(p.horizonMonths).toBe(24);
    createdPlanIds.push(p.userCareerPlanId);

    const got = await suite.app.inject({
      method: "GET", url: `/v1/user-career-plans/${p.userCareerPlanId}`,
      headers: { cookie: ch(tenantS.cookies) },
    });
    expect(got.statusCode).toBe(200);

    const list = await suite.app.inject({
      method: "GET", url: `/v1/user-career-plans?userId=${managerS.userId}&status=ACTIVE`,
      headers: { cookie: ch(tenantS.cookies) },
    });
    expect(list.statusCode).toBe(200);
    const body = list.json() as { items: Array<{ userCareerPlanId: string }>; total: number };
    expect(body.items.some((i) => i.userCareerPlanId === p.userCareerPlanId)).toBe(true);
  });

  it("Non-existent subject user → 404", async () => {
    const r = await suite.app.inject({
      method: "POST", url: "/v1/user-career-plans",
      headers: { cookie: ch(tenantS.cookies), "x-csrf-token": tenantS.csrfToken, "content-type": "application/json" },
      payload: { userId: randomUUID() },
    });
    expect(r.statusCode).toBe(404);
    expect((r.json() as { error: { code: string } }).error.code).toBe("NOT_FOUND");
  });

  it("Non-visible pathId on create → 404 CareerPath", async () => {
    const r = await suite.app.inject({
      method: "POST", url: "/v1/user-career-plans",
      headers: { cookie: ch(tenantS.cookies), "x-csrf-token": tenantS.csrfToken, "content-type": "application/json" },
      payload: { userId: managerS.userId, pathId: randomUUID() },
    });
    expect(r.statusCode).toBe(404);
    expect((r.json() as { error: { code: string } }).error.code).toBe("NOT_FOUND");
  });

  it("PATCH status PAUSED then COMPLETED then DELETE", async () => {
    const c = await suite.app.inject({
      method: "POST", url: "/v1/user-career-plans",
      headers: { cookie: ch(tenantS.cookies), "x-csrf-token": tenantS.csrfToken, "content-type": "application/json" },
      payload: { userId: managerS.userId },
    });
    expect(c.statusCode).toBe(201);
    const pid = (c.json() as { userCareerPlanId: string }).userCareerPlanId;
    createdPlanIds.push(pid);

    const p1 = await suite.app.inject({
      method: "PATCH", url: `/v1/user-career-plans/${pid}`,
      headers: { cookie: ch(tenantS.cookies), "x-csrf-token": tenantS.csrfToken, "content-type": "application/json" },
      payload: { status: "PAUSED" },
    });
    expect(p1.statusCode).toBe(200);
    expect((p1.json() as { status: string }).status).toBe("PAUSED");

    const p2 = await suite.app.inject({
      method: "PATCH", url: `/v1/user-career-plans/${pid}`,
      headers: { cookie: ch(tenantS.cookies), "x-csrf-token": tenantS.csrfToken, "content-type": "application/json" },
      payload: { status: "COMPLETED" },
    });
    expect(p2.statusCode).toBe(200);
    expect((p2.json() as { status: string }).status).toBe("COMPLETED");

    const del = await suite.app.inject({
      method: "DELETE", url: `/v1/user-career-plans/${pid}`,
      headers: { cookie: ch(tenantS.cookies), "x-csrf-token": tenantS.csrfToken },
    });
    expect(del.statusCode).toBe(204);
  });
});
