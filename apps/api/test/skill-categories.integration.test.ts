/**
 * apps/api/test/skill-categories.integration.test.ts
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { pool, closePool } from "../src/db/client.js";
import { TEST_PERSONA_PASSWORD } from "./helpers/personas.js";

const PWD = TEST_PERSONA_PASSWORD;
const SUITE_PREFIX = `IT_SC_${randomUUID().slice(0, 8).toUpperCase()}`;

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
let familyId: string;
const createdCategoryIds: string[] = [];

describe("/v1/skill-categories/* integration", () => {
  beforeAll(async () => {
    suite = await buildTestApp();
    platformS = await login(suite, "platform-test-admin@collaudo.invalid");
    tenantS = await login(suite, "federica.marchetti@rtl-bank.org");
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

  // D-10 (analisi interfacce 2026-10-31): la colonna della famiglia è nullable dalla 000051, e
  // in produzione ci sono categorie senza famiglia. Con il contratto che la pretendeva, la
  // lista intera rispondeva 500 (ResponseSerializationError su items[0].familyId) e la pagina
  // /skill-taxonomy era rotta per tutti.
  it("D-10: una categoria senza famiglia non rompe la lista (200, familyId null)", async () => {
    const code = `${SUITE_PREFIX}_NOFAM`;
    const ins = await pool.query<{ id: string }>(
      `INSERT INTO sys.sys_skill_categories (skill_category_family_id, skill_category_code, skill_category_name)
       VALUES (NULL, $1, 'Categoria senza famiglia') RETURNING skill_category_id AS id`,
      [code],
    );
    createdCategoryIds.push(ins.rows[0]!.id);

    const list = await suite.app.inject({
      method: "GET", url: `/v1/skill-categories?search=${code}`,
      headers: { cookie: ch(platformS.cookies) },
    });
    expect(list.statusCode, list.body).toBe(200);
    const body = list.json() as { items: Array<{ code: string; familyId: string | null }> };
    expect(body.items.find((i) => i.code === code)?.familyId).toBeNull();
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
