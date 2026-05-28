/**
 * apps/api/test/mfa.integration.test.ts
 *
 * MVP-3 Tappa E — TOTP MFA backend integration tests.
 *
 * Live DB: tests assume seeded admin (admin@heuresys.com / Admin#PassW0rd!).
 * Each test cleans the user's MFA factors at start so re-runs are deterministic.
 */

import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import * as OTPAuth from "otpauth";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { pool, closePool } from "../src/db/client.js";

const ADMIN_EMAIL = "admin@heuresys.com";
const ADMIN_PASSWORD = "Admin#PassW0rd!";

interface Bundle {
  cookies: Map<string, string>;
  csrf: string;
  userId: string;
}

function cookieHeader(cookies: Map<string, string>): string {
  return [...cookies.entries()].map(([n, v]) => `${n}=${v}`).join("; ");
}

async function loginAdmin(t: TestApp): Promise<Bundle> {
  const r = await t.app.inject({
    method: "POST",
    url: "/v1/auth/login",
    payload: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  expect(r.statusCode).toBe(200);
  const cookies = new Map<string, string>();
  for (const c of r.cookies) cookies.set(c.name, c.value);
  const body = r.json() as { user: { userId: string }; csrfToken: string };
  return { cookies, csrf: body.csrfToken, userId: body.user.userId };
}

describe("/v1/auth/mfa/* integration", () => {
  let suiteApp: TestApp;
  let adminUserId: string;

  beforeAll(async () => {
    suiteApp = await buildTestApp();
    // Resolve the admin's userId once.
    const r = await pool.query<{ user_id: string }>(
      `SELECT user_id FROM sys.sys_users WHERE user_email = $1`,
      [ADMIN_EMAIL],
    );
    adminUserId = r.rows[0]!.user_id;
  });

  beforeEach(async () => {
    // Clean slate per test.
    await pool.query(
      `DELETE FROM sys.sys_auth_mfa_factors WHERE auth_mfa_factor_user_id = $1`,
      [adminUserId],
    );
  });

  afterAll(async () => {
    await pool.query(
      `DELETE FROM sys.sys_auth_mfa_factors WHERE auth_mfa_factor_user_id = $1`,
      [adminUserId],
    );
    await suiteApp.app.close();
    await closePool();
  });

  it("POST /enroll returns factorId + otpauth URI + base32 secret, verified=false", async () => {
    const bundle = await loginAdmin(suiteApp);
    const resp = await suiteApp.app.inject({
      method: "POST",
      url: "/v1/auth/mfa/enroll",
      headers: {
        cookie: cookieHeader(bundle.cookies),
        "x-csrf-token": bundle.csrf,
        "content-type": "application/json",
      },
      payload: {},
    });
    expect(resp.statusCode).toBe(201);
    const body = resp.json() as {
      factorId: string;
      kind: string;
      otpauthUri: string;
      secret: string;
      verified: false;
    };
    expect(body.kind).toBe("TOTP");
    expect(body.verified).toBe(false);
    expect(body.factorId).toMatch(/^[0-9a-f-]{36}$/i);
    expect(body.otpauthUri).toMatch(/^otpauth:\/\/totp\/Heuresys:/);
    expect(body.secret).toMatch(/^[A-Z2-7]{16,}$/); // base32
  });

  it("POST /verify-setup with a correct TOTP code marks the factor verified", async () => {
    const bundle = await loginAdmin(suiteApp);
    const enroll = await suiteApp.app.inject({
      method: "POST",
      url: "/v1/auth/mfa/enroll",
      headers: {
        cookie: cookieHeader(bundle.cookies),
        "x-csrf-token": bundle.csrf,
        "content-type": "application/json",
      },
      payload: {},
    });
    const { factorId, secret } = enroll.json() as { factorId: string; secret: string };

    // Compute the current TOTP from the secret returned at enrollment.
    const totp = new OTPAuth.TOTP({
      issuer: "Heuresys",
      secret: OTPAuth.Secret.fromBase32(secret),
      digits: 6,
      period: 30,
      algorithm: "SHA1",
    });
    const code = totp.generate();

    const verify = await suiteApp.app.inject({
      method: "POST",
      url: "/v1/auth/mfa/verify-setup",
      headers: {
        cookie: cookieHeader(bundle.cookies),
        "x-csrf-token": bundle.csrf,
        "content-type": "application/json",
      },
      payload: { factorId, code },
    });
    expect(verify.statusCode).toBe(200);
    const body = verify.json() as { factorId: string; verified: true };
    expect(body.verified).toBe(true);
  });

  it("POST /verify-setup with a wrong TOTP code returns 401 MFA_TOTP_INVALID", async () => {
    const bundle = await loginAdmin(suiteApp);
    const enroll = await suiteApp.app.inject({
      method: "POST",
      url: "/v1/auth/mfa/enroll",
      headers: {
        cookie: cookieHeader(bundle.cookies),
        "x-csrf-token": bundle.csrf,
        "content-type": "application/json",
      },
      payload: {},
    });
    const { factorId } = enroll.json() as { factorId: string };
    const verify = await suiteApp.app.inject({
      method: "POST",
      url: "/v1/auth/mfa/verify-setup",
      headers: {
        cookie: cookieHeader(bundle.cookies),
        "x-csrf-token": bundle.csrf,
        "content-type": "application/json",
      },
      payload: { factorId, code: "000000" },
    });
    expect(verify.statusCode).toBe(401);
    const body = verify.json() as { error: { code: string } };
    expect(body.error.code).toBe("MFA_TOTP_INVALID");
  });

  it("GET /factors lists all factors for the current user, with verified status", async () => {
    const bundle = await loginAdmin(suiteApp);
    // Enroll one factor (not verified yet)
    const e1 = await suiteApp.app.inject({
      method: "POST",
      url: "/v1/auth/mfa/enroll",
      headers: {
        cookie: cookieHeader(bundle.cookies),
        "x-csrf-token": bundle.csrf,
        "content-type": "application/json",
      },
      payload: {},
    });
    expect(e1.statusCode).toBe(201);
    const factor1 = e1.json() as { factorId: string };

    const list = await suiteApp.app.inject({
      method: "GET",
      url: "/v1/auth/mfa/factors",
      headers: { cookie: cookieHeader(bundle.cookies) },
    });
    expect(list.statusCode).toBe(200);
    const body = list.json() as {
      items: Array<{ factorId: string; kind: string; verified: boolean }>;
      total: number;
    };
    expect(body.total).toBe(1);
    expect(body.items[0]!.factorId).toBe(factor1.factorId);
    expect(body.items[0]!.kind).toBe("TOTP");
    expect(body.items[0]!.verified).toBe(false);
  });

  it("DELETE /factors/:factorId removes the user's factor and 404 on a cross-user one", async () => {
    const bundle = await loginAdmin(suiteApp);
    const enroll = await suiteApp.app.inject({
      method: "POST",
      url: "/v1/auth/mfa/enroll",
      headers: {
        cookie: cookieHeader(bundle.cookies),
        "x-csrf-token": bundle.csrf,
        "content-type": "application/json",
      },
      payload: {},
    });
    const { factorId } = enroll.json() as { factorId: string };

    const del = await suiteApp.app.inject({
      method: "DELETE",
      url: `/v1/auth/mfa/factors/${factorId}`,
      headers: {
        cookie: cookieHeader(bundle.cookies),
        "x-csrf-token": bundle.csrf,
      },
    });
    expect(del.statusCode).toBe(204);

    // Cross-user: a different (valid v4 uuid, non-existent) factorId returns 404.
    // NB: must be a version-valid UUID — zod 4's z.uuid() is RFC-strict and
    // rejects non-versioned UUIDs (e.g. all-zero version nibble) with a 400.
    const cross = await suiteApp.app.inject({
      method: "DELETE",
      url: `/v1/auth/mfa/factors/00000000-0000-4000-8000-000000000123`,
      headers: {
        cookie: cookieHeader(bundle.cookies),
        "x-csrf-token": bundle.csrf,
      },
    });
    expect(cross.statusCode).toBe(404);
  });

  it("POST /verify-login with a junk challenge token returns 401", async () => {
    const resp = await suiteApp.app.inject({
      method: "POST",
      url: "/v1/auth/mfa/verify-login",
      headers: { "content-type": "application/json" },
      payload: { challengeToken: "deadbeef".repeat(8), code: "123456" },
    });
    expect(resp.statusCode).toBe(401);
    const body = resp.json() as { error: { code: string } };
    expect(body.error.code).toBe("MFA_CHALLENGE_INVALID");
  });
});
