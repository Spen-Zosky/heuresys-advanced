/**
 * apps/api/test/skill-families.integration.test.ts
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { pool, closePool } from "../src/db/client.js";

const PWD = "Admin#PassW0rd!";
const SUITE_PREFIX = `IT_SF_${randomUUID().slice(0, 8).toUpperCase()}`;

interface S { cookies: Map<string, string>; csrfToken: string }
function ch(c: Map<string, string>) { return [...c.entries()].map(([n, v]) => `${n}=${v}`).join("; "); }
async function login(t: TestApp, email: string): Promise<S> {
  const r = await t.app.inject({ method: "POST", url: "/v1/auth/login", payload: { email, password: PWD } });
  if (r.statusCode !== 200) throw new Error(`login: ${r.statusCode}`);
  const cookies = new Map<string, string>();
  for (const c of r.cookies) cookies.set(c.name, c.value);
  return { cookies, csrfToken: (r.json() as { csrfToken: string }).csrfToken };
}

let suite: TestApp;
let platformS: S;
let tenantS: S;
const createdFamilyIds: string[] = [];
const createdCategoryIds: string[] = [];

describe("/v1/skill-families/* integration", () => {
  beforeAll(async () => {
    suite = await buildTestApp();
    platformS = await login(suite, "admin@heuresys.com");
    tenantS = await login(suite, "federica.marchetti@rtl-bank.org");
  });

  afterAll(async () => {
    for (const id of createdCategoryIds) {
      try { await pool.query(`DELETE FROM sys.sys_skill_categories WHERE skill_category_id = $1`, [id]); }
      catch { /* ignore */ }
    }
    for (const id of createdFamilyIds) {
      try { await pool.query(`DELETE FROM sys.sys_skill_families WHERE skill_family_id = $1`, [id]); }
      catch { /* ignore */ }
    }
    await suite.app.close();
    await closePool();
  });

  it("CREATE / GET / LIST as PLATFORM_ADMIN happy path", async () => {
    const code = `${SUITE_PREFIX}_HP`;
    const created = await suite.app.inject({
      method: "POST", url: "/v1/skill-families",
      headers: { cookie: ch(platformS.cookies), "x-csrf-token": platformS.csrfToken, "content-type": "application/json" },
      payload: { code, name: "Happy Path Family", description: "Just a test family" },
    });
    expect(created.statusCode).toBe(201);
    const f = created.json() as { skillFamilyId: string; code: string; name: string };
    expect(f.code).toBe(code);
    createdFamilyIds.push(f.skillFamilyId);

    const got = await suite.app.inject({
      method: "GET", url: `/v1/skill-families/${f.skillFamilyId}`,
      headers: { cookie: ch(platformS.cookies) },
    });
    expect(got.statusCode).toBe(200);
    expect((got.json() as { name: string }).name).toBe("Happy Path Family");

    const list = await suite.app.inject({
      method: "GET", url: `/v1/skill-families?search=${SUITE_PREFIX}`,
      headers: { cookie: ch(platformS.cookies) },
    });
    expect(list.statusCode).toBe(200);
    const body = list.json() as { items: Array<{ code: string }>; total: number };
    expect(body.items.some((i) => i.code === code)).toBe(true);
  });

  it("TENANT_ADMIN cannot create skill family → 403 SKILL_FAMILY_ADMIN_ONLY", async () => {
    const r = await suite.app.inject({
      method: "POST", url: "/v1/skill-families",
      headers: { cookie: ch(tenantS.cookies), "x-csrf-token": tenantS.csrfToken, "content-type": "application/json" },
      payload: { code: `${SUITE_PREFIX}_BLOCKED`, name: "Should Block" },
    });
    expect(r.statusCode).toBe(403);
    expect((r.json() as { error: { code: string } }).error.code).toBe("SKILL_FAMILY_ADMIN_ONLY");
  });

  it("Duplicate family code → 409 SKILL_FAMILY_CODE_CONFLICT", async () => {
    const code = `${SUITE_PREFIX}_DUP`;
    const first = await suite.app.inject({
      method: "POST", url: "/v1/skill-families",
      headers: { cookie: ch(platformS.cookies), "x-csrf-token": platformS.csrfToken, "content-type": "application/json" },
      payload: { code, name: "First" },
    });
    expect(first.statusCode).toBe(201);
    createdFamilyIds.push((first.json() as { skillFamilyId: string }).skillFamilyId);

    const dup = await suite.app.inject({
      method: "POST", url: "/v1/skill-families",
      headers: { cookie: ch(platformS.cookies), "x-csrf-token": platformS.csrfToken, "content-type": "application/json" },
      payload: { code, name: "Second" },
    });
    expect(dup.statusCode).toBe(409);
    expect((dup.json() as { error: { code: string } }).error.code).toBe("SKILL_FAMILY_CODE_CONFLICT");
  });

  it("DELETE refuses if categories are attached → 409 SKILL_FAMILY_IN_USE", async () => {
    const code = `${SUITE_PREFIX}_INUSE`;
    const f = await suite.app.inject({
      method: "POST", url: "/v1/skill-families",
      headers: { cookie: ch(platformS.cookies), "x-csrf-token": platformS.csrfToken, "content-type": "application/json" },
      payload: { code, name: "Has Children" },
    });
    const familyId = (f.json() as { skillFamilyId: string }).skillFamilyId;
    createdFamilyIds.push(familyId);

    const c = await suite.app.inject({
      method: "POST", url: "/v1/skill-categories",
      headers: { cookie: ch(platformS.cookies), "x-csrf-token": platformS.csrfToken, "content-type": "application/json" },
      payload: { familyId, code: `${SUITE_PREFIX}_CAT`, name: "Child Category" },
    });
    expect(c.statusCode).toBe(201);
    createdCategoryIds.push((c.json() as { skillCategoryId: string }).skillCategoryId);

    const del = await suite.app.inject({
      method: "DELETE", url: `/v1/skill-families/${familyId}`,
      headers: { cookie: ch(platformS.cookies), "x-csrf-token": platformS.csrfToken },
    });
    expect(del.statusCode).toBe(409);
    expect((del.json() as { error: { code: string } }).error.code).toBe("SKILL_FAMILY_IN_USE");
  });
});
