/**
 * apps/api/test/successor-readiness.integration.test.ts
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { pool, closePool } from "../src/db/client.js";
import { TEST_PERSONA_PASSWORD } from "./helpers/personas.js";

const PWD = TEST_PERSONA_PASSWORD;
const SUITE_PREFIX = `IT_SR_${randomUUID().slice(0, 8).toUpperCase()}`;

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
let candidateId: string;
const createdReadinessIds: string[] = [];
const createdCandidateIds: string[] = [];
const createdPoolIds: string[] = [];

describe("/v1/successor-readiness integration", () => {
  beforeAll(async () => {
    suite = await buildTestApp();
    tenantS = await login(suite, "federica.marchetti@rtl-bank.org");
    const managerS = await login(suite, "paolo.caputo@rtl-bank.org");
    const p = await pool.query<{ position_id: string }>(
      `SELECT position_id FROM sys.sys_positions WHERE position_owner_user_id = (SELECT user_id FROM sys.sys_users WHERE lower(user_email) = 'paolo.caputo@rtl-bank.org') LIMIT 1`,
    );
    const positionId = p.rows[0]!.position_id;
    const poolRes = await suite.app.inject({
      method: "POST", url: "/v1/succession-pools",
      headers: { cookie: ch(tenantS.cookies), "x-csrf-token": tenantS.csrfToken, "content-type": "application/json" },
      payload: { positionId, code: `${SUITE_PREFIX}_POOL`, name: "Pool for readiness" },
    });
    const poolId = (poolRes.json() as { successionPoolId: string }).successionPoolId;
    createdPoolIds.push(poolId);

    const candRes = await suite.app.inject({
      method: "POST", url: "/v1/successor-candidates",
      headers: { cookie: ch(tenantS.cookies), "x-csrf-token": tenantS.csrfToken, "content-type": "application/json" },
      payload: { poolId, userId: managerS.userId },
    });
    candidateId = (candRes.json() as { successorCandidateId: string }).successorCandidateId;
    createdCandidateIds.push(candidateId);
  });

  afterAll(async () => {
    for (const id of createdReadinessIds) {
      try { await pool.query(`DELETE FROM sys.sys_successor_readiness WHERE successor_readiness_id = $1`, [id]); }
      catch { /* ignore */ }
    }
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
      method: "POST", url: "/v1/successor-readiness",
      headers: { cookie: ch(tenantS.cookies), "x-csrf-token": tenantS.csrfToken, "content-type": "application/json" },
      payload: { candidateId, score: 75.0, horizon: "6_MONTHS", payload: { dimension: "leadership" } },
    });
    expect(c.statusCode).toBe(201);
    const r = c.json() as { successorReadinessId: string; score: number | null; horizon: string | null };
    expect(r.score).toBe(75.0);
    expect(r.horizon).toBe("6_MONTHS");
    createdReadinessIds.push(r.successorReadinessId);

    const list = await suite.app.inject({
      method: "GET", url: `/v1/successor-readiness?candidateId=${candidateId}`,
      headers: { cookie: ch(tenantS.cookies) },
    });
    expect(list.statusCode).toBe(200);
    const body = list.json() as { total: number };
    expect(body.total).toBeGreaterThanOrEqual(1);

    const got = await suite.app.inject({
      method: "GET", url: `/v1/successor-readiness/${r.successorReadinessId}`,
      headers: { cookie: ch(tenantS.cookies) },
    });
    expect(got.statusCode).toBe(200);
  });

  it("Non-existent candidate → 404", async () => {
    const r = await suite.app.inject({
      method: "POST", url: "/v1/successor-readiness",
      headers: { cookie: ch(tenantS.cookies), "x-csrf-token": tenantS.csrfToken, "content-type": "application/json" },
      payload: { candidateId: randomUUID(), score: 50 },
    });
    expect(r.statusCode).toBe(404);
  });
});
