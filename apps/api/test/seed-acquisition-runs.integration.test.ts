/**
 * apps/api/test/seed-acquisition-runs.integration.test.ts
 *
 * Integration coverage for the seed-acquisition-runs module (/v1/seed-acquisition-runs).
 * Verbs: GET / , GET /:id , POST / , PATCH /:id , DELETE /:id.
 *   - read   routes require permission `seed_acquisition:read`
 *   - mutate routes require permission `seed_acquisition:trigger` + app.verifyCsrf
 * Visibility (service.ts): PLATFORM_ADMIN sees all tenants; everyone else only
 * their own tenant. Cross-tenant / missing → NotFoundError ("NOT_FOUND").
 *
 * All rows created here are deleted in afterAll on sys.sys_seed_acquisition_runs.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { pool, closePool } from "../src/db/client.js";

const PWD = "Admin#PassW0rd!";
const SUITE_PREFIX = `IT_SAR_${randomUUID().slice(0, 8).toUpperCase()}`;

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

interface RunResponse {
  seedAcquisitionRunId: string;
  tenantId: string;
  code: string;
  status: string;
}
interface ErrorBody {
  error: { code: string; message: string; requestId: string };
}

let suite: TestApp;
let platformS: S;
let tenantAdminS: S;
let userS: S;
const createdRunIds: string[] = [];

describe("/v1/seed-acquisition-runs/* integration", () => {
  beforeAll(async () => {
    suite = await buildTestApp();
    platformS = await login(suite, "admin@heuresys.com");
    // TENANT_ADMIN persona — has seed_acquisition:trigger AND a non-null tenantId,
    // so trigger() derives the tenant from actor.tenantId (no body.tenantId needed).
    tenantAdminS = await login(suite, "federica.marchetti@rtl-bank.org");
    // Plain USER persona — expected to lack seed_acquisition:trigger (and likely :read).
    userS = await login(suite, "tommaso.fiore@rtl-bank.org");
  });

  afterAll(async () => {
    for (const id of createdRunIds) {
      try {
        await pool.query(`DELETE FROM sys.sys_seed_acquisition_runs WHERE seed_acquisition_run_id = $1`, [id]);
      } catch {
        /* ignore cleanup errors */
      }
    }
    await suite.app.close();
    await closePool();
  });

  it("unauthenticated LIST → 401", async () => {
    const r = await suite.app.inject({ method: "GET", url: "/v1/seed-acquisition-runs" });
    expect(r.statusCode).toBe(401);
  });

  it("PLATFORM_ADMIN LIST happy path → 200 with { items: [], total }", async () => {
    const r = await suite.app.inject({
      method: "GET",
      url: "/v1/seed-acquisition-runs",
      headers: { cookie: ch(platformS.cookies) },
    });
    expect(r.statusCode).toBe(200);
    const body = r.json() as { items: unknown[]; total: number };
    expect(Array.isArray(body.items)).toBe(true);
    expect(typeof body.total).toBe("number");
  });

  it("TENANT_ADMIN CREATE → 201, GET /:id readback → 200", async () => {
    const code = `${SUITE_PREFIX}_HP`;
    const created = await suite.app.inject({
      method: "POST",
      url: "/v1/seed-acquisition-runs",
      headers: {
        cookie: ch(tenantAdminS.cookies),
        "x-csrf-token": tenantAdminS.csrfToken,
        "content-type": "application/json",
      },
      payload: { code, metadata: { suite: SUITE_PREFIX } },
    });
    expect(created.statusCode).toBe(201);
    const c = created.json() as RunResponse;
    expect(c.code).toBe(code);
    expect(c.status).toBe("RUNNING");
    expect(typeof c.seedAcquisitionRunId).toBe("string");
    createdRunIds.push(c.seedAcquisitionRunId);

    const read = await suite.app.inject({
      method: "GET",
      url: `/v1/seed-acquisition-runs/${c.seedAcquisitionRunId}`,
      headers: { cookie: ch(tenantAdminS.cookies) },
    });
    expect(read.statusCode).toBe(200);
    const got = read.json() as RunResponse;
    expect(got.seedAcquisitionRunId).toBe(c.seedAcquisitionRunId);
    expect(got.code).toBe(code);
  });

  it("GET /:id for a random uuid → 404 NOT_FOUND", async () => {
    const r = await suite.app.inject({
      method: "GET",
      url: `/v1/seed-acquisition-runs/${randomUUID()}`,
      headers: { cookie: ch(platformS.cookies) },
    });
    expect(r.statusCode).toBe(404);
    expect((r.json() as ErrorBody).error.code).toBe("NOT_FOUND");
  });

  it("TENANT_ADMIN PATCH status → 200 (status persisted)", async () => {
    const code = `${SUITE_PREFIX}_PATCH`;
    const created = await suite.app.inject({
      method: "POST",
      url: "/v1/seed-acquisition-runs",
      headers: {
        cookie: ch(tenantAdminS.cookies),
        "x-csrf-token": tenantAdminS.csrfToken,
        "content-type": "application/json",
      },
      payload: { code },
    });
    expect(created.statusCode).toBe(201);
    const c = created.json() as RunResponse;
    createdRunIds.push(c.seedAcquisitionRunId);

    const patched = await suite.app.inject({
      method: "PATCH",
      url: `/v1/seed-acquisition-runs/${c.seedAcquisitionRunId}`,
      headers: {
        cookie: ch(tenantAdminS.cookies),
        "x-csrf-token": tenantAdminS.csrfToken,
        "content-type": "application/json",
      },
      payload: { status: "COMPLETED" },
    });
    expect(patched.statusCode).toBe(200);
    expect((patched.json() as RunResponse).status).toBe("COMPLETED");
  });

  it("CSRF: CREATE without x-csrf-token → 403", async () => {
    const r = await suite.app.inject({
      method: "POST",
      url: "/v1/seed-acquisition-runs",
      headers: { cookie: ch(platformS.cookies), "content-type": "application/json" },
      payload: { code: `${SUITE_PREFIX}_NOCSRF` },
    });
    expect(r.statusCode).toBe(403);
  });

  it("RBAC: plain USER cannot trigger a run → 403 FORBIDDEN", async () => {
    const r = await suite.app.inject({
      method: "POST",
      url: "/v1/seed-acquisition-runs",
      headers: {
        cookie: ch(userS.cookies),
        "x-csrf-token": userS.csrfToken,
        "content-type": "application/json",
      },
      payload: { code: `${SUITE_PREFIX}_DENY` },
    });
    expect(r.statusCode).toBe(403);
    expect((r.json() as ErrorBody).error.code).toBe("FORBIDDEN");
  });
});
