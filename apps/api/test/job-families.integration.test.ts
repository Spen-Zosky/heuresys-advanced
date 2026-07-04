/**
 * apps/api/test/job-families.integration.test.ts
 *
 * Integration tests for /v1/job-families/* (sys.sys_job_families).
 * Platform-level reference data: reads open to any authenticated user;
 * mutations gated to PLATFORM_ADMIN by the service (JOB_FAMILY_ADMIN_ONLY),
 * CSRF-enforced on POST/PATCH/DELETE. No tenant_id on this table.
 *
 * Tests hit the live OCI VM DB via the SSH tunnel (no mocks). Any row created
 * here is cleaned up in afterAll against the real sys.sys_job_families table.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { pool, closePool } from "../src/db/client.js";
import { TEST_PERSONA_PASSWORD } from "./helpers/personas.js";

const PWD = TEST_PERSONA_PASSWORD;
const SUITE_PREFIX = `IT_JF_${randomUUID().slice(0, 8).toUpperCase()}`;

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
let tenantS: S;
const createdFamilyIds: string[] = [];

describe("/v1/job-families/* integration", () => {
  beforeAll(async () => {
    suite = await buildTestApp();
    platformS = await login(suite, "admin@heuresys.com");
    tenantS = await login(suite, "federica.marchetti@rtl-bank.org");
  });

  afterAll(async () => {
    for (const id of createdFamilyIds) {
      try {
        await pool.query(`DELETE FROM sys.sys_job_families WHERE job_family_id = $1`, [id]);
      } catch {
        /* ignore cleanup errors */
      }
    }
    await suite.app.close();
    await closePool();
  });

  it("rejects an unauthenticated LIST with 401 UNAUTHORIZED", async () => {
    const r = await suite.app.inject({ method: "GET", url: "/v1/job-families" });
    expect(r.statusCode).toBe(401);
    expect((r.json() as { error: { code: string } }).error.code).toBe("UNAUTHORIZED");
  });

  it("LIST as authenticated user returns 200 with { items: [], total } shape", async () => {
    const r = await suite.app.inject({
      method: "GET",
      url: "/v1/job-families",
      headers: { cookie: ch(platformS.cookies) },
    });
    expect(r.statusCode).toBe(200);
    const body = r.json() as { items: unknown[]; total: number };
    expect(Array.isArray(body.items)).toBe(true);
    expect(typeof body.total).toBe("number");
  });

  it("CREATE / GET-by-id as PLATFORM_ADMIN happy path (201 + readback)", async () => {
    const code = `${SUITE_PREFIX}_HP`;
    const created = await suite.app.inject({
      method: "POST",
      url: "/v1/job-families",
      headers: {
        cookie: ch(platformS.cookies),
        "x-csrf-token": platformS.csrfToken,
        "content-type": "application/json",
      },
      payload: { code, name: "Happy Family" },
    });
    expect(created.statusCode).toBe(201);
    const c = created.json() as { jobFamilyId: string; code: string; name: string };
    expect(c.code).toBe(code);
    expect(typeof c.jobFamilyId).toBe("string");
    createdFamilyIds.push(c.jobFamilyId);

    const got = await suite.app.inject({
      method: "GET",
      url: `/v1/job-families/${c.jobFamilyId}`,
      headers: { cookie: ch(platformS.cookies) },
    });
    expect(got.statusCode).toBe(200);
    const g = got.json() as { jobFamilyId: string; code: string };
    expect(g.jobFamilyId).toBe(c.jobFamilyId);
    expect(g.code).toBe(code);
  });

  it("GET-by-id for a random uuid returns 404 NOT_FOUND", async () => {
    const r = await suite.app.inject({
      method: "GET",
      url: `/v1/job-families/${randomUUID()}`,
      headers: { cookie: ch(platformS.cookies) },
    });
    expect(r.statusCode).toBe(404);
    expect((r.json() as { error: { code: string } }).error.code).toBe("NOT_FOUND");
  });

  it("TENANT_ADMIN cannot CREATE → 403 JOB_FAMILY_ADMIN_ONLY", async () => {
    const r = await suite.app.inject({
      method: "POST",
      url: "/v1/job-families",
      headers: {
        cookie: ch(tenantS.cookies),
        "x-csrf-token": tenantS.csrfToken,
        "content-type": "application/json",
      },
      payload: { code: `${SUITE_PREFIX}_BLOCK`, name: "Blocked" },
    });
    expect(r.statusCode).toBe(403);
    expect((r.json() as { error: { code: string } }).error.code).toBe("JOB_FAMILY_ADMIN_ONLY");
  });

  it("CREATE without x-csrf-token header → 403 (CSRF enforced)", async () => {
    const r = await suite.app.inject({
      method: "POST",
      url: "/v1/job-families",
      headers: {
        cookie: ch(platformS.cookies),
        "content-type": "application/json",
      },
      payload: { code: `${SUITE_PREFIX}_NOCSRF`, name: "No Csrf" },
    });
    expect(r.statusCode).toBe(403);
  });

  it("Duplicate code → 409 JOB_FAMILY_CODE_CONFLICT", async () => {
    const code = `${SUITE_PREFIX}_DUP`;
    const first = await suite.app.inject({
      method: "POST",
      url: "/v1/job-families",
      headers: {
        cookie: ch(platformS.cookies),
        "x-csrf-token": platformS.csrfToken,
        "content-type": "application/json",
      },
      payload: { code, name: "First Dup" },
    });
    expect(first.statusCode).toBe(201);
    createdFamilyIds.push((first.json() as { jobFamilyId: string }).jobFamilyId);

    const dup = await suite.app.inject({
      method: "POST",
      url: "/v1/job-families",
      headers: {
        cookie: ch(platformS.cookies),
        "x-csrf-token": platformS.csrfToken,
        "content-type": "application/json",
      },
      payload: { code, name: "Second Dup" },
    });
    expect(dup.statusCode).toBe(409);
    expect((dup.json() as { error: { code: string } }).error.code).toBe("JOB_FAMILY_CODE_CONFLICT");
  });
});
