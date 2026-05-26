/**
 * apps/api/test/skills.integration.test.ts
 * Integration tests for /v1/skills/* covering tenant + global visibility.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { pool, closePool } from "../src/db/client.js";

const PWD = "Admin#PassW0rd!";
const SUITE_PREFIX = `IT_SK_${randomUUID().slice(0, 8).toUpperCase()}`;

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
let employeeS: S;
const createdSkillIds: string[] = [];

describe("/v1/skills/* integration", () => {
  beforeAll(async () => {
    suite = await buildTestApp();
    platformS = await login(suite, "admin@heuresys.com");
    tenantS = await login(suite, "tenant_admin_test@rtl-bank.test");
    employeeS = await login(suite, "employee_test@rtl-bank.test");
  });

  afterAll(async () => {
    for (const id of createdSkillIds) {
      try { await pool.query(`DELETE FROM sys.sys_skills WHERE skill_id = $1`, [id]); }
      catch { /* ignore */ }
    }
    await suite.app.close();
    await closePool();
  });

  it("CREATE tenant-scoped skill as TENANT_ADMIN; visible to USER in same tenant", async () => {
    const code = `${SUITE_PREFIX}_TENANT`;
    const created = await suite.app.inject({
      method: "POST", url: "/v1/skills",
      headers: { cookie: ch(tenantS.cookies), "x-csrf-token": tenantS.csrfToken, "content-type": "application/json" },
      payload: { code, name: "Tenant Skill" },
    });
    expect(created.statusCode).toBe(201);
    const skill = created.json() as { skillId: string; isGlobal: boolean; tenantId: string | null };
    expect(skill.isGlobal).toBe(false);
    expect(skill.tenantId).not.toBeNull();
    createdSkillIds.push(skill.skillId);

    const visibility = await suite.app.inject({
      method: "GET", url: `/v1/skills/${skill.skillId}`,
      headers: { cookie: ch(employeeS.cookies) },
    });
    expect(visibility.statusCode).toBe(200);
  });

  it("CREATE global skill as PLATFORM_ADMIN; visible to all", async () => {
    const code = `${SUITE_PREFIX}_GLOBAL`;
    const created = await suite.app.inject({
      method: "POST", url: "/v1/skills",
      headers: { cookie: ch(platformS.cookies), "x-csrf-token": platformS.csrfToken, "content-type": "application/json" },
      payload: { code, name: "Global Skill", isGlobal: true },
    });
    expect(created.statusCode).toBe(201);
    const skill = created.json() as { skillId: string; isGlobal: boolean; tenantId: string | null };
    expect(skill.isGlobal).toBe(true);
    expect(skill.tenantId).toBeNull();
    createdSkillIds.push(skill.skillId);

    // Visible to USER too
    const visUser = await suite.app.inject({
      method: "GET", url: `/v1/skills/${skill.skillId}`,
      headers: { cookie: ch(employeeS.cookies) },
    });
    expect(visUser.statusCode).toBe(200);
  });

  it("TENANT_ADMIN cannot create global skill (forced to false)", async () => {
    const code = `${SUITE_PREFIX}_NOT_GLOBAL`;
    const created = await suite.app.inject({
      method: "POST", url: "/v1/skills",
      headers: { cookie: ch(tenantS.cookies), "x-csrf-token": tenantS.csrfToken, "content-type": "application/json" },
      payload: { code, name: "Not Really Global", isGlobal: true },
    });
    expect(created.statusCode).toBe(201);
    const skill = created.json() as { skillId: string; isGlobal: boolean };
    expect(skill.isGlobal).toBe(false); // forced
    createdSkillIds.push(skill.skillId);
  });

  it("UPDATE global skill as TENANT_ADMIN → 403", async () => {
    const code = `${SUITE_PREFIX}_LOCKED_GLOBAL`;
    const created = await suite.app.inject({
      method: "POST", url: "/v1/skills",
      headers: { cookie: ch(platformS.cookies), "x-csrf-token": platformS.csrfToken, "content-type": "application/json" },
      payload: { code, name: "Locked Global", isGlobal: true },
    });
    const { skillId } = created.json() as { skillId: string };
    createdSkillIds.push(skillId);

    const blocked = await suite.app.inject({
      method: "PATCH", url: `/v1/skills/${skillId}`,
      headers: { cookie: ch(tenantS.cookies), "x-csrf-token": tenantS.csrfToken, "content-type": "application/json" },
      payload: { name: "Attempt Rename" },
    });
    expect(blocked.statusCode).toBe(403);
    expect((blocked.json() as { error: { code: string } }).error.code).toBe(
      "GLOBAL_SKILL_EDIT_FORBIDDEN",
    );
  });

  it("LIST as USER includes both global + own-tenant skills", async () => {
    // Scope by SUITE_PREFIX via the `search` filter (ILIKE on code/name) so the
    // assertion is robust against table growth: sys.sys_skills holds tens of
    // thousands of rows post brownfield Wave-1 import, far beyond any single
    // page, so a bare `?limit=200` would not contain this suite's freshly
    // created skills. The visibility intent (USER sees global + own-tenant) is
    // unchanged — we still assert every createdSkillId is returned.
    const r = await suite.app.inject({
      method: "GET", url: `/v1/skills?limit=200&search=${SUITE_PREFIX}`,
      headers: { cookie: ch(employeeS.cookies) },
    });
    expect(r.statusCode).toBe(200);
    const body = r.json() as { items: { skillId: string }[] };
    // Should contain the global + tenant skills we created above.
    const ids = new Set(body.items.map((s) => s.skillId));
    for (const id of createdSkillIds) expect(ids.has(id)).toBe(true);
  });
});
