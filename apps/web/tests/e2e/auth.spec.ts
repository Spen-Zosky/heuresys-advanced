/**
 * apps/web/tests/e2e/auth.spec.ts
 *
 * Live-data E2E for the login pilot. Real seed credentials, real API,
 * real DB on the OCI VM via the SSH tunnel on :5433. No mocks.
 *
 * Asserts:
 *   1. PLATFORM_ADMIN login → cookies set + redirect /dashboard.
 *   2. Pure USER login → redirect /me.
 *   3. Wrong password → 401 → error message visible, no redirect.
 *   4. Direct /dashboard access without session → middleware redirects /login.
 */

import { test, expect } from "@playwright/test";
import { PERSONAS, passwordFor, completeMfaIfChallenged, fillLoginForm } from "./fixtures";

test.describe("MVP-2a /login pilot — live data", () => {
  test("PLATFORM_ADMIN login lands on /dashboard, sets HttpOnly access cookie", async ({ page, context }) => {
    await page.goto("/login");
    await expect(page.getByTestId("login-title")).toBeVisible();

    await fillLoginForm(page, PERSONAS.platformAdmin.email, passwordFor(PERSONAS.platformAdmin.email));

    const [loginResp] = await Promise.all([
      page.waitForResponse(
        (r) => r.url().includes("/v1/auth/login") && r.request().method() === "POST",
      ),
      page.getByTestId("login-submit").click(),
    ]);

    expect(loginResp.status()).toBe(200);
    let body = await loginResp.json();
    if (body.status === "mfa_required") {
      // S983 WS-E: under the live mandatory policy the first response is the
      // challenge — the SECOND login response carries the success bundle.
      const [resp2] = await Promise.all([
        page.waitForResponse(
          (r) => r.url().includes("/v1/auth/login") && r.request().method() === "POST",
        ),
        completeMfaIfChallenged(page, PERSONAS.platformAdmin.email),
      ]);
      expect(resp2.status()).toBe(200);
      body = await resp2.json();
    }
    expect(body.user.email).toBe(PERSONAS.platformAdmin.email);
    expect(typeof body.csrfToken).toBe("string");
    expect(body.csrfToken.length).toBeGreaterThan(20);

    await page.waitForURL("**/dashboard");

    const cookies = await context.cookies();
    const access = cookies.find((c) => c.name === "hrx_access");
    expect(access).toBeDefined();
    expect(access!.httpOnly).toBe(true);
    const csrf = cookies.find((c) => c.name === "hrx_csrf");
    expect(csrf).toBeDefined();
    expect(csrf!.httpOnly).toBe(false);
  });

  // [S1045] L'atterraggio NON è più scritto qui: si legge dal fixture, che è la sola
  // fonte. Era cablato `**/me` e la mig 000272 lo ha smentito — `tommaso.fiore` è
  // `BRANCH_MANAGER`, ha `dashboard:view` e atterra sul cruscotto. L'atterraggio
  // segue il PERMESSO (S1044 #116), quindi un percorso scritto a mano qui è destinato
  // a mentire alla prossima decisione: questa riga ora la segue da sé.
  test("il login della persona `employee` atterra dove il fixture dichiara", async ({ page }) => {
    await page.goto("/login");
    await fillLoginForm(page, PERSONAS.employee.email, passwordFor(PERSONAS.employee.email));
    await page.getByTestId("login-submit").click();
    await completeMfaIfChallenged(page, PERSONAS.employee.email);
    await page.waitForURL(`**${PERSONAS.employee.expectedLandingPath}`);
  });

  test("wrong password shows error message, stays on /login", async ({ page }) => {
    await page.goto("/login");
    await fillLoginForm(page, PERSONAS.platformAdmin.email, "wrong-password-x");

    const [loginResp] = await Promise.all([
      page.waitForResponse(
        (r) => r.url().includes("/v1/auth/login") && r.request().method() === "POST",
      ),
      page.getByTestId("login-submit").click(),
    ]);

    expect(loginResp.status()).toBe(401);
    await expect(page.getByTestId("login-error")).toBeVisible();
    expect(page.url()).toContain("/login");
  });

  test("middleware redirects /dashboard without session to /login?next=/dashboard", async ({ page, context }) => {
    await context.clearCookies();
    await page.goto("/dashboard");
    await page.waitForURL((url) => url.pathname === "/login");
    expect(page.url()).toMatch(/[?&]next=%2Fdashboard/);
  });
});
