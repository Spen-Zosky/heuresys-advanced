/**
 * apps/api/test/position-succession-relevance.integration.test.ts
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { pool, closePool } from "../src/db/client.js";

const PWD = "Admin#PassW0rd!";

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
let positionId: string;
let upsertedId: string | null = null;

describe("/v1/position-succession-relevance integration", () => {
  beforeAll(async () => {
    suite = await buildTestApp();
    tenantS = await login(suite, "federica.marchetti@rtl-bank.org");
    const p = await pool.query<{ position_id: string }>(
      `SELECT position_id FROM sys.sys_positions WHERE position_owner_user_id = (SELECT user_id FROM sys.sys_users WHERE lower(user_email) = 'paolo.caputo@rtl-bank.org') LIMIT 1`,
    );
    positionId = p.rows[0]!.position_id;
  });

  afterAll(async () => {
    if (upsertedId) {
      try { await pool.query(`DELETE FROM sys.sys_position_succession_relevance WHERE position_succession_relevance_id = $1`, [upsertedId]); }
      catch { /* ignore */ }
    }
    await suite.app.close();
    await closePool();
  });

  it("PUT (insert) then PUT (update) is idempotent on position_id", async () => {
    const first = await suite.app.inject({
      method: "PUT", url: "/v1/position-succession-relevance",
      headers: { cookie: ch(tenantS.cookies), "x-csrf-token": tenantS.csrfToken, "content-type": "application/json" },
      payload: { positionId, isCritical: true, readinessHorizon: "READY_6_MONTHS" },
    });
    expect(first.statusCode).toBe(200);
    const r1 = first.json() as { positionSuccessionRelevanceId: string; isCritical: boolean };
    expect(r1.isCritical).toBe(true);
    upsertedId = r1.positionSuccessionRelevanceId;

    const second = await suite.app.inject({
      method: "PUT", url: "/v1/position-succession-relevance",
      headers: { cookie: ch(tenantS.cookies), "x-csrf-token": tenantS.csrfToken, "content-type": "application/json" },
      payload: { positionId, isCritical: false, readinessHorizon: "READY_1_YEAR" },
    });
    expect(second.statusCode).toBe(200);
    const r2 = second.json() as { positionSuccessionRelevanceId: string; isCritical: boolean; readinessHorizon: string };
    expect(r2.positionSuccessionRelevanceId).toBe(upsertedId);
    expect(r2.isCritical).toBe(false);
    expect(r2.readinessHorizon).toBe("READY_1_YEAR");
  });

  it("GET by id returns the upserted row", async () => {
    const r = await suite.app.inject({
      method: "GET", url: `/v1/position-succession-relevance/${upsertedId}`,
      headers: { cookie: ch(tenantS.cookies) },
    });
    expect(r.statusCode).toBe(200);
  });

  it("Non-existent position on PUT → 404", async () => {
    const r = await suite.app.inject({
      method: "PUT", url: "/v1/position-succession-relevance",
      headers: { cookie: ch(tenantS.cookies), "x-csrf-token": tenantS.csrfToken, "content-type": "application/json" },
      payload: { positionId: randomUUID(), isCritical: true },
    });
    expect(r.statusCode).toBe(404);
  });
});
