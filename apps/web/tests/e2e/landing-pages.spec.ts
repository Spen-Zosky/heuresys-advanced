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
  test.describe("as employee (pure USER)", () => {
    test.use({ storageState: storageStateFor("employee") });

    test("/me renders with role + greeting + cards + pure-USER nav", async ({ page }) => {
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

      // Pure USER must NOT see admin nav links.
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
