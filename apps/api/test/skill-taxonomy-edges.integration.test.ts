/**
 * apps/api/test/skill-taxonomy-edges.integration.test.ts
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { pool, closePool } from "../src/db/client.js";
import { TEST_PERSONA_PASSWORD } from "./helpers/personas.js";

const PWD = TEST_PERSONA_PASSWORD;
const SUITE_PREFIX = `IT_STE_${randomUUID().slice(0, 8).toUpperCase()}`;

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
let parentSkillId: string;
let childSkillId: string;
const createdEdgeIds: string[] = [];
const createdSkillIds: string[] = [];

describe("/v1/skill-taxonomy-edges/* integration", () => {
  beforeAll(async () => {
    suite = await buildTestApp();
    platformS = await login(suite, "enzo.spenuso@heuresys.com");
    tenantS = await login(suite, "federica.marchetti@rtl-bank.org");
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

  it("#62 G3 — multi-hop cycle (A→B, B→C, C→A) → 409 SKILL_TAXONOMY_EDGE_CYCLE", async () => {
    // third node C: parent→child already exists (IS_A, test 1); add child→C, then C→parent must close the loop
    const s3 = await suite.app.inject({
      method: "POST", url: "/v1/skills",
      headers: { cookie: ch(platformS.cookies), "x-csrf-token": platformS.csrfToken, "content-type": "application/json" },
      payload: { code: `${SUITE_PREFIX}_GRANDCHILD`, name: "Grandchild Skill", isGlobal: true },
    });
    const grandchildId = (s3.json() as { skillId: string }).skillId;
    createdSkillIds.push(grandchildId);

    const e2 = await suite.app.inject({
      method: "POST", url: "/v1/skill-taxonomy-edges",
      headers: { cookie: ch(platformS.cookies), "x-csrf-token": platformS.csrfToken, "content-type": "application/json" },
      payload: { parentSkillId: childSkillId, childSkillId: grandchildId, kind: "IS_A" },
    });
    expect(e2.statusCode).toBe(201);
    createdEdgeIds.push((e2.json() as { edgeId: string }).edgeId);

    const closing = await suite.app.inject({
      method: "POST", url: "/v1/skill-taxonomy-edges",
      headers: { cookie: ch(platformS.cookies), "x-csrf-token": platformS.csrfToken, "content-type": "application/json" },
      payload: { parentSkillId: grandchildId, childSkillId: parentSkillId, kind: "IS_A" },
    });
    expect(closing.statusCode).toBe(409);
    expect((closing.json() as { error: { code: string } }).error.code).toBe("SKILL_TAXONOMY_EDGE_CYCLE");

    // a DIFFERENT kind must not be blocked by the IS_A chain (kind-scoped walk)
    const otherKind = await suite.app.inject({
      method: "POST", url: "/v1/skill-taxonomy-edges",
      headers: { cookie: ch(platformS.cookies), "x-csrf-token": platformS.csrfToken, "content-type": "application/json" },
      payload: { parentSkillId: grandchildId, childSkillId: parentSkillId, kind: "RELATED" },
    });
    expect(otherKind.statusCode).toBe(201);
    createdEdgeIds.push((otherKind.json() as { edgeId: string }).edgeId);
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
