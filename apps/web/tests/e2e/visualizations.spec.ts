/**
 * apps/web/tests/e2e/visualizations.spec.ts
 *
 * Live-data E2E for /visualizations and /visualizations/[id]. Seed contains
 * zero visualization graphs by default — both pages exercise the empty-state
 * paths which are still live-API-backed.
 */

import { test, expect } from "@playwright/test";
import { storageStateFor } from "./fixtures";

test.use({ storageState: storageStateFor("tenantAdmin") });

test.describe("MVP-2a visualizations — live data", () => {
  test("/visualizations browser renders (empty state OK)", async ({ page }) => {
    await page.goto("/visualizations");
    await expect(page.getByTestId("visualizations-page")).toBeVisible();
    await expect(page.getByTestId("visualizations-count")).toContainText(/\d+\s+grafici/);
  });

  test("/visualizations/[graphId] handles 404 for non-existent graph", async ({ page }) => {
    await page.goto("/visualizations/00000000-0000-0000-0000-000000000000");
    await expect(page.getByTestId("visualization-error")).toBeVisible({ timeout: 15_000 });
  });
});
