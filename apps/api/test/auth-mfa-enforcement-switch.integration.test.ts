/**
 * apps/api/test/auth-mfa-enforcement-switch.integration.test.ts
 *
 * S989 MFA neutralization kill-switch: with mfaEnforcement=false (env
 * MFA_ENFORCEMENT_ENABLED=false) the login §3b gate is bypassed ENTIRELY so
 * dev/test can proceed without a second factor — even with the mandatory-MFA
 * policy ON and the user in scope. The MFA capability + per-tenant policy DATA
 * stay intact; only login-time enforcement is suspended. Proves BOTH gate
 * branches are bypassed:
 *   - policy ON, in-scope, NO factor   -> full session (no mfa_enrollment_required)
 *   - user WITH a verified factor       -> full session, no mfa_required challenge
 *
 * Isolation mirrors auth-mfa-mandatory: policy scoped to ["READ_ONLY"] on the
 * RTL tenant, persona alberto.rossetti (used by no other suite for a real
 * login), snapshot-restore of the pre-suite policy + factor cleanup in afterAll.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import * as OTPAuth from "otpauth";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { pool } from "../src/db/client.js";
import { COOKIES } from "../src/config/constants.js";

const PASSWORD = "Admin#PassW0rd!";
const READONLY = "alberto.rossetti@rtl-bank.org"; // R2 persona, READ_ONLY

function genTotp(secretBase32: string): string {
  return new OTPAuth.TOTP({
    issuer: "Heuresys",
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secretBase32),
  }).generate();
}

describe("/v1/auth/login MFA enforcement kill-switch (S989, mfaEnforcement=false)", () => {
  let app: TestApp;
  let rtlTenantId: string;
  let albertoUserId: string;

  async function login(payload: Record<string, unknown>) {
    return app.app.inject({ method: "POST", url: "/v1/auth/login", payload });
  }
  function cookieHeader(resp: { cookies: Array<{ name: string; value: string }> }): string {
    return resp.cookies.map((c) => `${c.name}=${c.value}`).join("; ");
  }

  interface SavedPolicy {
    auth_mfa_policy_enabled: boolean;
    auth_mfa_policy_role_codes: string[] | null;
  }
  let savedPolicy: SavedPolicy | null = null;

  beforeAll(async () => {
    // The kill-switch is wired at the DI seam (not only via env): pin it false
    // here so the suite is deterministic regardless of the ambient .env value.
    app = await buildTestApp({ mfaEnforcement: false });
    const u = await pool.query<{ user_id: string; user_tenant_id: string }>(
      `SELECT user_id, user_tenant_id FROM sys.sys_users WHERE lower(user_email) = lower($1)`,
      [READONLY],
    );
    const row = u.rows[0];
    if (!row) throw new Error(`R2 persona not seeded: ${READONLY} (run pnpm db:seed-r2)`);
    albertoUserId = row.user_id;
    rtlTenantId = row.user_tenant_id;
    // Snapshot the pre-suite RTL policy (restored in afterAll — the live DB
    // carries the REAL S982 activation a blanket delete would wipe).
    savedPolicy =
      (
        await pool.query<SavedPolicy>(
          `SELECT auth_mfa_policy_enabled, auth_mfa_policy_role_codes
             FROM sys.sys_auth_mfa_policies WHERE auth_mfa_policy_tenant_id = $1`,
          [rtlTenantId],
        )
      ).rows[0] ?? null;
    // Policy ON + in scope: with enforcement ON this WOULD gate the persona;
    // the kill-switch must override it.
    await pool.query(
      `INSERT INTO sys.sys_auth_mfa_policies
         (auth_mfa_policy_tenant_id, auth_mfa_policy_enabled, auth_mfa_policy_role_codes)
       VALUES ($1, true, ARRAY['READ_ONLY'])
       ON CONFLICT (auth_mfa_policy_tenant_id) DO UPDATE SET
         auth_mfa_policy_enabled    = EXCLUDED.auth_mfa_policy_enabled,
         auth_mfa_policy_role_codes = EXCLUDED.auth_mfa_policy_role_codes`,
      [rtlTenantId],
    );
    // Clean factor state for the persona.
    await pool.query(`DELETE FROM sys.sys_auth_mfa_factors WHERE auth_mfa_factor_user_id = $1`, [
      albertoUserId,
    ]);
  });

  afterAll(async () => {
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

  it("policy ON + in-scope + NO factor: enforcement OFF yields a FULL session (enrollment gate bypassed)", async () => {
    const resp = await login({ email: READONLY, password: PASSWORD });
    expect(resp.statusCode).toBe(200);
    expect((resp.json() as { status: string }).status).toBe("success"); // NOT mfa_enrollment_required
    const names = resp.cookies.map((c) => c.name);
    expect(names).toContain(COOKIES.ACCESS);
    expect(names).toContain(COOKIES.REFRESH); // full session: refresh issued
    expect(names).toContain(COOKIES.CSRF);
  });

  it("user WITH a verified factor: enforcement OFF logs in directly, no mfa_required challenge", async () => {
    // Enroll+verify a TOTP factor through the full session the switch grants.
    const full = await login({ email: READONLY, password: PASSWORD });
    const cookies = cookieHeader(full);
    const csrf = (full.json() as { csrfToken: string }).csrfToken;

    const enroll = await app.app.inject({
      method: "POST",
      url: "/v1/auth/mfa/enroll",
      headers: { cookie: cookies, "x-csrf-token": csrf, "content-type": "application/json" },
      payload: {},
    });
    expect(enroll.statusCode).toBe(201);
    const { factorId, secret } = enroll.json() as { factorId: string; secret: string };
    const verify = await app.app.inject({
      method: "POST",
      url: "/v1/auth/mfa/verify-setup",
      headers: { cookie: cookies, "x-csrf-token": csrf, "content-type": "application/json" },
      payload: { factorId, code: genTotp(secret) },
    });
    expect(verify.statusCode).toBe(200);

    // Re-login: even WITH a verified factor the gate is bypassed -> direct success.
    const relogin = await login({ email: READONLY, password: PASSWORD });
    expect(relogin.statusCode).toBe(200);
    const json = relogin.json() as { status: string; challengeToken?: string };
    expect(json.status).toBe("success"); // NOT mfa_required
    expect(json.challengeToken).toBeUndefined();
    expect(relogin.cookies.map((c) => c.name)).toContain(COOKIES.REFRESH);
  });
});
