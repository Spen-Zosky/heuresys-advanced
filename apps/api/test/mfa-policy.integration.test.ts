/**
 * apps/api/test/mfa-policy.integration.test.ts
 *
 * /v1/mfa-policy admin surface (MVP-4 par.2.5 #4). Hits the live DB through
 * the tunnel (no mocks). afterAll restores the EXACT pre-suite policy rows
 * (snapshot-restore, S982): the live DB may carry a REAL activation (e.g. the
 * RTL role-slice enabled by Enzo) that a blanket delete would silently wipe.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { pool } from "../src/db/client.js";

const PASSWORD = "Admin#PassW0rd!";
const PLATFORM = "admin@heuresys.com";
const TENANT_ADMIN = "federica.marchetti@rtl-bank.org";
const MANAGER = "paolo.caputo@rtl-bank.org";

describe("/v1/mfa-policy (mandatory-MFA #4)", () => {
  let app: TestApp;
  let rtlTenantId: string;
  let heuresysTenantId: string;

  async function loginAs(email: string) {
    const resp = await app.app.inject({
      method: "POST",
      url: "/v1/auth/login",
      payload: { email, password: PASSWORD },
    });
    expect(resp.statusCode).toBe(200);
    const json = resp.json() as { status: string; csrfToken: string };
    expect(json.status).toBe("success");
    const cookie = resp.cookies.map((c) => `${c.name}=${c.value}`).join("; ");
    return { cookie, csrf: json.csrfToken };
  }

  interface SavedPolicy {
    auth_mfa_policy_tenant_id: string;
    auth_mfa_policy_enabled: boolean;
    auth_mfa_policy_role_codes: string[] | null;
  }
  let savedPolicies: SavedPolicy[] = [];

  beforeAll(async () => {
    app = await buildTestApp();
    const t = await pool.query<{ tenant_id: string; tenant_code: string }>(
      `SELECT tenant_id, tenant_code FROM sys.sys_tenancies WHERE tenant_status = 'ACTIVE' ORDER BY tenant_code`,
    );
    const rtl = t.rows.find((r) => r.tenant_code.includes("RTL"));
    const heu = t.rows.find((r) => !r.tenant_code.includes("RTL"));
    if (!rtl || !heu) throw new Error("expected the 2 ACTIVE case-study tenants");
    rtlTenantId = rtl.tenant_id;
    heuresysTenantId = heu.tenant_id;
    // Snapshot the pre-suite policy state of the touched tenants (restored in afterAll).
    savedPolicies = (
      await pool.query<SavedPolicy>(
        `SELECT auth_mfa_policy_tenant_id, auth_mfa_policy_enabled, auth_mfa_policy_role_codes
           FROM sys.sys_auth_mfa_policies WHERE auth_mfa_policy_tenant_id = ANY($1)`,
        [[rtlTenantId, heuresysTenantId]],
      )
    ).rows;
  });

  afterAll(async () => {
    // Snapshot-restore: wipe the suite's rows, then re-insert the pre-suite state.
    await pool.query(`DELETE FROM sys.sys_auth_mfa_policies WHERE auth_mfa_policy_tenant_id = ANY($1)`, [
      [rtlTenantId, heuresysTenantId],
    ]);
    for (const p of savedPolicies) {
      await pool.query(
        `INSERT INTO sys.sys_auth_mfa_policies
           (auth_mfa_policy_tenant_id, auth_mfa_policy_enabled, auth_mfa_policy_role_codes)
         VALUES ($1, $2, $3)`,
        [p.auth_mfa_policy_tenant_id, p.auth_mfa_policy_enabled, p.auth_mfa_policy_role_codes],
      );
    }
    await app.app.close();
  });

  it("MANAGER has neither read nor manage (403 PERMISSION_DENIED)", async () => {
    const mgr = await loginAs(MANAGER);
    const read = await app.app.inject({
      method: "GET",
      url: "/v1/mfa-policy",
      headers: { cookie: mgr.cookie },
    });
    expect(read.statusCode).toBe(403);
    const write = await app.app.inject({
      method: "PUT",
      url: `/v1/mfa-policy/${rtlTenantId}`,
      headers: { cookie: mgr.cookie, "x-csrf-token": mgr.csrf },
      payload: { enabled: false },
    });
    expect(write.statusCode).toBe(403);
  });

  it("PUT without the CSRF header is rejected (403 CSRF_FAIL)", async () => {
    const adm = await loginAs(PLATFORM);
    const resp = await app.app.inject({
      method: "PUT",
      url: `/v1/mfa-policy/${rtlTenantId}`,
      headers: { cookie: adm.cookie },
      payload: { enabled: false },
    });
    expect(resp.statusCode).toBe(403);
    expect((resp.json() as { error: { code: string } }).error.code).toBe("CSRF_FAIL");
  });

  it("TENANT_ADMIN upserts OWN tenant; foreign tenant -> 404 (no existence leak)", async () => {
    const ta = await loginAs(TENANT_ADMIN);
    const own = await app.app.inject({
      method: "PUT",
      url: `/v1/mfa-policy/${rtlTenantId}`,
      headers: { cookie: ta.cookie, "x-csrf-token": ta.csrf },
      payload: { enabled: false, roleCodes: ["READ_ONLY"] },
    });
    expect(own.statusCode).toBe(200);
    const body = own.json() as { tenantId: string; enabled: boolean; roleCodes: string[] | null };
    expect(body.tenantId).toBe(rtlTenantId);
    expect(body.enabled).toBe(false);
    expect(body.roleCodes).toEqual(["READ_ONLY"]);

    const foreign = await app.app.inject({
      method: "PUT",
      url: `/v1/mfa-policy/${heuresysTenantId}`,
      headers: { cookie: ta.cookie, "x-csrf-token": ta.csrf },
      payload: { enabled: false },
    });
    expect(foreign.statusCode).toBe(404);
  });

  it("TENANT_ADMIN list sees ONLY its own tenant's policy", async () => {
    const ta = await loginAs(TENANT_ADMIN);
    const resp = await app.app.inject({
      method: "GET",
      url: "/v1/mfa-policy",
      headers: { cookie: ta.cookie },
    });
    expect(resp.statusCode).toBe(200);
    const body = resp.json() as { items: Array<{ tenantId: string }>; total: number };
    expect(body.items.every((p) => p.tenantId === rtlTenantId)).toBe(true);
  });

  it("PLATFORM_ADMIN upserts any tenant; re-PUT is an idempotent update (same row)", async () => {
    const adm = await loginAs(PLATFORM);
    const first = await app.app.inject({
      method: "PUT",
      url: `/v1/mfa-policy/${heuresysTenantId}`,
      headers: { cookie: adm.cookie, "x-csrf-token": adm.csrf },
      payload: { enabled: false },
    });
    expect(first.statusCode).toBe(200);
    const a = first.json() as { policyId: string; roleCodes: string[] | null };
    expect(a.roleCodes).toBeNull(); // omitted -> all roles

    const second = await app.app.inject({
      method: "PUT",
      url: `/v1/mfa-policy/${heuresysTenantId}`,
      headers: { cookie: adm.cookie, "x-csrf-token": adm.csrf },
      payload: { enabled: false, roleCodes: ["USER", "READ_ONLY"] },
    });
    expect(second.statusCode).toBe(200);
    const b = second.json() as { policyId: string; roleCodes: string[] | null };
    expect(b.policyId).toBe(a.policyId); // UNIQUE(tenant) -> updated, not duplicated
    expect(b.roleCodes).toEqual(["USER", "READ_ONLY"]);

    const list = await app.app.inject({
      method: "GET",
      url: "/v1/mfa-policy",
      headers: { cookie: adm.cookie },
    });
    const lb = list.json() as { items: Array<{ tenantId: string }> };
    expect(lb.items.length).toBeGreaterThanOrEqual(2); // platform sees every tenant's row
  });

  it("unknown role code in the scope list -> 400 VALIDATION_ERROR", async () => {
    const adm = await loginAs(PLATFORM);
    const resp = await app.app.inject({
      method: "PUT",
      url: `/v1/mfa-policy/${rtlTenantId}`,
      headers: { cookie: adm.cookie, "x-csrf-token": adm.csrf },
      payload: { enabled: false, roleCodes: ["NOT_A_ROLE"] },
    });
    expect(resp.statusCode).toBe(400);
  });

  it("unknown tenant -> 404", async () => {
    const adm = await loginAs(PLATFORM);
    const resp = await app.app.inject({
      method: "PUT",
      url: "/v1/mfa-policy/00000000-0000-4000-8000-000000000000",
      headers: { cookie: adm.cookie, "x-csrf-token": adm.csrf },
      payload: { enabled: false },
    });
    expect(resp.statusCode).toBe(404);
  });
});
