/**
 * apps/web/tests/e2e/analytics-org-network.spec.ts
 *
 * Live-data E2E for /analytics/org-network (BI analytics P3, capability #1 Phase 3:
 * org-network metrics over the position reports-to graph).
 *
 * Doctrine: LIVE DATA E2E ONLY — no mock, no fixture, no hardcoded number.
 * The totalPositions assertion is driven by a real GET /v1/analytics/org-network
 * call made through the same-origin Next.js `/api` proxy (the very path the page
 * uses at runtime), so the UI value is verified against the live API response —
 * not a constant baked into the test.
 *
 * Persona: platformAdmin (enzo.spenuso@heuresys.com → PLATFORM scope). The `analytics:view`
 * permission is granted to the admin roles by migration 000057. Auth is the persisted
 * storageState produced once by auth.setup.ts; this spec performs no inline login.
 */

import { test, expect, type APIRequestContext } from "@playwright/test";
import { storageStateFor } from "./fixtures";

import type { OrgNetworkAnalyticsResponse } from "@heuresys/shared";

test.use({ storageState: storageStateFor("platformAdmin") });

/**
 * Fetches the live org-network analytics payload through the same-origin Next.js
 * `/api` proxy (mirrors apiFetch's default baseUrl "/api"). The `request` fixture
 * inherits the storageState cookies, so the HttpOnly access token is forwarded
 * exactly as the browser would. baseURL comes from playwright.config.ts.
 */
async function fetchOrgNetwork(request: APIRequestContext): Promise<OrgNetworkAnalyticsResponse> {
  const res = await request.get("/api/v1/analytics/org-network");
  expect(res.ok(), `GET /api/v1/analytics/org-network → HTTP ${res.status()}`).toBeTruthy();
  return (await res.json()) as OrgNetworkAnalyticsResponse;
}

test.describe("BI P3 /analytics/org-network — live data (PLATFORM scope)", () => {
  test("renders org-graph metrics + chart fed by the live API number", async ({ page, request }) => {
    // 1. Learn the real position count straight from the live API (no fabricated value).
    const api = await fetchOrgNetwork(request);
    expect(typeof api.totalPositions).toBe("number");
    expect(api.totalPositions).toBeGreaterThan(0);

    // 2. Navigate to the page under test.
    await page.goto("/analytics/org-network");
    await expect(page.getByTestId("analytics-org-network-page")).toBeVisible({ timeout: 30_000 });

    // 3. Scope badge reflects the platform-admin scope returned by the API.
    await expect(page.getByTestId("analytics-org-network-scope")).toContainText(api.scope.kind);

    // 4. LIVE-DATA assertion: the headline totalPositions the page renders MUST equal
    //    the number the live API returned — not a hardcoded constant. If the page
    //    shipped mock/placeholder data, this would diverge from the API payload.
    await expect(page.getByTestId("org-network-total-positions")).toContainText(
      String(api.totalPositions),
    );

    // 5. The depth-distribution EChartsCard renders a real canvas.
    const depthChart = page.getByTestId("analytics-org-network-depth-chart");
    await expect(depthChart).toBeVisible({ timeout: 15_000 });
    await expect(depthChart.locator("canvas").first()).toBeVisible({ timeout: 15_000 });
  });
});
