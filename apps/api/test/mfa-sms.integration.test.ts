/**
 * apps/api/test/mfa-sms.integration.test.ts
 * SMS_OTP factor (MVP-4 §2.5, code-only slice): enroll -> verify-setup -> login
 * step-up, provider-seam gating (ConsoleSms = not production-capable -> 404).
 * Mirrors the EMAIL_OTP suite shape; uses InMemorySms to assert on sent codes.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { InMemorySms } from "../src/modules/auth/sms-sender.js";
import { pool } from "../src/db/client.js";

const EMAIL = "antonio.parisi@rtl-bank.org";
const PWD = "Admin#PassW0rd!";
const PHONE = "+393331234567";

interface Session { cookies: Map<string, string>; csrf: string; userId: string }
const ch = (c: Map<string, string>) => [...c.entries()].map(([n, v]) => `${n}=${v}`).join("; ");

async function login(t: TestApp): Promise<Session> {
  // Dual-mode (S983 WS-E): with the fixture TOTP factor live the login is a
  // 2-step; loginRaw completes it and returns the full session.
  const r = await loginRaw(t.app, EMAIL, PWD);
  const cookies = new Map<string, string>();
  for (const c of r.cookies) cookies.set(c.name, c.value);
  const body = r.json() as { csrfToken: string; user: { userId: string } };
  return { cookies, csrf: body.csrfToken, userId: body.user.userId };
}

async function cleanupFactors(): Promise<void> {
  await pool.query(
    `DELETE FROM sys.sys_auth_mfa_factors
      WHERE auth_mfa_factor_user_id = (SELECT user_id FROM sys.sys_users WHERE lower(user_email) = $1)
        AND auth_mfa_factor_kind = 'SMS_OTP'`,
    [EMAIL],
  );
}

describe("MFA SMS_OTP (code-only slice)", () => {
  let suite: TestApp;
  let s: Session;

  beforeAll(async () => {
    suite = await buildTestApp();
    await cleanupFactors();
    s = await login(suite);
  });

  afterAll(async () => {
    await cleanupFactors();
    await suite.app.close();
  });

  it("enroll requires CSRF (403 without token)", async () => {
    const r = await suite.app.inject({
      method: "POST", url: "/v1/auth/mfa/sms-otp/enroll",
      headers: { cookie: ch(s.cookies), "content-type": "application/json" },
      payload: { phoneNumber: PHONE },
    });
    expect(r.statusCode).toBe(403);
  });

  it("enroll rejects a non-E.164 phone number (400)", async () => {
    const r = await suite.app.inject({
      method: "POST", url: "/v1/auth/mfa/sms-otp/enroll",
      headers: { cookie: ch(s.cookies), "x-csrf-token": s.csrf, "content-type": "application/json" },
      payload: { phoneNumber: "333 not a phone" },
    });
    expect(r.statusCode).toBe(400);
  });

  it("enroll -> wrong code -> verify-setup with the sent code -> factor verified", async () => {
    const sms = suite.sms as InMemorySms;
    const enroll = await suite.app.inject({
      method: "POST", url: "/v1/auth/mfa/sms-otp/enroll",
      headers: { cookie: ch(s.cookies), "x-csrf-token": s.csrf, "content-type": "application/json" },
      payload: { phoneNumber: PHONE },
    });
    expect(enroll.statusCode).toBe(201);
    const out = enroll.json() as { factorId: string; kind: string; phoneHint: string; verified: boolean };
    expect(out.kind).toBe("SMS_OTP");
    expect(out.verified).toBe(false);
    // hint is masked: never the full number
    expect(out.phoneHint).not.toBe(PHONE);
    expect(out.phoneHint.endsWith(PHONE.slice(-3))).toBe(true);
    // the code went out via the SMS seam (never in the response body)
    expect(JSON.stringify(enroll.json())).not.toContain(sms.lastOtpCode() ?? "@@none@@");
    const code = sms.lastOtpCode();
    expect(code).toMatch(/^\d{6}$/);

    // wrong code -> 401 (attempt counted)
    const wrongCode = code === "000000" ? "000001" : "000000";
    const bad = await suite.app.inject({
      method: "POST", url: "/v1/auth/mfa/sms-otp/verify-setup",
      headers: { cookie: ch(s.cookies), "x-csrf-token": s.csrf, "content-type": "application/json" },
      payload: { factorId: out.factorId, code: wrongCode },
    });
    expect(bad.statusCode).toBe(401);

    // right code -> verified
    const ok = await suite.app.inject({
      method: "POST", url: "/v1/auth/mfa/sms-otp/verify-setup",
      headers: { cookie: ch(s.cookies), "x-csrf-token": s.csrf, "content-type": "application/json" },
      payload: { factorId: out.factorId, code },
    });
    expect(ok.statusCode).toBe(200);
    expect((ok.json() as { verified: boolean }).verified).toBe(true);
  });

  it("resend (enroll) honours the 30s cooldown (429 MFA_OTP_RESEND_COOLDOWN)", async () => {
    const sms = suite.sms as InMemorySms;
    const enroll = await suite.app.inject({
      method: "POST", url: "/v1/auth/mfa/sms-otp/enroll",
      headers: { cookie: ch(s.cookies), "x-csrf-token": s.csrf, "content-type": "application/json" },
      payload: { phoneNumber: PHONE },
    });
    expect(enroll.statusCode).toBe(201);
    const { factorId } = enroll.json() as { factorId: string };
    expect(sms.lastOtpCode()).toMatch(/^\d{6}$/);
    const resend = await suite.app.inject({
      method: "POST", url: "/v1/auth/mfa/sms-otp/resend",
      headers: { cookie: ch(s.cookies), "x-csrf-token": s.csrf, "content-type": "application/json" },
      payload: { factorId },
    });
    expect(resend.statusCode).toBe(429);
    expect((resend.json() as { error: { code: string } }).error.code).toBe("MFA_OTP_RESEND_COOLDOWN");
  });

  it("login step-up: availableKinds includes SMS_OTP, code is pre-sent, verify completes login", async () => {
    const sms = suite.sms as InMemorySms;
    sms.clear();
    const step1 = await suite.app.inject({
      method: "POST", url: "/v1/auth/login", payload: { email: EMAIL, password: PWD },
    });
    expect(step1.statusCode).toBe(200);
    const body = step1.json() as { status: string; challengeToken: string; availableKinds: string[] };
    expect(body.status).toBe("mfa_required");
    expect(body.availableKinds).toContain("SMS_OTP");
    // a login code was pre-sent to the enrolled phone
    const sent = sms.sentOtps[sms.sentOtps.length - 1];
    expect(sent?.purpose).toBe("LOGIN");
    expect(sent?.toPhone).toBe(PHONE);

    const step2 = await suite.app.inject({
      method: "POST", url: "/v1/auth/login",
      payload: { email: EMAIL, password: PWD, challengeToken: body.challengeToken, mfaCode: sms.lastOtpCode() },
    });
    expect(step2.statusCode).toBe(200);
    expect((step2.json() as { status: string }).status).toBe("success");
  });

  it("provider gating: with a non-production-capable sender, enroll -> 404 SMS_NOT_CONFIGURED", async () => {
    const gatedSms = new InMemorySms(false);
    const gated = await buildTestApp({ smsSender: gatedSms });
    try {
      const gs = await (async () => {
        const r = await gated.app.inject({ method: "POST", url: "/v1/auth/login", payload: { email: EMAIL, password: PWD } });
        // user has a verified SMS factor from the flow above -> two-step; complete with the
        // code the GATED app just pre-sent (its own sender instance still records sends).
        const b = r.json() as { status: string; challengeToken?: string };
        if (b.status !== "mfa_required") return r;
        return gated.app.inject({
          method: "POST", url: "/v1/auth/login",
          payload: { email: EMAIL, password: PWD, challengeToken: b.challengeToken, mfaCode: gatedSms.lastOtpCode() },
        });
      })();
      expect(gs.statusCode).toBe(200);
      const cookies = new Map<string, string>();
      for (const c of gs.cookies) cookies.set(c.name, c.value);
      const csrf = (gs.json() as { csrfToken: string }).csrfToken;
      const r = await gated.app.inject({
        method: "POST", url: "/v1/auth/mfa/sms-otp/enroll",
        headers: { cookie: ch(cookies), "x-csrf-token": csrf, "content-type": "application/json" },
        payload: { phoneNumber: PHONE },
      });
      expect(r.statusCode).toBe(404);
      expect((r.json() as { error: { code: string } }).error.code).toBe("SMS_NOT_CONFIGURED");
    } finally {
      await gated.app.close();
    }
  });
});
