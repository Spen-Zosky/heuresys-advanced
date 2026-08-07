/**
 * apps/api/test/enterprise-typing-profiles.integration.test.ts
 *
 * Module: enterprise-typing-profiles (1:1 with tenant; PUT = upsert by tenant).
 * Routes (apps/api/src/modules/enterprise-typing-profiles/routes.ts):
 *   GET    /v1/enterprise-typing-profiles        requirePermission('enterprise_typing:read')
 *   GET    /v1/enterprise-typing-profiles/:id    requirePermission('enterprise_typing:read')
 *   PUT    /v1/enterprise-typing-profiles         verifyCsrf + requirePermission('enterprise_typing:update')
 *   DELETE /v1/enterprise-typing-profiles/:id     verifyCsrf + requirePermission('enterprise_typing:update')
 *
 * Auth model (verified against the live sys_auth_role_permissions matrix):
 *  - 'enterprise_typing:read'   → ALL 9 roles (so a read 403 cannot be produced by a real persona).
 *  - 'enterprise_typing:update' → BLUEPRINT_MANAGER + PLATFORM_ADMIN + TENANT_ADMIN only. USER lacks it
 *    → used as the denied persona for the write RBAC test. DELETE /:id (params only, no body) is the
 *    cheapest write route to exercise pure permission denial: a valid x-csrf-token clears verifyCsrf,
 *    then requirePermission('enterprise_typing:update') denies in the preHandler (403, default
 *    FORBIDDEN code from requirePermission's bare ForbiddenError) before the handler runs.
 *
 * Live-data safety: the upsert happy path creates a THROWAWAY tenant and upserts a profile for it
 * (clean INSERT, no conflict, never touches the live RTL_BANK reference tenant). Both rows are
 * removed in afterAll. The tenant FK cascades to the profile, but we delete explicitly anyway.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { pool, closePool } from "../src/db/client.js";
import { TEST_PERSONA_PASSWORD } from "./helpers/personas.js";

const PWD = TEST_PERSONA_PASSWORD;
const SUITE_PREFIX = `IT_ETP_${randomUUID().slice(0, 8).toUpperCase()}`;

interface S { cookies: Map<string, string>; csrfToken: string }
function ch(c: Map<string, string>) { return [...c.entries()].map(([n, v]) => `${n}=${v}`).join("; "); }
async function login(t: TestApp, email: string): Promise<S> {
  const r = await loginRaw(t.app, email, PWD);
  const cookies = new Map<string, string>();
  for (const c of r.cookies) cookies.set(c.name, c.value);
  return { cookies, csrfToken: (r.json() as { csrfToken: string }).csrfToken };
}

interface ErrBody { error: { code: string; message: string; requestId?: string } }
interface ProfileBody { enterpriseTypingProfileId: string; tenantId: string; regulatoryIntensity: string }
interface ListBody { items: Array<{ enterpriseTypingProfileId: string; tenantId: string }>; total: number }

let suite: TestApp;
let platformS: S;
let userS: S;

// Throwaway tenant for the clean upsert path (never the live RTL tenant).
let throwawayTenantId: string | null = null;
let createdProfileId: string | null = null;

describe("/v1/enterprise-typing-profiles/* integration", () => {
  beforeAll(async () => {
    suite = await buildTestApp();
    platformS = await login(suite, "enzo.spenuso@heuresys.com");
    userS = await login(suite, "tommaso.fiore@rtl-bank.org");

    const t = await pool.query<{ tenant_id: string }>(
      `INSERT INTO sys.sys_tenancies (tenant_code, tenant_name, tenant_status)
       VALUES ($1, $2, 'ACTIVE') RETURNING tenant_id`,
      [`${SUITE_PREFIX}_TEN`, `Throwaway ${SUITE_PREFIX}`],
    );
    throwawayTenantId = t.rows[0]!.tenant_id;
  });

  afterAll(async () => {
    if (createdProfileId) {
      try { await pool.query(`DELETE FROM sys.sys_enterprise_typing_profiles WHERE enterprise_typing_profile_id = $1`, [createdProfileId]); }
      catch { /* ignore */ }
    }
    if (throwawayTenantId) {
      try { await pool.query(`DELETE FROM sys.sys_enterprise_typing_profiles WHERE enterprise_typing_tenant_id = $1`, [throwawayTenantId]); }
      catch { /* ignore */ }
      try { await pool.query(`DELETE FROM sys.sys_tenancies WHERE tenant_id = $1`, [throwawayTenantId]); }
      catch { /* ignore */ }
    }
    await suite.app.close();
    await closePool();
  });

  it("unauthenticated GET / → 401", async () => {
    const r = await suite.app.inject({ method: "GET", url: "/v1/enterprise-typing-profiles" });
    expect(r.statusCode).toBe(401);
  });

  it("LIST as PLATFORM_ADMIN → 200 with { items[], total } shape", async () => {
    const r = await suite.app.inject({
      method: "GET", url: "/v1/enterprise-typing-profiles",
      headers: { cookie: ch(platformS.cookies) },
    });
    expect(r.statusCode).toBe(200);
    const body = r.json() as ListBody;
    expect(Array.isArray(body.items)).toBe(true);
    expect(typeof body.total).toBe("number");
  });

  it("GET /:id with a random uuid → 404 NOT_FOUND", async () => {
    const r = await suite.app.inject({
      method: "GET", url: `/v1/enterprise-typing-profiles/${randomUUID()}`,
      headers: { cookie: ch(platformS.cookies) },
    });
    expect(r.statusCode).toBe(404);
    expect((r.json() as ErrBody).error.code).toBe("NOT_FOUND");
  });

  it("DELETE /:id as USER lacking enterprise_typing:update → 403 FORBIDDEN", async () => {
    // DELETE requires enterprise_typing:update (same as PUT) but no request body, so this is a
    // pure permission-denial test: USER (tommaso.fiore) genuinely lacks enterprise_typing:update
    // (TENANT_ADMIN federica HAS it, so cannot be denied). A valid x-csrf-token passes verifyCsrf;
    // requirePermission then denies in the preHandler before the handler runs → 403 FORBIDDEN.
    const r = await suite.app.inject({
      method: "DELETE", url: `/v1/enterprise-typing-profiles/${randomUUID()}`,
      headers: { cookie: ch(userS.cookies), "x-csrf-token": userS.csrfToken },
    });
    expect(r.statusCode).toBe(403);
    // requirePermission throws a bare ForbiddenError → default code FORBIDDEN.
    expect((r.json() as ErrBody).error.code).toBe("FORBIDDEN");
  });

  it("PUT (upsert) without x-csrf-token → 403 CSRF_FAIL", async () => {
    const r = await suite.app.inject({
      method: "PUT", url: "/v1/enterprise-typing-profiles",
      headers: { cookie: ch(platformS.cookies), "content-type": "application/json" },
      payload: { tenantId: throwawayTenantId, regulatoryIntensity: "HIGH" },
    });
    expect(r.statusCode).toBe(403);
    expect((r.json() as ErrBody).error.code).toBe("CSRF_FAIL");
  });

  it("PLATFORM_ADMIN upsert (throwaway tenant) → 200, then GET /:id readback → 200", async () => {
    const put = await suite.app.inject({
      method: "PUT", url: "/v1/enterprise-typing-profiles",
      headers: { cookie: ch(platformS.cookies), "x-csrf-token": platformS.csrfToken, "content-type": "application/json" },
      payload: { tenantId: throwawayTenantId, regulatoryIntensity: "EXTREME", countryCode: "IT", employeeCount: 42 },
    });
    expect(put.statusCode).toBe(200);
    const created = put.json() as ProfileBody;
    expect(created.tenantId).toBe(throwawayTenantId);
    expect(created.regulatoryIntensity).toBe("EXTREME");
    createdProfileId = created.enterpriseTypingProfileId;

    const get = await suite.app.inject({
      method: "GET", url: `/v1/enterprise-typing-profiles/${createdProfileId}`,
      headers: { cookie: ch(platformS.cookies) },
    });
    expect(get.statusCode).toBe(200);
    const back = get.json() as ProfileBody;
    expect(back.enterpriseTypingProfileId).toBe(createdProfileId);
    expect(back.tenantId).toBe(throwawayTenantId);
  });

  it("DELETE /:id (throwaway profile) as PLATFORM_ADMIN → 204, then GET → 404", async () => {
    // Guard: only meaningful if the upsert test above produced a row.
    expect(createdProfileId).not.toBeNull();
    const id = createdProfileId!;

    const del = await suite.app.inject({
      method: "DELETE", url: `/v1/enterprise-typing-profiles/${id}`,
      headers: { cookie: ch(platformS.cookies), "x-csrf-token": platformS.csrfToken },
    });
    expect(del.statusCode).toBe(204);
    createdProfileId = null; // deleted — afterAll need not re-delete the profile row

    const get = await suite.app.inject({
      method: "GET", url: `/v1/enterprise-typing-profiles/${id}`,
      headers: { cookie: ch(platformS.cookies) },
    });
    expect(get.statusCode).toBe(404);
    expect((get.json() as ErrBody).error.code).toBe("NOT_FOUND");
  });
});
