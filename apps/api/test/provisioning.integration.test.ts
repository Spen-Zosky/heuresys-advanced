/**
 * apps/api/test/provisioning.integration.test.ts
 * D-14 FASE 1+2 — POST /v1/tenants/provision. Verifies the whole transactional
 * chain (tenant + first TENANT_ADMIN identity/credential/role floor + MFA
 * policy + optional in-tx archetype), that the provisioned admin can
 * immediately authenticate, admin-gating, the clean 409 on a duplicate
 * tenantCode, archetype validation BEFORE any write, and the
 * TENANT_PROVISION_ENABLED kill-switch.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { pool, closePool } from "../src/db/client.js";
import { TEST_PERSONA_PASSWORD } from "./helpers/personas.js";
import { anIndustryCode } from "./helpers/industry.js";
import { env } from "../src/config/env.js";

const ADMIN_EMAIL = "enzo.spenuso@heuresys.com";
const TENANT_ADMIN_EMAIL = "federica.marchetti@rtl-bank.org";
const SUITE_PREFIX = `PROV_${randomUUID().slice(0, 8).toUpperCase()}`;
const NEW_ADMIN_PW = "Prov1sion#Pass!";

interface Auth {
  cookies: Map<string, string>;
  csrfToken: string;
}
function cookieHeader(cookies: Map<string, string>): string {
  return [...cookies.entries()].map(([n, v]) => `${n}=${v}`).join("; ");
}
async function login(t: TestApp, email: string): Promise<Auth> {
  const r = await loginRaw(t.app, email, TEST_PERSONA_PASSWORD);
  const cookies = new Map<string, string>();
  for (const c of r.cookies) cookies.set(c.name, c.value);
  return { cookies, csrfToken: (r.json() as { csrfToken: string }).csrfToken };
}

describe("D-14 tenant provisioning /v1/tenants/provision", () => {
  let suite: TestApp;
  let admin: Auth;
  const createdTenantIds: string[] = [];

  beforeAll(async () => {
    suite = await buildTestApp();
    admin = await login(suite, ADMIN_EMAIL);
  });
  afterAll(async () => {
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

  function headers(a: Auth) {
    return {
      cookie: cookieHeader(a.cookies),
      "x-csrf-token": a.csrfToken,
      "content-type": "application/json",
    };
  }

  it("PLATFORM_ADMIN provisions a full tenant in one transactional call", async () => {
    const code = `${SUITE_PREFIX}_OK`;
    const newAdminEmail = `admin.${code.toLowerCase()}@example.org`;
    const r = await suite.app.inject({
      method: "POST",
      url: "/v1/tenants/provision",
      headers: headers(admin),
      payload: {
        tenantCode: code,
        tenantName: "Provisioned Org",
        tenantIndustryCode: await anIndustryCode(),
        tenantCountryCode: "IT",
        adminEmail: newAdminEmail,
        adminDisplayName: "Provisioned Admin",
        adminPassword: NEW_ADMIN_PW,
      },
    });
    expect(r.statusCode).toBe(201);
    const out = r.json() as {
      tenant: { id: string; code: string; name: string };
      admin: { userId: string; email: string; mustRotatePassword: boolean; roles: string[] };
    };
    createdTenantIds.push(out.tenant.id);
    expect(out.tenant.code).toBe(code);
    expect(out.admin.mustRotatePassword).toBe(true);
    // F2: the practiced role floor — TENANT_ADMIN + USER (I17)
    expect(out.admin.roles.sort()).toEqual(["TENANT_ADMIN", "USER"]);

    // DB proof — every leg of the chain persisted
    const tenant = await pool.query(`SELECT tenant_status FROM sys.sys_tenancies WHERE tenant_id = $1`, [out.tenant.id]);
    expect(tenant.rows[0]?.tenant_status).toBe("ACTIVE");

    const grant = await pool.query(
      `SELECT r.auth_role_code FROM sys.sys_user_auth_roles ur
         JOIN sys.sys_auth_roles r ON r.auth_role_id = ur.user_auth_role_role_id
        WHERE ur.user_auth_role_user_id = $1 AND ur.user_auth_role_tenant_id = $2
          AND ur.user_auth_role_revoked_at IS NULL`,
      [out.admin.userId, out.tenant.id],
    );
    expect(grant.rows.map((x) => x.auth_role_code).sort()).toEqual(["TENANT_ADMIN", "USER"]);

    const cred = await pool.query(
      `SELECT c.auth_credential_id FROM sys.sys_auth_credentials c
         JOIN sys.sys_auth_identities i ON i.auth_identity_id = c.auth_credential_identity_id
        WHERE i.auth_identity_user_id = $1 AND c.auth_credential_is_current = true`,
      [out.admin.userId],
    );
    expect(cred.rows.length).toBe(1);

    const policy = await pool.query(
      `SELECT auth_mfa_policy_id FROM sys.sys_auth_mfa_policies WHERE auth_mfa_policy_tenant_id = $1`,
      [out.tenant.id],
    );
    expect(policy.rows.length).toBe(1);

    // LIVE proof: the provisioned admin can authenticate with the issued password
    const asNew = await loginRaw(suite.app, newAdminEmail, NEW_ADMIN_PW);
    expect(asNew.statusCode).toBe(200);
  });

  it("rejects a non-PLATFORM_ADMIN actor (403)", async () => {
    const ta = await login(suite, TENANT_ADMIN_EMAIL);
    const r = await suite.app.inject({
      method: "POST",
      url: "/v1/tenants/provision",
      headers: headers(ta),
      payload: {
        tenantCode: `${SUITE_PREFIX}_FORBID`,
        tenantName: "Forbidden",
        tenantIndustryCode: await anIndustryCode(),
        adminEmail: "x@example.org",
        adminDisplayName: "x",
        adminPassword: NEW_ADMIN_PW,
      },
    });
    expect(r.statusCode).toBe(403);
  });

  it("rolls back atomically on a duplicate tenantCode (no half-provisioned state)", async () => {
    const code = `${SUITE_PREFIX}_DUP`;
    const base = {
      tenantCode: code,
      tenantName: "Dup Org",
      tenantIndustryCode: await anIndustryCode(),
      adminEmail: `admin.${code.toLowerCase()}@example.org`,
      adminDisplayName: "Dup Admin",
      adminPassword: NEW_ADMIN_PW,
    };
    const first = await suite.app.inject({ method: "POST", url: "/v1/tenants/provision", headers: headers(admin), payload: base });
    expect(first.statusCode).toBe(201);
    createdTenantIds.push((first.json() as { tenant: { id: string } }).tenant.id);

    const secondEmail = `admin.${code.toLowerCase()}.2@example.org`;
    const second = await suite.app.inject({
      method: "POST",
      url: "/v1/tenants/provision",
      headers: headers(admin),
      payload: { ...base, adminEmail: secondEmail },
    });
    // F2: a duplicate tenantCode is a CLEAN 409, not a raw unique-violation 500
    expect(second.statusCode).toBe(409);
    expect((second.json() as { error: { code: string } }).error.code).toBe("TENANT_CODE_EXISTS");

    // the second admin must NOT exist — the failed provision rolled everything back
    const u = await pool.query(`SELECT user_id FROM sys.sys_users WHERE lower(user_email) = lower($1)`, [secondEmail]);
    expect(u.rows.length).toBe(0);
  });

  it("F2: provisions WITH an archetype — org structure materialized in the SAME transaction", async () => {
    const code = `${SUITE_PREFIX}_ARCH`;
    const r = await suite.app.inject({
      method: "POST",
      url: "/v1/tenants/provision",
      headers: headers(admin),
      payload: {
        tenantCode: code,
        tenantName: "Archetyped Org",
        tenantIndustryCode: await anIndustryCode(),
        adminEmail: `admin.${code.toLowerCase()}@example.org`,
        adminDisplayName: "Arch Admin",
        adminPassword: NEW_ADMIN_PW,
        archetypeKey: "RETAIL_BANK_REFERENCE",
      },
    });
    expect(r.statusCode).toBe(201);
    const out = r.json() as {
      tenant: { id: string };
      archetype?: { key: string; created: { orgUnits: number; positions: number; users: number } };
    };
    createdTenantIds.push(out.tenant.id);
    expect(out.archetype?.key).toBe("RETAIL_BANK_REFERENCE");
    expect(out.archetype!.created.orgUnits).toBeGreaterThan(0);
    expect(out.archetype!.created.positions).toBeGreaterThan(0);

    // DB proof — the org structure exists under the NEW tenant
    const ou = await pool.query(
      `SELECT count(*)::int AS n FROM sys.sys_organization_units WHERE organization_unit_tenant_id = $1`,
      [out.tenant.id],
    );
    expect(ou.rows[0]?.n).toBe(out.archetype!.created.orgUnits);
  });

  it("F2: an unknown archetypeKey is rejected BEFORE any write (no orphan tenant)", async () => {
    const code = `${SUITE_PREFIX}_BADARCH`;
    const r = await suite.app.inject({
      method: "POST",
      url: "/v1/tenants/provision",
      headers: headers(admin),
      payload: {
        tenantCode: code,
        tenantName: "Bad Arch",
        tenantIndustryCode: await anIndustryCode(),
        adminEmail: `admin.${code.toLowerCase()}@example.org`,
        adminDisplayName: "x",
        adminPassword: NEW_ADMIN_PW,
        archetypeKey: "DOES_NOT_EXIST",
      },
    });
    expect(r.statusCode).toBe(404);
    expect((r.json() as { error: { code: string } }).error.code).toBe("ARCHETYPE_NOT_FOUND");
    const t = await pool.query(`SELECT tenant_id FROM sys.sys_tenancies WHERE tenant_code = $1`, [code]);
    expect(t.rows.length).toBe(0);
  });

  it("F2: TENANT_PROVISION_ENABLED=false disables the endpoint (403 FEATURE_DISABLED)", async () => {
    const prev = env.TENANT_PROVISION_ENABLED;
    try {
      (env as { TENANT_PROVISION_ENABLED: boolean }).TENANT_PROVISION_ENABLED = false;
      const r = await suite.app.inject({
        method: "POST",
        url: "/v1/tenants/provision",
        headers: headers(admin),
        payload: {
          tenantCode: `${SUITE_PREFIX}_OFF`,
          tenantName: "Disabled",
          tenantIndustryCode: await anIndustryCode(),
          adminEmail: `admin.off.${SUITE_PREFIX.toLowerCase()}@example.org`,
          adminDisplayName: "x",
          adminPassword: NEW_ADMIN_PW,
        },
      });
      expect(r.statusCode).toBe(403);
      expect((r.json() as { error: { code: string } }).error.code).toBe("FEATURE_DISABLED");
    } finally {
      (env as { TENANT_PROVISION_ENABLED: boolean }).TENANT_PROVISION_ENABLED = prev;
    }
  });
});
