/**
 * apps/api/test/organization-units.integration.test.ts
 * Integration tests for /v1/organization-units/*.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { pool, closePool } from "../src/db/client.js";

const PWD = "Admin#PassW0rd!";
const SUITE_PREFIX = `IT_OU_${randomUUID().slice(0, 8).toUpperCase()}`;

interface S { cookies: Map<string, string>; csrfToken: string }
function ch(c: Map<string, string>) { return [...c.entries()].map(([n, v]) => `${n}=${v}`).join("; "); }
async function login(t: TestApp, email: string): Promise<S> {
  const r = await loginRaw(t.app, email, PWD);
  const cookies = new Map<string, string>();
  for (const c of r.cookies) cookies.set(c.name, c.value);
  return { cookies, csrfToken: (r.json() as { csrfToken: string }).csrfToken };
}

let suite: TestApp;
let tenantS: S;
let employeeS: S;
const createdIds: string[] = [];

describe("/v1/organization-units/* integration", () => {
  beforeAll(async () => {
    suite = await buildTestApp();
    tenantS = await login(suite, "federica.marchetti@rtl-bank.org");
    employeeS = await login(suite, "tommaso.fiore@rtl-bank.org");
  });

  afterAll(async () => {
    for (const id of createdIds) {
      try { await pool.query(`DELETE FROM sys.sys_organization_units WHERE organization_unit_id = $1`, [id]); }
      catch { /* ignore */ }
    }
    await suite.app.close();
    await closePool();
  });

  it("LIST: USER can read OUs in own tenant", async () => {
    const r = await suite.app.inject({
      method: "GET", url: "/v1/organization-units?limit=100",
      headers: { cookie: ch(employeeS.cookies) },
    });
    expect(r.statusCode).toBe(200);
    const body = r.json() as { total: number };
    expect(body.total).toBeGreaterThanOrEqual(6); // RTL seed has 6
  });

  it("CREATE / GET / PATCH / DELETE happy path as TENANT_ADMIN", async () => {
    const code = `${SUITE_PREFIX}_HAPPY`;
    const created = await suite.app.inject({
      method: "POST", url: "/v1/organization-units",
      headers: { cookie: ch(tenantS.cookies), "x-csrf-token": tenantS.csrfToken, "content-type": "application/json" },
      payload: { code, name: "Happy Unit", type: "DEPARTMENT" },
    });
    expect(created.statusCode).toBe(201);
    const ou = created.json() as { organizationUnitId: string; isActive: boolean };
    expect(ou.isActive).toBe(true);
    createdIds.push(ou.organizationUnitId);

    const single = await suite.app.inject({
      method: "GET", url: `/v1/organization-units/${ou.organizationUnitId}`,
      headers: { cookie: ch(tenantS.cookies) },
    });
    expect(single.statusCode).toBe(200);

    const patched = await suite.app.inject({
      method: "PATCH", url: `/v1/organization-units/${ou.organizationUnitId}`,
      headers: { cookie: ch(tenantS.cookies), "x-csrf-token": tenantS.csrfToken, "content-type": "application/json" },
      payload: { name: "Happy Unit Renamed" },
    });
    expect(patched.statusCode).toBe(200);
    expect((patched.json() as { name: string }).name).toBe("Happy Unit Renamed");

    const del = await suite.app.inject({
      method: "DELETE", url: `/v1/organization-units/${ou.organizationUnitId}`,
      headers: { cookie: ch(tenantS.cookies), "x-csrf-token": tenantS.csrfToken },
    });
    expect(del.statusCode).toBe(204);

    const after = await suite.app.inject({
      method: "GET", url: `/v1/organization-units/${ou.organizationUnitId}`,
      headers: { cookie: ch(tenantS.cookies) },
    });
    expect((after.json() as { isActive: boolean }).isActive).toBe(false);
  });

  it("CREATE duplicate code → 409 OU_CODE_CONFLICT", async () => {
    const code = `${SUITE_PREFIX}_DUP`;
    const first = await suite.app.inject({
      method: "POST", url: "/v1/organization-units",
      headers: { cookie: ch(tenantS.cookies), "x-csrf-token": tenantS.csrfToken, "content-type": "application/json" },
      payload: { code, name: "Dup A" },
    });
    expect(first.statusCode).toBe(201);
    createdIds.push((first.json() as { organizationUnitId: string }).organizationUnitId);

    const dup = await suite.app.inject({
      method: "POST", url: "/v1/organization-units",
      headers: { cookie: ch(tenantS.cookies), "x-csrf-token": tenantS.csrfToken, "content-type": "application/json" },
      payload: { code, name: "Dup B" },
    });
    expect(dup.statusCode).toBe(409);
    expect((dup.json() as { error: { code: string } }).error.code).toBe("OU_CODE_CONFLICT");
  });

  it("USER cannot create (no permission)", async () => {
    const r = await suite.app.inject({
      method: "POST", url: "/v1/organization-units",
      headers: { cookie: ch(employeeS.cookies), "x-csrf-token": employeeS.csrfToken, "content-type": "application/json" },
      payload: { code: `${SUITE_PREFIX}_BLOCKED`, name: "X" },
    });
    expect(r.statusCode).toBe(403);
  });
});
