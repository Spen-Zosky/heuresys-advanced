/**
 * apps/web/tests/e2e/landing-pages.spec.ts
 *
 * Live-data E2E for the post-login landing pages: /me (ESS) and /dashboard
 * (admin). Uses storageState produced by auth.setup.ts so individual tests
 * don't re-hit /v1/auth/login (rate-limited 10 per 5 min).
 */

import { test, expect } from "@playwright/test";
import { storageStateFor } from "./fixtures";

test.describe("MVP-2a landing pages — live data", () => {
  // S1043: la persona `employee` e' oggi responsabile di filiale (TEAM_LEADER), quindi
  // ATTERRA sul cruscotto. Continua pero' a non vedere la navigazione di
  // amministrazione, perche' quella e' riservata a un insieme piu' stretto
  // (PLATFORM_ADMIN/TENANT_ADMIN/MANAGER/…), e TEAM_LEADER non vi appartiene. Le due
  // cose non coincidono, ed e' proprio questa distinzione che il test difende.
  test.describe("as employee (TEAM_LEADER, senza navigazione di amministrazione)", () => {
    test.use({ storageState: storageStateFor("employee") });

    test("/me renders with role + greeting + cards + no admin nav", async ({ page }) => {
      await page.goto("/me");
      await expect(page).toHaveURL(/\/me$/);

      await expect(page.getByTestId("me-page")).toBeVisible();
      await expect(page.getByTestId("me-email")).toContainText("tommaso.fiore@rtl-bank.org");
      await expect(page.getByTestId("me-roles")).toContainText("USER");
      await expect(page.getByTestId("me-card-primary-position")).toBeVisible();
      await expect(page.getByTestId("me-card-learning")).toBeVisible();
      await expect(page.getByTestId("me-card-gaps")).toBeVisible();
      await expect(page.getByTestId("me-learning-count")).toContainText(/\d+\s+assegnati/);
      await expect(page.getByTestId("me-gaps-count")).toContainText(/\d+\s+aperti/);

      // Non vede la navigazione di amministrazione: TEAM_LEADER non e un ruolo di classe admin.
      await expect(page.getByTestId("nav-me")).toBeVisible();
      await expect(page.getByTestId("nav-dashboard")).toHaveCount(0);
      await expect(page.getByTestId("nav-users")).toHaveCount(0);
    });
  });

  test.describe("as tenantAdmin", () => {
    test.use({ storageState: storageStateFor("tenantAdmin") });

    test("/dashboard shows TENANT scope, counters, and admin nav", async ({ page }) => {
      await page.goto("/dashboard");

      await expect(page.getByTestId("nav-dashboard")).toBeVisible({ timeout: 15_000 });
      await expect(page.getByTestId("nav-users")).toBeVisible();
      await expect(page.getByTestId("nav-positions")).toBeVisible();
      await expect(page.getByTestId("nav-me")).toBeVisible();

      await expect(page.getByTestId("dashboard-page")).toBeVisible();
      await expect(page.getByTestId("dashboard-title")).toBeVisible();
      await expect(page.getByTestId("dashboard-scope")).toContainText("TENANT");
      await expect(page.getByTestId("counter-users")).toBeVisible();
      await expect(page.getByTestId("counter-positions")).toBeVisible();
      await expect(page.getByTestId("counter-tenants")).toHaveCount(0);
    });
  });

  test.describe("as platformAdmin", () => {
    test.use({ storageState: storageStateFor("platformAdmin") });

    test("/dashboard shows PLATFORM scope + tenants counter", async ({ page }) => {
      await page.goto("/dashboard");
      await expect(page.getByTestId("dashboard-scope")).toContainText("PLATFORM");
      await expect(page.getByTestId("counter-tenants")).toBeVisible();
    });
  });
});
