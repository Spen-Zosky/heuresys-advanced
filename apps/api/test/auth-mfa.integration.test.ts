/**
 * apps/api/test/auth-mfa.integration.test.ts
 *
 * Integration tests for MFA login-gating (MVP-3 Tappa E, batch X20). Exercises
 * the 2-step /v1/auth/login flow composed in auth.service.login():
 *   step 1 (email+password, MFA-enrolled user) -> 200 { status: 'mfa_required', challengeToken }
 *   step 2 (+ challengeToken + valid TOTP)      -> 200 { status: 'success' } + 3 cookies
 *
 * A throwaway verified TOTP factor is enrolled on a dedicated persona
 * (antonio.parisi@rtl-bank.org) in beforeAll and deleted in afterAll so the
 * rest of the suite is unaffected. Does NOT closePool (shared across the
 * singleThread suite — owned by auth.integration.test.ts afterAll).
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import * as OTPAuth from "otpauth";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { pool } from "../src/db/client.js";
import { COOKIES } from "../src/config/constants.js";
import { sharedMfaService } from "../src/modules/auth/mfa-service.js";
import * as mfaRepo from "../src/modules/auth/mfa-repository.js";
import { passwordFor } from "./helpers/personas.js";

import { senzaCacheDiSessione } from "./helpers/session-cache.js";

// Z-251 F2 — questo file esercita il FLUSSO di autenticazione (login, MFA, rotazione del
// refresh): una sessione presa da un altro file proverebbe qualcosa che il test non sta
// chiedendo. Qui i login sono veri, sempre.
senzaCacheDiSessione();

const MFA_EMAIL = "antonio.parisi@rtl-bank.org";
const MFA_PASSWORD = passwordFor(MFA_EMAIL);

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

  it("fixture persona (admin) completes a FULL login — plain success pre-flip, TOTP 2-step under the live mandatory policy (S983 WS-E)", async () => {
    // Repurposed from "no-MFA account logs in directly": with the e2e-fixture
    // TOTP factor live there IS no factor-less admin — the invariant under
    // test is that the login always completes to a FULL session.
    const resp = await loginRaw(app.app, "enzo.spenuso@heuresys.com");
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

  it("MFA account step 2 with invalid TOTP returns 401 + audits an MFA_FAIL event (no plaintext code) [QW-SEC5]", async () => {
    const countMfaFail = async () =>
      (
        await pool.query<{ n: number }>(
          `SELECT count(*)::int AS n FROM sys.sys_auth_login_events
             WHERE auth_login_event_user_id = $1 AND auth_login_event_type = 'MFA_FAIL'`,
          [mfaUserId],
        )
      ).rows[0]!.n;
    const before = await countMfaFail();

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

    // QW-SEC5: the failed second factor is now audited as a security event.
    expect(await countMfaFail()).toBe(before + 1);
    // The audited record carries a typed reason and NEVER the submitted code.
    const ev = await pool.query<{ details: { reason?: string } }>(
      `SELECT auth_login_event_details AS details FROM sys.sys_auth_login_events
         WHERE auth_login_event_user_id = $1 AND auth_login_event_type = 'MFA_FAIL'
         ORDER BY created_at DESC LIMIT 1`,
      [mfaUserId],
    );
    expect(ev.rows[0]!.details.reason).toBe("MFA_TOTP_INVALID");
    expect(JSON.stringify(ev.rows[0]!.details)).not.toContain("000000");
  });

  it("MFA account step 2 without mfaCode returns 401 MFA_CODE_REQUIRED", async () => {
    const step1 = await login({ email: MFA_EMAIL, password: MFA_PASSWORD });
    const challengeToken = step1.json().challengeToken as string;
    const resp = await login({ email: MFA_EMAIL, password: MFA_PASSWORD, challengeToken });
    expect(resp.statusCode).toBe(401);
    expect(resp.json().error?.code).toBe("MFA_CODE_REQUIRED");
  });
});

/* =====================================================================
 * EMAIL_OTP factor (MVP-4 A8)
 *
 * Uses a dedicated persona (tommaso.fiore@rtl-bank.org, a USER with no other
 * MFA factor) so the EMAIL_OTP flow is exercised in isolation. The emailed
 * 6-digit code is read from the InMemoryMailer seam injected by buildTestApp.
 * All EMAIL_OTP factors created here are deleted in afterAll.
 * =================================================================== */

