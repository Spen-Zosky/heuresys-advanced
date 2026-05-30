/**
 * apps/api/test/career-path-steps.integration.test.ts
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { pool, closePool } from "../src/db/client.js";

const PWD = "Admin#PassW0rd!";
const SUITE_PREFIX = `IT_CPS_${randomUUID().slice(0, 8).toUpperCase()}`;

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
const createdStepIds: string[] = [];
const createdPathIds: string[] = [];

describe("/v1/career-path-steps integration", () => {
  beforeAll(async () => {
    suite = await buildTestApp();
    tenantS = await login(suite, "federica.marchetti@rtl-bank.org");

    const pr = await suite.app.inject({
      method: "POST", url: "/v1/career-paths",
      headers: { cookie: ch(tenantS.cookies), "x-csrf-token": tenantS.csrfToken, "content-type": "application/json" },
      payload: { code: `${SUITE_PREFIX}_PATH`, name: "Career Path under test" },
    });
    if (pr.statusCode !== 201) throw new Error(`path setup: ${pr.statusCode}`);
    pathId = (pr.json() as { careerPathId: string }).careerPathId;
    createdPathIds.push(pathId);
  });

  afterAll(async () => {
    for (const id of createdStepIds) {
      try { await pool.query(`DELETE FROM sys.sys_career_path_steps WHERE career_path_step_id = $1`, [id]); }
      catch { /* ignore */ }
    }
    for (const id of createdPathIds) {
      try { await pool.query(`DELETE FROM sys.sys_career_paths WHERE career_path_id = $1`, [id]); }
      catch { /* ignore */ }
    }
    await suite.app.close();
    await closePool();
  });

  it("CREATE step without positions then LIST", async () => {
    const c = await suite.app.inject({
      method: "POST", url: "/v1/career-path-steps",
      headers: { cookie: ch(tenantS.cookies), "x-csrf-token": tenantS.csrfToken, "content-type": "application/json" },
      payload: { pathId, ordinal: 1, typicalDurationMonths: 18 },
    });
    expect(c.statusCode).toBe(201);
    const s = c.json() as { careerPathStepId: string; typicalDurationMonths: number | null };
    expect(s.typicalDurationMonths).toBe(18);
    createdStepIds.push(s.careerPathStepId);

    const list = await suite.app.inject({
      method: "GET", url: `/v1/career-path-steps?pathId=${pathId}`,
      headers: { cookie: ch(tenantS.cookies) },
    });
    expect(list.statusCode).toBe(200);
    const body = list.json() as { total: number };
    expect(body.total).toBeGreaterThanOrEqual(1);
  });

  it("Duplicate ordinal in same path → 409 CAREER_PATH_STEP_ORDINAL_CONFLICT", async () => {
    const dup = await suite.app.inject({
      method: "POST", url: "/v1/career-path-steps",
      headers: { cookie: ch(tenantS.cookies), "x-csrf-token": tenantS.csrfToken, "content-type": "application/json" },
      payload: { pathId, ordinal: 1 },
    });
    expect(dup.statusCode).toBe(409);
    expect((dup.json() as { error: { code: string } }).error.code).toBe("CAREER_PATH_STEP_ORDINAL_CONFLICT");
  });

  it("Invalid originPositionId → 404 Position", async () => {
    const r = await suite.app.inject({
      method: "POST", url: "/v1/career-path-steps",
      headers: { cookie: ch(tenantS.cookies), "x-csrf-token": tenantS.csrfToken, "content-type": "application/json" },
      payload: { pathId, ordinal: 50, originPositionId: randomUUID() },
    });
    expect(r.statusCode).toBe(404);
    expect((r.json() as { error: { code: string } }).error.code).toBe("NOT_FOUND");
  });

  it("Parent path with steps cannot be deleted → 409 CAREER_PATH_HAS_STEPS", async () => {
    const r = await suite.app.inject({
      method: "DELETE", url: `/v1/career-paths/${pathId}`,
      headers: { cookie: ch(tenantS.cookies), "x-csrf-token": tenantS.csrfToken },
    });
    expect(r.statusCode).toBe(409);
    expect((r.json() as { error: { code: string } }).error.code).toBe("CAREER_PATH_HAS_STEPS");
  });

  it("PATCH duration then DELETE step", async () => {
    const c = await suite.app.inject({
      method: "POST", url: "/v1/career-path-steps",
      headers: { cookie: ch(tenantS.cookies), "x-csrf-token": tenantS.csrfToken, "content-type": "application/json" },
      payload: { pathId, ordinal: 99, typicalDurationMonths: 6 },
    });
    expect(c.statusCode).toBe(201);
    const sid = (c.json() as { careerPathStepId: string }).careerPathStepId;
    createdStepIds.push(sid);

    const p = await suite.app.inject({
      method: "PATCH", url: `/v1/career-path-steps/${sid}`,
      headers: { cookie: ch(tenantS.cookies), "x-csrf-token": tenantS.csrfToken, "content-type": "application/json" },
      payload: { typicalDurationMonths: 12 },
    });
    expect(p.statusCode).toBe(200);
    expect((p.json() as { typicalDurationMonths: number | null }).typicalDurationMonths).toBe(12);

    const del = await suite.app.inject({
      method: "DELETE", url: `/v1/career-path-steps/${sid}`,
      headers: { cookie: ch(tenantS.cookies), "x-csrf-token": tenantS.csrfToken },
    });
    expect(del.statusCode).toBe(204);
  });
});
