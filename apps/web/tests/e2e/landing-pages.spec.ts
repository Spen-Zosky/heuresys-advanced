/**
 * apps/web/tests/e2e/landing-pages.spec.ts
 *
 * Live-data E2E for the post-login landing pages: /me (ESS) and /dashboard
 * (admin). Both consume real /v1 endpoints against the OCI VM DB.
 */

import { test, expect } from "@playwright/test";
import { loginAs } from "./fixtures";

test.describe("MVP-2a landing pages — live data", () => {
  test("/me renders for employee_test with role + greeting + cards + pure-USER nav", async ({ page }) => {
    await loginAs(page, "employee");
    await expect(page).toHaveURL(/\/me$/);

    await expect(page.getByTestId("me-page")).toBeVisible();
    await expect(page.getByTestId("me-email")).toContainText("employee_test@rtl-bank.test");
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

  test("/dashboard as TENANT_ADMIN shows TENANT scope, counters, and admin nav", async ({ page }) => {
    await loginAs(page, "tenantAdmin");
    await expect(page).toHaveURL(/\/dashboard$/);

    // Wait for the global nav to mount first (proves the layout finished
    // its useCurrentUser fetch and role gating). Then check page content.
    await expect(page.getByTestId("nav-dashboard")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("nav-users")).toBeVisible();
    await expect(page.getByTestId("nav-positions")).toBeVisible();
    await expect(page.getByTestId("nav-me")).toBeVisible();

    await expect(page.getByTestId("dashboard-page")).toBeVisible();
    await expect(page.getByTestId("dashboard-title")).toBeVisible();
    await expect(page.getByTestId("dashboard-scope")).toContainText("TENANT");
    await expect(page.getByTestId("counter-users")).toBeVisible();
    await expect(page.getByTestId("counter-positions")).toBeVisible();

    // TENANT_ADMIN doesn't have cross-tenant counter.
    await expect(page.getByTestId("counter-tenants")).toHaveCount(0);
  });

  test("/dashboard as PLATFORM_ADMIN shows PLATFORM scope + tenants counter", async ({ page }) => {
    await loginAs(page, "platformAdmin");
    await expect(page).toHaveURL(/\/dashboard$/);

    await expect(page.getByTestId("dashboard-scope")).toContainText("PLATFORM");
    await expect(page.getByTestId("counter-tenants")).toBeVisible();
  });
});
