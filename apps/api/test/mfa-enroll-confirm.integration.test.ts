/**
 * apps/api/test/mfa-enroll-confirm.integration.test.ts
 * TOFU v2 (MVP-4 §2.5, mig 000108): out-of-band email confirmation on the FIRST
 * self-owned factor enrollment + "new MFA method added" notice + audit event.
 * Uses buildTestApp({ enrollConfirm: "on" }) — the default test mode is "off"
 * (pre-v2 behaviour), so only this suite exercises the confirm flow.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import * as OTPAuth from "otpauth";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { pool } from "../src/db/client.js";

const TOTP_USER = "paolo.caputo@rtl-bank.org";
const EMAIL_USER = "tommaso.fiore@rtl-bank.org";
const PWD = "Admin#PassW0rd!";

interface Session { cookies: Map<string, string>; csrf: string; userId: string }
const ch = (c: Map<string, string>) => [...c.entries()].map(([n, v]) => `${n}=${v}`).join("; ");

async function login(t: TestApp, email: string): Promise<Session> {
  const r = await t.app.inject({ method: "POST", url: "/v1/auth/login", payload: { email, password: PWD } });
  if (r.statusCode !== 200) throw new Error(`login ${email}: ${r.statusCode} ${r.body}`);
  const cookies = new Map<string, string>();
  for (const c of r.cookies) cookies.set(c.name, c.value);
  const body = r.json() as { csrfToken: string; user: { userId: string } };
  return { cookies, csrf: body.csrfToken, userId: body.user.userId };
}

function totpCode(secretBase32: string): string {
  return new OTPAuth.TOTP({
    issuer: "Heuresys",
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secretBase32),
  }).generate();
}

async function cleanupFactors(email: string): Promise<void> {
  await pool.query(
    `DELETE FROM sys.sys_auth_mfa_factors
      WHERE auth_mfa_factor_user_id = (SELECT user_id FROM sys.sys_users WHERE lower(user_email) = $1)`,
    [email],
  );
}

async function factorVerified(factorId: string): Promise<boolean | null> {
  const { rows } = await pool.query<{ v: boolean }>(
    `SELECT auth_mfa_factor_verified AS v FROM sys.sys_auth_mfa_factors WHERE auth_mfa_factor_id = $1`,
    [factorId],
  );
  return rows[0]?.v ?? null;
}

describe("MFA enroll-confirm (TOFU v2, mode ON)", () => {
  let suite: TestApp;
  let s: Session;

  beforeAll(async () => {
    suite = await buildTestApp({ enrollConfirm: "on" });
    await cleanupFactors(TOTP_USER);
    await cleanupFactors(EMAIL_USER);
    s = await login(suite, TOTP_USER);
  });

  afterAll(async () => {
    await cleanupFactors(TOTP_USER);
    await cleanupFactors(EMAIL_USER);
    await suite.app.close();
  });

  it("first TOTP factor: possession proof -> confirm_required (factor stays unverified, code emailed CONFIRM_ENROLL)", async () => {
    const enroll = await suite.app.inject({
      method: "POST", url: "/v1/auth/mfa/enroll",
      headers: { cookie: ch(s.cookies), "x-csrf-token": s.csrf, "content-type": "application/json" },
      payload: {},
    });
    expect(enroll.statusCode).toBe(201);
    const { factorId, secret } = enroll.json() as { factorId: string; secret: string };

    const verify = await suite.app.inject({
      method: "POST", url: "/v1/auth/mfa/verify-setup",
      headers: { cookie: ch(s.cookies), "x-csrf-token": s.csrf, "content-type": "application/json" },
      payload: { factorId, code: totpCode(secret) },
    });
    expect(verify.statusCode).toBe(200);
    const out = verify.json() as { verified: boolean; confirmRequired?: boolean; emailHint?: string };
    expect(out.verified).toBe(false);
    expect(out.confirmRequired).toBe(true);
    expect(out.emailHint).toContain("@");
    // factor is NOT verified yet
    expect(await factorVerified(factorId)).toBe(false);
    // the confirmation code went out via email with the dedicated purpose
    const last = suite.mailer.sentOtps[suite.mailer.sentOtps.length - 1];
    expect(last?.purpose).toBe("CONFIRM_ENROLL");
    expect(last?.code).toMatch(/^\d{6}$/);

    // wrong confirm code -> 401, factor still unverified
    const wrong = last!.code === "000000" ? "000001" : "000000";
    const bad = await suite.app.inject({
      method: "POST", url: "/v1/auth/mfa/enroll-confirm",
      headers: { cookie: ch(s.cookies), "x-csrf-token": s.csrf, "content-type": "application/json" },
      payload: { factorId, code: wrong },
    });
    expect(bad.statusCode).toBe(401);
    expect(await factorVerified(factorId)).toBe(false);

    // resend within the 30s cooldown -> 429
    const resend = await suite.app.inject({
      method: "POST", url: "/v1/auth/mfa/enroll-confirm/resend",
      headers: { cookie: ch(s.cookies), "x-csrf-token": s.csrf, "content-type": "application/json" },
      payload: { factorId },
    });
    expect(resend.statusCode).toBe(429);

    // correct confirm code -> verified + notice + audit event
    const noticesBefore = suite.mailer.sentNotices.length;
    const ok = await suite.app.inject({
      method: "POST", url: "/v1/auth/mfa/enroll-confirm",
      headers: { cookie: ch(s.cookies), "x-csrf-token": s.csrf, "content-type": "application/json" },
      payload: { factorId, code: last!.code },
    });
    expect(ok.statusCode).toBe(200);
    expect((ok.json() as { verified: boolean }).verified).toBe(true);
    expect(await factorVerified(factorId)).toBe(true);
    expect(suite.mailer.sentNotices.length).toBe(noticesBefore + 1);
    expect(suite.mailer.sentNotices[suite.mailer.sentNotices.length - 1]?.kind).toBe("TOTP");
    const ev = await pool.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM sys.sys_auth_login_events
        WHERE auth_login_event_user_id = $1 AND auth_login_event_type = 'MFA_FACTOR_ENROLLED'`,
      [s.userId],
    );
    expect(ev.rows[0]!.n).toBeGreaterThanOrEqual(1);

    // replay of the consumed confirm code -> 401 (single-use; factor already verified -> 400 path)
    const replay = await suite.app.inject({
      method: "POST", url: "/v1/auth/mfa/enroll-confirm",
      headers: { cookie: ch(s.cookies), "x-csrf-token": s.csrf, "content-type": "application/json" },
      payload: { factorId, code: last!.code },
    });
    expect([400, 401]).toContain(replay.statusCode);
  });

  it("second factor: no confirm required (immediate verified + notice)", async () => {
    // paolo now has one verified factor (from the test above) -> not the first.
    const enroll = await suite.app.inject({
      method: "POST", url: "/v1/auth/mfa/enroll",
      headers: { cookie: ch(s.cookies), "x-csrf-token": s.csrf, "content-type": "application/json" },
      payload: {},
    });
    expect(enroll.statusCode).toBe(201);
    const { factorId, secret } = enroll.json() as { factorId: string; secret: string };
    const noticesBefore = suite.mailer.sentNotices.length;
    const verify = await suite.app.inject({
      method: "POST", url: "/v1/auth/mfa/verify-setup",
      headers: { cookie: ch(s.cookies), "x-csrf-token": s.csrf, "content-type": "application/json" },
      payload: { factorId, code: totpCode(secret) },
    });
    expect(verify.statusCode).toBe(200);
    expect((verify.json() as { verified: boolean }).verified).toBe(true);
    expect(await factorVerified(factorId)).toBe(true);
    expect(suite.mailer.sentNotices.length).toBe(noticesBefore + 1);
  });

  it("EMAIL_OTP first factor: already out-of-band -> verified directly, no extra confirm", async () => {
    const s2 = await login(suite, EMAIL_USER);
    const enroll = await suite.app.inject({
      method: "POST", url: "/v1/auth/mfa/email-otp/enroll",
      headers: { cookie: ch(s2.cookies), "x-csrf-token": s2.csrf, "content-type": "application/json" },
      payload: {},
    });
    expect(enroll.statusCode).toBe(201);
    const { factorId } = enroll.json() as { factorId: string };
    const code = suite.mailer.lastOtpCode()!;
    const verify = await suite.app.inject({
      method: "POST", url: "/v1/auth/mfa/email-otp/verify-setup",
      headers: { cookie: ch(s2.cookies), "x-csrf-token": s2.csrf, "content-type": "application/json" },
      payload: { factorId, code },
    });
    expect(verify.statusCode).toBe(200);
    expect((verify.json() as { verified: boolean }).verified).toBe(true);
    expect(await factorVerified(factorId)).toBe(true);
  });
});
