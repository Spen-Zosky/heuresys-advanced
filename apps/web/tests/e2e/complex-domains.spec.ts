/**
 * apps/web/tests/e2e/complex-domains.spec.ts
 *
 * Live-data E2E for /career-succession and /compensation-intelligence.
 * tenantAdmin storage (compensation_intelligence:read + career_succession
 * permissions both granted to TENANT_ADMIN by seed).
 */

import { test, expect } from "@playwright/test";
import { storageStateFor } from "./fixtures";

test.use({ storageState: storageStateFor("tenantAdmin") });

test.describe("MVP-2a complex domains — live data", () => {
  test("/career-succession switches across 3 tabs", async ({ page }) => {
    await page.goto("/career-succession");
    await expect(page.getByTestId("career-page")).toBeVisible();
    await expect(page.getByTestId("career-content-paths")).toBeVisible();

    await page.getByTestId("career-tab-pools").click();
    await expect(page.getByTestId("career-content-pools")).toBeVisible();

    await page.getByTestId("career-tab-candidates").click();
    await expect(page.getByTestId("career-content-candidates")).toBeVisible();
  });

  test("/compensation-intelligence shows 6 status counters", async ({ page }) => {
    await page.goto("/compensation-intelligence");
    await expect(page.getByTestId("compensation-page")).toBeVisible();
    await expect(page.getByTestId("compensation-count")).toContainText(/\d+\s+reward gate/);

    await expect(page.getByTestId("compensation-status-PASSED")).toBeVisible();
    await expect(page.getByTestId("compensation-status-WARNING")).toBeVisible();
    await expect(page.getByTestId("compensation-status-BLOCKED")).toBeVisible();
    await expect(page.getByTestId("compensation-status-PENDING")).toBeVisible();

    // F4: distribution donut (server-side GROUP BY aggregate, echarts via ssr:false boundary)
    await expect(page.getByTestId("compensation-distribution-chart")).toBeVisible();
  });
});
