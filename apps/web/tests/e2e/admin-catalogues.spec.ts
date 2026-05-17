/**
 * apps/web/tests/e2e/admin-catalogues.spec.ts
 *
 * Live-data E2E for admin catalogue pages: /skills, /kpis, /learning, /tenants.
 * Uses storageState — tenantAdmin for skills/kpis/learning (visible via
 * global+tenant filter), platformAdmin for /tenants (PLATFORM_ADMIN-only).
 */

import { test, expect } from "@playwright/test";
import { storageStateFor } from "./fixtures";

test.describe("MVP-2a admin catalogues — live data", () => {
  test.describe("as tenantAdmin", () => {
    test.use({ storageState: storageStateFor("tenantAdmin") });

    test("/skills shows catalogue with rows", async ({ page }) => {
      await page.goto("/skills");
      await expect(page.getByTestId("skills-page")).toBeVisible();
      await expect(page.getByTestId("skills-count")).toContainText(/\d+\s+skill/);
    });

    test("/kpis shows KPI definitions", async ({ page }) => {
      await page.goto("/kpis");
      await expect(page.getByTestId("kpis-page")).toBeVisible();
      await expect(page.getByTestId("kpis-count")).toContainText(/\d+\s+KPI/);
    });

    test("/learning shows learning modules catalogue", async ({ page }) => {
      await page.goto("/learning");
      await expect(page.getByTestId("learning-page")).toBeVisible();
      await expect(page.getByTestId("learning-count")).toContainText(/\d+\s+moduli/);
    });
  });

  test.describe("as platformAdmin", () => {
    test.use({ storageState: storageStateFor("platformAdmin") });

    test("/tenants shows the tenant registry", async ({ page }) => {
      await page.goto("/tenants");
      await expect(page.getByTestId("tenants-page")).toBeVisible();
      await expect(page.getByTestId("tenants-count")).toContainText(/\d+\s+totali/);
    });
  });
});
