/**
 * apps/api/test/auth-mfa-mandatory.integration.test.ts
 *
 * Mandatory-MFA login gate (MVP-4 par.2.5 #4). Exercises the third /login
 * outcome end-to-end against the live DB:
 *
 *   policy OFF                    -> behaviour identical to pre-#4 (regression)
 *   policy ON, role out of scope  -> success unchanged (role scoping)
 *   policy ON, in scope, no factor-> 200 mfa_enrollment_required + RESTRICTED
 *                                    enr session (ACCESS+CSRF cookies, NO refresh)
 *   enr session                   -> MFA self-service reachable; every
 *                                    permission-gated route 403; refresh 401
 *   enroll TOTP via enr session   -> re-login becomes the regular mfa_required
 *                                    challenge -> full session
 *
 * Isolation: the policy is scoped to roleCodes ["READ_ONLY"] on the RTL tenant
 * and the gated persona is alberto.rossetti (R2 READ_ONLY — used by no other
 * test file), so a mid-run crash cannot gate the personas other files log in
 * with. Cleanup in afterAll removes the policy row + the throwaway factor.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import * as OTPAuth from "otpauth";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { pool } from "../src/db/client.js";
import { COOKIES } from "../src/config/constants.js";

const PASSWORD = "Admin#PassW0rd!";
const READONLY = "alberto.rossetti@rtl-bank.org"; // R2 persona, READ_ONLY
const TENANT_ADMIN = "federica.marchetti@rtl-bank.org"; // RTL, NOT in ["READ_ONLY"] scope

function genTotp(secretBase32: string): string {
  const totp = new OTPAuth.TOTP({
    issuer: "Heuresys",
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secretBase32),
  });
  return totp.generate();
}

describe("/v1/auth/login mandatory-MFA gate (#4)", () => {
  let app: TestApp;
  let rtlTenantId: string;
  let albertoUserId: string;

  async function login(payload: Record<string, unknown>) {
    return app.app.inject({ method: "POST", url: "/v1/auth/login", payload });
  }

  function cookieHeader(resp: { cookies: Array<{ name: string; value: string }> }): string {
    return resp.cookies.map((c) => `${c.name}=${c.value}`).join("; ");
  }

  async function setPolicy(enabled: boolean): Promise<void> {
    await pool.query(
      `INSERT INTO sys.sys_auth_mfa_policies
         (auth_mfa_policy_tenant_id, auth_mfa_policy_enabled, auth_mfa_policy_role_codes)
       VALUES ($1, $2, ARRAY['READ_ONLY'])
       ON CONFLICT (auth_mfa_policy_tenant_id) DO UPDATE SET
         auth_mfa_policy_enabled    = EXCLUDED.auth_mfa_policy_enabled,
         auth_mfa_policy_role_codes = EXCLUDED.auth_mfa_policy_role_codes`,
      [rtlTenantId, enabled],
    );
  }

  beforeAll(async () => {
    app = await buildTestApp();
    const u = await pool.query<{ user_id: string; user_tenant_id: string }>(
      `SELECT user_id, user_tenant_id FROM sys.sys_users WHERE lower(user_email) = lower($1)`,
      [READONLY],
    );
    const row = u.rows[0];
    if (!row) throw new Error(`R2 persona not seeded: ${READONLY} (run pnpm db:seed-r2)`);
    albertoUserId = row.user_id;
    rtlTenantId = row.user_tenant_id;
  });

  afterAll(async () => {
    // Remove the policy row FIRST (gate off no matter what), then the throwaway factor(s).
    await pool.query(`DELETE FROM sys.sys_auth_mfa_policies WHERE auth_mfa_policy_tenant_id = $1`, [
      rtlTenantId,
    ]);
    await pool.query(`DELETE FROM sys.sys_auth_mfa_factors WHERE auth_mfa_factor_user_id = $1`, [
      albertoUserId,
    ]);
    await app.app.close();
  });

  it("policy OFF: the in-scope persona logs in with a full session (pre-#4 regression)", async () => {
    const resp = await login({ email: READONLY, password: PASSWORD });
    expect(resp.statusCode).toBe(200);
    expect((resp.json() as { status: string }).status).toBe("success");
  });

  it("policy ON: factor-less in-scope user gets mfa_enrollment_required — ACCESS+CSRF cookies, NO refresh", async () => {
    await setPolicy(true);
    const resp = await login({ email: READONLY, password: PASSWORD });
    expect(resp.statusCode).toBe(200);
    const json = resp.json() as { status: string; csrfToken: string; allowedKinds: string[] };
    expect(json.status).toBe("mfa_enrollment_required");
    expect(json.csrfToken.length).toBeGreaterThan(0);
    // allowedKinds is provider-aware: the test app's InMemorySms IS production-
    // capable, so SMS_OTP appears here; in PROD without a real SMS provider the
    // list is TOTP/EMAIL_OTP/WEBAUTHN only (ConsoleSms is not capable).
    expect(json.allowedKinds).toEqual(["TOTP", "EMAIL_OTP", "WEBAUTHN", "SMS_OTP"]);
    const names = resp.cookies.map((c) => c.name);
    expect(names).toContain(COOKIES.ACCESS);
    expect(names).toContain(COOKIES.CSRF);
    expect(names).not.toContain(COOKIES.REFRESH);
  });

  it("policy ON: a user whose roles are OUT of scope (TENANT_ADMIN) is untouched", async () => {
    const resp = await login({ email: TENANT_ADMIN, password: PASSWORD });
    expect(resp.statusCode).toBe(200);
    expect((resp.json() as { status: string }).status).toBe("success");
  });

  it("the enr session is CONTAINED by the allowlist guard: everything outside mfa+login+logout is 401 MFA_ENROLLMENT_ONLY", async () => {
    const gate = await login({ email: READONLY, password: PASSWORD });
    const cookies = cookieHeader(gate);
    const csrf = (gate.json() as { csrfToken: string }).csrfToken;

    // Review fix S981: containment is an explicit positive allowlist on the
    // `enr` claim, not just roles:[] — including the authenticated-only
    // routes WITHOUT requirePermission that used to leak through.
    for (const url of [
      "/v1/users", // permission-gated
      "/v1/auth/me", // authenticated-only, would expose REAL roles
      "/v1/auth/sessions/current", // authenticated-only
      "/v1/skill-categories", // authenticated-only global read
      "/v1/me/permissions", // authenticated-only
    ]) {
      const resp = await app.app.inject({ method: "GET", url, headers: { cookie: cookies } });
      expect(resp.statusCode, url).toBe(401);
      expect((resp.json() as { error: { code: string } }).error.code, url).toBe(
        "MFA_ENROLLMENT_ONLY",
      );
    }

    // No refresh cookie was issued -> the session cannot be extended.
    const refresh = await app.app.inject({
      method: "POST",
      url: "/v1/auth/refresh",
      headers: { cookie: cookies, "x-csrf-token": csrf },
    });
    expect(refresh.statusCode).toBe(401);

    // The MFA self-service surface IS reachable (the intended enrollment path).
    const factors = await app.app.inject({
      method: "GET",
      url: "/v1/auth/mfa/factors",
      headers: { cookie: cookies },
    });
    expect(factors.statusCode).toBe(200);
  });

  it("full loop: enroll+verify TOTP through the enr session, then re-login -> mfa_required -> success", async () => {
    // 1. Gate response = restricted session.
    const gate = await login({ email: READONLY, password: PASSWORD });
    expect((gate.json() as { status: string }).status).toBe("mfa_enrollment_required");
    const cookies = cookieHeader(gate);
    const csrf = (gate.json() as { csrfToken: string }).csrfToken;

    // 2. Enroll a TOTP factor through the restricted session (CSRF-protected).
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
    expect((verify.json() as { verified: boolean }).verified).toBe(true);

    // 3. Re-login from scratch: the user now HAS a verified factor -> regular challenge.
    const step1 = await login({ email: READONLY, password: PASSWORD });
    expect((step1.json() as { status: string }).status).toBe("mfa_required");
    const challengeToken = (step1.json() as { challengeToken: string }).challengeToken;

    const step2 = await login({
      email: READONLY,
      password: PASSWORD,
      challengeToken,
      mfaCode: genTotp(secret),
    });
    expect(step2.statusCode).toBe(200);
    const done = step2.json() as { status: string; user: { userId: string } };
    expect(done.status).toBe("success");
    expect(done.user.userId).toBe(albertoUserId);
    const names = step2.cookies.map((c) => c.name);
    expect(names).toContain(COOKIES.ACCESS);
    expect(names).toContain(COOKIES.REFRESH);
    expect(names).toContain(COOKIES.CSRF);

    // 4. The gate audit event was recorded.
    const ev = await pool.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM sys.sys_auth_login_events
        WHERE auth_login_event_user_id = $1
          AND auth_login_event_type = 'LOGIN_MFA_ENROLLMENT_REQUIRED'`,
      [albertoUserId],
    );
    expect(Number(ev.rows[0]!.n)).toBeGreaterThanOrEqual(1);
  });
});
