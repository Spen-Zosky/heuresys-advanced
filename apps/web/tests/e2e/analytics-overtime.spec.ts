/**
 * apps/web/tests/e2e/analytics-overtime.spec.ts
 *
 * Live-data E2E for /analytics/overtime (BI analytics P2 extension, capability #1).
 *
 * Doctrine: LIVE DATA E2E ONLY — no mock, no fixture, no hardcoded number.
 * The headline request count and the scope badge are asserted against the SAME
 * live GET /v1/analytics/overtime payload the page itself fetches at runtime, so
 * the UI values are verified against the real API response, not constants.
 *
 * Persona: platformAdmin (enzo.spenuso@heuresys.com → PLATFORM scope). `analytics:view`
 * is granted to the admin roles by migration 000057. Auth is the persisted
 * storageState from auth.setup.ts (no inline login).
 */

import { test, expect, type APIRequestContext } from "@playwright/test";
import { storageStateFor } from "./fixtures";

import type { OvertimeAnalyticsResponse } from "@heuresys/shared";

test.use({ storageState: storageStateFor("platformAdmin") });

async function fetchOvertime(request: APIRequestContext): Promise<OvertimeAnalyticsResponse> {
  const res = await request.get("/api/v1/analytics/overtime");
  expect(res.ok(), `GET /api/v1/analytics/overtime → HTTP ${res.status()}`).toBeTruthy();
  return (await res.json()) as OvertimeAnalyticsResponse;
}

test.describe("BI P2 /analytics/overtime — live data (PLATFORM scope)", () => {
  test("renders request stats + status/type/monthly/OU charts fed by the live API", async ({
    page,
    request,
  }) => {
    // 1. Learn the real numbers straight from the live API (no fabricated value).
    const api = await fetchOvertime(request);
    expect(typeof api.totalRequests).toBe("number");
    expect(api.byStatus.length).toBeGreaterThan(0);
    expect(api.byType.length).toBeGreaterThan(0);
    expect(api.monthly.length).toBeGreaterThan(0);
    expect(api.byOrgUnit.length).toBeGreaterThan(0);

    // 2. Navigate to the page under test.
    await page.goto("/analytics/overtime");
    await expect(page.getByTestId("analytics-overtime-page")).toBeVisible({ timeout: 30_000 });

    // 3. Scope badge reflects the scope the API returned.
    await expect(page.getByTestId("analytics-overtime-scope")).toContainText(api.scope.kind);

    // 4. LIVE-DATA assertion: the total-requests stat the page renders MUST match the
    //    live API number. The count-up animation and any thousands-separator are
    //    tolerated by polling + stripping non-digits before comparing.
    const expectedRequests = String(api.totalRequests);
    await expect(async () => {
      const txt = (await page.getByTestId("overtime-total-requests").innerText()).replace(/\D/g, "");
      expect(txt).toContain(expectedRequests);
    }).toPass({ timeout: 15_000 });

    // 5. All four EChartsCard canvases render (status donut + type bar + monthly line + OU bar).
    for (const testid of [
      "analytics-overtime-status-chart",
      "analytics-overtime-type-chart",
      "analytics-overtime-monthly-chart",
      "analytics-overtime-ou-chart",
    ]) {
      const card = page.getByTestId(testid);
      await expect(card).toBeVisible({ timeout: 15_000 });
      await expect(card.locator("canvas").first()).toBeVisible({ timeout: 15_000 });
    }
  });
});
