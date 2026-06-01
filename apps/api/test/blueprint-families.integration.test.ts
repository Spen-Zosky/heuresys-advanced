/**
 * apps/api/test/blueprint-families.integration.test.ts
 *
 * Integration tests for the blueprint-families module (global catalog, no tenant).
 * Routes (src/modules/blueprint-families/routes.ts):
 *   GET    /v1/blueprint-families        requirePermission('blueprint:read')
 *   GET    /v1/blueprint-families/:id    requirePermission('blueprint:read')
 *   POST   /v1/blueprint-families        verifyCsrf + requirePermission('blueprint:activate')
 *   PATCH  /v1/blueprint-families/:id     verifyCsrf + requirePermission('blueprint:override')
 *   DELETE /v1/blueprint-families/:id     verifyCsrf + requirePermission('blueprint:override')
 *
 * Authorization model (service.ts): writes are PLATFORM_ADMIN-only — the service
 * throws ForbiddenError("PLATFORM_ADMIN required") (default code FORBIDDEN) when the
 * actor is not PLATFORM_ADMIN. TENANT_ADMIN holds blueprint:activate/override at the
 * route RBAC layer (CROSS JOIN grant) but is blocked by the service-level isPlatform()
 * gate. The MANAGER persona lacks blueprint:activate entirely → blocked at the route
 * RBAC layer. Both paths surface as HTTP 403 + code FORBIDDEN.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { pool, closePool } from "../src/db/client.js";

const PWD = "Admin#PassW0rd!";
const SUITE_PREFIX = `IT_BF_${randomUUID().slice(0, 8).toUpperCase()}`;

interface S {
  cookies: Map<string, string>;
  csrfToken: string;
}
function ch(c: Map<string, string>): string {
  return [...c.entries()].map(([n, v]) => `${n}=${v}`).join("; ");
}
async function login(t: TestApp, email: string): Promise<S> {
  const r = await t.app.inject({ method: "POST", url: "/v1/auth/login", payload: { email, password: PWD } });
  if (r.statusCode !== 200) throw new Error(`login ${email}: ${r.statusCode}`);
  const cookies = new Map<string, string>();
  for (const c of r.cookies) cookies.set(c.name, c.value);
  return { cookies, csrfToken: (r.json() as { csrfToken: string }).csrfToken };
}

interface FamilyResponse {
  blueprintFamilyId: string;
  code: string;
  name: string;
  description: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}
interface ErrorEnvelope {
  error: { code: string; message: string; requestId?: string };
}

let suite: TestApp;
let platformS: S;
let tenantS: S;
let managerS: S;
const createdFamilyIds: string[] = [];

describe("/v1/blueprint-families/* integration", () => {
  beforeAll(async () => {
    suite = await buildTestApp();
    platformS = await login(suite, "admin@heuresys.com");
    tenantS = await login(suite, "federica.marchetti@rtl-bank.org");
    managerS = await login(suite, "paolo.caputo@rtl-bank.org");
  });

  afterAll(async () => {
    for (const id of createdFamilyIds) {
      try {
        await pool.query(`DELETE FROM sys.sys_blueprint_families WHERE blueprint_family_id = $1`, [id]);
      } catch {
        /* ignore cleanup errors */
      }
    }
    await suite.app.close();
    await closePool();
  });

  it("unauthenticated GET / → 401", async () => {
    const r = await suite.app.inject({ method: "GET", url: "/v1/blueprint-families" });
    expect(r.statusCode).toBe(401);
  });

  it("LIST as PLATFORM_ADMIN → 200 with { items: [], total } shape", async () => {
    const r = await suite.app.inject({
      method: "GET",
      url: "/v1/blueprint-families",
      headers: { cookie: ch(platformS.cookies) },
    });
    expect(r.statusCode).toBe(200);
    const body = r.json() as { items: FamilyResponse[]; total: number };
    expect(Array.isArray(body.items)).toBe(true);
    expect(typeof body.total).toBe("number");
  });

  it("CREATE then GET /:id as PLATFORM_ADMIN happy path → 201 then 200", async () => {
    const code = `${SUITE_PREFIX}_HP`;
    const created = await suite.app.inject({
      method: "POST",
      url: "/v1/blueprint-families",
      headers: {
        cookie: ch(platformS.cookies),
        "x-csrf-token": platformS.csrfToken,
        "content-type": "application/json",
      },
      payload: { code, name: "Happy Family" },
    });
    expect(created.statusCode).toBe(201);
    const c = created.json() as FamilyResponse;
    expect(c.code).toBe(code);
    expect(c.name).toBe("Happy Family");
    expect(typeof c.blueprintFamilyId).toBe("string");
    createdFamilyIds.push(c.blueprintFamilyId);

    const got = await suite.app.inject({
      method: "GET",
      url: `/v1/blueprint-families/${c.blueprintFamilyId}`,
      headers: { cookie: ch(platformS.cookies) },
    });
    expect(got.statusCode).toBe(200);
    const g = got.json() as FamilyResponse;
    expect(g.blueprintFamilyId).toBe(c.blueprintFamilyId);
    expect(g.code).toBe(code);
  });

  it("GET /:id with a random uuid → 404 NOT_FOUND", async () => {
    const r = await suite.app.inject({
      method: "GET",
      url: `/v1/blueprint-families/${randomUUID()}`,
      headers: { cookie: ch(platformS.cookies) },
    });
    expect(r.statusCode).toBe(404);
    expect((r.json() as ErrorEnvelope).error.code).toBe("NOT_FOUND");
  });

  it("TENANT_ADMIN cannot create (service PLATFORM_ADMIN gate) → 403 FORBIDDEN", async () => {
    const r = await suite.app.inject({
      method: "POST",
      url: "/v1/blueprint-families",
      headers: {
        cookie: ch(tenantS.cookies),
        "x-csrf-token": tenantS.csrfToken,
        "content-type": "application/json",
      },
      payload: { code: `${SUITE_PREFIX}_TA_BLOCK`, name: "Tenant Blocked" },
    });
    expect(r.statusCode).toBe(403);
    expect((r.json() as ErrorEnvelope).error.code).toBe("FORBIDDEN");
  });

  it("MANAGER lacks blueprint:activate (route RBAC) → 403 FORBIDDEN", async () => {
    const r = await suite.app.inject({
      method: "POST",
      url: "/v1/blueprint-families",
      headers: {
        cookie: ch(managerS.cookies),
        "x-csrf-token": managerS.csrfToken,
        "content-type": "application/json",
      },
      payload: { code: `${SUITE_PREFIX}_MGR_BLOCK`, name: "Manager Blocked" },
    });
    expect(r.statusCode).toBe(403);
    expect((r.json() as ErrorEnvelope).error.code).toBe("FORBIDDEN");
  });

  it("CREATE without x-csrf-token header → 403", async () => {
    const r = await suite.app.inject({
      method: "POST",
      url: "/v1/blueprint-families",
      headers: { cookie: ch(platformS.cookies), "content-type": "application/json" },
      payload: { code: `${SUITE_PREFIX}_NOCSRF`, name: "No CSRF" },
    });
    expect(r.statusCode).toBe(403);
  });

  it("duplicate code → 409 BLUEPRINT_FAMILY_CODE_CONFLICT", async () => {
    const code = `${SUITE_PREFIX}_DUP`;
    const first = await suite.app.inject({
      method: "POST",
      url: "/v1/blueprint-families",
      headers: {
        cookie: ch(platformS.cookies),
        "x-csrf-token": platformS.csrfToken,
        "content-type": "application/json",
      },
      payload: { code, name: "First Dup" },
    });
    expect(first.statusCode).toBe(201);
    createdFamilyIds.push((first.json() as FamilyResponse).blueprintFamilyId);

    const dup = await suite.app.inject({
      method: "POST",
      url: "/v1/blueprint-families",
      headers: {
        cookie: ch(platformS.cookies),
        "x-csrf-token": platformS.csrfToken,
        "content-type": "application/json",
      },
      payload: { code, name: "Second Dup" },
    });
    expect(dup.statusCode).toBe(409);
    expect((dup.json() as ErrorEnvelope).error.code).toBe("BLUEPRINT_FAMILY_CODE_CONFLICT");
  });
});
