/**
 * apps/api/test/blueprint-processes.integration.test.ts
 *
 * Integration tests for the blueprint-processes module (global process registry
 * scoped to a blueprint variant; unique (variant_id, code)).
 *
 * Routes (src/modules/blueprint-processes/routes.ts):
 *   GET    /v1/blueprint-processes        requirePermission('blueprint:read')
 *   GET    /v1/blueprint-processes/:id    requirePermission('blueprint:read')
 *   POST   /v1/blueprint-processes        verifyCsrf + requirePermission('blueprint:activate')
 *   PATCH  /v1/blueprint-processes/:id    verifyCsrf + requirePermission('blueprint:override')
 *   DELETE /v1/blueprint-processes/:id    verifyCsrf + requirePermission('blueprint:override')
 *
 * Authorization model (service.ts): writes are PLATFORM_ADMIN-only — the service
 * throws ForbiddenError("PLATFORM_ADMIN required") (default code FORBIDDEN) when the
 * actor is not PLATFORM_ADMIN. TENANT_ADMIN holds blueprint:activate at the route
 * RBAC layer but is blocked by the service-level isPlatform() gate → HTTP 403 FORBIDDEN.
 * Reads only require blueprint:read at the RBAC layer (no further service scope).
 *
 * Typed error codes surfaced:
 *   - NotFoundError("BlueprintProcess") / ("BlueprintVariant") → default code NOT_FOUND
 *   - ForbiddenError("PLATFORM_ADMIN required")               → default code FORBIDDEN
 *   - ConflictError(..., "BLUEPRINT_PROCESS_CODE_CONFLICT")    → code BLUEPRINT_PROCESS_CODE_CONFLICT
 *
 * Setup chain (PLATFORM_ADMIN): family → variant → process. The create flow asserts
 * the parent variant exists (repo.variantExists), so a real variant must be wired first.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { pool, closePool } from "../src/db/client.js";

const PWD = "Admin#PassW0rd!";
const SUITE_PREFIX = `IT_BP_${randomUUID().slice(0, 8).toUpperCase()}`;

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

interface ProcessResponse {
  blueprintProcessId: string;
  variantId: string;
  code: string;
  name: string;
  ordinal: number;
  description: string | null;
  isOptional: boolean;
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
let familyId: string;
let variantId: string;
const createdProcessIds: string[] = [];

describe("/v1/blueprint-processes/* integration", () => {
  beforeAll(async () => {
    suite = await buildTestApp();
    platformS = await login(suite, "admin@heuresys.com");
    tenantS = await login(suite, "federica.marchetti@rtl-bank.org");

    const fam = await suite.app.inject({
      method: "POST",
      url: "/v1/blueprint-families",
      headers: {
        cookie: ch(platformS.cookies),
        "x-csrf-token": platformS.csrfToken,
        "content-type": "application/json",
      },
      payload: { code: `${SUITE_PREFIX}_FAM`, name: "BP Parent Family" },
    });
    if (fam.statusCode !== 201) throw new Error(`family setup: ${fam.statusCode} ${fam.body}`);
    familyId = (fam.json() as { blueprintFamilyId: string }).blueprintFamilyId;

    const variant = await suite.app.inject({
      method: "POST",
      url: "/v1/blueprint-variants",
      headers: {
        cookie: ch(platformS.cookies),
        "x-csrf-token": platformS.csrfToken,
        "content-type": "application/json",
      },
      payload: { familyId, code: `${SUITE_PREFIX}_VAR`, name: "BP Parent Variant" },
    });
    if (variant.statusCode !== 201) throw new Error(`variant setup: ${variant.statusCode} ${variant.body}`);
    variantId = (variant.json() as { blueprintVariantId: string }).blueprintVariantId;
  });

  afterAll(async () => {
    for (const id of createdProcessIds) {
      try {
        await pool.query(`DELETE FROM sys.sys_blueprint_process_registry WHERE blueprint_process_id = $1`, [id]);
      } catch {
        /* ignore cleanup errors */
      }
    }
    try {
      await pool.query(`DELETE FROM sys.sys_blueprint_variants WHERE blueprint_variant_id = $1`, [variantId]);
    } catch {
      /* ignore cleanup errors */
    }
    try {
      await pool.query(`DELETE FROM sys.sys_blueprint_families WHERE blueprint_family_id = $1`, [familyId]);
    } catch {
      /* ignore cleanup errors */
    }
    await suite.app.close();
    await closePool();
  });

  it("unauthenticated GET / → 401", async () => {
    const r = await suite.app.inject({ method: "GET", url: "/v1/blueprint-processes" });
    expect(r.statusCode).toBe(401);
  });

  it("LIST as PLATFORM_ADMIN → 200 with { items: [], total } shape", async () => {
    const r = await suite.app.inject({
      method: "GET",
      url: "/v1/blueprint-processes",
      headers: { cookie: ch(platformS.cookies) },
    });
    expect(r.statusCode).toBe(200);
    const body = r.json() as { items: ProcessResponse[]; total: number };
    expect(Array.isArray(body.items)).toBe(true);
    expect(typeof body.total).toBe("number");
  });

  it("CREATE then GET /:id as PLATFORM_ADMIN happy path → 201 then 200", async () => {
    const code = `${SUITE_PREFIX}_HP`;
    const created = await suite.app.inject({
      method: "POST",
      url: "/v1/blueprint-processes",
      headers: {
        cookie: ch(platformS.cookies),
        "x-csrf-token": platformS.csrfToken,
        "content-type": "application/json",
      },
      payload: { variantId, code, name: "Happy Process", ordinal: 0 },
    });
    expect(created.statusCode).toBe(201);
    const c = created.json() as ProcessResponse;
    expect(c.code).toBe(code);
    expect(c.name).toBe("Happy Process");
    expect(c.variantId).toBe(variantId);
    expect(typeof c.blueprintProcessId).toBe("string");
    createdProcessIds.push(c.blueprintProcessId);

    const got = await suite.app.inject({
      method: "GET",
      url: `/v1/blueprint-processes/${c.blueprintProcessId}`,
      headers: { cookie: ch(platformS.cookies) },
    });
    expect(got.statusCode).toBe(200);
    const g = got.json() as ProcessResponse;
    expect(g.blueprintProcessId).toBe(c.blueprintProcessId);
    expect(g.code).toBe(code);
  });

  it("GET /:id with a random uuid → 404 NOT_FOUND", async () => {
    const r = await suite.app.inject({
      method: "GET",
      url: `/v1/blueprint-processes/${randomUUID()}`,
      headers: { cookie: ch(platformS.cookies) },
    });
    expect(r.statusCode).toBe(404);
    expect((r.json() as ErrorEnvelope).error.code).toBe("NOT_FOUND");
  });

  it("CREATE with a non-existent variantId → 404 NOT_FOUND", async () => {
    const r = await suite.app.inject({
      method: "POST",
      url: "/v1/blueprint-processes",
      headers: {
        cookie: ch(platformS.cookies),
        "x-csrf-token": platformS.csrfToken,
        "content-type": "application/json",
      },
      payload: { variantId: randomUUID(), code: `${SUITE_PREFIX}_ORPHAN`, name: "Orphan", ordinal: 0 },
    });
    expect(r.statusCode).toBe(404);
    expect((r.json() as ErrorEnvelope).error.code).toBe("NOT_FOUND");
  });

  it("TENANT_ADMIN cannot create (service PLATFORM_ADMIN gate) → 403 FORBIDDEN", async () => {
    const r = await suite.app.inject({
      method: "POST",
      url: "/v1/blueprint-processes",
      headers: {
        cookie: ch(tenantS.cookies),
        "x-csrf-token": tenantS.csrfToken,
        "content-type": "application/json",
      },
      payload: { variantId, code: `${SUITE_PREFIX}_TA_BLOCK`, name: "Tenant Blocked", ordinal: 0 },
    });
    expect(r.statusCode).toBe(403);
    expect((r.json() as ErrorEnvelope).error.code).toBe("FORBIDDEN");
  });

  it("CREATE without x-csrf-token header → 403", async () => {
    const r = await suite.app.inject({
      method: "POST",
      url: "/v1/blueprint-processes",
      headers: { cookie: ch(platformS.cookies), "content-type": "application/json" },
      payload: { variantId, code: `${SUITE_PREFIX}_NOCSRF`, name: "No CSRF", ordinal: 0 },
    });
    expect(r.statusCode).toBe(403);
  });

  it("duplicate (variant_id, code) → 409 BLUEPRINT_PROCESS_CODE_CONFLICT", async () => {
    const code = `${SUITE_PREFIX}_DUP`;
    const first = await suite.app.inject({
      method: "POST",
      url: "/v1/blueprint-processes",
      headers: {
        cookie: ch(platformS.cookies),
        "x-csrf-token": platformS.csrfToken,
        "content-type": "application/json",
      },
      payload: { variantId, code, name: "First Dup", ordinal: 1 },
    });
    expect(first.statusCode).toBe(201);
    createdProcessIds.push((first.json() as ProcessResponse).blueprintProcessId);

    const dup = await suite.app.inject({
      method: "POST",
      url: "/v1/blueprint-processes",
      headers: {
        cookie: ch(platformS.cookies),
        "x-csrf-token": platformS.csrfToken,
        "content-type": "application/json",
      },
      payload: { variantId, code, name: "Second Dup", ordinal: 2 },
    });
    expect(dup.statusCode).toBe(409);
    expect((dup.json() as ErrorEnvelope).error.code).toBe("BLUEPRINT_PROCESS_CODE_CONFLICT");
  });
});
