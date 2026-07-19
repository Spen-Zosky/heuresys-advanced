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

  /**
   * C4 (#42): the severity strip is a SERVER-side aggregate over the whole visible
   * set, while the table below is one server page. Before the fix both came from a
   * single `?limit=200` fetch — the badge showed the real total but the strip
   * counted at most 200 gaps, so the two numbers on this screen contradicted each
   * other for any tenant past 200. Both figures are read live; nothing hardcoded.
   */
  test("/gaps severity counters sum to the real total, not to the fetched page", async ({ page }) => {
    await page.goto("/gaps");
    await expect(page.getByTestId("gaps-page")).toBeVisible();
    await expect(page.getByTestId("gaps-count")).toContainText(/\d+\s+gap/);

    const badge = await page.getByTestId("gaps-count").innerText();
    const total = Number((/(\d[\d.,\s]*)/.exec(badge)?.[1] ?? "0").replace(/[.,\s]/g, ""));

    let summed = 0;
    for (const sev of ["CRITICAL", "HIGH", "MEDIUM", "LOW"]) {
      summed += Number((await page.getByTestId(`gaps-severity-${sev}`).innerText()).trim() || "0");
    }
    expect(summed).toBe(total);

    // And the table is a page of that set, never the whole thing at once.
    const rows = await page.getByTestId("gaps-row").count();
    expect(rows).toBeLessThanOrEqual(total);
  });
});
