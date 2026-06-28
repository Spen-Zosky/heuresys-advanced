/**
 * apps/web/tests/e2e/me-myhr-tabs.spec.ts
 *
 * S1010 F3a — the My HR (/me) sub-tab IA: Riepilogo | Performance | Presenze.
 * Performance + Presenze are read-only consultation of data already in the DB
 * (sys_performance_reviews / sys_attendance / sys_time_off_balances, from the
 * rebuild). LIVE assertions for the employee persona (tommaso.fiore). No mocks.
 */

import { test, expect } from "@playwright/test";
import { storageStateFor } from "./fixtures";

test.use({ storageState: storageStateFor("employee") });

test.describe("/me (My HR) sub-tabs — live data", () => {
  test("Riepilogo default, then Performance + Presenze", async ({ page }) => {
    await page.goto("/me");
    await expect(page.getByTestId("me-page")).toBeVisible();
    // default tab = Riepilogo (the original landing content)
    await expect(page.getByTestId("myhr-summary")).toBeVisible();
    await expect(page.getByTestId("me-greeting")).toBeVisible();

    // Performance sub-tab — real review rating
    await page.getByTestId("myhr-tab-performance").click();
    await expect(page.getByTestId("myhr-performance")).toBeVisible();
    await expect(page.getByTestId("perf-overall")).not.toBeEmpty();
    await expect(page).toHaveURL(/[?&]tab=performance/);

    // Presenze sub-tab — leave balances + recent attendance
    await page.getByTestId("myhr-tab-presenze").click();
    await expect(page.getByTestId("myhr-attendance")).toBeVisible();
    await expect(page.getByTestId("att-balances")).toBeVisible();
  });
});
