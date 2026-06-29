/**
 * apps/web/tests/e2e/me-pay-slips.spec.ts
 *
 * Live-data E2E for the Cedolini tab of /me/profile (S1011 F4). The outsider
 * persona (antonio.parisi) has 3 real imported pay-slips (mig 000167 + seed 16);
 * asserts the tab renders them.
 */
import { test, expect } from "@playwright/test";
import { storageStateFor } from "./fixtures";

test.use({ storageState: storageStateFor("outsider") });

test.describe("/me/profile Cedolini tab — live data (F4)", () => {
  test("renders the caller's imported pay-slips", async ({ page }) => {
    await page.goto("/me/profile?tab=cedolini");
    await expect(page.getByTestId("me-profile-page")).toBeVisible();

    // the Cedolini tab exists and is selectable
    await page.getByTestId("profile-tab-cedolini").click();
    await expect(page.getByTestId("profile-payslips")).toBeVisible();

    // antonio has real slips → at least the primary slip card + a gross amount
    await expect(page.getByTestId("section-payslip-primary")).toBeVisible();
    await expect(page.getByTestId("ps-gross")).not.toBeEmpty();
  });
});
