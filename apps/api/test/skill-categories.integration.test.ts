/**
 * apps/api/test/skill-categories.integration.test.ts
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { pool, closePool } from "../src/db/client.js";

const PWD = "Admin#PassW0rd!";
const SUITE_PREFIX = `IT_SC_${randomUUID().slice(0, 8).toUpperCase()}`;

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
let familyId: string;
const createdCategoryIds: string[] = [];

describe("/v1/skill-categories/* integration", () => {
  beforeAll(async () => {
    suite = await buildTestApp();
    platformS = await login(suite, "admin@heuresys.com");
    tenantS = await login(suite, "tenant_admin_test@rtl-bank.test");
    const f = await suite.app.inject({
      method: "POST", url: "/v1/skill-families",
      headers: { cookie: ch(platformS.cookies), "x-csrf-token": platformS.csrfToken, "content-type": "application/json" },
      payload: { code: `${SUITE_PREFIX}_FAM`, name: "Parent Family" },
    });
    familyId = (f.json() as { skillFamilyId: string }).skillFamilyId;
  });

  afterAll(async () => {
    for (const id of createdCategoryIds) {
      try { await pool.query(`DELETE FROM sys.sys_skill_categories WHERE skill_category_id = $1`, [id]); }
      catch { /* ignore */ }
    }
    try { await pool.query(`DELETE FROM sys.sys_skill_families WHERE skill_family_id = $1`, [familyId]); }
    catch { /* ignore */ }
    await suite.app.close();
    await closePool();
  });

  it("CREATE / GET / LIST as PLATFORM_ADMIN happy path", async () => {
    const code = `${SUITE_PREFIX}_HP`;
    const created = await suite.app.inject({
      method: "POST", url: "/v1/skill-categories",
      headers: { cookie: ch(platformS.cookies), "x-csrf-token": platformS.csrfToken, "content-type": "application/json" },
      payload: { familyId, code, name: "Happy Cat" },
    });
    expect(created.statusCode).toBe(201);
    const c = created.json() as { skillCategoryId: string; code: string };
    expect(c.code).toBe(code);
    createdCategoryIds.push(c.skillCategoryId);

    const list = await suite.app.inject({
      method: "GET", url: `/v1/skill-categories?familyId=${familyId}`,
      headers: { cookie: ch(platformS.cookies) },
    });
    expect(list.statusCode).toBe(200);
    const body = list.json() as { items: Array<{ code: string }>; total: number };
    expect(body.items.some((i) => i.code === code)).toBe(true);
  });

  it("Missing familyId FK → 404 NOT_FOUND", async () => {
    const r = await suite.app.inject({
      method: "POST", url: "/v1/skill-categories",
      headers: { cookie: ch(platformS.cookies), "x-csrf-token": platformS.csrfToken, "content-type": "application/json" },
      payload: { familyId: randomUUID(), code: `${SUITE_PREFIX}_ORPHAN`, name: "Orphan" },
    });
    expect(r.statusCode).toBe(404);
    expect((r.json() as { error: { code: string } }).error.code).toBe("NOT_FOUND");
  });

  it("TENANT_ADMIN cannot create → 403 SKILL_CATEGORY_ADMIN_ONLY", async () => {
    const r = await suite.app.inject({
      method: "POST", url: "/v1/skill-categories",
      headers: { cookie: ch(tenantS.cookies), "x-csrf-token": tenantS.csrfToken, "content-type": "application/json" },
      payload: { familyId, code: `${SUITE_PREFIX}_BLOCK`, name: "Blocked" },
    });
    expect(r.statusCode).toBe(403);
    expect((r.json() as { error: { code: string } }).error.code).toBe("SKILL_CATEGORY_ADMIN_ONLY");
  });

  it("Duplicate category code → 409 SKILL_CATEGORY_CODE_CONFLICT", async () => {
    const code = `${SUITE_PREFIX}_DUP`;
    const first = await suite.app.inject({
      method: "POST", url: "/v1/skill-categories",
      headers: { cookie: ch(platformS.cookies), "x-csrf-token": platformS.csrfToken, "content-type": "application/json" },
      payload: { familyId, code, name: "First Dup" },
    });
    expect(first.statusCode).toBe(201);
    createdCategoryIds.push((first.json() as { skillCategoryId: string }).skillCategoryId);

    const dup = await suite.app.inject({
      method: "POST", url: "/v1/skill-categories",
      headers: { cookie: ch(platformS.cookies), "x-csrf-token": platformS.csrfToken, "content-type": "application/json" },
      payload: { familyId, code, name: "Second Dup" },
    });
    expect(dup.statusCode).toBe(409);
    expect((dup.json() as { error: { code: string } }).error.code).toBe("SKILL_CATEGORY_CODE_CONFLICT");
  });
});
