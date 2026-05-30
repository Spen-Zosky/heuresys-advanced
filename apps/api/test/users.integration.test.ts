/**
 * apps/api/test/users.integration.test.ts
 * Integration tests for /v1/users/*. Validates the 4 scope tiers
 * (PLATFORM_ADMIN / TENANT_ADMIN / MANAGER team / USER self) at runtime
 * using the personas seeded by pnpm db:seed-test-admin.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { pool, closePool } from "../src/db/client.js";

const PWD = "Admin#PassW0rd!";
const PLATFORM_EMAIL = "admin@heuresys.com";
const TENANT_ADMIN_EMAIL = "federica.marchetti@rtl-bank.org";
const MANAGER_EMAIL = "paolo.caputo@rtl-bank.org";
const EMPLOYEE_EMAIL = "tommaso.fiore@rtl-bank.org";
const OUTSIDER_EMAIL = "antonio.parisi@rtl-bank.org";

const SUITE_PREFIX = `IT_USR_${randomUUID().slice(0, 8).toUpperCase()}`;

interface Session {
  cookies: Map<string, string>;
  csrfToken: string;
  userId: string;
}

function cookieHeader(cookies: Map<string, string>): string {
  return [...cookies.entries()].map(([n, v]) => `${n}=${v}`).join("; ");
}

async function login(t: TestApp, email: string): Promise<Session> {
  const r = await t.app.inject({
    method: "POST",
    url: "/v1/auth/login",
    payload: { email, password: PWD },
  });
  if (r.statusCode !== 200) {
    throw new Error(`login ${email} failed: ${r.statusCode} ${r.payload}`);
  }
  const cookies = new Map<string, string>();
  for (const c of r.cookies) cookies.set(c.name, c.value);
  const body = r.json() as { user: { userId: string }; csrfToken: string };
  return { cookies, csrfToken: body.csrfToken, userId: body.user.userId };
}

let suite: TestApp;
let platformS: Session;
let tenantS: Session;
let managerS: Session;
let employeeS: Session;
let outsiderS: Session;
let employeeId: string;
let outsiderId: string;
const createdUserIds: string[] = [];

describe("/v1/users/* integration (4-tier scope)", () => {
  beforeAll(async () => {
    suite = await buildTestApp();
    platformS = await login(suite, PLATFORM_EMAIL);
    tenantS = await login(suite, TENANT_ADMIN_EMAIL);
    managerS = await login(suite, MANAGER_EMAIL);
    employeeS = await login(suite, EMPLOYEE_EMAIL);
    outsiderS = await login(suite, OUTSIDER_EMAIL);
    employeeId = employeeS.userId;
    outsiderId = outsiderS.userId;
  });

  afterAll(async () => {
    for (const id of createdUserIds) {
      try {
        await pool.query(`DELETE FROM sys.sys_user_auth_roles WHERE user_auth_role_user_id = $1`, [id]);
        await pool.query(`DELETE FROM sys.sys_auth_credentials c USING sys.sys_auth_identities i WHERE c.auth_credential_identity_id = i.auth_identity_id AND i.auth_identity_user_id = $1`, [id]);
        await pool.query(`DELETE FROM sys.sys_auth_identities WHERE auth_identity_user_id = $1`, [id]);
        await pool.query(`DELETE FROM sys.sys_users WHERE user_id = $1`, [id]);
      } catch {
        /* ignore */
      }
    }
    await suite.app.close();
    await closePool();
  });

  /* -------------------------------------------------- list scope tiers */

  it("LIST: PLATFORM_ADMIN sees all users in DB (≥ 163 = synthetic seed + fixtures)", async () => {
    const r = await suite.app.inject({
      method: "GET",
      url: "/v1/users?limit=200",
      headers: { cookie: cookieHeader(platformS.cookies) },
    });
    expect(r.statusCode).toBe(200);
    const body = r.json() as { total: number };
    expect(body.total).toBeGreaterThanOrEqual(163);
  });

  it("LIST: TENANT_ADMIN sees only own-tenant users", async () => {
    const r = await suite.app.inject({
      method: "GET",
      url: "/v1/users?limit=200",
      headers: { cookie: cookieHeader(tenantS.cookies) },
    });
    expect(r.statusCode).toBe(200);
    const body = r.json() as { items: { tenantId: string }[]; total: number };
    expect(body.total).toBeGreaterThanOrEqual(163);
    // All returned items must be in RTL tenant.
    const tenants = new Set(body.items.map((u) => u.tenantId));
    expect(tenants.size).toBe(1);
  });

  it("LIST: MANAGER sees only their team (self + direct reports, tenant-scoped)", async () => {
    const r = await suite.app.inject({
      method: "GET",
      url: "/v1/users?limit=200",
      headers: { cookie: cookieHeader(managerS.cookies) },
    });
    expect(r.statusCode).toBe(200);
    const body = r.json() as { items: { userId: string; email: string }[]; total: number };
    // paolo.caputo (manager persona) sees self + the incumbents of the positions he owns
    // (his direct reports) — a small set, NOT the whole tenant (163+).
    expect(body.total).toBeGreaterThanOrEqual(2);
    expect(body.total).toBeLessThan(50);
    const emails = new Set(body.items.map((u) => u.email));
    expect(emails.has(MANAGER_EMAIL)).toBe(true); // self
    expect(emails.has(EMPLOYEE_EMAIL)).toBe(true); // a direct report (tommaso.fiore)
    expect(emails.has(OUTSIDER_EMAIL)).toBe(false); // different team (antonio, claudia's report)
  });

  it("LIST: USER sees only self", async () => {
    const r = await suite.app.inject({
      method: "GET",
      url: "/v1/users?limit=200",
      headers: { cookie: cookieHeader(employeeS.cookies) },
    });
    expect(r.statusCode).toBe(200);
    const body = r.json() as { items: { email: string }[]; total: number };
    expect(body.total).toBe(1);
    expect(body.items[0]!.email).toBe(EMPLOYEE_EMAIL);
  });

  /* -------------------------------------------------- get by id scope */

  it("GET :id MANAGER → 200 for team member, 404 for outsider", async () => {
    const teamOk = await suite.app.inject({
      method: "GET",
      url: `/v1/users/${employeeId}`,
      headers: { cookie: cookieHeader(managerS.cookies) },
    });
    expect(teamOk.statusCode).toBe(200);

    const blocked = await suite.app.inject({
      method: "GET",
      url: `/v1/users/${outsiderId}`,
      headers: { cookie: cookieHeader(managerS.cookies) },
    });
    expect(blocked.statusCode).toBe(404);
  });

  it("GET :id USER → 200 for self, 404 for any other", async () => {
    const self = await suite.app.inject({
      method: "GET",
      url: `/v1/users/${employeeS.userId}`,
      headers: { cookie: cookieHeader(employeeS.cookies) },
    });
    expect(self.statusCode).toBe(200);

    const other = await suite.app.inject({
      method: "GET",
      url: `/v1/users/${outsiderId}`,
      headers: { cookie: cookieHeader(employeeS.cookies) },
    });
    expect(other.statusCode).toBe(404);
  });

  /* -------------------------------------------------- create */

  it("CREATE: TENANT_ADMIN → 201; duplicate email → 409", async () => {
    const email = `${SUITE_PREFIX.toLowerCase()}_create@rtl-bank.test`;
    const created = await suite.app.inject({
      method: "POST",
      url: "/v1/users",
      headers: {
        cookie: cookieHeader(tenantS.cookies),
        "x-csrf-token": tenantS.csrfToken,
        "content-type": "application/json",
      },
      payload: { email, displayName: "Created by Tenant Admin" },
    });
    expect(created.statusCode).toBe(201);
    const body = created.json() as { userId: string; status: string; type: string };
    expect(body.status).toBe("PENDING_VERIFICATION");
    expect(body.type).toBe("STANDARD");
    createdUserIds.push(body.userId);

    const dup = await suite.app.inject({
      method: "POST",
      url: "/v1/users",
      headers: {
        cookie: cookieHeader(tenantS.cookies),
        "x-csrf-token": tenantS.csrfToken,
        "content-type": "application/json",
      },
      payload: { email, displayName: "Duplicate" },
    });
    expect(dup.statusCode).toBe(409);
    expect((dup.json() as { error: { code: string } }).error.code).toBe("USER_EMAIL_CONFLICT");
  });

  it("CREATE: MANAGER → 403 (insufficient perm)", async () => {
    const r = await suite.app.inject({
      method: "POST",
      url: "/v1/users",
      headers: {
        cookie: cookieHeader(managerS.cookies),
        "x-csrf-token": managerS.csrfToken,
        "content-type": "application/json",
      },
      payload: { email: `${SUITE_PREFIX.toLowerCase()}_blocked@rtl-bank.test`, displayName: "Blocked" },
    });
    expect(r.statusCode).toBe(403);
  });

  /* -------------------------------------------------- update field restrictions */

  it("PATCH: MANAGER updates allowed field (displayName) on team member; rejected on email", async () => {
    const okPatch = await suite.app.inject({
      method: "PATCH",
      url: `/v1/users/${employeeId}`,
      headers: {
        cookie: cookieHeader(managerS.cookies),
        "x-csrf-token": managerS.csrfToken,
        "content-type": "application/json",
      },
      payload: { displayName: "Renamed by Manager" },
    });
    expect(okPatch.statusCode).toBe(200);

    const blocked = await suite.app.inject({
      method: "PATCH",
      url: `/v1/users/${employeeId}`,
      headers: {
        cookie: cookieHeader(managerS.cookies),
        "x-csrf-token": managerS.csrfToken,
        "content-type": "application/json",
      },
      payload: { email: "should-not-go-through@nope.test" },
    });
    expect(blocked.statusCode).toBe(403);
    expect((blocked.json() as { error: { code: string } }).error.code).toBe("FIELD_NOT_ALLOWED");
  });

  it("PATCH /v1/users/:id from USER → 403 (admin endpoint; self-update lives in /v1/me/profile MVP-2b)", async () => {
    // Design split per AUTH §6.1 (ESS): USER role intentionally lacks
    // `user:update` in the seed; their self-service update path is the
    // separate /v1/me/profile endpoint (ADR-0011, MVP-2b). The /v1/users/*
    // module is admin-facing only.
    const r = await suite.app.inject({
      method: "PATCH",
      url: `/v1/users/${employeeS.userId}`,
      headers: {
        cookie: cookieHeader(employeeS.cookies),
        "x-csrf-token": employeeS.csrfToken,
        "content-type": "application/json",
      },
      payload: { displayName: "USER cannot update via admin endpoint" },
    });
    expect(r.statusCode).toBe(403);
  });

  /* -------------------------------------------------- deactivate */

  it("DELETE: PLATFORM_ADMIN deactivates a created user; second DELETE → 409", async () => {
    // Create a fresh disposable user as target. PLATFORM_ADMIN supplies
    // tenantId explicitly (their JWT carries tenant_id=null).
    const tenantRow = await pool.query<{ tenant_id: string }>(
      `SELECT tenant_id FROM sys.sys_tenancies WHERE tenant_code = 'RTL_BANK'`,
    );
    const rtlTenantId = tenantRow.rows[0]!.tenant_id;
    const email = `${SUITE_PREFIX.toLowerCase()}_dx@rtl-bank.test`;
    const created = await suite.app.inject({
      method: "POST",
      url: "/v1/users",
      headers: {
        cookie: cookieHeader(platformS.cookies),
        "x-csrf-token": platformS.csrfToken,
        "content-type": "application/json",
      },
      payload: { email, displayName: "DeactivateMe", tenantId: rtlTenantId },
    });
    expect(created.statusCode).toBe(201);
    const { userId } = created.json() as { userId: string };
    createdUserIds.push(userId);

    const del1 = await suite.app.inject({
      method: "DELETE",
      url: `/v1/users/${userId}`,
      headers: { cookie: cookieHeader(platformS.cookies), "x-csrf-token": platformS.csrfToken },
    });
    expect(del1.statusCode).toBe(204);

    const after = await suite.app.inject({
      method: "GET",
      url: `/v1/users/${userId}`,
      headers: { cookie: cookieHeader(platformS.cookies) },
    });
    expect((after.json() as { status: string }).status).toBe("DEACTIVATED");

    const del2 = await suite.app.inject({
      method: "DELETE",
      url: `/v1/users/${userId}`,
      headers: { cookie: cookieHeader(platformS.cookies), "x-csrf-token": platformS.csrfToken },
    });
    expect(del2.statusCode).toBe(409);
    expect((del2.json() as { error: { code: string } }).error.code).toBe("USER_ALREADY_DEACTIVATED");
  });

  it("DELETE: self-deactivation → 409 SELF_DEACTIVATE", async () => {
    const r = await suite.app.inject({
      method: "DELETE",
      url: `/v1/users/${platformS.userId}`,
      headers: { cookie: cookieHeader(platformS.cookies), "x-csrf-token": platformS.csrfToken },
    });
    expect(r.statusCode).toBe(409);
    expect((r.json() as { error: { code: string } }).error.code).toBe("SELF_DEACTIVATE");
  });

  /* -------------------------------------------------- role grants */

  it("ROLE GRANTS: list/grant/revoke flow as TENANT_ADMIN on a freshly-created user", async () => {
    const email = `${SUITE_PREFIX.toLowerCase()}_roles@rtl-bank.test`;
    const created = await suite.app.inject({
      method: "POST",
      url: "/v1/users",
      headers: {
        cookie: cookieHeader(tenantS.cookies),
        "x-csrf-token": tenantS.csrfToken,
        "content-type": "application/json",
      },
      payload: { email, displayName: "RolesTarget" },
    });
    const { userId } = created.json() as { userId: string };
    createdUserIds.push(userId);

    // 1. Initial: no role grants.
    const listEmpty = await suite.app.inject({
      method: "GET",
      url: `/v1/users/${userId}/roles`,
      headers: { cookie: cookieHeader(tenantS.cookies) },
    });
    expect(listEmpty.statusCode).toBe(200);
    expect((listEmpty.json() as { items: unknown[] }).items.length).toBe(0);

    // 2. Grant USER role (tenant-scoped, forced by TENANT_ADMIN policy).
    const grant = await suite.app.inject({
      method: "POST",
      url: `/v1/users/${userId}/roles`,
      headers: {
        cookie: cookieHeader(tenantS.cookies),
        "x-csrf-token": tenantS.csrfToken,
        "content-type": "application/json",
      },
      payload: { roleCode: "USER" },
    });
    expect(grant.statusCode).toBe(201);
    const grantBody = grant.json() as { grantId: string; roleCode: string; tenantId: string | null };
    expect(grantBody.roleCode).toBe("USER");
    expect(grantBody.tenantId).not.toBeNull();
    const grantId = grantBody.grantId;

    // 3. List again: 1 item.
    const listOne = await suite.app.inject({
      method: "GET",
      url: `/v1/users/${userId}/roles`,
      headers: { cookie: cookieHeader(tenantS.cookies) },
    });
    expect((listOne.json() as { items: unknown[] }).items.length).toBe(1);

    // 4. Duplicate grant → 409 ROLE_GRANT_DUPLICATE.
    const dup = await suite.app.inject({
      method: "POST",
      url: `/v1/users/${userId}/roles`,
      headers: {
        cookie: cookieHeader(tenantS.cookies),
        "x-csrf-token": tenantS.csrfToken,
        "content-type": "application/json",
      },
      payload: { roleCode: "USER" },
    });
    expect(dup.statusCode).toBe(409);
    expect((dup.json() as { error: { code: string } }).error.code).toBe("ROLE_GRANT_DUPLICATE");

    // 5. TENANT_ADMIN attempting to grant PLATFORM_ADMIN → 403.
    const platBlocked = await suite.app.inject({
      method: "POST",
      url: `/v1/users/${userId}/roles`,
      headers: {
        cookie: cookieHeader(tenantS.cookies),
        "x-csrf-token": tenantS.csrfToken,
        "content-type": "application/json",
      },
      payload: { roleCode: "PLATFORM_ADMIN" },
    });
    expect(platBlocked.statusCode).toBe(403);
    expect((platBlocked.json() as { error: { code: string } }).error.code).toBe(
      "PLATFORM_GRANT_FORBIDDEN",
    );

    // 6. Revoke the grant.
    const revoke = await suite.app.inject({
      method: "DELETE",
      url: `/v1/users/${userId}/roles/${grantId}`,
      headers: { cookie: cookieHeader(tenantS.cookies), "x-csrf-token": tenantS.csrfToken },
    });
    expect(revoke.statusCode).toBe(204);

    // 7. Second revoke → 404 (the grant is gone from the active-set lookup).
    const revoke2 = await suite.app.inject({
      method: "DELETE",
      url: `/v1/users/${userId}/roles/${grantId}`,
      headers: { cookie: cookieHeader(tenantS.cookies), "x-csrf-token": tenantS.csrfToken },
    });
    // findGrantById returns the row regardless of revoked_at, so we get 409 not 404.
    expect(revoke2.statusCode).toBe(409);
    expect((revoke2.json() as { error: { code: string } }).error.code).toBe(
      "ROLE_GRANT_ALREADY_REVOKED",
    );
  });
});
