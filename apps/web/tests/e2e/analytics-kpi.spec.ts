/**
 * apps/web/tests/e2e/analytics-kpi.spec.ts
 *
 * Live-data E2E for /analytics/kpi (BI analytics P1b, capability #1 phase 1).
 *
 * Doctrine: LIVE DATA E2E ONLY. The headline number (kpi-total-targets) is read
 * from the real GET /v1/analytics/kpi endpoint (via the Next.js /api proxy using
 * the persisted authenticated context) and asserted to match what the page renders
 * — proving the cell is fed by a live /v1/* call hitting the OCI VM PostgreSQL, not
 * a mock/fixture/placeholder. The KPI achievement gauge/chart must render.
 *
 * Auth: reuses the persisted storageState produced once by auth.setup.ts. We use
 * tenantAdmin (federica.marchetti@rtl-bank.org) — analytics:view is granted to the
 * admin roles by migration 000057.
 */

import { test, expect } from "@playwright/test";
import { storageStateFor, gotoAuthenticated } from "./fixtures";

test.use({ storageState: storageStateFor("tenantAdmin") });

test.describe("BI analytics — KPI (live data)", () => {
  test("/analytics/kpi renders live total targets + achievement gauge", async ({ page }) => {
    // 1. Learn the authoritative number from the real endpoint, via the page's
    //    authenticated context through the Next.js /api proxy (same pattern as
    //    me-preferences.spec.ts → page.request.get("/api/v1/me/preferences")).
    const apiResp = await page.request.get("/api/v1/analytics/kpi");
    expect(apiResp.status()).toBe(200);
    const api = (await apiResp.json()) as { totalTargets: number };
    expect(typeof api.totalTargets).toBe("number");

    // 2. Navigate to the page (gotoAuthenticated tolerates cold next-dev compiles
    //    of the deep authenticated route).
    await gotoAuthenticated(page, "/analytics/kpi");

    // 3. Page shell rendered (not the /login redirect).
    await expect(page.getByTestId("analytics-kpi-page")).toBeVisible();

    // 4. The headline stat is fed by the live API — assert the rendered number
    //    matches what the endpoint returned (proves no mock/placeholder).
    await expect(page.getByTestId("kpi-total-targets")).toContainText(String(api.totalTargets));

    // 5. The KPI achievement gauge/chart renders (RadialGauge/LinearGauge or
    //    EChartsCard, depending on the page composition).
    await expect(page.getByTestId("analytics-kpi-chart")).toBeVisible();
  });
});