const OTP_EMAIL = "tommaso.fiore@rtl-bank.org";
const OTP_PASSWORD = passwordFor(OTP_EMAIL);

function ch(c: Map<string, string>): string {
  return [...c.entries()].map(([n, v]) => `${n}=${v}`).join("; ");
}

describe("/v1/auth/mfa EMAIL_OTP factor (MVP-4)", () => {
  let app: TestApp;
  let userId: string;
  let cookies: Map<string, string>;
  let csrfToken: string;
  const createdFactorIds = new Set<string>();

  async function loginSession(email: string, password: string) {
    // Dual-mode (S983 WS-E): loginRaw completes the TOTP step-2 when the
    // fixture factor gates the login; pre-flip it is a plain passthrough.
    const r = await loginRaw(app.app, email, password);
    const c = new Map<string, string>();
    for (const k of r.cookies) c.set(k.name, k.value);
    return { resp: r, cookies: c, csrfToken: (r.json() as { csrfToken?: string }).csrfToken ?? "" };
  }

  beforeAll(async () => {
    app = await buildTestApp();
    const r = await pool.query<{ user_id: string }>(
      `SELECT user_id FROM sys.sys_users WHERE lower(user_email) = lower($1) LIMIT 1`,
      [OTP_EMAIL],
    );
    const found = r.rows[0];
    if (!found) throw new Error(`EMAIL_OTP test persona not seeded: ${OTP_EMAIL}`);
    userId = found.user_id;
    // Clean any leftover EMAIL_OTP factors from prior interrupted runs.
    await pool.query(
      `DELETE FROM sys.sys_auth_mfa_factors WHERE auth_mfa_factor_user_id = $1 AND auth_mfa_factor_kind = 'EMAIL_OTP'`,
      [userId],
    );
    const s = await loginSession(OTP_EMAIL, OTP_PASSWORD);
    cookies = s.cookies;
    csrfToken = s.csrfToken;
  });

  afterAll(async () => {
    for (const id of createdFactorIds) {
      await pool
        .query(`DELETE FROM sys.sys_auth_mfa_factors WHERE auth_mfa_factor_id = $1`, [id])
        .catch(() => {});
    }
    await pool
      .query(
        `DELETE FROM sys.sys_auth_mfa_factors WHERE auth_mfa_factor_user_id = $1 AND auth_mfa_factor_kind = 'EMAIL_OTP'`,
        [userId],
      )
      .catch(() => {});
    await app.app.close();
    // NOTE: do NOT closePool — shared across the singleThread suite.
  });

  function authHeaders() {
    return { cookie: ch(cookies), "x-csrf-token": csrfToken, "content-type": "application/json" };
  }

  /** Enroll an EMAIL_OTP factor + read the emailed code from the mailer seam. */
  async function enrollEmailOtp(): Promise<{ factorId: string; code: string }> {
    app.mailer.clear();
    const r = await app.app.inject({
      method: "POST",
      url: "/v1/auth/mfa/email-otp/enroll",
      headers: authHeaders(),
      payload: {},
    });
    if (r.statusCode !== 201) throw new Error(`enroll: ${r.statusCode} ${r.body}`);
    const body = r.json() as { factorId: string; kind: string; emailHint: string };
    createdFactorIds.add(body.factorId);
    const code = app.mailer.lastOtpCode();
    if (!code) throw new Error("no OTP code captured in InMemoryMailer");
    return { factorId: body.factorId, code };
  }

  it("enroll emails a 6-digit code, NEVER returns it in the response body", async () => {
    app.mailer.clear();
    const r = await app.app.inject({
      method: "POST",
      url: "/v1/auth/mfa/email-otp/enroll",
      headers: authHeaders(),
      payload: {},
    });
    expect(r.statusCode).toBe(201);
    const body = r.json() as Record<string, unknown>;
    createdFactorIds.add(body.factorId as string);
    expect(body.kind).toBe("EMAIL_OTP");
    expect(body.verified).toBe(false);
    expect((body.emailHint as string)).toMatch(/\*\*\*@/);
    // The OTP code must NOT appear anywhere in the response body.
    expect(JSON.stringify(body)).not.toContain(app.mailer.lastOtpCode() ?? "__none__");
    expect(body.code).toBeUndefined();
    expect(body.secret).toBeUndefined();
    // The code WAS emailed (mailer seam) and is 6 digits.
    expect(app.mailer.lastOtpCode()).toMatch(/^\d{6}$/);
    expect(app.mailer.sentOtps.at(-1)?.purpose).toBe("ENROLL");
  });

  it("enroll → verify-setup with the emailed code activates the factor", async () => {
    const { factorId, code } = await enrollEmailOtp();
    const r = await app.app.inject({
      method: "POST",
      url: "/v1/auth/mfa/email-otp/verify-setup",
      headers: authHeaders(),
      payload: { factorId, code },
    });
    expect(r.statusCode).toBe(200);
    const body = r.json() as { kind: string; verified: boolean };
    expect(body.kind).toBe("EMAIL_OTP");
    expect(body.verified).toBe(true);
    // DB reflects verified=true.
    const chk = await pool.query<{ v: boolean }>(
      `SELECT auth_mfa_factor_verified AS v FROM sys.sys_auth_mfa_factors WHERE auth_mfa_factor_id = $1`,
      [factorId],
    );
    expect(chk.rows[0]?.v).toBe(true);
  });

  it("verify-setup with WRONG code is rejected (MFA_OTP_INVALID), factor stays unverified", async () => {
    const { factorId } = await enrollEmailOtp();
    const r = await app.app.inject({
      method: "POST",
      url: "/v1/auth/mfa/email-otp/verify-setup",
      headers: authHeaders(),
      payload: { factorId, code: "000000" },
    });
    expect(r.statusCode).toBe(401);
    expect(r.json().error?.code).toBe("MFA_OTP_INVALID");
    const chk = await pool.query<{ v: boolean }>(
      `SELECT auth_mfa_factor_verified AS v FROM sys.sys_auth_mfa_factors WHERE auth_mfa_factor_id = $1`,
      [factorId],
    );
    expect(chk.rows[0]?.v).toBe(false);
  });

  it("verify-setup with EXPIRED code is rejected (MFA_OTP_EXPIRED)", async () => {
    const { factorId, code } = await enrollEmailOtp();
    // Force-expire the active challenge: backdate created_at to 1h ago and set
    // expires_at to 59 min ago — satisfies the CHECK (expires_at > created_at)
    // yet is firmly in the past, so the server-side TTL check fires.
    await pool.query(
      `UPDATE sys.sys_auth_mfa_otp_challenges
          SET auth_mfa_otp_expires_at = now() - interval '59 minutes',
              created_at              = now() - interval '60 minutes'
        WHERE auth_mfa_otp_factor_id = $1 AND auth_mfa_otp_consumed_at IS NULL`,
      [factorId],
    );
    const r = await app.app.inject({
      method: "POST",
      url: "/v1/auth/mfa/email-otp/verify-setup",
      headers: authHeaders(),
      payload: { factorId, code },
    });
    expect(r.statusCode).toBe(401);
    expect(r.json().error?.code).toBe("MFA_OTP_EXPIRED");
  });

  it("replay: a consumed (already-used) code is rejected (MFA_OTP_INVALID)", async () => {
    const { factorId, code } = await enrollEmailOtp();
    // First use succeeds.
    const ok = await app.app.inject({
      method: "POST",
      url: "/v1/auth/mfa/email-otp/verify-setup",
      headers: authHeaders(),
      payload: { factorId, code },
    });
    expect(ok.statusCode).toBe(200);
    // Replay the same code → no active challenge anymore → rejected.
    const replay = await app.app.inject({
      method: "POST",
      url: "/v1/auth/mfa/email-otp/verify-setup",
      headers: authHeaders(),
      payload: { factorId, code },
    });
    expect(replay.statusCode).toBe(401);
    expect(replay.json().error?.code).toBe("MFA_OTP_INVALID");
  });

  it("max-attempts lockout: 5 wrong codes then the challenge is invalidated (MFA_OTP_LOCKED)", async () => {
    const { factorId, code } = await enrollEmailOtp();
    // 5 wrong attempts (attempt budget = 5). The 5th flips to locked.
    let lastCode = "";
    for (let i = 0; i < 5; i++) {
      const r = await app.app.inject({
        method: "POST",
        url: "/v1/auth/mfa/email-otp/verify-setup",
        headers: authHeaders(),
        payload: { factorId, code: "111111" },
      });
      lastCode = r.json().error?.code as string;
      expect(r.statusCode).toBe(401);
    }
    // By the 5th attempt the challenge is locked.
    expect(lastCode).toBe("MFA_OTP_LOCKED");
    // Even the CORRECT code now fails — the challenge was invalidated.
    const afterLock = await app.app.inject({
      method: "POST",
      url: "/v1/auth/mfa/email-otp/verify-setup",
      headers: authHeaders(),
      payload: { factorId, code },
    });
    expect(afterLock.statusCode).toBe(401);
    expect(afterLock.json().error?.code).toBe("MFA_OTP_INVALID");
  });

  it("login step-up: EMAIL_OTP-enrolled user gets mfa_required, code emailed, step-2 succeeds", async () => {
    // Enroll + verify so the user has an ACTIVE EMAIL_OTP factor.
    const { factorId, code } = await enrollEmailOtp();
    const setup = await app.app.inject({
      method: "POST",
      url: "/v1/auth/mfa/email-otp/verify-setup",
      headers: authHeaders(),
      payload: { factorId, code },
    });
    expect(setup.statusCode).toBe(200);

    // Step 1: password only → mfa_required + EMAIL_OTP available, NO cookies.
    app.mailer.clear();
    const step1 = await app.app.inject({
      method: "POST",
      url: "/v1/auth/login",
      payload: { email: OTP_EMAIL, password: OTP_PASSWORD },
    });
    expect(step1.statusCode).toBe(200);
    const j1 = step1.json() as { status: string; challengeToken: string; availableKinds: string[] };
    expect(j1.status).toBe("mfa_required");
    expect(j1.availableKinds).toContain("EMAIL_OTP");
    expect(step1.cookies.map((c) => c.name)).not.toContain(COOKIES.ACCESS);
    // A LOGIN-purpose code was emailed at challenge-begin.
    const loginCode = app.mailer.lastOtpCode();
    expect(loginCode).toMatch(/^\d{6}$/);
    expect(app.mailer.sentOtps.at(-1)?.purpose).toBe("LOGIN");

    // Step 2: wrong code → 401 MFA_OTP_INVALID (challenge re-minted each step-1).
    const step1b = await app.app.inject({
      method: "POST",
      url: "/v1/auth/login",
      payload: { email: OTP_EMAIL, password: OTP_PASSWORD },
    });
    const tok2 = (step1b.json() as { challengeToken: string }).challengeToken;
    const wrong = await app.app.inject({
      method: "POST",
      url: "/v1/auth/login",
      payload: { email: OTP_EMAIL, password: OTP_PASSWORD, challengeToken: tok2, mfaCode: "000000" },
    });
    expect(wrong.statusCode).toBe(401);
    expect(wrong.json().error?.code).toBe("MFA_OTP_INVALID");

    // Step 2 with the CORRECT emailed code → success + 3 cookies.
    const step1c = await app.app.inject({
      method: "POST",
      url: "/v1/auth/login",
      payload: { email: OTP_EMAIL, password: OTP_PASSWORD },
    });
    const tok3 = (step1c.json() as { challengeToken: string }).challengeToken;
    const goodCode = app.mailer.lastOtpCode()!;
    const ok = await app.app.inject({
      method: "POST",
      url: "/v1/auth/login",
      payload: { email: OTP_EMAIL, password: OTP_PASSWORD, challengeToken: tok3, mfaCode: goodCode },
    });
    expect(ok.statusCode).toBe(200);
    const okJson = ok.json() as { status: string; user?: { userId: string } };
    expect(okJson.status).toBe("success");
    expect(okJson.user?.userId).toBe(userId);
    const setCookies = ok.cookies.map((c) => c.name);
    expect(setCookies).toContain(COOKIES.ACCESS);
    expect(setCookies).toContain(COOKIES.REFRESH);
    expect(setCookies).toContain(COOKIES.CSRF);
  });

  it("enroll without CSRF token → 403 CSRF_FAIL (state-changing route protected)", async () => {
    const r = await app.app.inject({
      method: "POST",
      url: "/v1/auth/mfa/email-otp/enroll",
      headers: { cookie: ch(cookies), "content-type": "application/json" },
      payload: {},
    });
    expect(r.statusCode).toBe(403);
    expect(r.json().error?.code).toBe("CSRF_FAIL");
  });
});
