/**
 * apps/api/test/position-career-paths.integration.test.ts
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { pool, closePool } from "../src/db/client.js";

const PWD = "Admin#PassW0rd!";
const SUITE_PREFIX = `IT_PCP_${randomUUID().slice(0, 8).toUpperCase()}`;

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
let tenantS: S;
let positionId: string;
let careerPathId: string;
const createdLinkIds: string[] = [];
const createdPathIds: string[] = [];

describe("/v1/position-career-paths integration", () => {
  beforeAll(async () => {
    suite = await buildTestApp();
    tenantS = await login(suite, "federica.marchetti@rtl-bank.org");
    const p = await pool.query<{ position_id: string }>(
      `SELECT position_id FROM sys.sys_positions WHERE position_owner_user_id = (SELECT user_id FROM sys.sys_users WHERE lower(user_email) = 'paolo.caputo@rtl-bank.org') LIMIT 1`,
    );
    positionId = p.rows[0]!.position_id;

    const cp = await suite.app.inject({
      method: "POST", url: "/v1/career-paths",
      headers: { cookie: ch(tenantS.cookies), "x-csrf-token": tenantS.csrfToken, "content-type": "application/json" },
      payload: { code: `${SUITE_PREFIX}_PATH`, name: "Link target" },
    });
    careerPathId = (cp.json() as { careerPathId: string }).careerPathId;
    createdPathIds.push(careerPathId);
  });

  afterAll(async () => {
    for (const id of createdLinkIds) {
      try { await pool.query(`DELETE FROM sys.sys_position_career_paths WHERE position_career_path_id = $1`, [id]); }
      catch { /* ignore */ }
    }
    for (const id of createdPathIds) {
      try { await pool.query(`DELETE FROM sys.sys_career_paths WHERE career_path_id = $1`, [id]); }
      catch { /* ignore */ }
    }
    await suite.app.close();
    await closePool();
  });

  it("CREATE / LIST happy path then DELETE", async () => {
    const c = await suite.app.inject({
      method: "POST", url: "/v1/position-career-paths",
      headers: { cookie: ch(tenantS.cookies), "x-csrf-token": tenantS.csrfToken, "content-type": "application/json" },
      payload: { positionId, careerPathId },
    });
    expect(c.statusCode).toBe(201);
    const l = c.json() as { positionCareerPathId: string };
    createdLinkIds.push(l.positionCareerPathId);

    const list = await suite.app.inject({
      method: "GET", url: `/v1/position-career-paths?positionId=${positionId}`,
      headers: { cookie: ch(tenantS.cookies) },
    });
    expect(list.statusCode).toBe(200);

    const del = await suite.app.inject({
      method: "DELETE", url: `/v1/position-career-paths/${l.positionCareerPathId}`,
      headers: { cookie: ch(tenantS.cookies), "x-csrf-token": tenantS.csrfToken },
    });
    expect(del.statusCode).toBe(204);
  });

  it("Duplicate link → 409 POSITION_CAREER_PATH_DUPLICATE", async () => {
    const first = await suite.app.inject({
      method: "POST", url: "/v1/position-career-paths",
      headers: { cookie: ch(tenantS.cookies), "x-csrf-token": tenantS.csrfToken, "content-type": "application/json" },
      payload: { positionId, careerPathId },
    });
    expect(first.statusCode).toBe(201);
    createdLinkIds.push((first.json() as { positionCareerPathId: string }).positionCareerPathId);

    const dup = await suite.app.inject({
      method: "POST", url: "/v1/position-career-paths",
      headers: { cookie: ch(tenantS.cookies), "x-csrf-token": tenantS.csrfToken, "content-type": "application/json" },
      payload: { positionId, careerPathId },
    });
    expect(dup.statusCode).toBe(409);
    expect((dup.json() as { error: { code: string } }).error.code).toBe("POSITION_CAREER_PATH_DUPLICATE");
  });

  it("Non-existent position → 404", async () => {
    const r = await suite.app.inject({
      method: "POST", url: "/v1/position-career-paths",
      headers: { cookie: ch(tenantS.cookies), "x-csrf-token": tenantS.csrfToken, "content-type": "application/json" },
      payload: { positionId: randomUUID(), careerPathId },
    });
    expect(r.statusCode).toBe(404);
  });
});
