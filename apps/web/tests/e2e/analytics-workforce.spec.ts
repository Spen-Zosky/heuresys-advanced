/**
 * apps/web/tests/e2e/analytics-workforce.spec.ts
 *
 * Live-data E2E for /analytics/workforce (BI analytics P1b, capability #1).
 *
 * Doctrine: LIVE DATA E2E ONLY — no mock, no fixture, no hardcoded number.
 * The headcount assertion is driven by a real GET /v1/analytics/workforce
 * call made through the same-origin Next.js `/api` proxy (the very path the
 * page itself uses at runtime), so the UI value is verified against the live
 * API response — not a constant baked into the test.
 *
 * Persona: platformAdmin (enzo.spenuso@heuresys.com → PLATFORM scope). The
 * `analytics:view` permission is granted to the admin roles by migration
 * 000057. Auth is the persisted storageState produced once by auth.setup.ts;
 * this spec performs no inline login (canonical fixtures pattern).
 */

import { test, expect, type APIRequestContext } from "@playwright/test";
import { storageStateFor } from "./fixtures";

import type { WorkforceAnalyticsResponse } from "@heuresys/shared";

test.use({ storageState: storageStateFor("platformAdmin") });

/**
 * Fetches the live workforce analytics payload through the same-origin
 * Next.js `/api` proxy (mirrors apiFetch's default baseUrl "/api"). The
 * `request` fixture inherits the storageState cookies, so the HttpOnly access
 * token is forwarded exactly as the browser would. baseURL comes from
 * playwright.config.ts so no host/port is hardcoded here.
 */
async function fetchWorkforce(request: APIRequestContext): Promise<WorkforceAnalyticsResponse> {
  const res = await request.get("/api/v1/analytics/workforce");
  expect(res.ok(), `GET /api/v1/analytics/workforce → HTTP ${res.status()}`).toBeTruthy();
  return (await res.json()) as WorkforceAnalyticsResponse;
}

test.describe("BI P1b /analytics/workforce — live data (PLATFORM scope)", () => {
  test("renders headcount + chart fed by the live API number", async ({ page, request }) => {
    // 1. Learn the real headcount straight from the live API (no fabricated value).
    const api = await fetchWorkforce(request);
    expect(typeof api.totalHeadcount).toBe("number");

    // 2. Navigate to the page under test.
    await page.goto("/analytics/workforce");
    await expect(page.getByTestId("analytics-workforce-page")).toBeVisible({ timeout: 30_000 });

    // 3. Scope badge reflects the platform-admin scope returned by the API.
    await expect(page.getByTestId("analytics-workforce-scope")).toContainText(api.scope.kind);

    // 4. LIVE-DATA assertion: the headline headcount the page renders MUST equal
    //    the number the live API returned — not a hardcoded constant. If the page
    //    shipped mock/placeholder data, this would diverge from the API payload.
    await expect(page.getByTestId("workforce-total")).toContainText(
      String(api.totalHeadcount),
    );

    // 5. At least one EChartsCard renders. EChartsCard mounts a <canvas> inside the
    //    org-unit distribution panel; assert both the panel testid and a real canvas.
    const orgChart = page.getByTestId("analytics-org-chart");
    await expect(orgChart).toBeVisible({ timeout: 15_000 });
    await expect(orgChart.locator("canvas").first()).toBeVisible({ timeout: 15_000 });
  });
});
