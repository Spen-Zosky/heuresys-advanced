/**
 * apps/api/test/succession-pools.integration.test.ts
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { pool, closePool } from "../src/db/client.js";

const PWD = "Admin#PassW0rd!";
const SUITE_PREFIX = `IT_SP_${randomUUID().slice(0, 8).toUpperCase()}`;

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
let testPositionId: string;
const createdIds: string[] = [];

describe("/v1/succession-pools integration", () => {
  beforeAll(async () => {
    suite = await buildTestApp();
    tenantS = await login(suite, "federica.marchetti@rtl-bank.org");
    const p = await pool.query<{ position_id: string }>(
      `SELECT position_id FROM sys.sys_positions WHERE position_owner_user_id = (SELECT user_id FROM sys.sys_users WHERE lower(user_email) = 'paolo.caputo@rtl-bank.org') LIMIT 1`,
    );
    if (p.rows.length === 0) throw new Error("manager-owned position not found");
    testPositionId = p.rows[0]!.position_id;
  });

  afterAll(async () => {
    for (const id of createdIds) {
      try { await pool.query(`DELETE FROM sys.sys_succession_pools WHERE succession_pool_id = $1`, [id]); }
      catch { /* ignore */ }
    }
    await suite.app.close();
    await closePool();
  });

  it("CREATE / GET / LIST happy path", async () => {
    const c = await suite.app.inject({
      method: "POST", url: "/v1/succession-pools",
      headers: { cookie: ch(tenantS.cookies), "x-csrf-token": tenantS.csrfToken, "content-type": "application/json" },
      payload: { positionId: testPositionId, code: `${SUITE_PREFIX}_HP`, name: "Test Pool" },
    });
    expect(c.statusCode).toBe(201);
    const p = c.json() as { successionPoolId: string; status: string };
    expect(p.status).toBe("ACTIVE");
    createdIds.push(p.successionPoolId);

    const list = await suite.app.inject({
      method: "GET", url: `/v1/succession-pools?positionId=${testPositionId}`,
      headers: { cookie: ch(tenantS.cookies) },
    });
    expect(list.statusCode).toBe(200);
  });

  it("Duplicate code → 409 SUCCESSION_POOL_CODE_CONFLICT", async () => {
    const code = `${SUITE_PREFIX}_DUP`;
    const first = await suite.app.inject({
      method: "POST", url: "/v1/succession-pools",
      headers: { cookie: ch(tenantS.cookies), "x-csrf-token": tenantS.csrfToken, "content-type": "application/json" },
      payload: { positionId: testPositionId, code, name: "Dup-1" },
    });
    expect(first.statusCode).toBe(201);
    createdIds.push((first.json() as { successionPoolId: string }).successionPoolId);

    const dup = await suite.app.inject({
      method: "POST", url: "/v1/succession-pools",
      headers: { cookie: ch(tenantS.cookies), "x-csrf-token": tenantS.csrfToken, "content-type": "application/json" },
      payload: { positionId: testPositionId, code, name: "Dup-2" },
    });
    expect(dup.statusCode).toBe(409);
    expect((dup.json() as { error: { code: string } }).error.code).toBe("SUCCESSION_POOL_CODE_CONFLICT");
  });

  it("Invalid positionId → 404", async () => {
    const r = await suite.app.inject({
      method: "POST", url: "/v1/succession-pools",
      headers: { cookie: ch(tenantS.cookies), "x-csrf-token": tenantS.csrfToken, "content-type": "application/json" },
      payload: { positionId: randomUUID(), code: `${SUITE_PREFIX}_NOPOS`, name: "Bad position" },
    });
    expect(r.statusCode).toBe(404);
  });

  it("PATCH archive then DELETE", async () => {
    const c = await suite.app.inject({
      method: "POST", url: "/v1/succession-pools",
      headers: { cookie: ch(tenantS.cookies), "x-csrf-token": tenantS.csrfToken, "content-type": "application/json" },
      payload: { positionId: testPositionId, code: `${SUITE_PREFIX}_LIFE`, name: "Lifecycle" },
    });
    expect(c.statusCode).toBe(201);
    const pid = (c.json() as { successionPoolId: string }).successionPoolId;
    createdIds.push(pid);

    const p = await suite.app.inject({
      method: "PATCH", url: `/v1/succession-pools/${pid}`,
      headers: { cookie: ch(tenantS.cookies), "x-csrf-token": tenantS.csrfToken, "content-type": "application/json" },
      payload: { status: "ARCHIVED" },
    });
    expect(p.statusCode).toBe(200);
    expect((p.json() as { status: string }).status).toBe("ARCHIVED");

    const del = await suite.app.inject({
      method: "DELETE", url: `/v1/succession-pools/${pid}`,
      headers: { cookie: ch(tenantS.cookies), "x-csrf-token": tenantS.csrfToken },
    });
    expect(del.statusCode).toBe(204);
  });
});
