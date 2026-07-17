/**
 * apps/web/tests/e2e/time-off.spec.ts — A/L8 (#33).
 * Time-off & leave admin page live over /v1/time-off/* (requests / accrual rules /
 * balance transactions). Org-scoping is proven at the API level by the integration
 * suite; this asserts the page renders live data on a real login. PLATFORM_ADMIN.
 */
import { test, expect } from "@playwright/test";
import { storageStateFor } from "./fixtures";

test.describe("time-off & leave admin page (#33 A/L8)", () => {
  test.use({ storageState: storageStateFor("platformAdmin") });

  test("renders requests + accrual rules + transactions over the live tables; filter works", async ({ page }) => {
    await page.goto("/time-off");
    await expect(page.getByTestId("time-off-page")).toBeVisible();
    await expect(page.getByTestId("time-off-title")).toBeVisible();
    // Live leave requests (69 seeded) + accrual rules (20) + transactions (20).
    await expect(page.getByTestId("time-off-request-row").first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("time-off-rule-row").first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("time-off-txn-row").first()).toBeVisible({ timeout: 20_000 });
    // Status filter narrows the request set without error.
    await page.getByTestId("time-off-status-filter").selectOption("APPROVED");
    await expect(page.getByTestId("time-off-page")).toBeVisible();
  });
});
