/**
 * apps/api/test/skill-taxonomy-edges.integration.test.ts
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { pool, closePool } from "../src/db/client.js";

const PWD = "Admin#PassW0rd!";
const SUITE_PREFIX = `IT_STE_${randomUUID().slice(0, 8).toUpperCase()}`;

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
let parentSkillId: string;
let childSkillId: string;
const createdEdgeIds: string[] = [];
const createdSkillIds: string[] = [];

describe("/v1/skill-taxonomy-edges/* integration", () => {
  beforeAll(async () => {
    suite = await buildTestApp();
    platformS = await login(suite, "admin@heuresys.com");
    tenantS = await login(suite, "tenant_admin_test@rtl-bank.test");
    // Two global skills as endpoints for edges.
    const sp = await suite.app.inject({
      method: "POST", url: "/v1/skills",
      headers: { cookie: ch(platformS.cookies), "x-csrf-token": platformS.csrfToken, "content-type": "application/json" },
      payload: { code: `${SUITE_PREFIX}_PARENT`, name: "Parent Skill", isGlobal: true },
    });
    parentSkillId = (sp.json() as { skillId: string }).skillId;
    createdSkillIds.push(parentSkillId);
    const sc = await suite.app.inject({
      method: "POST", url: "/v1/skills",
      headers: { cookie: ch(platformS.cookies), "x-csrf-token": platformS.csrfToken, "content-type": "application/json" },
      payload: { code: `${SUITE_PREFIX}_CHILD`, name: "Child Skill", isGlobal: true },
    });
    childSkillId = (sc.json() as { skillId: string }).skillId;
    createdSkillIds.push(childSkillId);
  });

  afterAll(async () => {
    for (const id of createdEdgeIds) {
      try { await pool.query(`DELETE FROM sys.sys_skill_taxonomy_edges WHERE skill_taxonomy_edge_id = $1`, [id]); }
      catch { /* ignore */ }
    }
    for (const id of createdSkillIds) {
      try { await pool.query(`DELETE FROM sys.sys_skills WHERE skill_id = $1`, [id]); }
      catch { /* ignore */ }
    }
    await suite.app.close();
    await closePool();
  });

  it("CREATE / GET / LIST edge as PLATFORM_ADMIN happy path", async () => {
    const created = await suite.app.inject({
      method: "POST", url: "/v1/skill-taxonomy-edges",
      headers: { cookie: ch(platformS.cookies), "x-csrf-token": platformS.csrfToken, "content-type": "application/json" },
      payload: { parentSkillId, childSkillId, kind: "IS_A" },
    });
    expect(created.statusCode).toBe(201);
    const e = created.json() as { edgeId: string; kind: string };
    expect(e.kind).toBe("IS_A");
    createdEdgeIds.push(e.edgeId);

    const got = await suite.app.inject({
      method: "GET", url: `/v1/skill-taxonomy-edges/${e.edgeId}`,
      headers: { cookie: ch(tenantS.cookies) },
    });
    expect(got.statusCode).toBe(200);
  });

  it("Self-loop → 400 VALIDATION_ERROR", async () => {
    const r = await suite.app.inject({
      method: "POST", url: "/v1/skill-taxonomy-edges",
      headers: { cookie: ch(platformS.cookies), "x-csrf-token": platformS.csrfToken, "content-type": "application/json" },
      payload: { parentSkillId, childSkillId: parentSkillId, kind: "RELATED" },
    });
    expect(r.statusCode).toBe(400);
    expect((r.json() as { error: { code: string } }).error.code).toBe("VALIDATION_ERROR");
  });

  it("Missing parent skill → 404", async () => {
    const r = await suite.app.inject({
      method: "POST", url: "/v1/skill-taxonomy-edges",
      headers: { cookie: ch(platformS.cookies), "x-csrf-token": platformS.csrfToken, "content-type": "application/json" },
      payload: { parentSkillId: randomUUID(), childSkillId, kind: "IS_A" },
    });
    expect(r.statusCode).toBe(404);
    expect((r.json() as { error: { code: string } }).error.code).toBe("NOT_FOUND");
  });

  it("Duplicate parent/child/kind → 409 SKILL_TAXONOMY_EDGE_CONFLICT", async () => {
    const r1 = await suite.app.inject({
      method: "POST", url: "/v1/skill-taxonomy-edges",
      headers: { cookie: ch(platformS.cookies), "x-csrf-token": platformS.csrfToken, "content-type": "application/json" },
      payload: { parentSkillId, childSkillId, kind: "PART_OF" },
    });
    expect(r1.statusCode).toBe(201);
    createdEdgeIds.push((r1.json() as { edgeId: string }).edgeId);

    const r2 = await suite.app.inject({
      method: "POST", url: "/v1/skill-taxonomy-edges",
      headers: { cookie: ch(platformS.cookies), "x-csrf-token": platformS.csrfToken, "content-type": "application/json" },
      payload: { parentSkillId, childSkillId, kind: "PART_OF" },
    });
    expect(r2.statusCode).toBe(409);
    expect((r2.json() as { error: { code: string } }).error.code).toBe("SKILL_TAXONOMY_EDGE_CONFLICT");
  });

  it("TENANT_ADMIN cannot create edge → 403 SKILL_TAXONOMY_ADMIN_ONLY", async () => {
    const r = await suite.app.inject({
      method: "POST", url: "/v1/skill-taxonomy-edges",
      headers: { cookie: ch(tenantS.cookies), "x-csrf-token": tenantS.csrfToken, "content-type": "application/json" },
      payload: { parentSkillId, childSkillId, kind: "RELATED" },
    });
    expect(r.statusCode).toBe(403);
    expect((r.json() as { error: { code: string } }).error.code).toBe("SKILL_TAXONOMY_ADMIN_ONLY");
  });
});
