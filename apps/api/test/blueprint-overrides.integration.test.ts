/**
 * apps/api/test/blueprint-overrides.integration.test.ts
 *
 * Module: blueprint-overrides (/v1/blueprint-overrides)
 * Routes (read from routes.ts):
 *   GET    /        requirePermission('blueprint:read')                       -> list
 *   GET    /:id     requirePermission('blueprint:read')                       -> getById
 *   PUT    /        verifyCsrf + requirePermission('blueprint:override')      -> upsert (200)
 *   DELETE /:id     verifyCsrf + requirePermission('blueprint:override')      -> delete (204)
 *
 * Visibility model (service.ts): platform sees all; non-platform restricted to
 * own tenant via the activation's tenant. A non-visible / missing activation
 * yields NotFoundError("BlueprintActivation") -> HTTP 404, error code NOT_FOUND.
 *
 * RBAC (db/migrations/000005_auth_foundation.sql):
 *   - blueprint:read   -> all 8 roles (incl. USER, MANAGER, TENANT_ADMIN).
 *   - blueprint:override -> PLATFORM_ADMIN, TENANT_ADMIN, BLUEPRINT_MANAGER only.
 *     MANAGER / USER do NOT hold it -> requirePermission throws the DEFAULT
 *     ForbiddenError (no custom code) -> HTTP 403, error code FORBIDDEN.
 *
 * No rows are created by this suite: the mutation happy-path requires a real
 * activation+process pair with matching variants, which is not guaranteed by
 * the seed (seed volume is not asserted). Instead the PUT route is exercised
 * deterministically against a random activationId -> 404 NOT_FOUND. The afterAll
 * cleanup is therefore a defensive no-op kept for parity with the template.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { pool, closePool } from "../src/db/client.js";

const PWD = "Admin#PassW0rd!";
const SUITE_PREFIX = `IT_BO_${randomUUID().slice(0, 8).toUpperCase()}`;

interface S {
  cookies: Map<string, string>;
  csrfToken: string;
}
function ch(c: Map<string, string>): string {
  return [...c.entries()].map(([n, v]) => `${n}=${v}`).join("; ");
}
async function login(t: TestApp, email: string): Promise<S> {
  const r = await t.app.inject({
    method: "POST",
    url: "/v1/auth/login",
    payload: { email, password: PWD },
  });
  if (r.statusCode !== 200) throw new Error(`login ${email}: ${r.statusCode}`);
  const cookies = new Map<string, string>();
  for (const c of r.cookies) cookies.set(c.name, c.value);
  return { cookies, csrfToken: (r.json() as { csrfToken: string }).csrfToken };
}

interface ErrEnvelope {
  error: { code: string; message: string; requestId?: string };
}

let suite: TestApp;
let platformS: S; // admin@heuresys.com  — PLATFORM_ADMIN (holds blueprint:override)
let managerS: S; // paolo.caputo@rtl-bank.org — MANAGER (blueprint:read only, NO override)
let userS: S; // tommaso.fiore@rtl-bank.org — USER (blueprint:read only, NO override)

// Defensive cleanup register. This suite does not create overrides (see header),
// but any id pushed here would be removed in afterAll.
const createdOverrideIds: string[] = [];

describe("/v1/blueprint-overrides/* integration", () => {
  beforeAll(async () => {
    suite = await buildTestApp();
    platformS = await login(suite, "admin@heuresys.com");
    managerS = await login(suite, "paolo.caputo@rtl-bank.org");
    userS = await login(suite, "tommaso.fiore@rtl-bank.org");
  });

  afterAll(async () => {
    for (const id of createdOverrideIds) {
      try {
        await pool.query(
          `DELETE FROM sys.sys_blueprint_overrides WHERE blueprint_override_id = $1`,
          [id],
        );
      } catch {
        /* ignore */
      }
    }
    await suite.app.close();
    await closePool();
  });

  it("unauthenticated GET / -> 401", async () => {
    const r = await suite.app.inject({ method: "GET", url: "/v1/blueprint-overrides" });
    expect(r.statusCode).toBe(401);
  });

  it("LIST as PLATFORM_ADMIN -> 200 with { items: [], total } shape", async () => {
    const r = await suite.app.inject({
      method: "GET",
      url: "/v1/blueprint-overrides",
      headers: { cookie: ch(platformS.cookies) },
    });
    expect(r.statusCode).toBe(200);
    const body = r.json() as { items: unknown[]; total: number };
    expect(Array.isArray(body.items)).toBe(true);
    expect(typeof body.total).toBe("number");
    expect(body.total).toBeGreaterThanOrEqual(0);
  });

  it("GET /:id with a random uuid -> 404 NOT_FOUND", async () => {
    const r = await suite.app.inject({
      method: "GET",
      url: `/v1/blueprint-overrides/${randomUUID()}`,
      headers: { cookie: ch(platformS.cookies) },
    });
    expect(r.statusCode).toBe(404);
    expect((r.json() as ErrEnvelope).error.code).toBe("NOT_FOUND");
  });

  it("PUT / (upsert) as MANAGER lacking blueprint:override -> 403 FORBIDDEN", async () => {
    const r = await suite.app.inject({
      method: "PUT",
      url: "/v1/blueprint-overrides",
      headers: {
        cookie: ch(managerS.cookies),
        "x-csrf-token": managerS.csrfToken,
        "content-type": "application/json",
      },
      payload: {
        activationId: randomUUID(),
        processId: randomUUID(),
        inclusion: "IN",
        rationale: `${SUITE_PREFIX}_DENY`,
      },
    });
    expect(r.statusCode).toBe(403);
    expect((r.json() as ErrEnvelope).error.code).toBe("FORBIDDEN");
  });

  it("PUT / (upsert) as USER lacking blueprint:override -> 403 FORBIDDEN", async () => {
    const r = await suite.app.inject({
      method: "PUT",
      url: "/v1/blueprint-overrides",
      headers: {
        cookie: ch(userS.cookies),
        "x-csrf-token": userS.csrfToken,
        "content-type": "application/json",
      },
      payload: {
        activationId: randomUUID(),
        processId: randomUUID(),
        inclusion: "IN",
      },
    });
    expect(r.statusCode).toBe(403);
    expect((r.json() as ErrEnvelope).error.code).toBe("FORBIDDEN");
  });

  it("PUT / (upsert) without x-csrf-token header -> 403 (CSRF)", async () => {
    const r = await suite.app.inject({
      method: "PUT",
      url: "/v1/blueprint-overrides",
      headers: {
        cookie: ch(platformS.cookies),
        "content-type": "application/json",
      },
      payload: {
        activationId: randomUUID(),
        processId: randomUUID(),
        inclusion: "IN",
      },
    });
    expect(r.statusCode).toBe(403);
  });

  it("PUT / (upsert) as PLATFORM_ADMIN with non-existent activation -> 404 NOT_FOUND", async () => {
    const r = await suite.app.inject({
      method: "PUT",
      url: "/v1/blueprint-overrides",
      headers: {
        cookie: ch(platformS.cookies),
        "x-csrf-token": platformS.csrfToken,
        "content-type": "application/json",
      },
      payload: {
        activationId: randomUUID(),
        processId: randomUUID(),
        inclusion: "IN",
        rationale: `${SUITE_PREFIX}_ORPHAN`,
      },
    });
    expect(r.statusCode).toBe(404);
    expect((r.json() as ErrEnvelope).error.code).toBe("NOT_FOUND");
  });
});
