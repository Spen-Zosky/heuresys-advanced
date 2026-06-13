/**
 * apps/api/test/auth-refresh-cookie.integration.test.ts
 * D-26 regression suite — the refresh cookie MUST live on Path=/ so it
 * survives the prefix-stripping proxies (Next rewrite `/api/:path*` → `/:path*`
 * in dev; nginx → next → same rewrite in PROD). With the original
 * "/v1/auth" scope the browser never attached the cookie to the
 * browser-visible URL /api/v1/auth/refresh: the silent refresh could never
 * fire and every session hard-logged-out at the 15-min access TTL.
 *
 * Also covers two gaps the original auth suite never asserted:
 *   - POST /refresh without the refresh cookie → 401 REFRESH_MISSING;
 *   - logout clears the refresh cookie on BOTH the live path ("/") and the
 *     legacy "/v1/auth" path (pre-D-26 cookies in the wild).
 *
 * Live DB dependency: admin@heuresys.com seeded via `pnpm db:seed-test-admin`.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildTestApp, type TestApp } from "./helpers/build-test-app.js";
import { loginRaw } from "./helpers/login.js";
import { COOKIES } from "../src/config/constants.js";
import {
  REFRESH_COOKIE_PATH,
  LEGACY_REFRESH_COOKIE_PATH,
} from "../src/modules/auth/tokens.js";
import { closePool } from "../src/db/client.js";

const ADMIN_EMAIL = "admin@heuresys.com";
const ADMIN_PASSWORD = "Admin#PassW0rd!";

/** light-my-request parsed Set-Cookie entry (attributes included). */
interface InjectCookie {
  name: string;
  value: string;
  path?: string;
  httpOnly?: boolean;
  sameSite?: string;
  maxAge?: number;
}

let t: TestApp;

describe("D-26 — refresh cookie path / silent-refresh contract", () => {
  beforeAll(async () => {
    t = await buildTestApp();
  });

  afterAll(async () => {
    await t.app.close();
    await closePool();
  });

  it("login issues the refresh cookie on Path=/ (proxy-traversable), HttpOnly, SameSite=Lax", async () => {
    expect(REFRESH_COOKIE_PATH).toBe("/");

    const r = await loginRaw(t.app, ADMIN_EMAIL, ADMIN_PASSWORD);
    const cookies = r.cookies as unknown as InjectCookie[];
    const refresh = cookies.find((c) => c.name === COOKIES.REFRESH);

    expect(refresh).toBeDefined();
    expect(refresh!.value).toBeTruthy();
    expect(refresh!.path).toBe("/");
    expect(refresh!.httpOnly).toBe(true);
    expect(String(refresh!.sameSite).toLowerCase()).toBe("lax");
  });

  it("POST /refresh without the refresh cookie returns 401 REFRESH_MISSING", async () => {
    const login = await loginRaw(t.app, ADMIN_EMAIL, ADMIN_PASSWORD);
    const cookies = login.cookies as unknown as InjectCookie[];
    const csrf = cookies.find((c) => c.name === COOKIES.CSRF)!.value;

    const resp = await t.app.inject({
      method: "POST",
      url: "/v1/auth/refresh",
      headers: {
        cookie: `${COOKIES.CSRF}=${csrf}`,
        "x-csrf-token": csrf,
        "content-type": "application/json",
      },
      payload: {},
    });

    expect(resp.statusCode).toBe(401);
    const body = resp.json() as { error: { code: string } };
    expect(body.error.code).toBe("REFRESH_MISSING");
  });

  it("logout clears the refresh cookie on BOTH the live and the legacy path", async () => {
    const login = await loginRaw(t.app, ADMIN_EMAIL, ADMIN_PASSWORD);
    const cookies = login.cookies as unknown as InjectCookie[];
    const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join("; ");
    const csrf = cookies.find((c) => c.name === COOKIES.CSRF)!.value;

    const resp = await t.app.inject({
      method: "POST",
      url: "/v1/auth/logout",
      headers: {
        cookie: cookieHeader,
        "x-csrf-token": csrf,
        "content-type": "application/json",
      },
      payload: {},
    });
    expect(resp.statusCode).toBe(204);

    const cleared = (resp.cookies as unknown as InjectCookie[]).filter(
      (c) => c.name === COOKIES.REFRESH,
    );
    expect(cleared).toHaveLength(2);
    const clearedPaths = new Set(cleared.map((c) => c.path));
    expect(clearedPaths).toEqual(new Set([REFRESH_COOKIE_PATH, LEGACY_REFRESH_COOKIE_PATH]));
    for (const c of cleared) {
      expect(c.value).toBe("");
    }
  });
});
