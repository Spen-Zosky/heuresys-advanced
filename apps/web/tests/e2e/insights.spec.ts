/**
 * apps/web/tests/e2e/insights.spec.ts
 *
 * cap③ data-mining · P1b — LIVE DATA E2E for the /insights flight-risk page.
 * A PLATFORM_ADMIN loads the page; the table is fed by GET /v1/insights/flight-risk
 * (live sys_flight_risk_scores, already populated). Asserts the page count matches
 * the live API total, rows render, and the per-feature explainability panel opens.
 * The recompute button (insights:admin) is asserted present but NOT clicked — it
 * would re-score the whole tenant (covered by the API integration test instead).
 */

import { test, expect } from "@playwright/test";
import { storageStateFor } from "./fixtures";

test.describe.configure({ retries: 1 });

test.describe("cap③ insights /insights flight-risk — live data", () => {
  test.use({ storageState: storageStateFor("platformAdmin") });

  test("renders live flight-risk scores + per-feature explainability", async ({ page }) => {
    const resp = await page.request.get("/api/v1/insights/flight-risk");
    expect(resp.ok()).toBeTruthy();
    const body = (await resp.json()) as { items: unknown[]; total: number };
    expect(body.items.length).toBeGreaterThan(0);

    await page.goto("/insights", { waitUntil: "domcontentloaded", timeout: 60_000 });
    await expect(page.getByTestId("insights-page")).toBeVisible({ timeout: 45_000 });

    // the page count reflects the live API total
    await expect(page.getByTestId("insights-count")).toContainText(String(body.total));

    // rows render; admin recompute control present (not clicked — it re-scores everyone)
    await expect(page.getByTestId("insights-row").first()).toBeVisible();
    await expect(page.getByTestId("insights-recompute")).toBeVisible();

    // open the top subject's explainability → multiple feature contributions
    await page.getByTestId("insights-row-select").first().click();
    await expect(page.getByTestId("insights-explain")).toBeVisible();
    await expect(page.getByTestId("insights-feature").first()).toBeVisible();
    expect(await page.getByTestId("insights-feature").count()).toBeGreaterThan(1);
  });
});
