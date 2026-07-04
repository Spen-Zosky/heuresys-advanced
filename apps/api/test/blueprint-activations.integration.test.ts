/**
 * apps/api/test/blueprint-activations.integration.test.ts
 *
 * Integration tests for the blueprint-activations module (tenant-scoped).
 * Routes (apps/api/src/modules/blueprint-activations/routes.ts):
 *   GET    /            requirePermission('blueprint:read')
 *   GET    /:id         requirePermission('blueprint:read')
 *   POST   /            verifyCsrf + requirePermission('blueprint:activate')   -> 201
 *   PATCH  /:id         verifyCsrf + requirePermission('blueprint:activate')   -> 200
 *   DELETE /:id         verifyCsrf + requirePermission('blueprint:activate')   -> 204
 *
 * Visibility model (service.ts): PLATFORM_ADMIN sees all; everyone else only
 * their own tenant. `blueprint:read` is granted to every role; `blueprint:activate`
 * is NOT granted to USER (the denied-persona used below). requirePermission denial
 * yields ForbiddenError with default code "FORBIDDEN" (no second-arg code).
 *
 * NOTE: a full create-then-readback happy path would require a pre-existing
 * sys.sys_blueprint_variants row (create throws NotFoundError("BlueprintVariant")
 * for an unknown variantId). Rather than hard-code a seeded variant id (forbidden
 * by the brief — seed volume is not guaranteed) or create cross-module rows, the
 * create path is exercised up to the typed 404 NOT_FOUND. This proves auth + CSRF +
 * Zod body validation all pass and the service is reached, while creating NO row
 * (insert never runs) — so no afterAll cleanup is needed.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { closePool } from "../src/db/client.js";
import { TEST_PERSONA_PASSWORD } from "./helpers/personas.js";

const PWD = TEST_PERSONA_PASSWORD;

interface S {
  cookies: Map<string, string>;
  csrfToken: string;
}
function ch(c: Map<string, string>): string {
  return [...c.entries()].map(([n, v]) => `${n}=${v}`).join("; ");
}
async function login(t: TestApp, email: string): Promise<S> {
  const r = await loginRaw(t.app, email, PWD);
  const cookies = new Map<string, string>();
  for (const c of r.cookies) cookies.set(c.name, c.value);
  return { cookies, csrfToken: (r.json() as { csrfToken: string }).csrfToken };
}

interface ListBody {
  items: Array<{ blueprintActivationId: string; tenantId: string; variantId: string; status: string }>;
  total: number;
}
interface ErrBody {
  error: { code: string; message: string };
}

let suite: TestApp;
let platformS: S;
let tenantS: S;
let userS: S;

describe("/v1/blueprint-activations/* integration", () => {
  beforeAll(async () => {
    suite = await buildTestApp();
    platformS = await login(suite, "admin@heuresys.com");
    tenantS = await login(suite, "federica.marchetti@rtl-bank.org");
    userS = await login(suite, "tommaso.fiore@rtl-bank.org");
  });

  afterAll(async () => {
    await suite.app.close();
    await closePool();
  });

  it("unauthenticated GET / → 401", async () => {
    const r = await suite.app.inject({ method: "GET", url: "/v1/blueprint-activations" });
    expect(r.statusCode).toBe(401);
  });

  it("LIST as PLATFORM_ADMIN → 200 with { items: [], total } shape", async () => {
    const r = await suite.app.inject({
      method: "GET",
      url: "/v1/blueprint-activations",
      headers: { cookie: ch(platformS.cookies) },
    });
    expect(r.statusCode).toBe(200);
    const body = r.json() as ListBody;
    expect(Array.isArray(body.items)).toBe(true);
    expect(typeof body.total).toBe("number");
    expect(body.total).toBeGreaterThanOrEqual(0);
  });

  it("LIST as TENANT_ADMIN (tenant-scoped read) → 200 with valid shape", async () => {
    const r = await suite.app.inject({
      method: "GET",
      url: "/v1/blueprint-activations",
      headers: { cookie: ch(tenantS.cookies) },
    });
    expect(r.statusCode).toBe(200);
    const body = r.json() as ListBody;
    expect(Array.isArray(body.items)).toBe(true);
    expect(typeof body.total).toBe("number");
  });

  it("GET /:id for a random uuid → 404 NOT_FOUND", async () => {
    const r = await suite.app.inject({
      method: "GET",
      url: `/v1/blueprint-activations/${randomUUID()}`,
      headers: { cookie: ch(platformS.cookies) },
    });
    expect(r.statusCode).toBe(404);
    expect((r.json() as ErrBody).error.code).toBe("NOT_FOUND");
  });

  it("USER lacking blueprint:activate cannot POST → 403 FORBIDDEN", async () => {
    // valid CSRF token + schema-valid body so the request reaches requirePermission
    const r = await suite.app.inject({
      method: "POST",
      url: "/v1/blueprint-activations",
      headers: {
        cookie: ch(userS.cookies),
        "x-csrf-token": userS.csrfToken,
        "content-type": "application/json",
      },
      payload: { variantId: randomUUID() },
    });
    expect(r.statusCode).toBe(403);
    expect((r.json() as ErrBody).error.code).toBe("FORBIDDEN");
  });

  it("POST without x-csrf-token → 403 CSRF_FAIL", async () => {
    const r = await suite.app.inject({
      method: "POST",
      url: "/v1/blueprint-activations",
      headers: { cookie: ch(platformS.cookies), "content-type": "application/json" },
      payload: { variantId: randomUUID() },
    });
    expect(r.statusCode).toBe(403);
    expect((r.json() as ErrBody).error.code).toBe("CSRF_FAIL");
  });

  it("POST with unknown variantId (auth+CSRF pass) → 404 NOT_FOUND, no row created", async () => {
    const r = await suite.app.inject({
      method: "POST",
      url: "/v1/blueprint-activations",
      headers: {
        cookie: ch(platformS.cookies),
        "x-csrf-token": platformS.csrfToken,
        "content-type": "application/json",
      },
      // PLATFORM_ADMIN must supply tenantId; provide one so we get past the
      // TENANT_ID_REQUIRED guard and reach the variantExists() NOT_FOUND check.
      payload: { variantId: randomUUID(), tenantId: randomUUID() },
    });
    expect(r.statusCode).toBe(404);
    expect((r.json() as ErrBody).error.code).toBe("NOT_FOUND");
  });
});
