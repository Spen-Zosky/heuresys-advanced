/**
 * apps/api/test/learning-gaps.integration.test.ts
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { pool, closePool } from "../src/db/client.js";
import { TEST_PERSONA_PASSWORD } from "./helpers/personas.js";

const PWD = TEST_PERSONA_PASSWORD;
const SUITE_PREFIX = `IT_LG_${randomUUID().slice(0, 8).toUpperCase()}`;

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
const createdGapIds: string[] = [];

describe("/v1/learning-gaps integration", () => {
  beforeAll(async () => {
    suite = await buildTestApp();
    tenantS = await login(suite, "federica.marchetti@rtl-bank.org");
    managerS = await login(suite, "paolo.caputo@rtl-bank.org");
  });

  afterAll(async () => {
    for (const id of createdGapIds) {
      try { await pool.query(`DELETE FROM sys.sys_learning_gaps WHERE learning_gap_id = $1`, [id]); }
      catch { /* ignore */ }
    }
    await suite.app.close();
    await closePool();
  });

  it("CREATE / LIST / GET happy path as HRMS_MANAGER-equivalent (TENANT_ADMIN)", async () => {
    const c = await suite.app.inject({
      method: "POST", url: "/v1/learning-gaps",
      headers: { cookie: ch(tenantS.cookies), "x-csrf-token": tenantS.csrfToken, "content-type": "application/json" },
      payload: {
        userId: managerS.userId,
        severity: "HIGH",
        requiredProficiency: "ADVANCED",
        currentProficiency: "INTERMEDIATE",
        score: 35.5,
        metadata: { suitePrefix: SUITE_PREFIX, dimension: "leadership" },
      },
    });
    expect(c.statusCode).toBe(201);
    const g = c.json() as { learningGapId: string; severity: string; score: number | null };
    expect(g.severity).toBe("HIGH");
    expect(g.score).toBe(35.5);
    createdGapIds.push(g.learningGapId);

    const got = await suite.app.inject({
      method: "GET", url: `/v1/learning-gaps/${g.learningGapId}`,
      headers: { cookie: ch(tenantS.cookies) },
    });
    expect(got.statusCode).toBe(200);

    const list = await suite.app.inject({
      method: "GET", url: `/v1/learning-gaps?userId=${managerS.userId}&severity=HIGH`,
      headers: { cookie: ch(tenantS.cookies) },
    });
    expect(list.statusCode).toBe(200);
    const body = list.json() as { items: Array<{ learningGapId: string }>; total: number };
    expect(body.items.some((i) => i.learningGapId === g.learningGapId)).toBe(true);
  });

  it("Non-existent subject user → 404", async () => {
    const r = await suite.app.inject({
      method: "POST", url: "/v1/learning-gaps",
      headers: { cookie: ch(tenantS.cookies), "x-csrf-token": tenantS.csrfToken, "content-type": "application/json" },
      payload: { userId: randomUUID(), severity: "LOW" },
    });
    expect(r.statusCode).toBe(404);
    expect((r.json() as { error: { code: string } }).error.code).toBe("NOT_FOUND");
  });

  it("PATCH severity CRITICAL then DELETE", async () => {
    const c = await suite.app.inject({
      method: "POST", url: "/v1/learning-gaps",
      headers: { cookie: ch(tenantS.cookies), "x-csrf-token": tenantS.csrfToken, "content-type": "application/json" },
      payload: { userId: managerS.userId, severity: "LOW" },
    });
    expect(c.statusCode).toBe(201);
    const gid = (c.json() as { learningGapId: string }).learningGapId;
    createdGapIds.push(gid);

    const p = await suite.app.inject({
      method: "PATCH", url: `/v1/learning-gaps/${gid}`,
      headers: { cookie: ch(tenantS.cookies), "x-csrf-token": tenantS.csrfToken, "content-type": "application/json" },
      payload: { severity: "CRITICAL" },
    });
    expect(p.statusCode).toBe(200);
    expect((p.json() as { severity: string }).severity).toBe("CRITICAL");

    const del = await suite.app.inject({
      method: "DELETE", url: `/v1/learning-gaps/${gid}`,
      headers: { cookie: ch(tenantS.cookies), "x-csrf-token": tenantS.csrfToken },
    });
    expect(del.statusCode).toBe(204);
  });
});
