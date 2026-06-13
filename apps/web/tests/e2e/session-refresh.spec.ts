/**
 * apps/web/tests/e2e/session-refresh.spec.ts
 * D-26 — a session MUST survive access-token expiry via silent refresh.
 *
 * Uses a FRESH UI login (own refresh-token family) instead of the shared
 * storageState personas: refresh rotation is single-use, and refreshing from
 * a shared tests/.auth/*.json would rotate the token under every other spec
 * (a later context presenting the stale token = replay → family revoked).
 *
 * Access-TTL expiry is simulated by dropping ONLY the hrx_access cookie —
 * exactly the state the browser reaches when the cookie's 15-min maxAge
 * elapses (expired cookies are not sent and are evicted).
 *
 * Proves, end-to-end:
 *   1. full navigation with an expired access token passes the middleware
 *      (resumable session: hrx_refresh now on Path=/), the page's parallel
 *      queries collapse into EXACTLY ONE successful POST /api/v1/auth/refresh
 *      (single-flight — two concurrent POSTs would be a replay and revoke
 *      the family), and the app renders authenticated with a fresh
 *      hrx_access — no /login hard-redirect;
 *   2. a second expiry recovered through the client-side navigation path
 *      (apiFetch 401 → refresh → retry) — sequential rotations stay valid.
 *
 * The "no cookies at all → /login redirect" guard stays covered by
 * auth.spec.ts (middleware negative path) — not duplicated here.
 *
 * Rate-limit note: adds 1 login POST per run (cap 10/5min per IP; escape
 * hatch AUTH_LOGIN_RATELIMIT_MAX in the API .env).
 */

import { test, expect, type BrowserContext } from "@playwright/test";
import { loginAs } from "./fixtures";

// Fresh, persona-independent context: no shared storageState.
test.use({ storageState: { cookies: [], origins: [] } });

/** Drop ONLY hrx_access — the browser-equivalent of the 15-min TTL elapsing. */
async function dropAccessCookie(context: BrowserContext): Promise<void> {
  const cookies = await context.cookies();
  await context.clearCookies();
  await context.addCookies(cookies.filter((c) => c.name !== "hrx_access"));
}

test("D-26: access expiry recovers via single silent refresh, no hard-logout", async ({
  page,
  context,
}) => {
  const refreshStatuses: number[] = [];
  page.on("response", (res) => {
    if (res.request().method() === "POST" && res.url().includes("/api/v1/auth/refresh")) {
      refreshStatuses.push(res.status());
    }
  });
  const okRefreshes = () => refreshStatuses.filter((s) => s === 200).length;

  await loginAs(page, "platformAdmin");

  // The D-26 invariant itself: the refresh cookie must be host-wide.
  const refreshCookie = (await context.cookies()).find((c) => c.name === "hrx_refresh");
  expect(refreshCookie, "hrx_refresh cookie must exist after login").toBeTruthy();
  expect(refreshCookie!.path).toBe("/");

  // --- 1. Full navigation with expired access (middleware + recovery path) ---
  await dropAccessCookie(context);
  await page.goto("/dashboard", { waitUntil: "domcontentloaded", timeout: 60_000 });
  // Authenticated shell rendered = middleware let the resumable session
  // through AND the silent refresh recovered the data layer.
  await page.getByTestId("nav-me").waitFor({ state: "visible", timeout: 45_000 });
  expect(page.url()).not.toContain("/login");

  await expect.poll(okRefreshes, { timeout: 15_000 }).toBeGreaterThanOrEqual(1);
  await page.waitForTimeout(1_000); // settle: late parallel queries would surface extra POSTs
  expect(okRefreshes(), "parallel queries must collapse into ONE refresh (single-flight)").toBe(1);
  expect(
    refreshStatuses.every((s) => s === 200),
    `no refresh may fail/replay (statuses: ${refreshStatuses.join(",")})`,
  ).toBe(true);
  expect(
    (await context.cookies()).some((c) => c.name === "hrx_access"),
    "a fresh hrx_access must be re-minted by the refresh",
  ).toBe(true);

  // --- 2. Second expiry, client-side navigation (apiFetch 401 → refresh → retry) ---
  await dropAccessCookie(context);
  await page.getByTestId("nav-me").click();
  await page.waitForURL("**/me**", { timeout: 45_000 });

  await expect.poll(okRefreshes, { timeout: 15_000 }).toBeGreaterThanOrEqual(2);
  await page.waitForTimeout(1_000);
  expect(okRefreshes(), "second recovery must also be a single refresh").toBe(2);
  expect(refreshStatuses.every((s) => s === 200)).toBe(true);
  expect(page.url()).not.toContain("/login");
});
