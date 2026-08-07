/**
 * apps/web/tests/e2e/analytics-attendance.spec.ts
 *
 * Live-data E2E for /analytics/attendance (BI analytics P2, capability #1).
 *
 * Doctrine: LIVE DATA E2E ONLY — no mock, no fixture, no hardcoded number.
 * The headline hours and the scope badge are asserted against the SAME live
 * GET /v1/analytics/attendance payload the page itself fetches at runtime, so
 * the UI values are verified against the real API response, not constants.
 *
 * Persona: platformAdmin (enzo.spenuso@heuresys.com → PLATFORM scope). `analytics:view`
 * is granted to the admin roles by migration 000057. Auth is the persisted
 * storageState from auth.setup.ts (no inline login).
 */

import { test, expect, type APIRequestContext } from "@playwright/test";
import { storageStateFor } from "./fixtures";

import type { AttendanceAnalyticsResponse } from "@heuresys/shared";

test.use({ storageState: storageStateFor("platformAdmin") });

async function fetchAttendance(request: APIRequestContext): Promise<AttendanceAnalyticsResponse> {
  const res = await request.get("/api/v1/analytics/attendance");
  expect(res.ok(), `GET /api/v1/analytics/attendance → HTTP ${res.status()}`).toBeTruthy();
  return (await res.json()) as AttendanceAnalyticsResponse;
}

test.describe("BI P2 /analytics/attendance — live data (PLATFORM scope)", () => {
  test("renders worked-hours stats + monthly/OU charts fed by the live API", async ({
    page,
    request,
  }) => {
    // 1. Learn the real numbers straight from the live API (no fabricated value).
    const api = await fetchAttendance(request);
    expect(typeof api.totalOvertimeHours).toBe("number");
    expect(api.monthly.length).toBeGreaterThan(0);
    expect(api.byOrgUnit.length).toBeGreaterThan(0);

    // 2. Navigate to the page under test.
    await page.goto("/analytics/attendance");
    await expect(page.getByTestId("analytics-attendance-page")).toBeVisible({ timeout: 30_000 });

    // 3. Scope badge reflects the scope the API returned.
    await expect(page.getByTestId("analytics-attendance-scope")).toContainText(api.scope.kind);

    // 4. LIVE-DATA assertion: the overtime stat the page renders MUST match the
    //    live API number. The count-up animation and any thousands-separator are
    //    tolerated by polling + stripping non-digits before comparing.
    const expectedOvertime = String(Math.round(api.totalOvertimeHours));
    await expect(async () => {
      const txt = (await page.getByTestId("attendance-total-overtime").innerText()).replace(/\D/g, "");
      expect(txt).toContain(expectedOvertime);
    }).toPass({ timeout: 15_000 });

    // 5. Both EChartsCard canvases render (monthly time-series + by-OU bar).
    const monthly = page.getByTestId("analytics-attendance-monthly-chart");
    await expect(monthly).toBeVisible({ timeout: 15_000 });
    await expect(monthly.locator("canvas").first()).toBeVisible({ timeout: 15_000 });

    const ou = page.getByTestId("analytics-attendance-ou-chart");
    await expect(ou).toBeVisible({ timeout: 15_000 });
    await expect(ou.locator("canvas").first()).toBeVisible({ timeout: 15_000 });
  });
});
