/**
 * apps/web/tests/e2e/me-time-off.spec.ts — B3 (#34).
 *
 * Live-data E2E for /me/time-off (ESS "Ferie e permessi"): balances render
 * from /v1/me/attendance (tommaso holds 3 real balance rows), the submission
 * form is present, and a server-rejected range (end < start) surfaces the
 * error inline. Deliberately NON-persisting: the happy path (submit → manager
 * approves → applied effect) writes real approval + leave data and is proven
 * by apps/api/test/b3-time-off-approval.integration.test.ts inside the D-52
 * rollback transaction — an E2E suite that drained 2 vacation days per run
 * would not be idempotent.
 */

import { test, expect } from "@playwright/test";
import { storageStateFor } from "./fixtures";

test.describe("/me/time-off — ESS leave requests (B3)", () => {
  test.use({ storageState: storageStateFor("employee") });

  test("renders live balances, the form and the history table", async ({ page }) => {
    await page.goto("/me/time-off");
    await expect(page.getByTestId("me-time-off-page")).toBeVisible();

    // Balances: tommaso has real VACATION / SICK / PERSONAL rows.
    await expect(page.getByTestId("me-time-off-balances")).toBeVisible({ timeout: 15_000 });
    const cards = page.getByTestId("me-time-off-balances").locator("> div");
    expect(await cards.count()).toBeGreaterThanOrEqual(3);

    // Form is live with the translated leave-type options.
    await expect(page.getByTestId("me-time-off-form")).toBeVisible();
    const options = page.getByTestId("me-time-off-type").locator("option");
    expect(await options.count()).toBe(10);

    // History table (or its legitimate empty state) is present.
    const anyRow = page.getByTestId("me-time-off-row").first();
    const empty = page.getByTestId("me-time-off-empty");
    await expect(anyRow.or(empty)).toBeVisible({ timeout: 15_000 });
  });

  test("an inverted range is rejected by the server and surfaced inline", async ({ page }) => {
    await page.goto("/me/time-off");
    await expect(page.getByTestId("me-time-off-form")).toBeVisible();

    await page.getByTestId("me-time-off-start").fill("2027-03-10");
    await page.getByTestId("me-time-off-end").fill("2027-03-08");
    await page.getByTestId("me-time-off-submit").click();

    await expect(page.getByTestId("me-time-off-error")).toBeVisible({ timeout: 15_000 });
  });
});
