/**
 * apps/api/test/skill-aliases.integration.test.ts
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { pool, closePool } from "../src/db/client.js";

const PWD = "Admin#PassW0rd!";
const SUITE_PREFIX = `IT_SAL_${randomUUID().slice(0, 8).toUpperCase()}`;

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
let globalSkillId: string;
let tenantSkillId: string;
const createdAliasIds: string[] = [];
const createdSkillIds: string[] = [];

describe("/v1/skill-aliases/* integration", () => {
  beforeAll(async () => {
    suite = await buildTestApp();
    platformS = await login(suite, "admin@heuresys.com");
    tenantS = await login(suite, "tenant_admin_test@rtl-bank.test");
    const sg = await suite.app.inject({
      method: "POST", url: "/v1/skills",
      headers: { cookie: ch(platformS.cookies), "x-csrf-token": platformS.csrfToken, "content-type": "application/json" },
      payload: { code: `${SUITE_PREFIX}_GLOBAL`, name: "Global Skill", isGlobal: true },
    });
    globalSkillId = (sg.json() as { skillId: string }).skillId;
    createdSkillIds.push(globalSkillId);
    const st = await suite.app.inject({
      method: "POST", url: "/v1/skills",
      headers: { cookie: ch(tenantS.cookies), "x-csrf-token": tenantS.csrfToken, "content-type": "application/json" },
      payload: { code: `${SUITE_PREFIX}_TENANT`, name: "Tenant Skill" },
    });
    tenantSkillId = (st.json() as { skillId: string }).skillId;
    createdSkillIds.push(tenantSkillId);
  });

  afterAll(async () => {
    for (const id of createdAliasIds) {
      try { await pool.query(`DELETE FROM sys.sys_skill_aliases WHERE skill_alias_id = $1`, [id]); }
      catch { /* ignore */ }
    }
    for (const id of createdSkillIds) {
      try { await pool.query(`DELETE FROM sys.sys_skills WHERE skill_id = $1`, [id]); }
      catch { /* ignore */ }
    }
    await suite.app.close();
    await closePool();
  });

  it("CREATE alias on tenant skill as TENANT_ADMIN happy path", async () => {
    const created = await suite.app.inject({
      method: "POST", url: "/v1/skill-aliases",
      headers: { cookie: ch(tenantS.cookies), "x-csrf-token": tenantS.csrfToken, "content-type": "application/json" },
      payload: { skillId: tenantSkillId, label: "Sinonimo IT", locale: "it" },
    });
    expect(created.statusCode).toBe(201);
    const a = created.json() as { aliasId: string; label: string; locale: string };
    expect(a.label).toBe("Sinonimo IT");
    createdAliasIds.push(a.aliasId);

    const list = await suite.app.inject({
      method: "GET", url: `/v1/skill-aliases?skillId=${tenantSkillId}`,
      headers: { cookie: ch(tenantS.cookies) },
    });
    expect(list.statusCode).toBe(200);
    const body = list.json() as { items: Array<{ aliasId: string }>; total: number };
    expect(body.items.some((i) => i.aliasId === a.aliasId)).toBe(true);
  });

  it("TENANT_ADMIN cannot create alias on global skill → 403 GLOBAL_SKILL_ALIAS_ADMIN_ONLY", async () => {
    const r = await suite.app.inject({
      method: "POST", url: "/v1/skill-aliases",
      headers: { cookie: ch(tenantS.cookies), "x-csrf-token": tenantS.csrfToken, "content-type": "application/json" },
      payload: { skillId: globalSkillId, label: "Should Block", locale: "en" },
    });
    expect(r.statusCode).toBe(403);
    expect((r.json() as { error: { code: string } }).error.code).toBe("GLOBAL_SKILL_ALIAS_ADMIN_ONLY");
  });

  it("Duplicate label+locale → 409 SKILL_ALIAS_CONFLICT", async () => {
    const first = await suite.app.inject({
      method: "POST", url: "/v1/skill-aliases",
      headers: { cookie: ch(tenantS.cookies), "x-csrf-token": tenantS.csrfToken, "content-type": "application/json" },
      payload: { skillId: tenantSkillId, label: "Duplicato", locale: "it" },
    });
    expect(first.statusCode).toBe(201);
    createdAliasIds.push((first.json() as { aliasId: string }).aliasId);

    const dup = await suite.app.inject({
      method: "POST", url: "/v1/skill-aliases",
      headers: { cookie: ch(tenantS.cookies), "x-csrf-token": tenantS.csrfToken, "content-type": "application/json" },
      payload: { skillId: tenantSkillId, label: "Duplicato", locale: "it" },
    });
    expect(dup.statusCode).toBe(409);
    expect((dup.json() as { error: { code: string } }).error.code).toBe("SKILL_ALIAS_CONFLICT");
  });

  it("PATCH alias label as PLATFORM_ADMIN on global skill alias", async () => {
    const created = await suite.app.inject({
      method: "POST", url: "/v1/skill-aliases",
      headers: { cookie: ch(platformS.cookies), "x-csrf-token": platformS.csrfToken, "content-type": "application/json" },
      payload: { skillId: globalSkillId, label: "Initial", locale: "en" },
    });
    expect(created.statusCode).toBe(201);
    const aliasId = (created.json() as { aliasId: string }).aliasId;
    createdAliasIds.push(aliasId);

    const patched = await suite.app.inject({
      method: "PATCH", url: `/v1/skill-aliases/${aliasId}`,
      headers: { cookie: ch(platformS.cookies), "x-csrf-token": platformS.csrfToken, "content-type": "application/json" },
      payload: { label: "Renamed" },
    });
    expect(patched.statusCode).toBe(200);
    expect((patched.json() as { label: string }).label).toBe("Renamed");
  });
});
