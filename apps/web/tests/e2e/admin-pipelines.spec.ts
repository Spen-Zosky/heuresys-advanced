/**
 * apps/web/tests/e2e/admin-pipelines.spec.ts
 *
 * Live-data E2E for /seed-acquisition/runs, /brownfield-adaptation, /gaps.
 * tenantAdmin storage for all (PLATFORM_ADMIN required only for cross-tenant
 * brownfield approvals which we don't exercise here).
 */

import { test, expect } from "@playwright/test";
import { storageStateFor } from "./fixtures";

test.use({ storageState: storageStateFor("tenantAdmin") });

test.describe("MVP-2a pipelines — live data", () => {
  test("/seed-acquisition/runs renders run list (empty state OK)", async ({ page }) => {
    await page.goto("/seed-acquisition/runs");
    await expect(page.getByTestId("seed-runs-page")).toBeVisible();
    await expect(page.getByTestId("seed-runs-count")).toContainText(/\d+\s+run/);
  });

  test("/brownfield-adaptation switches across 3 tabs", async ({ page }) => {
    await page.goto("/brownfield-adaptation");
    await expect(page.getByTestId("brownfield-page")).toBeVisible();
    await expect(page.getByTestId("brownfield-content-inventory")).toBeVisible();

    await page.getByTestId("brownfield-tab-mapping").click();
    await expect(page.getByTestId("brownfield-content-mapping")).toBeVisible();

    await page.getByTestId("brownfield-tab-runs").click();
    await expect(page.getByTestId("brownfield-content-runs")).toBeVisible();
  });

  test("/gaps shows severity summary and full list", async ({ page }) => {
    await page.goto("/gaps");
    await expect(page.getByTestId("gaps-page")).toBeVisible();
    await expect(page.getByTestId("gaps-count")).toContainText(/\d+\s+gap/);
    // 4 severity counter cards always render.
    await expect(page.getByTestId("gaps-severity-CRITICAL")).toBeVisible();
    await expect(page.getByTestId("gaps-severity-HIGH")).toBeVisible();
    await expect(page.getByTestId("gaps-severity-MEDIUM")).toBeVisible();
    await expect(page.getByTestId("gaps-severity-LOW")).toBeVisible();
  });
});
