/**
 * apps/api/test/auth.integration.test.ts
 * Integration tests for the /v1/auth/* module. Uses Fastify's app.inject()
 * (no socket) so tests run fast and deterministically.
 *
 * Live DB dependency: tests assume the test-admin (admin@heuresys.com /
 * <TEST_ADMIN_PASSWORD>) has been seeded via `pnpm db:seed-test-admin`.
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { createHash } from "node:crypto";
import { Writable } from "node:stream";
import pino from "pino";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { totpFor } from "./helpers/login.js";
import { LOG_REDACT_PATHS } from "../src/app.js";
import { pool, closePool } from "../src/db/client.js";
import { COOKIES } from "../src/config/constants.js";
import { createAuthService } from "../src/modules/auth/service.js";
import { InMemoryMailer } from "../src/modules/auth/mailer.js";
import { sharedEmailRateLimiter } from "../src/modules/auth/email-rate-limit.js";
import { TEST_PERSONA_PASSWORD } from "./helpers/personas.js";

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

const ADMIN_EMAIL = "admin@heuresys.com";
const ADMIN_PASSWORD = TEST_PERSONA_PASSWORD;

interface LoginBundle {
  status: number;
  body: { user: { userId: string; email: string }; roles: string[]; csrfToken: string };
  cookies: Map<string, string>;
}

function cookieHeader(cookies: Map<string, string>, names?: string[]): string {
  const entries = names
    ? names.map((n) => [n, cookies.get(n)] as const).filter((p) => p[1] !== undefined)
    : [...cookies.entries()];
  return entries.map(([n, v]) => `${n}=${v}`).join("; ");
}

async function performLogin(t: TestApp, email = ADMIN_EMAIL, password = ADMIN_PASSWORD): Promise<LoginBundle> {
  // Dual-mode (S983 WS-E): SUCCESS paths complete the TOTP step-2 when the
  // live mandatory policy challenges the fixture persona; FAILURE paths
  // (wrong creds → 401/429) surface the RAW first response untouched.
  let resp = await t.app.inject({
    method: "POST",
    url: "/v1/auth/login",
    payload: { email, password },
  });
  if (resp.statusCode === 200) {
    const b = resp.json() as { status?: string; challengeToken?: string };
    if (b.status === "mfa_required") {
      resp = await t.app.inject({
        method: "POST",
        url: "/v1/auth/login",
        payload: { email, password, challengeToken: b.challengeToken, mfaCode: totpFor(email) },
      });
    }
  }
  const cookies = new Map<string, string>();
  for (const c of resp.cookies) cookies.set(c.name, c.value);
  return { status: resp.statusCode, body: resp.json() as LoginBundle["body"], cookies };
}

let suiteApp: TestApp;

describe("/v1/auth/* integration", () => {
  beforeAll(async () => {
    suiteApp = await buildTestApp();
  });

  afterEach(async () => {
    // We can keep a single app for the whole suite — each request is
    // isolated and rate-limit counters are per-instance.
    // The per-email rate limiter is a module singleton, so we reset it
    // between tests to keep them order-independent.
    sharedEmailRateLimiter.reset();
  });

  afterAll(async () => {
    await suiteApp.app.close();
    await closePool();
  });

  /* -------------------------------------------------- login */

  it("POST /login with valid credentials returns 200 + 3 cookies + body", async () => {
    const result = await performLogin(suiteApp);
    expect(result.status).toBe(200);
    expect(result.body.user.email).toBe(ADMIN_EMAIL);
    expect(result.body.user.userId).toMatch(/^[0-9a-f-]{36}$/i);
    expect(result.body.roles).toContain("PLATFORM_ADMIN");
    expect(result.body.csrfToken).toMatch(/^[A-Za-z0-9_-]{20,}$/);
    expect(result.cookies.get(COOKIES.ACCESS)).toBeTruthy();
    expect(result.cookies.get(COOKIES.REFRESH)).toBeTruthy();
    expect(result.cookies.get(COOKIES.CSRF)).toBeTruthy();
    expect(result.cookies.get(COOKIES.CSRF)).toBe(result.body.csrfToken);
  });

  it("POST /login with unknown email returns 401 LOGIN_INVALID", async () => {
    const result = await performLogin(suiteApp, "nobody@nowhere.test", ADMIN_PASSWORD);
    expect(result.status).toBe(401);
    const body = result.body as unknown as { error: { code: string } };
    expect(body.error.code).toBe("LOGIN_INVALID");
  });

  it("POST /login with wrong password returns 401 LOGIN_INVALID", async () => {
    const result = await performLogin(suiteApp, ADMIN_EMAIL, "WrongPassword#9!");
    expect(result.status).toBe(401);
    const body = result.body as unknown as { error: { code: string } };
    expect(body.error.code).toBe("LOGIN_INVALID");
  });

  it("POST /login with malformed body returns 400 VALIDATION_ERROR", async () => {
    const resp = await suiteApp.app.inject({
      method: "POST",
      url: "/v1/auth/login",
      payload: { email: "not-an-email", password: "" },
    });
    expect(resp.statusCode).toBe(400);
    const body = resp.json() as { error: { code: string } };
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  /* -------------------------------------------------- /me */

  it("GET /me without cookie returns 401", async () => {
    const resp = await suiteApp.app.inject({ method: "GET", url: "/v1/auth/me" });
    expect(resp.statusCode).toBe(401);
    const body = resp.json() as { error: { code: string } };
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  it("GET /me with valid access cookie returns user payload (tenantId NULL for platform admin)", async () => {
    const login = await performLogin(suiteApp);
    const resp = await suiteApp.app.inject({
      method: "GET",
      url: "/v1/auth/me",
      headers: { cookie: cookieHeader(login.cookies, [COOKIES.ACCESS]) },
    });
    expect(resp.statusCode).toBe(200);
    const body = resp.json() as {
      userId: string;
      email: string;
      roles: string[];
      tenantId: string | null;
    };
    expect(body.email).toBe(ADMIN_EMAIL);
    expect(body.roles).toContain("PLATFORM_ADMIN");
    expect(body.tenantId).toBeNull();
  });

  /* -------------------------------------------------- refresh */

  it("POST /refresh with valid refresh + CSRF rotates tokens", async () => {
    const login = await performLogin(suiteApp);
    const resp = await suiteApp.app.inject({
      method: "POST",
      url: "/v1/auth/refresh",
      headers: {
        cookie: cookieHeader(login.cookies, [COOKIES.REFRESH, COOKIES.CSRF]),
        "x-csrf-token": login.body.csrfToken,
        "content-type": "application/json",
      },
      payload: {},
    });
    expect(resp.statusCode).toBe(200);
    const cookies = new Map<string, string>();
    for (const c of resp.cookies) cookies.set(c.name, c.value);
    const newRefresh = cookies.get(COOKIES.REFRESH);
    const newAccess = cookies.get(COOKIES.ACCESS);
    expect(newRefresh).toBeTruthy();
    expect(newAccess).toBeTruthy();
    expect(newRefresh).not.toBe(login.cookies.get(COOKIES.REFRESH));
    expect(newAccess).not.toBe(login.cookies.get(COOKIES.ACCESS));
  });

  it("POST /refresh replay (token presented twice) returns 401 + revokes the family", async () => {
    const login = await performLogin(suiteApp);
    const originalRefresh = login.cookies.get(COOKIES.REFRESH)!;
    const csrfHeader = { "x-csrf-token": login.body.csrfToken };

    // First refresh: succeeds.
    const first = await suiteApp.app.inject({
      method: "POST",
      url: "/v1/auth/refresh",
      headers: {
        cookie: cookieHeader(login.cookies, [COOKIES.REFRESH, COOKIES.CSRF]),
        ...csrfHeader,
        "content-type": "application/json",
      },
      payload: {},
    });
    expect(first.statusCode).toBe(200);

    // Second refresh with the SAME (now-used) token: replay → 401, family revoked.
    const second = await suiteApp.app.inject({
      method: "POST",
      url: "/v1/auth/refresh",
      headers: {
        cookie: cookieHeader(login.cookies, [COOKIES.REFRESH, COOKIES.CSRF]),
        ...csrfHeader,
        "content-type": "application/json",
      },
      payload: {},
    });
    expect(second.statusCode).toBe(401);
    const body = second.json() as { error: { code: string } };
    expect(body.error.code).toBe("REFRESH_REPLAY_DETECTED");

    // Verify the whole family is revoked in DB. SHA-256 the presented refresh
    // token to find its DB row; from there read the family_id; assert all
    // rows in the family are revoked.
    const replayedHash = sha256(originalRefresh);
    const fam = await pool.query<{ family_id: string }>(
      `SELECT auth_refresh_token_family_id AS family_id
         FROM sys.sys_auth_refresh_tokens
        WHERE auth_refresh_token_hash = $1`,
      [replayedHash],
    );
    expect(fam.rows.length).toBe(1);
    const familyId = fam.rows[0]!.family_id;
    const status = await pool.query<{ total: string; revoked: string }>(
      `SELECT count(*) AS total,
              count(*) FILTER (WHERE auth_refresh_token_revoked_at IS NOT NULL) AS revoked
         FROM sys.sys_auth_refresh_tokens
        WHERE auth_refresh_token_family_id = $1`,
      [familyId],
    );
    const total = Number(status.rows[0]!.total);
    const revoked = Number(status.rows[0]!.revoked);
    expect(total).toBeGreaterThanOrEqual(2); // original + rotated
    expect(revoked).toBe(total);              // ALL revoked
  });

  /* -------------------------------------------------- logout */

  it("POST /logout with valid CSRF returns 204 + clears cookies + revokes family", async () => {
    const login = await performLogin(suiteApp);
    const resp = await suiteApp.app.inject({
      method: "POST",
      url: "/v1/auth/logout",
      headers: {
        cookie: cookieHeader(login.cookies),
        "x-csrf-token": login.body.csrfToken,
        "content-type": "application/json",
      },
      payload: {},
    });
    expect(resp.statusCode).toBe(204);

    // Cookies cleared (Set-Cookie with empty value + expires in past).
    const cleared = new Set(resp.cookies.map((c) => c.name));
    expect(cleared.has(COOKIES.ACCESS)).toBe(true);
    expect(cleared.has(COOKIES.REFRESH)).toBe(true);
    expect(cleared.has(COOKIES.CSRF)).toBe(true);

    // Family revoked in DB.
    const refresh = login.cookies.get(COOKIES.REFRESH)!;
    const hash = sha256(refresh);
    const row = await pool.query<{ family_id: string; revoked_at: Date | null }>(
      `SELECT auth_refresh_token_family_id AS family_id,
              auth_refresh_token_revoked_at AS revoked_at
         FROM sys.sys_auth_refresh_tokens
        WHERE auth_refresh_token_hash = $1`,
      [hash],
    );
    expect(row.rows[0]?.revoked_at).not.toBeNull();
  });

  it("POST /logout without CSRF header returns 403 CSRF_FAIL", async () => {
    const login = await performLogin(suiteApp);
    const resp = await suiteApp.app.inject({
      method: "POST",
      url: "/v1/auth/logout",
      headers: {
        cookie: cookieHeader(login.cookies),
        "content-type": "application/json",
      },
      payload: {},
    });
    expect(resp.statusCode).toBe(403);
    const body = resp.json() as { error: { code: string } };
    expect(body.error.code).toBe("CSRF_FAIL");
  });

  /* -------------------------------------------------- password reset */

  it("POST /password-reset/request triggers mailer + always returns 204", async () => {
    // Known existing user
    const r1 = await suiteApp.app.inject({
      method: "POST",
      url: "/v1/auth/password-reset/request",
      payload: { email: ADMIN_EMAIL },
    });
    expect(r1.statusCode).toBe(204);
    expect(suiteApp.mailer.sent.length).toBeGreaterThanOrEqual(1);
    const last = suiteApp.mailer.sent[suiteApp.mailer.sent.length - 1]!;
    expect(last.toEmail).toBe(ADMIN_EMAIL);
    expect(last.resetUrl).toMatch(/\/reset\?token=[A-Za-z0-9_-]+$/);

    // Unknown email: still 204, mailer not called.
    const beforeUnknown = suiteApp.mailer.sent.length;
    const r2 = await suiteApp.app.inject({
      method: "POST",
      url: "/v1/auth/password-reset/request",
      payload: { email: "nobody@nowhere.test" },
    });
    expect(r2.statusCode).toBe(204);
    expect(suiteApp.mailer.sent.length).toBe(beforeUnknown);
  });

  /* -------------------------------------------------- admin revoke */

  it("POST /admin/revoke-user as PLATFORM_ADMIN returns 204 + writes REVOKED_BY_ADMIN audit", async () => {
    // Pick a real non-persona RTL_BANK user as the target (synthetic users no longer exist post-rebuild).
    const targetRow = await pool.query<{ user_id: string }>(
      `SELECT user_id FROM sys.sys_users
        WHERE split_part(user_email, '@', 2) = 'rtl-bank.org'
          AND lower(user_email) NOT IN (
            'federica.marchetti@rtl-bank.org','paolo.caputo@rtl-bank.org',
            'tommaso.fiore@rtl-bank.org','antonio.parisi@rtl-bank.org')
        ORDER BY user_id LIMIT 1`,
    );
    expect(targetRow.rows.length).toBe(1);
    const targetUserId = targetRow.rows[0]!.user_id;

    const beforeCount = Number(
      (
        await pool.query<{ c: string }>(
          `SELECT count(*)::text AS c FROM sys.sys_auth_login_events
            WHERE auth_login_event_user_id = $1
              AND auth_login_event_type = 'REVOKED_BY_ADMIN'`,
          [targetUserId],
        )
      ).rows[0]!.c,
    );

    const login = await performLogin(suiteApp);
    const resp = await suiteApp.app.inject({
      method: "POST",
      url: `/v1/auth/admin/revoke-user/${targetUserId}`,
      headers: {
        cookie: cookieHeader(login.cookies),
        "x-csrf-token": login.body.csrfToken,
        "content-type": "application/json",
      },
      payload: {},
    });
    expect(resp.statusCode).toBe(204);

    const afterCount = Number(
      (
        await pool.query<{ c: string }>(
          `SELECT count(*)::text AS c FROM sys.sys_auth_login_events
            WHERE auth_login_event_user_id = $1
              AND auth_login_event_type = 'REVOKED_BY_ADMIN'`,
          [targetUserId],
        )
      ).rows[0]!.c,
    );
    expect(afterCount).toBe(beforeCount + 1);
  });

  /* -------------------------------------------------- admin list sessions (Tappa E) */

  it("GET /admin/users/:userId/sessions as PLATFORM_ADMIN returns active families", async () => {
    // Fresh local app: the suiteApp per-IP rate limit on /login is at risk of
    // exhaustion by this point in the suite, and a fresh app keeps this test
    // deterministic.
    const local = await buildTestApp();
    try {
      const adminLogin = await performLogin(local);
      expect(adminLogin.status).toBe(200);
      const adminUserId = adminLogin.body.user.userId;

      const resp = await local.app.inject({
        method: "GET",
        url: `/v1/auth/admin/users/${adminUserId}/sessions`,
        headers: { cookie: cookieHeader(adminLogin.cookies) },
      });
      expect(resp.statusCode).toBe(200);

    const body = resp.json() as {
      items: Array<{
        familyId: string;
        tenantId: string;
        firstIssuedAt: string;
        lastIssuedAt: string;
        expiresAt: string;
        ip: string | null;
        userAgent: string | null;
      }>;
      total: number;
    };
      expect(body.total).toBeGreaterThanOrEqual(1);
      expect(body.items.length).toBe(body.total);
      expect(body.items[0]!.familyId).toMatch(/^[0-9a-f-]{36}$/i);
      expect(body.items[0]!.tenantId).toMatch(/^[0-9a-f-]{36}$/i);
      // ISO 8601 datetime
      expect(body.items[0]!.firstIssuedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    } finally {
      await local.app.close();
    }
  });

  it("GET /admin/users/:userId/sessions without auth returns 401", async () => {
    const targetRow = await pool.query<{ user_id: string }>(
      `SELECT user_id FROM sys.sys_users LIMIT 1`,
    );
    const targetUserId = targetRow.rows[0]!.user_id;

    const resp = await suiteApp.app.inject({
      method: "GET",
      url: `/v1/auth/admin/users/${targetUserId}/sessions`,
    });
    expect(resp.statusCode).toBe(401);
  });

  it("adminListSessions unit: TENANT_ADMIN cannot list sessions outside own tenant", async () => {
    const mailer = new InMemoryMailer();
    const service = createAuthService({
      jwtSign: () => Promise.resolve("dummy"),
      mailer,
      log: suiteApp.app.log,
    });

    // Pick a target user from a different tenant than the actor.
    const target = await pool.query<{ user_id: string; user_tenant_id: string }>(
      `SELECT user_id, user_tenant_id FROM sys.sys_users
        WHERE user_tenant_id IS NOT NULL
        ORDER BY user_id LIMIT 1`,
    );
    expect(target.rows.length).toBe(1);
    const targetUserId = target.rows[0]!.user_id;
    const targetTenantId = target.rows[0]!.user_tenant_id;

    // Other-tenant TENANT_ADMIN actor (any UUID not equal to targetTenantId).
    const otherTenant = "00000000-0000-0000-0000-000000000999";
    expect(otherTenant).not.toBe(targetTenantId);

    await expect(
      service.adminListSessions({
        actorUserId: "00000000-0000-0000-0000-000000000001",
        actorTenantId: otherTenant,
        actorRoles: ["TENANT_ADMIN"],
        targetUserId,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("adminRevokeUser unit: TENANT_ADMIN cannot revoke a user outside its tenant", async () => {
    // Use the seeded admin user as the cross-tenant target (anchored to
    // RTL_BANK_REFERENCE tenant in sys_users).
    const adminRow = await pool.query<{ user_id: string; user_tenant_id: string }>(
      `SELECT user_id, user_tenant_id FROM sys.sys_users
        WHERE user_email = $1 LIMIT 1`,
      ["admin@heuresys.com"],
    );
    expect(adminRow.rows.length).toBe(1);
    const target = adminRow.rows[0]!;
    const fakeTenantId = "00000000-0000-0000-0000-000000000001";
    expect(target.user_tenant_id).not.toBe(fakeTenantId);

    const noopLogger = {
      warn: () => {},
      info: () => {},
      debug: () => {},
      error: () => {},
      fatal: () => {},
      trace: () => {},
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      child: () => noopLogger as any,
      level: "silent",
    };

    const service = createAuthService({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      log: noopLogger as any,
      mailer: new InMemoryMailer(),
      jwtSign: async () => "noop.jwt.token",
    });

    await expect(
      service.adminRevokeUser({
        actorUserId: "00000000-0000-0000-0000-000000000099",
        actorTenantId: fakeTenantId,
        actorRoles: ["TENANT_ADMIN"],
        targetUserId: target.user_id,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  /* -------------------------------------------------- rate limit */

  it("POST /login per-email rate limit: 6th failed attempt on same email → 429 with Retry-After", async () => {
    // MVP-3 Tappa E: defense vs credential-stuffing — even from a single IP
    // a single email can be brute-forced; per-email limit caps it at 5
    // failures / 5 min regardless of source.
    sharedEmailRateLimiter.reset();
    const local = await buildTestApp();
    try {
      const target = "victim@nowhere.test";
      const statuses: number[] = [];
      for (let i = 0; i < 6; i++) {
        const r = await local.app.inject({
          method: "POST",
          url: "/v1/auth/login",
          payload: { email: target, password: "WrongPass#9!" },
        });
        statuses.push(r.statusCode);
        if (i === 5) {
          // 6th attempt must be 429 + body with code LOGIN_TOO_MANY_ATTEMPTS_FOR_EMAIL
          expect(r.statusCode).toBe(429);
          const body = r.json() as { error: { code: string; message: string } };
          expect(body.error.code).toBe("LOGIN_TOO_MANY_ATTEMPTS_FOR_EMAIL");
          expect(r.headers["retry-after"]).toBeTruthy();
        }
      }
      // First 5 should be 401 (LOGIN_INVALID — unknown email)
      expect(statuses.slice(0, 5).every((s) => s === 401)).toBe(true);
      expect(statuses[5]).toBe(429);
    } finally {
      await local.app.close();
      sharedEmailRateLimiter.reset();
    }
  });

  it("POST /login per-email rate limit resets on successful login", async () => {
    sharedEmailRateLimiter.reset();
    // Fresh local app to isolate from the suiteApp per-IP rate-limit counter.
    const local = await buildTestApp();
    try {
      // 3 failures then 1 success → counter cleared → another failure must
      // get 401 (not 429), proving the per-email lock was lifted by the
      // successful login.
      for (let i = 0; i < 3; i++) {
        const r = await local.app.inject({
          method: "POST",
          url: "/v1/auth/login",
          payload: { email: ADMIN_EMAIL, password: "WrongPass#9!" },
        });
        expect(r.statusCode).toBe(401);
      }
      const ok = await performLogin(local);
      expect(ok.status).toBe(200);
      const fail = await local.app.inject({
        method: "POST",
        url: "/v1/auth/login",
        payload: { email: ADMIN_EMAIL, password: "WrongPass#9!" },
      });
      expect(fail.statusCode).toBe(401);
    } finally {
      await local.app.close();
      sharedEmailRateLimiter.reset();
    }
  });

  it("POST /login is rate-limited (11 attempts → 429)", async () => {
    // Use a fresh app so the rate-limit store doesn't leak into other tests.
    // Pin the per-IP limit to the production default (10): the suite-wide
    // setup lifts AUTH_LOGIN_RATELIMIT_MAX for the mandatory-MFA 2-step
    // logins (S983 WS-E) — this test asserts the limiter itself.
    const prevMax = process.env.AUTH_LOGIN_RATELIMIT_MAX;
    process.env.AUTH_LOGIN_RATELIMIT_MAX = "10";
    const local = await buildTestApp();
    try {
      const statuses: number[] = [];
      for (let i = 0; i < 11; i++) {
        const r = await local.app.inject({
          method: "POST",
          url: "/v1/auth/login",
          payload: {
            email: `nobody${i}@nowhere.test`,
            password: "WhateverPass#9!",
          },
        });
        statuses.push(r.statusCode);
      }
      const unauthorised = statuses.filter((s) => s === 401).length;
      const throttled = statuses.filter((s) => s === 429).length;
      expect(unauthorised).toBe(10);
      expect(throttled).toBe(1);
      expect(statuses[10]).toBe(429);
    } finally {
      if (prevMax === undefined) delete process.env.AUTH_LOGIN_RATELIMIT_MAX;
      else process.env.AUTH_LOGIN_RATELIMIT_MAX = prevMax;
      await local.app.close();
    }
  });

  /* -------------------------------------------------- pino redaction */

  // Fastify does not log request bodies by default, so a full inject() flow
  // can't surface the sentinel via the request logger. We instead validate
  // the redaction *config* at runtime: a pino instance built with our
  // LOG_REDACT_PATHS must redact every shape we declared.
  it("LOG_REDACT_PATHS redact every documented body field", async () => {
    const SENTINEL = "SekretPa$$w0rdInLog!";
    const chunks: string[] = [];
    const collector = new Writable({
      write(chunk, _enc, done) {
        chunks.push(chunk.toString());
        done();
      },
    });

    const logger = pino(
      {
        level: "info",
        redact: { paths: [...LOG_REDACT_PATHS], censor: "[REDACTED]" },
      },
      collector,
    );

    // Each log line exercises one or more paths from LOG_REDACT_PATHS.
    logger.info({ req: { body: { password: SENTINEL } } }, "login attempt");
    logger.info(
      { req: { body: { newPassword: SENTINEL, confirmPassword: SENTINEL } } },
      "reset attempt",
    );
    logger.info(
      { res: { body: { token: SENTINEL, refreshToken: SENTINEL } } },
      "issued tokens",
    );
    logger.info(
      { req: { headers: { cookie: SENTINEL, authorization: SENTINEL } } },
      "incoming headers",
    );
    // Wildcard *.password / *.hash / *.secret — match at any depth.
    logger.info({ inner: { password: SENTINEL, hash: SENTINEL, secret: SENTINEL } }, "wildcard");

    await new Promise((resolve) => setTimeout(resolve, 30));

    const joined = chunks.join("");
    expect(joined.length).toBeGreaterThan(0);

    // The sentinel must never appear anywhere in the output.
    expect(joined.includes(SENTINEL)).toBe(false);

    // Every named path we declared in LOG_REDACT_PATHS triggered redaction
    // at least once → ≥10 [REDACTED] occurrences across the 5 lines above
    // (1 + 2 + 2 + 2 + 3 = 10).
    const redactedCount = (joined.match(/\[REDACTED\]/g) ?? []).length;
    expect(redactedCount).toBeGreaterThanOrEqual(10);
  });
});
