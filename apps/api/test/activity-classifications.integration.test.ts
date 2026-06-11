/**
 * apps/api/test/activity-classifications.integration.test.ts
 *
 * Module: activity-classifications (global ATECO + NACE catalog, no tenant).
 * Visibility model (service.ts): read for anyone holding `enterprise_typing:read`;
 * write (POST/PATCH/DELETE) is PLATFORM_ADMIN only. Unique natural key (scheme, code).
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { pool, closePool } from "../src/db/client.js";

const PWD = "Admin#PassW0rd!";
const SUITE_PREFIX = `IT_AC_${randomUUID().slice(0, 8).toUpperCase()}`;

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

describe("/v1/activity-classifications/* integration", () => {
  beforeAll(async () => {
    suite = await buildTestApp();
    platformS = await login(suite, "admin@heuresys.com");
    tenantS = await login(suite, "federica.marchetti@rtl-bank.org");
  });

  afterAll(async () => {
    for (const id of createdIds) {
      try { await pool.query(`DELETE FROM sys.sys_activity_classifications WHERE activity_classification_id = $1`, [id]); }
      catch { /* ignore */ }
    }
    await suite.app.close();
    await closePool();
  });

  it("unauthenticated GET / → 401", async () => {
    const r = await suite.app.inject({ method: "GET", url: "/v1/activity-classifications" });
    expect(r.statusCode).toBe(401);
  });

  it("LIST as PLATFORM_ADMIN → 200 + { items: [], total } shape", async () => {
    const r = await suite.app.inject({
      method: "GET", url: "/v1/activity-classifications?limit=5",
      headers: { cookie: ch(platformS.cookies) },
    });
    expect(r.statusCode).toBe(200);
    const body = r.json() as { items: unknown[]; total: number };
    expect(Array.isArray(body.items)).toBe(true);
    expect(typeof body.total).toBe("number");
  });

  it("CREATE then GET /:id as PLATFORM_ADMIN happy path", async () => {
    const code = `${SUITE_PREFIX}HP`;
    const created = await suite.app.inject({
      method: "POST", url: "/v1/activity-classifications",
      headers: { cookie: ch(platformS.cookies), "x-csrf-token": platformS.csrfToken, "content-type": "application/json" },
      payload: { scheme: "ATECO_2025", code, name: "Happy Classification" },
    });
    expect(created.statusCode).toBe(201);
    const c = created.json() as { activityClassificationId: string; code: string; scheme: string };
    expect(c.code).toBe(code);
    expect(c.scheme).toBe("ATECO_2025");
    expect(typeof c.activityClassificationId).toBe("string");
    createdIds.push(c.activityClassificationId);

    const got = await suite.app.inject({
      method: "GET", url: `/v1/activity-classifications/${c.activityClassificationId}`,
      headers: { cookie: ch(platformS.cookies) },
    });
    expect(got.statusCode).toBe(200);
    const g = got.json() as { activityClassificationId: string };
    expect(g.activityClassificationId).toBe(c.activityClassificationId);
  });

  it("GET /:id with random uuid → 404 NOT_FOUND", async () => {
    const r = await suite.app.inject({
      method: "GET", url: `/v1/activity-classifications/${randomUUID()}`,
      headers: { cookie: ch(platformS.cookies) },
    });
    expect(r.statusCode).toBe(404);
    expect((r.json() as { error: { code: string } }).error.code).toBe("NOT_FOUND");
  });

  it("TENANT_ADMIN cannot create → 403 FORBIDDEN", async () => {
    const r = await suite.app.inject({
      method: "POST", url: "/v1/activity-classifications",
      headers: { cookie: ch(tenantS.cookies), "x-csrf-token": tenantS.csrfToken, "content-type": "application/json" },
      payload: { scheme: "ATECO_2025", code: `${SUITE_PREFIX}BLK`, name: "Blocked" },
    });
    expect(r.statusCode).toBe(403);
    expect((r.json() as { error: { code: string } }).error.code).toBe("FORBIDDEN");
  });

  it("CREATE without x-csrf-token header → 403 CSRF_FAIL", async () => {
    const r = await suite.app.inject({
      method: "POST", url: "/v1/activity-classifications",
      headers: { cookie: ch(platformS.cookies), "content-type": "application/json" },
      payload: { scheme: "ATECO_2025", code: `${SUITE_PREFIX}NOCSRF`, name: "No CSRF" },
    });
    expect(r.statusCode).toBe(403);
    expect((r.json() as { error: { code: string } }).error.code).toBe("CSRF_FAIL");
  });

  it("Duplicate (scheme, code) → 409 ACTIVITY_CLASSIFICATION_CONFLICT", async () => {
    const code = `${SUITE_PREFIX}DUP`;
    const first = await suite.app.inject({
      method: "POST", url: "/v1/activity-classifications",
      headers: { cookie: ch(platformS.cookies), "x-csrf-token": platformS.csrfToken, "content-type": "application/json" },
      payload: { scheme: "ATECO_2025", code, name: "First Dup" },
    });
    expect(first.statusCode).toBe(201);
    createdIds.push((first.json() as { activityClassificationId: string }).activityClassificationId);

    const dup = await suite.app.inject({
      method: "POST", url: "/v1/activity-classifications",
      headers: { cookie: ch(platformS.cookies), "x-csrf-token": platformS.csrfToken, "content-type": "application/json" },
      payload: { scheme: "ATECO_2025", code, name: "Second Dup" },
    });
    expect(dup.statusCode).toBe(409);
    expect((dup.json() as { error: { code: string } }).error.code).toBe("ACTIVITY_CLASSIFICATION_CONFLICT");
  });
});
