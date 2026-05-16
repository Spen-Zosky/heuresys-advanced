/**
 * apps/api/test/tenants.integration.test.ts
 * Integration tests for /v1/tenants/*. Uses Fastify app.inject() against a
 * live PG. Each test that creates a tenant uses a unique tenant_code based
 * on a per-suite UUID prefix so re-runs don't collide on the unique index.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { pool, closePool } from "../src/db/client.js";
import { tenantsService } from "../src/modules/tenants/service.js";

const ADMIN_EMAIL = "admin@heuresys.com";
const ADMIN_PASSWORD = "Admin#PassW0rd!";

// Per-suite prefix so concurrent or repeated runs produce unique codes.
const SUITE_PREFIX = `IT_${randomUUID().slice(0, 8).toUpperCase()}`;

interface LoginResult {
  cookies: Map<string, string>;
  csrfToken: string;
}

function cookieHeader(cookies: Map<string, string>): string {
  return [...cookies.entries()].map(([n, v]) => `${n}=${v}`).join("; ");
}

async function loginAdmin(t: TestApp): Promise<LoginResult> {
  const r = await t.app.inject({
    method: "POST",
    url: "/v1/auth/login",
    payload: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  const cookies = new Map<string, string>();
  for (const c of r.cookies) cookies.set(c.name, c.value);
  const body = r.json() as { csrfToken: string };
  return { cookies, csrfToken: body.csrfToken };
}

let suite: TestApp;
let auth: LoginResult;
const createdTenantIds: string[] = [];

describe("/v1/tenants/* integration", () => {
  beforeAll(async () => {
    suite = await buildTestApp();
    auth = await loginAdmin(suite);
  });

  afterAll(async () => {
    // Best-effort cleanup: hard-delete every tenant the suite created so
    // re-runs stay quick and don't leave drift. Wrapped in try so test
    // teardown never masks a test failure.
    for (const id of createdTenantIds) {
      try {
        await pool.query(`DELETE FROM sys.sys_tenancies WHERE tenant_id = $1`, [id]);
      } catch {
        /* ignore */
      }
    }
    await suite.app.close();
    await closePool();
  });

  /* -------------------------------------------------- auth gates */

  it("GET /v1/tenants without auth → 401", async () => {
    const r = await suite.app.inject({ method: "GET", url: "/v1/tenants" });
    expect(r.statusCode).toBe(401);
  });

  it("POST /v1/tenants without CSRF → 403", async () => {
    const r = await suite.app.inject({
      method: "POST",
      url: "/v1/tenants",
      headers: { cookie: cookieHeader(auth.cookies), "content-type": "application/json" },
      payload: { tenantCode: `${SUITE_PREFIX}_NOOP`, tenantName: "noop" },
    });
    expect(r.statusCode).toBe(403);
  });

  /* -------------------------------------------------- CRUD happy path */

  it("POST /v1/tenants → 201 with defaults; GET single + GET list reflect it", async () => {
    const code = `${SUITE_PREFIX}_HAPPY`;
    const created = await suite.app.inject({
      method: "POST",
      url: "/v1/tenants",
      headers: {
        cookie: cookieHeader(auth.cookies),
        "x-csrf-token": auth.csrfToken,
        "content-type": "application/json",
      },
      payload: {
        tenantCode: code,
        tenantName: "Happy Path Test",
        tenantSizeBand: "M",
        tenantCountryCode: "IT",
      },
    });
    expect(created.statusCode).toBe(201);
    const body = created.json() as {
      tenantId: string;
      tenantCode: string;
      tenantStatus: string;
      tenantMetadata: Record<string, unknown>;
    };
    expect(body.tenantCode).toBe(code);
    expect(body.tenantStatus).toBe("PENDING_ACTIVATION");
    expect(body.tenantMetadata).toEqual({});
    createdTenantIds.push(body.tenantId);

    const single = await suite.app.inject({
      method: "GET",
      url: `/v1/tenants/${body.tenantId}`,
      headers: { cookie: cookieHeader(auth.cookies) },
    });
    expect(single.statusCode).toBe(200);
    expect((single.json() as { tenantCode: string }).tenantCode).toBe(code);

    const list = await suite.app.inject({
      method: "GET",
      url: `/v1/tenants?limit=200`,
      headers: { cookie: cookieHeader(auth.cookies) },
    });
    expect(list.statusCode).toBe(200);
    const listBody = list.json() as { items: Array<{ tenantCode: string }> };
    expect(listBody.items.some((t) => t.tenantCode === code)).toBe(true);
  });

  it("POST /v1/tenants with duplicate code → 409 TENANT_CODE_CONFLICT", async () => {
    const code = `${SUITE_PREFIX}_DUP`;
    const first = await suite.app.inject({
      method: "POST",
      url: "/v1/tenants",
      headers: {
        cookie: cookieHeader(auth.cookies),
        "x-csrf-token": auth.csrfToken,
        "content-type": "application/json",
      },
      payload: { tenantCode: code, tenantName: "Dup Original" },
    });
    expect(first.statusCode).toBe(201);
    createdTenantIds.push((first.json() as { tenantId: string }).tenantId);

    const second = await suite.app.inject({
      method: "POST",
      url: "/v1/tenants",
      headers: {
        cookie: cookieHeader(auth.cookies),
        "x-csrf-token": auth.csrfToken,
        "content-type": "application/json",
      },
      payload: { tenantCode: code, tenantName: "Dup Attempt" },
    });
    expect(second.statusCode).toBe(409);
    const errBody = second.json() as { error: { code: string } };
    expect(errBody.error.code).toBe("TENANT_CODE_CONFLICT");
  });

  it("PATCH /v1/tenants/:id → 200 with merged fields; non-supplied stay intact", async () => {
    const code = `${SUITE_PREFIX}_PATCH`;
    const created = await suite.app.inject({
      method: "POST",
      url: "/v1/tenants",
      headers: {
        cookie: cookieHeader(auth.cookies),
        "x-csrf-token": auth.csrfToken,
        "content-type": "application/json",
      },
      payload: { tenantCode: code, tenantName: "PatchTarget" },
    });
    const { tenantId } = created.json() as { tenantId: string };
    createdTenantIds.push(tenantId);

    const patched = await suite.app.inject({
      method: "PATCH",
      url: `/v1/tenants/${tenantId}`,
      headers: {
        cookie: cookieHeader(auth.cookies),
        "x-csrf-token": auth.csrfToken,
        "content-type": "application/json",
      },
      payload: {
        tenantStatus: "ACTIVE",
        tenantLegalName: "PatchTarget SpA",
        tenantMetadata: { migrated: true, batch: 1 },
      },
    });
    expect(patched.statusCode).toBe(200);
    const body = patched.json() as {
      tenantStatus: string;
      tenantLegalName: string;
      tenantName: string;
      tenantMetadata: Record<string, unknown>;
    };
    expect(body.tenantStatus).toBe("ACTIVE");
    expect(body.tenantLegalName).toBe("PatchTarget SpA");
    expect(body.tenantName).toBe("PatchTarget"); // unchanged
    expect(body.tenantMetadata).toEqual({ migrated: true, batch: 1 });
  });

  it("DELETE /v1/tenants/:id → 204 + archived; second DELETE → 409 already archived", async () => {
    const code = `${SUITE_PREFIX}_ARCH`;
    const created = await suite.app.inject({
      method: "POST",
      url: "/v1/tenants",
      headers: {
        cookie: cookieHeader(auth.cookies),
        "x-csrf-token": auth.csrfToken,
        "content-type": "application/json",
      },
      payload: { tenantCode: code, tenantName: "Archive Me" },
    });
    const { tenantId } = created.json() as { tenantId: string };
    createdTenantIds.push(tenantId);

    const firstDel = await suite.app.inject({
      method: "DELETE",
      url: `/v1/tenants/${tenantId}`,
      headers: { cookie: cookieHeader(auth.cookies), "x-csrf-token": auth.csrfToken },
    });
    expect(firstDel.statusCode).toBe(204);

    const after = await suite.app.inject({
      method: "GET",
      url: `/v1/tenants/${tenantId}`,
      headers: { cookie: cookieHeader(auth.cookies) },
    });
    expect((after.json() as { tenantStatus: string }).tenantStatus).toBe("ARCHIVED");

    const secondDel = await suite.app.inject({
      method: "DELETE",
      url: `/v1/tenants/${tenantId}`,
      headers: { cookie: cookieHeader(auth.cookies), "x-csrf-token": auth.csrfToken },
    });
    expect(secondDel.statusCode).toBe(409);
    expect((secondDel.json() as { error: { code: string } }).error.code).toBe(
      "TENANT_ALREADY_ARCHIVED",
    );
  });

  /* -------------------------------------------------- validation */

  it("POST /v1/tenants with invalid body → 400 VALIDATION_ERROR", async () => {
    const r = await suite.app.inject({
      method: "POST",
      url: "/v1/tenants",
      headers: {
        cookie: cookieHeader(auth.cookies),
        "x-csrf-token": auth.csrfToken,
        "content-type": "application/json",
      },
      payload: { tenantCode: "", tenantName: "missing code", tenantCountryCode: "ITA" },
    });
    expect(r.statusCode).toBe(400);
    expect((r.json() as { error: { code: string } }).error.code).toBe("VALIDATION_ERROR");
  });

  /* -------------------------------------------------- scope filter (unit) */

  it("tenantsService unit: non-platform actor cannot read cross-tenant target", async () => {
    // Use any existing tenant as the target; actor is in a different tenant.
    const someTenant = await pool.query<{ tenant_id: string }>(
      `SELECT tenant_id FROM sys.sys_tenancies WHERE tenant_status <> 'ARCHIVED' LIMIT 1`,
    );
    expect(someTenant.rows.length).toBe(1);
    const targetId = someTenant.rows[0]!.tenant_id;

    const otherTenantId = "00000000-0000-0000-0000-000000000001";
    expect(targetId).not.toBe(otherTenantId);

    await expect(
      tenantsService.getById(
        {
          userId: "00000000-0000-0000-0000-000000000099",
          tenantId: otherTenantId,
          roles: ["TENANT_ADMIN"],
        },
        targetId,
      ),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
