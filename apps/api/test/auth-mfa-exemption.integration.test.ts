/**
 * apps/api/test/auth-mfa-exemption.integration.test.ts
 *
 * Integrazione #9 WI-A — per-user MFA exemption (sys.sys_auth_mfa_exemptions,
 * mig 000116) + M-8 eligibility guard (mig 000117).
 *
 * With mandatory-MFA enforcement ON (production default), a user with a verified
 * factor normally gets `mfa_required` at login. An ACTIVE exemption row makes the
 * login fall straight through to a FULL session — this is how the headless Agent
 * SDK service user (PLATFORM_ADMIN) logs in (PLAN §9 decision (a): A1 flag-DB).
 *
 * M-8 (re-review post-WI-A): an exemption may ONLY target a platform-level
 * (tenant-null) OR PLATFORM_ADMIN user — a tenant-scoped human user can NEVER be
 * silently exempted (DB trigger, mig 000117). Invariant I7: auth-only table.
 *
 * Subject = admin@heuresys.com (PLATFORM_ADMIN, exemptable, carries the e2e TOTP
 * fixture so the no-exemption baseline is `mfa_required`). The baseline does not
 * depend on any per-tenant policy (beginLoginChallenge fires on the factor alone),
 * so the suite touches ONLY exemption rows (admin + tommaso), never policies/factors.
 * Cleanup is strict: a lingering exemption on a PLATFORM_ADMIN would bypass MFA.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { pool } from "../src/db/client.js";
import { COOKIES } from "../src/config/constants.js";

const PASSWORD = "Admin#PassW0rd!";
const ADMIN = "admin@heuresys.com"; // PLATFORM_ADMIN -> exemptable (M-8)
const TENANT_USER = "tommaso.fiore@rtl-bank.org"; // USER, tenant-scoped -> NOT exemptable

describe("/v1/auth/login MFA exemption (#9 WI-A + M-8, mfaEnforcement=true)", () => {
  let app: TestApp;
  let adminUserId: string;
  let tommasoUserId: string;

  async function login(payload: Record<string, unknown>) {
    return app.app.inject({ method: "POST", url: "/v1/auth/login", payload });
  }
  async function resolveUserId(email: string): Promise<string> {
    const r = await pool.query<{ user_id: string }>(
      `SELECT user_id FROM sys.sys_users WHERE lower(user_email) = lower($1)`,
      [email],
    );
    const row = r.rows[0];
    if (!row) throw new Error(`persona not seeded: ${email} (run pnpm db:seed-test-admin)`);
    return row.user_id;
  }
  /** Set admin's exemption: true/false sets `enabled`, null deletes the row. */
  async function setAdminExemption(enabled: boolean | null) {
    if (enabled === null) {
      await pool.query(`DELETE FROM sys.sys_auth_mfa_exemptions WHERE auth_mfa_exemption_user_id = $1`, [
        adminUserId,
      ]);
      return;
    }
    await pool.query(
      `INSERT INTO sys.sys_auth_mfa_exemptions
         (auth_mfa_exemption_user_id, auth_mfa_exemption_reason, auth_mfa_exemption_enabled)
       VALUES ($1, $2, $3)
       ON CONFLICT (auth_mfa_exemption_user_id) DO UPDATE SET
         auth_mfa_exemption_enabled = EXCLUDED.auth_mfa_exemption_enabled`,
      [adminUserId, "wi-a exemption test", enabled],
    );
  }

  beforeAll(async () => {
    app = await buildTestApp({ mfaEnforcement: true });
    adminUserId = await resolveUserId(ADMIN);
    tommasoUserId = await resolveUserId(TENANT_USER);
    await setAdminExemption(null);
    await pool.query(`DELETE FROM sys.sys_auth_mfa_exemptions WHERE auth_mfa_exemption_user_id = $1`, [
      tommasoUserId,
    ]);
  });

  afterAll(async () => {
    // STRICT: never leave a PLATFORM_ADMIN exempt.
    await pool.query(
      `DELETE FROM sys.sys_auth_mfa_exemptions WHERE auth_mfa_exemption_user_id = ANY($1::uuid[])`,
      [[adminUserId, tommasoUserId]],
    );
    await app.app.close();
  });

  it("baseline: PLATFORM_ADMIN with a factor and NO exemption -> mfa_required", async () => {
    await setAdminExemption(null);
    const resp = await login({ email: ADMIN, password: PASSWORD });
    expect(resp.statusCode).toBe(200);
    const json = resp.json() as { status: string; challengeToken?: string };
    expect(json.status).toBe("mfa_required");
    expect(json.challengeToken).toBeTruthy();
    expect(resp.cookies.map((c) => c.name)).not.toContain(COOKIES.REFRESH);
  });

  it("ACTIVE exemption: same admin login -> FULL session (gate bypassed)", async () => {
    await setAdminExemption(true);
    const resp = await login({ email: ADMIN, password: PASSWORD });
    expect(resp.statusCode).toBe(200);
    const json = resp.json() as { status: string; challengeToken?: string };
    expect(json.status).toBe("success"); // NOT mfa_required
    expect(json.challengeToken).toBeUndefined();
    const names = resp.cookies.map((c) => c.name);
    expect(names).toContain(COOKIES.ACCESS);
    expect(names).toContain(COOKIES.REFRESH);
    expect(names).toContain(COOKIES.CSRF);
  });

  it("DISABLED exemption (enabled=false): gate applies again -> mfa_required", async () => {
    await setAdminExemption(false);
    const resp = await login({ email: ADMIN, password: PASSWORD });
    expect(resp.statusCode).toBe(200);
    expect((resp.json() as { status: string }).status).toBe("mfa_required");
  });

  it("M-8 negative: a tenant-scoped human user CANNOT be exempted (trigger rejects)", async () => {
    await expect(
      pool.query(
        `INSERT INTO sys.sys_auth_mfa_exemptions
           (auth_mfa_exemption_user_id, auth_mfa_exemption_reason)
         VALUES ($1, $2)`,
        [tommasoUserId, "must be rejected by 000117"],
      ),
    ).rejects.toThrow();
  });

  it("M-8 positive: a PLATFORM_ADMIN user CAN be exempted (no throw)", async () => {
    await setAdminExemption(null);
    await expect(setAdminExemption(true)).resolves.toBeUndefined();
    await setAdminExemption(null);
  });
});
