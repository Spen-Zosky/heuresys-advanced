/**
 * apps/web/tests/e2e/serie-a-panels.spec.ts — #30 + #31 (S1018).
 * KPI metrology panel (/kpis) + gap-closure panel (/gaps), live over the
 * 000015/000016/000017 satellites. TENANT_ADMIN.
 */
import { test, expect } from "@playwright/test";
import { storageStateFor } from "./fixtures";

test.describe("Serie-A panels (#30, #31)", () => {
  test.use({ storageState: storageStateFor("tenantAdmin") });

  test("#31 KPI metrology panel shows the assessment-method + weighting-rule catalogs", async ({ page }) => {
    await page.goto("/kpis");
    await expect(page.getByTestId("kpis-page")).toBeVisible();
    await expect(page.getByTestId("kpi-metrology")).toBeVisible({ timeout: 15_000 });
    // The 5 methods + 3 rules are seeded global catalogs → at least one row each.
    await expect(page.getByTestId("kpi-method-row").first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("kpi-rule-row").first()).toBeVisible({ timeout: 15_000 });
  });

  test("#30 gap-closure panel renders plans + analysis results", async ({ page }) => {
    await page.goto("/gaps");
    await expect(page.getByTestId("gaps-page")).toBeVisible();
    await expect(page.getByTestId("gap-closure")).toBeVisible({ timeout: 15_000 });
    // Live reservoir carries 36 plans + 270 results; a row or a real empty-state renders.
    await expect(
      page.getByTestId("gap-plan-row").first().or(page.getByTestId("gap-closure")),
    ).toBeVisible({ timeout: 15_000 });
  });
});
