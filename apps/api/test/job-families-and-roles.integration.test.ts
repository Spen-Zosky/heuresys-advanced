/**
 * apps/api/test/job-families-and-roles.integration.test.ts
 * Integration tests for /v1/job-families/* and /v1/job-roles/*.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { pool, closePool } from "../src/db/client.js";

const PWD = "Admin#PassW0rd!";
const SUITE_PREFIX = `IT_JOB_${randomUUID().slice(0, 8).toUpperCase()}`;

interface S { cookies: Map<string, string>; csrfToken: string }
function ch(c: Map<string, string>) { return [...c.entries()].map(([n, v]) => `${n}=${v}`).join("; "); }
async function login(t: TestApp, email: string): Promise<S> {
  const r = await loginRaw(t.app, email, PWD);
  const cookies = new Map<string, string>();
  for (const c of r.cookies) cookies.set(c.name, c.value);
  return { cookies, csrfToken: (r.json() as { csrfToken: string }).csrfToken };
}

let suite: TestApp;
let platformS: S;
let tenantS: S;
let employeeS: S;
const familyIds: string[] = [];
const roleIds: string[] = [];

describe("/v1/job-families + /v1/job-roles integration", () => {
  beforeAll(async () => {
    suite = await buildTestApp();
    platformS = await login(suite, "admin@heuresys.com");
    tenantS = await login(suite, "federica.marchetti@rtl-bank.org");
    employeeS = await login(suite, "tommaso.fiore@rtl-bank.org");
  });

  afterAll(async () => {
    for (const id of roleIds) {
      try { await pool.query(`DELETE FROM sys.sys_job_roles WHERE job_role_id = $1`, [id]); } catch { /* ignore */ }
    }
    for (const id of familyIds) {
      try { await pool.query(`DELETE FROM sys.sys_job_families WHERE job_family_id = $1`, [id]); } catch { /* ignore */ }
    }
    await suite.app.close();
    await closePool();
  });

  /* -------------------------------------------------- job-families */

  it("CREATE job-family as PLATFORM_ADMIN → 201; TENANT_ADMIN create → 403", async () => {
    const code = `${SUITE_PREFIX}_FAM`;
    const ok = await suite.app.inject({
      method: "POST", url: "/v1/job-families",
      headers: { cookie: ch(platformS.cookies), "x-csrf-token": platformS.csrfToken, "content-type": "application/json" },
      payload: { code, name: "Test Family" },
    });
    expect(ok.statusCode).toBe(201);
    const fam = ok.json() as { jobFamilyId: string };
    familyIds.push(fam.jobFamilyId);

    const blocked = await suite.app.inject({
      method: "POST", url: "/v1/job-families",
      headers: { cookie: ch(tenantS.cookies), "x-csrf-token": tenantS.csrfToken, "content-type": "application/json" },
      payload: { code: `${SUITE_PREFIX}_FAM2`, name: "Should Block" },
    });
    expect(blocked.statusCode).toBe(403);
    expect((blocked.json() as { error: { code: string } }).error.code).toBe("JOB_FAMILY_ADMIN_ONLY");
  });

  it("LIST job-families: USER can read", async () => {
    const r = await suite.app.inject({
      method: "GET", url: "/v1/job-families?limit=100",
      headers: { cookie: ch(employeeS.cookies) },
    });
    expect(r.statusCode).toBe(200);
    const body = r.json() as { total: number };
    expect(body.total).toBeGreaterThanOrEqual(1);
  });

  /* -------------------------------------------------- job-roles */

  it("CREATE job-role under valid family as TENANT_ADMIN → 201; invalid family → 404", async () => {
    expect(familyIds.length).toBeGreaterThan(0);
    const familyId = familyIds[0]!;

    const code = `${SUITE_PREFIX}_ROLE`;
    const ok = await suite.app.inject({
      method: "POST", url: "/v1/job-roles",
      headers: { cookie: ch(tenantS.cookies), "x-csrf-token": tenantS.csrfToken, "content-type": "application/json" },
      payload: { jobFamilyId: familyId, code, name: "Test Role", seniorityLevel: "SENIOR" },
    });
    expect(ok.statusCode).toBe(201);
    const role = ok.json() as { jobRoleId: string; seniorityLevel: string };
    expect(role.seniorityLevel).toBe("SENIOR");
    roleIds.push(role.jobRoleId);

    const bogusFamily = "00000000-0000-0000-0000-000000000000";
    const blocked = await suite.app.inject({
      method: "POST", url: "/v1/job-roles",
      headers: { cookie: ch(tenantS.cookies), "x-csrf-token": tenantS.csrfToken, "content-type": "application/json" },
      payload: { jobFamilyId: bogusFamily, code: `${SUITE_PREFIX}_ROLE_BAD`, name: "Bad" },
    });
    expect(blocked.statusCode).toBe(404);
  });

  it("CREATE job-role as MANAGER → 403 (no job_role:create perm)", async () => {
    const managerS = await login(suite, "paolo.caputo@rtl-bank.org");
    const familyId = familyIds[0]!;
    const r = await suite.app.inject({
      method: "POST", url: "/v1/job-roles",
      headers: { cookie: ch(managerS.cookies), "x-csrf-token": managerS.csrfToken, "content-type": "application/json" },
      payload: { jobFamilyId: familyId, code: `${SUITE_PREFIX}_MGR_BLK`, name: "Should Fail" },
    });
    expect(r.statusCode).toBe(403);
  });

  it("DELETE job-family with attached roles → 409 JOB_FAMILY_IN_USE", async () => {
    expect(familyIds.length).toBeGreaterThan(0);
    expect(roleIds.length).toBeGreaterThan(0);
    const familyId = familyIds[0]!;

    const r = await suite.app.inject({
      method: "DELETE", url: `/v1/job-families/${familyId}`,
      headers: { cookie: ch(platformS.cookies), "x-csrf-token": platformS.csrfToken },
    });
    expect(r.statusCode).toBe(409);
    expect((r.json() as { error: { code: string } }).error.code).toBe("JOB_FAMILY_IN_USE");
  });
});
