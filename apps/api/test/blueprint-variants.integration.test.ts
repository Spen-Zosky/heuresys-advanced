/**
 * apps/api/test/blueprint-variants.integration.test.ts
 *
 * Module: blueprint-variants (global catalog, platform-only mutations).
 * Routes (apps/api/src/modules/blueprint-variants/routes.ts):
 *   GET    /v1/blueprint-variants          requirePermission('blueprint:read')
 *   GET    /v1/blueprint-variants/:id      requirePermission('blueprint:read')
 *   POST   /v1/blueprint-variants          verifyCsrf + requirePermission('blueprint:activate')  -> 201
 *   PATCH  /v1/blueprint-variants/:id       verifyCsrf + requirePermission('blueprint:override') -> 200
 *   DELETE /v1/blueprint-variants/:id       verifyCsrf + requirePermission('blueprint:override') -> 204
 * Service auth model: mutations require PLATFORM_ADMIN (isPlatform), else ForbiddenError
 *   ("PLATFORM_ADMIN required") WITHOUT an explicit SCREAMING_SNAKE code -> assert HTTP 403 only.
 * Typed codes asserted: BLUEPRINT_VARIANT_CODE_CONFLICT (409), NOT_FOUND (404, NotFoundError).
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { pool, closePool } from "../src/db/client.js";

const PWD = "Admin#PassW0rd!";
const SUITE_PREFIX = `IT_BV_${randomUUID().slice(0, 8).toUpperCase()}`;

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
let platformS: S;   // admin@heuresys.com           = PLATFORM_ADMIN
let tenantS: S;     // federica.marchetti@rtl-bank  = TENANT_ADMIN (not platform -> mutation 403)
let userS: S;       // tommaso.fiore@rtl-bank       = USER (no blueprint:override -> mutation 403)
let familyId: string;
const createdVariantIds: string[] = [];

describe("/v1/blueprint-variants/* integration", () => {
  beforeAll(async () => {
    suite = await buildTestApp();
    platformS = await login(suite, "admin@heuresys.com");
    tenantS = await login(suite, "federica.marchetti@rtl-bank.org");
    userS = await login(suite, "tommaso.fiore@rtl-bank.org");
    // Seed a real parent blueprint family (FK target) as PLATFORM_ADMIN, mirroring the
    // skill-categories template (which seeds a skill-family parent).
    const f = await suite.app.inject({
      method: "POST", url: "/v1/blueprint-families",
      headers: { cookie: ch(platformS.cookies), "x-csrf-token": platformS.csrfToken, "content-type": "application/json" },
      payload: { code: `${SUITE_PREFIX}_FAM`, name: "Parent Family" },
    });
    if (f.statusCode !== 201) throw new Error(`family seed failed: ${f.statusCode} ${f.body}`);
    familyId = (f.json() as { blueprintFamilyId: string }).blueprintFamilyId;
  });

  afterAll(async () => {
    for (const id of createdVariantIds) {
      try { await pool.query(`DELETE FROM sys.sys_blueprint_variants WHERE blueprint_variant_id = $1`, [id]); }
      catch { /* ignore */ }
    }
    try { await pool.query(`DELETE FROM sys.sys_blueprint_families WHERE blueprint_family_id = $1`, [familyId]); }
    catch { /* ignore */ }
    await suite.app.close();
    await closePool();
  });

  it("unauthenticated GET list -> 401", async () => {
    const r = await suite.app.inject({ method: "GET", url: "/v1/blueprint-variants" });
    expect(r.statusCode).toBe(401);
  });

  it("USER lacking blueprint:override -> 403 FORBIDDEN on DELETE", async () => {
    // Every role has blueprint:read, so a read-denial test is impossible. DELETE uses
    // only path params (no body), so with a valid CSRF token verifyCsrf passes and
    // requirePermission('blueprint:override') denies USER in the preHandler chain.
    const r = await suite.app.inject({
      method: "DELETE", url: `/v1/blueprint-variants/${randomUUID()}`,
      // No content-type: a body-less DELETE with content-type:application/json makes Fastify
      // reject the empty body with 400 before the preHandler RBAC check runs.
      headers: { cookie: ch(userS.cookies), "x-csrf-token": userS.csrfToken },
    });
    expect(r.statusCode).toBe(403);
    expect((r.json() as { error: { code: string } }).error.code).toBe("FORBIDDEN");
  });

  it("LIST as PLATFORM_ADMIN -> 200 with { items, total } shape", async () => {
    const r = await suite.app.inject({
      method: "GET", url: "/v1/blueprint-variants",
      headers: { cookie: ch(platformS.cookies) },
    });
    expect(r.statusCode).toBe(200);
    const body = r.json() as { items: unknown[]; total: number };
    expect(Array.isArray(body.items)).toBe(true);
    expect(typeof body.total).toBe("number");
  });

  it("CREATE / GET-by-id / LIST-by-family as PLATFORM_ADMIN happy path", async () => {
    const code = `${SUITE_PREFIX}_HP`;
    const created = await suite.app.inject({
      method: "POST", url: "/v1/blueprint-variants",
      headers: { cookie: ch(platformS.cookies), "x-csrf-token": platformS.csrfToken, "content-type": "application/json" },
      payload: { familyId, code, name: "Happy Variant" },
    });
    expect(created.statusCode).toBe(201);
    const v = created.json() as { blueprintVariantId: string; familyId: string; code: string };
    expect(v.code).toBe(code);
    expect(v.familyId).toBe(familyId);
    createdVariantIds.push(v.blueprintVariantId);

    const got = await suite.app.inject({
      method: "GET", url: `/v1/blueprint-variants/${v.blueprintVariantId}`,
      headers: { cookie: ch(platformS.cookies) },
    });
    expect(got.statusCode).toBe(200);
    expect((got.json() as { blueprintVariantId: string }).blueprintVariantId).toBe(v.blueprintVariantId);

    const list = await suite.app.inject({
      method: "GET", url: `/v1/blueprint-variants?familyId=${familyId}`,
      headers: { cookie: ch(platformS.cookies) },
    });
    expect(list.statusCode).toBe(200);
    const body = list.json() as { items: Array<{ code: string }>; total: number };
    expect(body.items.some((i) => i.code === code)).toBe(true);
  });

  it("GET-by-id for random uuid -> 404 NOT_FOUND", async () => {
    const r = await suite.app.inject({
      method: "GET", url: `/v1/blueprint-variants/${randomUUID()}`,
      headers: { cookie: ch(platformS.cookies) },
    });
    expect(r.statusCode).toBe(404);
    expect((r.json() as { error: { code: string } }).error.code).toBe("NOT_FOUND");
  });

  it("TENANT_ADMIN cannot create (platform-only) -> 403", async () => {
    const r = await suite.app.inject({
      method: "POST", url: "/v1/blueprint-variants",
      headers: { cookie: ch(tenantS.cookies), "x-csrf-token": tenantS.csrfToken, "content-type": "application/json" },
      payload: { familyId, code: `${SUITE_PREFIX}_BLOCK`, name: "Blocked" },
    });
    expect(r.statusCode).toBe(403);
  });

  it("CREATE without x-csrf-token header -> 403 (CSRF)", async () => {
    const r = await suite.app.inject({
      method: "POST", url: "/v1/blueprint-variants",
      headers: { cookie: ch(platformS.cookies), "content-type": "application/json" },
      payload: { familyId, code: `${SUITE_PREFIX}_NOCSRF`, name: "No CSRF" },
    });
    expect(r.statusCode).toBe(403);
  });

  it("Duplicate variant code -> 409 BLUEPRINT_VARIANT_CODE_CONFLICT", async () => {
    const code = `${SUITE_PREFIX}_DUP`;
    const first = await suite.app.inject({
      method: "POST", url: "/v1/blueprint-variants",
      headers: { cookie: ch(platformS.cookies), "x-csrf-token": platformS.csrfToken, "content-type": "application/json" },
      payload: { familyId, code, name: "First Dup" },
    });
    expect(first.statusCode).toBe(201);
    createdVariantIds.push((first.json() as { blueprintVariantId: string }).blueprintVariantId);

    const dup = await suite.app.inject({
      method: "POST", url: "/v1/blueprint-variants",
      headers: { cookie: ch(platformS.cookies), "x-csrf-token": platformS.csrfToken, "content-type": "application/json" },
      payload: { familyId, code, name: "Second Dup" },
    });
    expect(dup.statusCode).toBe(409);
    expect((dup.json() as { error: { code: string } }).error.code).toBe("BLUEPRINT_VARIANT_CODE_CONFLICT");
  });
});
