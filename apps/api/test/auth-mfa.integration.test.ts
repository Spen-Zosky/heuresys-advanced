/**
 * apps/api/test/auth-mfa.integration.test.ts
 *
 * Integration tests for MFA login-gating (MVP-3 Tappa E, batch X20). Exercises
 * the 2-step /v1/auth/login flow composed in auth.service.login():
 *   step 1 (email+password, MFA-enrolled user) -> 200 { status: 'mfa_required', challengeToken }
 *   step 2 (+ challengeToken + valid TOTP)      -> 200 { status: 'success' } + 3 cookies
 *
 * A throwaway verified TOTP factor is enrolled on a dedicated persona
 * (outsider_test@rtl-bank.test) in beforeAll and deleted in afterAll so the
 * rest of the suite is unaffected. Does NOT closePool (shared across the
 * singleThread suite — owned by auth.integration.test.ts afterAll).
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import * as OTPAuth from "otpauth";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { pool } from "../src/db/client.js";
import { COOKIES } from "../src/config/constants.js";
import { sharedMfaService } from "../src/modules/auth/mfa-service.js";
import * as mfaRepo from "../src/modules/auth/mfa-repository.js";

const MFA_EMAIL = "outsider_test@rtl-bank.test";
const MFA_PASSWORD = "Admin#PassW0rd!";

/** Generate the current 6-digit code from a base32 secret (matches mfa-service params). */
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

describe("/v1/auth/login MFA gating (X20)", () => {
  let app: TestApp;
  let mfaUserId: string;
  let mfaFactorId: string;
  let mfaSecret: string;

  beforeAll(async () => {
    app = await buildTestApp();

    const r = await pool.query<{ user_id: string }>(
      `SELECT user_id FROM sys.sys_users WHERE lower(user_email) = lower($1) LIMIT 1`,
      [MFA_EMAIL],
    );
    const found = r.rows[0];
    if (!found) throw new Error(`MFA test persona not seeded: ${MFA_EMAIL}`);
    mfaUserId = found.user_id;

    // Enroll + verify a TOTP factor so the account has a verified MFA factor.
    const enrolled = await sharedMfaService.enrollTotp({ userId: mfaUserId, userEmail: MFA_EMAIL });
    mfaFactorId = enrolled.factorId;
    mfaSecret = enrolled.secret;
    await sharedMfaService.verifyTotpSetup({
      userId: mfaUserId,
      factorId: mfaFactorId,
      code: genTotp(mfaSecret),
    });
  });

  afterAll(async () => {
    // Clean up the throwaway factor so other tests (and re-runs) are unaffected.
    if (mfaFactorId && mfaUserId) {
      await mfaRepo.deleteMfaFactor(pool, mfaFactorId, mfaUserId).catch(() => {});
    }
    // NOTE: do NOT closePool — shared across the singleThread suite.
  });

  async function login(body: Record<string, unknown>) {
    return app.app.inject({
      method: "POST",
      url: "/v1/auth/login",
      payload: body,
    });
  }

  it("no-MFA account (admin) logs in directly with status: 'success' + cookies", async () => {
    const resp = await login({ email: "admin@heuresys.com", password: "Admin#PassW0rd!" });
    expect(resp.statusCode).toBe(200);
    const json = resp.json();
    expect(json.status).toBe("success");
    expect(json.user?.userId).toBeTruthy();
    expect(json.csrfToken).toBeTruthy();
    const setCookies = resp.cookies.map((c) => c.name);
    expect(setCookies).toContain(COOKIES.ACCESS);
    expect(setCookies).toContain(COOKIES.REFRESH);
    expect(setCookies).toContain(COOKIES.CSRF);
  });

  it("MFA account step 1 (password only) returns 200 status: 'mfa_required' + challengeToken, NO cookies", async () => {
    const resp = await login({ email: MFA_EMAIL, password: MFA_PASSWORD });
    expect(resp.statusCode).toBe(200);
    const json = resp.json();
    expect(json.status).toBe("mfa_required");
    expect(typeof json.challengeToken).toBe("string");
    expect(json.challengeToken.length).toBeGreaterThan(0);
    expect(json.availableKinds).toContain("TOTP");
    // No auth cookies issued at step 1.
    const setCookies = resp.cookies.map((c) => c.name);
    expect(setCookies).not.toContain(COOKIES.ACCESS);
    expect(setCookies).not.toContain(COOKIES.REFRESH);
  });

  it("MFA account step 2 with valid TOTP returns 200 status: 'success' + 3 cookies", async () => {
    const step1 = await login({ email: MFA_EMAIL, password: MFA_PASSWORD });
    const challengeToken = step1.json().challengeToken as string;
    const resp = await login({
      email: MFA_EMAIL,
      password: MFA_PASSWORD,
      challengeToken,
      mfaCode: genTotp(mfaSecret),
    });
    expect(resp.statusCode).toBe(200);
    const json = resp.json();
    expect(json.status).toBe("success");
    expect(json.user?.userId).toBe(mfaUserId);
    const setCookies = resp.cookies.map((c) => c.name);
    expect(setCookies).toContain(COOKIES.ACCESS);
    expect(setCookies).toContain(COOKIES.REFRESH);
    expect(setCookies).toContain(COOKIES.CSRF);
  });

  it("MFA account step 2 with invalid TOTP returns 401", async () => {
    const step1 = await login({ email: MFA_EMAIL, password: MFA_PASSWORD });
    const challengeToken = step1.json().challengeToken as string;
    const resp = await login({
      email: MFA_EMAIL,
      password: MFA_PASSWORD,
      challengeToken,
      mfaCode: "000000",
    });
    expect(resp.statusCode).toBe(401);
    expect(resp.json().error?.code).toBe("MFA_TOTP_INVALID");
  });

  it("MFA account step 2 without mfaCode returns 401 MFA_CODE_REQUIRED", async () => {
    const step1 = await login({ email: MFA_EMAIL, password: MFA_PASSWORD });
    const challengeToken = step1.json().challengeToken as string;
    const resp = await login({ email: MFA_EMAIL, password: MFA_PASSWORD, challengeToken });
    expect(resp.statusCode).toBe(401);
    expect(resp.json().error?.code).toBe("MFA_CODE_REQUIRED");
  });
});
