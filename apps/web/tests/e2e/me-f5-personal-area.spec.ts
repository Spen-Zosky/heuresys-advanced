/**
 * apps/web/tests/e2e/me-f5-personal-area.spec.ts
 *
 * Live-data E2E for the F5 Personal-area completion pages (S1011):
 *   /me/analytics  — attendance trend chart + KPI summary (tommaso has real data)
 *   /me/org-chart  — personal org-chart highlighting own node (RTL ORG_CHART graph)
 *   /me/approvals  — own approval requests, honest empty-state (0 requests)
 */
import { test, expect } from "@playwright/test";
import { storageStateFor } from "./fixtures";

test.use({ storageState: storageStateFor("employee") });

test.describe("/me F5 personal area — live data", () => {
  test("/me/analytics renders the KPI summary + attendance trend", async ({ page }) => {
    await page.goto("/me/analytics");
    await expect(page.getByTestId("me-analytics-page")).toBeVisible();
    await expect(page.getByTestId("analytics-summary")).toBeVisible();
    await expect(page.getByTestId("analytics-kpi-goals")).toBeVisible();
    await expect(page.getByTestId("analytics-trend")).toBeVisible(); // tommaso has attendance
  });

  test("/me/org-chart renders the org graph with the caller's node", async ({ page }) => {
    await page.goto("/me/org-chart");
    await expect(page.getByTestId("me-org-chart-page")).toBeVisible();
    await expect(page.getByTestId("me-org-chart-badge")).toBeVisible();
    await expect(page.getByTestId("me-org-chart-graph")).toBeVisible(); // RTL ORG_CHART graph has nodes
  });

  test("/me/approvals renders the status stats + honest empty-state", async ({ page }) => {
    await page.goto("/me/approvals");
    await expect(page.getByTestId("me-approvals-page")).toBeVisible();
    await expect(page.getByTestId("approvals-stats")).toBeVisible();
    await expect(page.getByTestId("approvals-stat-pending")).toBeVisible();
    await expect(page.getByTestId("me-approvals-empty")).toBeVisible(); // no requests yet → real empty-state
  });
});
