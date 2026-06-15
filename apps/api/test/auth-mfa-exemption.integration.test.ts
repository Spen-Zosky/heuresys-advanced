/**
 * apps/api/test/auth-mfa-exemption.integration.test.ts
 *
 * Integrazione #9 WI-A — per-user MFA exemption (sys.sys_auth_mfa_exemptions,
 * mig 000116). With mandatory-MFA enforcement ON (the production default), a user
 * who is in scope of an ENABLED tenant policy but has NO verified factor normally
 * receives `mfa_enrollment_required` (restricted session). An ACTIVE exemption row
 * for that user must make the login fall straight through to a FULL session — this
 * is how the headless Agent SDK service user logs in (PLAN §9 decision (a): A1
 * flag-DB primary). Invariant I7: the exemption lives in a sys_auth_* table.
 *
 * Isolation mirrors auth-mfa-enforcement-switch: policy scoped to ["READ_ONLY"] on
 * the RTL tenant, persona alberto.rossetti, snapshot-restore of the pre-suite
 * policy + factor cleanup + exemption cleanup in afterAll. vitest runs singleThread
 * so suites that share this persona never overlap.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { pool } from "../src/db/client.js";
import { COOKIES } from "../src/config/constants.js";

const PASSWORD = "Admin#PassW0rd!";
const READONLY = "alberto.rossetti@rtl-bank.org"; // R2 persona, READ_ONLY

describe("/v1/auth/login MFA exemption (#9 WI-A, mfaEnforcement=true)", () => {
  let app: TestApp;
  let rtlTenantId: string;
  let albertoUserId: string;

  async function login(payload: Record<string, unknown>) {
    return app.app.inject({ method: "POST", url: "/v1/auth/login", payload });
  }

  /** Set the exemption state for the persona: true/false sets `enabled`, null deletes the row. */
  async function setExemption(enabled: boolean | null) {
    if (enabled === null) {
      await pool.query(`DELETE FROM sys.sys_auth_mfa_exemptions WHERE auth_mfa_exemption_user_id = $1`, [
        albertoUserId,
      ]);
      return;
    }
    await pool.query(
      `INSERT INTO sys.sys_auth_mfa_exemptions
         (auth_mfa_exemption_user_id, auth_mfa_exemption_reason, auth_mfa_exemption_enabled)
       VALUES ($1, $2, $3)
       ON CONFLICT (auth_mfa_exemption_user_id) DO UPDATE SET
         auth_mfa_exemption_enabled = EXCLUDED.auth_mfa_exemption_enabled`,
      [albertoUserId, "wi-a exemption test", enabled],
    );
  }

  interface SavedPolicy {
    auth_mfa_policy_enabled: boolean;
    auth_mfa_policy_role_codes: string[] | null;
  }
  let savedPolicy: SavedPolicy | null = null;

  beforeAll(async () => {
    app = await buildTestApp({ mfaEnforcement: true });
    const u = await pool.query<{ user_id: string; user_tenant_id: string }>(
      `SELECT user_id, user_tenant_id FROM sys.sys_users WHERE lower(user_email) = lower($1)`,
      [READONLY],
    );
    const row = u.rows[0];
    if (!row) throw new Error(`R2 persona not seeded: ${READONLY} (run pnpm db:seed-r2)`);
    albertoUserId = row.user_id;
    rtlTenantId = row.user_tenant_id;
    savedPolicy =
      (
        await pool.query<SavedPolicy>(
          `SELECT auth_mfa_policy_enabled, auth_mfa_policy_role_codes
             FROM sys.sys_auth_mfa_policies WHERE auth_mfa_policy_tenant_id = $1`,
          [rtlTenantId],
        )
      ).rows[0] ?? null;
    // Policy ON + in scope: without an exemption this gates the persona to enrollment.
    await pool.query(
      `INSERT INTO sys.sys_auth_mfa_policies
         (auth_mfa_policy_tenant_id, auth_mfa_policy_enabled, auth_mfa_policy_role_codes)
       VALUES ($1, true, ARRAY['READ_ONLY'])
       ON CONFLICT (auth_mfa_policy_tenant_id) DO UPDATE SET
         auth_mfa_policy_enabled    = EXCLUDED.auth_mfa_policy_enabled,
         auth_mfa_policy_role_codes = EXCLUDED.auth_mfa_policy_role_codes`,
      [rtlTenantId],
    );
    await pool.query(`DELETE FROM sys.sys_auth_mfa_factors WHERE auth_mfa_factor_user_id = $1`, [
      albertoUserId,
    ]);
    await setExemption(null);
  });

  afterAll(async () => {
    await setExemption(null);
    await pool.query(`DELETE FROM sys.sys_auth_mfa_policies WHERE auth_mfa_policy_tenant_id = $1`, [
      rtlTenantId,
    ]);
    if (savedPolicy) {
      await pool.query(
        `INSERT INTO sys.sys_auth_mfa_policies
           (auth_mfa_policy_tenant_id, auth_mfa_policy_enabled, auth_mfa_policy_role_codes)
         VALUES ($1, $2, $3)`,
        [rtlTenantId, savedPolicy.auth_mfa_policy_enabled, savedPolicy.auth_mfa_policy_role_codes],
      );
    }
    await pool.query(`DELETE FROM sys.sys_auth_mfa_factors WHERE auth_mfa_factor_user_id = $1`, [
      albertoUserId,
    ]);
    await app.app.close();
  });

  it("NO exemption: policy ON + in-scope + no factor yields mfa_enrollment_required (behaviour unchanged)", async () => {
    await setExemption(null);
    const resp = await login({ email: READONLY, password: PASSWORD });
    expect(resp.statusCode).toBe(200);
    expect((resp.json() as { status: string }).status).toBe("mfa_enrollment_required");
    // restricted session: NO refresh cookie
    expect(resp.cookies.map((c) => c.name)).not.toContain(COOKIES.REFRESH);
  });

  it("ACTIVE exemption: same conditions yield a FULL session (gate bypassed)", async () => {
    await setExemption(true);
    const resp = await login({ email: READONLY, password: PASSWORD });
    expect(resp.statusCode).toBe(200);
    expect((resp.json() as { status: string }).status).toBe("success"); // NOT mfa_enrollment_required
    const names = resp.cookies.map((c) => c.name);
    expect(names).toContain(COOKIES.ACCESS);
    expect(names).toContain(COOKIES.REFRESH); // full session: refresh issued
    expect(names).toContain(COOKIES.CSRF);
  });

  it("DISABLED exemption (enabled=false): gate applies again -> mfa_enrollment_required", async () => {
    await setExemption(false);
    const resp = await login({ email: READONLY, password: PASSWORD });
    expect(resp.statusCode).toBe(200);
    expect((resp.json() as { status: string }).status).toBe("mfa_enrollment_required");
  });
});
