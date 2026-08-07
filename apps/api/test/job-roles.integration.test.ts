/**
 * apps/api/test/job-roles.integration.test.ts
 *
 * Integration tests for /v1/job-roles/* (sys.sys_job_roles).
 * Routes (apps/api/src/modules/job-roles/routes.ts):
 *   GET   /            job_role:read   (open to all per matrix)
 *   GET   /:id         job_role:read
 *   POST  /            job_role:create (CSRF) -> 201
 *   PATCH /:id         job_role:update (CSRF) -> 200
 *
 * Authorization is enforced purely by requirePermission (RBAC middleware) — the
 * service throws NO custom *_ADMIN_ONLY code. A denied persona therefore gets a
 * 403 with the RBAC ForbiddenError DEFAULT code "FORBIDDEN" (rbac.ts line 87 passes
 * no explicit code). job_role:create/update are granted to PLATFORM_ADMIN,
 * TENANT_ADMIN, HRMS_MANAGER; a USER persona lacks them.
 *
 * Tests hit the live OCI VM DB through the SSH tunnel; rows created here are
 * cleaned up in afterAll. No mocks.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { pool, closePool } from "../src/db/client.js";
import { TEST_PERSONA_PASSWORD } from "./helpers/personas.js";

const PWD = TEST_PERSONA_PASSWORD;
const SUITE_PREFIX = `IT_JR_${randomUUID().slice(0, 8).toUpperCase()}`;

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

let suite: TestApp;
let platformS: S;
let userS: S;
const createdJobRoleIds: string[] = [];

interface ErrEnvelope {
  error: { code: string; message: string; requestId?: string };
}

describe("/v1/job-roles/* integration", () => {
  beforeAll(async () => {
    suite = await buildTestApp();
    platformS = await login(suite, "enzo.spenuso@heuresys.com");
    userS = await login(suite, "tommaso.fiore@rtl-bank.org");
  });

  afterAll(async () => {
    for (const id of createdJobRoleIds) {
      try {
        await pool.query(`DELETE FROM sys.sys_job_roles WHERE job_role_id = $1`, [id]);
      } catch {
        /* ignore cleanup errors */
      }
    }
    await suite.app.close();
    await closePool();
  });

  it("unauthenticated GET / → 401", async () => {
    const r = await suite.app.inject({ method: "GET", url: "/v1/job-roles" });
    expect(r.statusCode).toBe(401);
  });

  it("LIST as PLATFORM_ADMIN → 200 with { items: [], total } shape", async () => {
    const r = await suite.app.inject({
      method: "GET",
      url: "/v1/job-roles?limit=5",
      headers: { cookie: ch(platformS.cookies) },
    });
    expect(r.statusCode).toBe(200);
    const body = r.json() as { items: unknown; total: unknown };
    expect(Array.isArray(body.items)).toBe(true);
    expect(typeof body.total).toBe("number");
  });

  it("CREATE / GET:id / readback as PLATFORM_ADMIN happy path → 201 then 200", async () => {
    const code = `${SUITE_PREFIX}_HP`;
    const created = await suite.app.inject({
      method: "POST",
      url: "/v1/job-roles",
      headers: {
        cookie: ch(platformS.cookies),
        "x-csrf-token": platformS.csrfToken,
        "content-type": "application/json",
      },
      // jobFamilyId omitted (ADR-0015: optional+nullable).
      payload: { code, name: "Integration Happy Role", seniorityLevel: "MID" },
    });
    expect(created.statusCode).toBe(201);
    const c = created.json() as { jobRoleId: string; code: string; name: string };
    expect(c.code).toBe(code);
    expect(typeof c.jobRoleId).toBe("string");
    createdJobRoleIds.push(c.jobRoleId);

    const got = await suite.app.inject({
      method: "GET",
      url: `/v1/job-roles/${c.jobRoleId}`,
      headers: { cookie: ch(platformS.cookies) },
    });
    expect(got.statusCode).toBe(200);
    const g = got.json() as { jobRoleId: string; code: string };
    expect(g.jobRoleId).toBe(c.jobRoleId);
    expect(g.code).toBe(code);
  });

  it("GET:id with random uuid → 404 NOT_FOUND", async () => {
    const r = await suite.app.inject({
      method: "GET",
      url: `/v1/job-roles/${randomUUID()}`,
      headers: { cookie: ch(platformS.cookies) },
    });
    expect(r.statusCode).toBe(404);
    expect((r.json() as ErrEnvelope).error.code).toBe("NOT_FOUND");
  });

  it("USER (lacks job_role:create) cannot create → 403 FORBIDDEN", async () => {
    const r = await suite.app.inject({
      method: "POST",
      url: "/v1/job-roles",
      headers: {
        cookie: ch(userS.cookies),
        "x-csrf-token": userS.csrfToken,
        "content-type": "application/json",
      },
      payload: { code: `${SUITE_PREFIX}_BLOCK`, name: "Blocked Role" },
    });
    expect(r.statusCode).toBe(403);
    expect((r.json() as ErrEnvelope).error.code).toBe("FORBIDDEN");
  });

  it("duplicate job role code → 409 JOB_ROLE_CODE_CONFLICT", async () => {
    const code = `${SUITE_PREFIX}_DUP`;
    const first = await suite.app.inject({
      method: "POST",
      url: "/v1/job-roles",
      headers: {
        cookie: ch(platformS.cookies),
        "x-csrf-token": platformS.csrfToken,
        "content-type": "application/json",
      },
      payload: { code, name: "First Dup Role" },
    });
    expect(first.statusCode).toBe(201);
    createdJobRoleIds.push((first.json() as { jobRoleId: string }).jobRoleId);

    const dup = await suite.app.inject({
      method: "POST",
      url: "/v1/job-roles",
      headers: {
        cookie: ch(platformS.cookies),
        "x-csrf-token": platformS.csrfToken,
        "content-type": "application/json",
      },
      payload: { code, name: "Second Dup Role" },
    });
    expect(dup.statusCode).toBe(409);
    expect((dup.json() as ErrEnvelope).error.code).toBe("JOB_ROLE_CODE_CONFLICT");
  });

  it("POST without x-csrf-token header → 403", async () => {
    const r = await suite.app.inject({
      method: "POST",
      url: "/v1/job-roles",
      headers: {
        cookie: ch(platformS.cookies),
        "content-type": "application/json",
      },
      payload: { code: `${SUITE_PREFIX}_NOCSRF`, name: "No Csrf Role" },
    });
    expect(r.statusCode).toBe(403);
  });
});
