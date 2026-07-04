/**
 * apps/api/test/successor-candidates.integration.test.ts
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { pool, closePool } from "../src/db/client.js";
import { TEST_PERSONA_PASSWORD } from "./helpers/personas.js";

const PWD = TEST_PERSONA_PASSWORD;
const SUITE_PREFIX = `IT_SC_${randomUUID().slice(0, 8).toUpperCase()}`;

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
let managerS: S;
let poolId: string;
const createdCandidateIds: string[] = [];
const createdPoolIds: string[] = [];

describe("/v1/successor-candidates integration", () => {
  beforeAll(async () => {
    suite = await buildTestApp();
    tenantS = await login(suite, "federica.marchetti@rtl-bank.org");
    managerS = await login(suite, "paolo.caputo@rtl-bank.org");
    const p = await pool.query<{ position_id: string }>(
      `SELECT position_id FROM sys.sys_positions WHERE position_owner_user_id = (SELECT user_id FROM sys.sys_users WHERE lower(user_email) = 'paolo.caputo@rtl-bank.org') LIMIT 1`,
    );
    const positionId = p.rows[0]!.position_id;
    const c = await suite.app.inject({
      method: "POST", url: "/v1/succession-pools",
      headers: { cookie: ch(tenantS.cookies), "x-csrf-token": tenantS.csrfToken, "content-type": "application/json" },
      payload: { positionId, code: `${SUITE_PREFIX}_POOL`, name: "Test Pool" },
    });
    if (c.statusCode !== 201) throw new Error(`pool setup: ${c.statusCode}`);
    poolId = (c.json() as { successionPoolId: string }).successionPoolId;
    createdPoolIds.push(poolId);
  });

  afterAll(async () => {
    for (const id of createdCandidateIds) {
      try { await pool.query(`DELETE FROM sys.sys_successor_candidates WHERE successor_candidate_id = $1`, [id]); }
      catch { /* ignore */ }
    }
    for (const id of createdPoolIds) {
      try { await pool.query(`DELETE FROM sys.sys_succession_pools WHERE succession_pool_id = $1`, [id]); }
      catch { /* ignore */ }
    }
    await suite.app.close();
    await closePool();
  });

  it("CREATE / LIST / GET happy path", async () => {
    const c = await suite.app.inject({
      method: "POST", url: "/v1/successor-candidates",
      headers: { cookie: ch(tenantS.cookies), "x-csrf-token": tenantS.csrfToken, "content-type": "application/json" },
      payload: { poolId, userId: managerS.userId, readinessLevel: "READY_6_MONTHS" },
    });
    expect(c.statusCode).toBe(201);
    const cand = c.json() as { successorCandidateId: string; status: string };
    expect(cand.status).toBe("CANDIDATE");
    createdCandidateIds.push(cand.successorCandidateId);

    const list = await suite.app.inject({
      method: "GET", url: `/v1/successor-candidates?poolId=${poolId}`,
      headers: { cookie: ch(tenantS.cookies) },
    });
    expect(list.statusCode).toBe(200);
  });

  it("Duplicate (pool, user) → 409 SUCCESSOR_CANDIDATE_DUPLICATE", async () => {
    const dup = await suite.app.inject({
      method: "POST", url: "/v1/successor-candidates",
      headers: { cookie: ch(tenantS.cookies), "x-csrf-token": tenantS.csrfToken, "content-type": "application/json" },
      payload: { poolId, userId: managerS.userId },
    });
    expect(dup.statusCode).toBe(409);
    expect((dup.json() as { error: { code: string } }).error.code).toBe("SUCCESSOR_CANDIDATE_DUPLICATE");
  });

  it("Non-existent pool → 404", async () => {
    const r = await suite.app.inject({
      method: "POST", url: "/v1/successor-candidates",
      headers: { cookie: ch(tenantS.cookies), "x-csrf-token": tenantS.csrfToken, "content-type": "application/json" },
      payload: { poolId: randomUUID(), userId: managerS.userId },
    });
    expect(r.statusCode).toBe(404);
  });

  it("Pool with candidates cannot be deleted → 409 SUCCESSION_POOL_HAS_CANDIDATES", async () => {
    const r = await suite.app.inject({
      method: "DELETE", url: `/v1/succession-pools/${poolId}`,
      headers: { cookie: ch(tenantS.cookies), "x-csrf-token": tenantS.csrfToken },
    });
    expect(r.statusCode).toBe(409);
    expect((r.json() as { error: { code: string } }).error.code).toBe("SUCCESSION_POOL_HAS_CANDIDATES");
  });

  it("GET /readiness-distribution as TENANT_ADMIN → 200 with seeded READY_6_MONTHS bucket", async () => {
    const r = await suite.app.inject({
      method: "GET", url: `/v1/successor-candidates/readiness-distribution`,
      headers: { cookie: ch(tenantS.cookies) },
    });
    expect(r.statusCode).toBe(200);
    const body = r.json() as { total: number; items: Array<{ readinessLevel: string; count: number }> };
    expect(body.total).toBeGreaterThanOrEqual(1);
    const ready = body.items.find((i) => i.readinessLevel === "READY_6_MONTHS");
    expect(ready).toBeDefined();
    expect(ready!.count).toBeGreaterThanOrEqual(1);
    expect(body.items.reduce((s, i) => s + i.count, 0)).toBe(body.total);
  });
});
