/**
 * apps/web/tests/e2e/compensation-read.spec.ts — A/L7 (#32).
 * The six comp & reward read panels added to /compensation-intelligence, live over
 * /v1/compensation/{variable-pay,recommendations,bonus-pools,objective-reward-rules,
 * position-economic-weight,handoff-records}. PLATFORM_ADMIN (holds compensation_intelligence:read).
 * Org-scoping is proven at the API level by the integration suite; this asserts live render.
 */
import { test, expect } from "@playwright/test";
import { storageStateFor } from "./fixtures";

test.describe("compensation intelligence — comp & reward read panels (#32 A/L7)", () => {
  test.use({ storageState: storageStateFor("platformAdmin") });

  test("renders the six dormant-data read panels over the live compensation tables", async ({ page }) => {
    await page.goto("/compensation-intelligence");
    await expect(page.getByTestId("compensation-page")).toBeVisible({ timeout: 30_000 });

    for (const panel of [
      "comp-variable-pay-panel", "comp-recommendation-panel", "comp-bonus-pool-panel",
      "comp-objective-rule-panel", "comp-position-weight-panel", "comp-handoff-panel",
    ]) {
      await expect(page.getByTestId(panel)).toBeVisible({ timeout: 20_000 });
    }

    // Live rows from populated tables: variable-pay (121) + recommendations (116).
    await expect(page.getByTestId("comp-variable-pay-row").first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("comp-recommendation-row").first()).toBeVisible({ timeout: 20_000 });
  });
});
