/**
 * apps/web/tests/e2e/admin-lists.spec.ts
 *
 * Live-data E2E for /users, /users/[id], /positions, /positions/[id]
 * against the seeded RTL_BANK_REFERENCE tenant (158 personas + 158 positions).
 * Uses storageState (auth.setup.ts) to avoid /v1/auth/login rate limit.
 */

import { test, expect } from "@playwright/test";
import { storageStateFor } from "./fixtures";

test.use({ storageState: storageStateFor("tenantAdmin") });

test.describe("MVP-2a admin lists — live data", () => {
  test("/users lists tenant users with real count > 0 and clickable detail", async ({ page }) => {
    await page.goto("/users");

    await expect(page.getByTestId("users-page")).toBeVisible();
    await expect(page.getByTestId("users-title")).toBeVisible();
    await expect(page.getByTestId("users-count")).toContainText(/\d+\s+totali/);
    const rows = page.getByTestId("users-row");
    await expect(rows.first()).toBeVisible();
    const rowCount = await rows.count();
    expect(rowCount).toBeGreaterThanOrEqual(5);

    const firstLink = page.getByTestId("user-link").first();
    await firstLink.click();
    await page.waitForURL(/\/users\/[0-9a-f-]+$/);
    await expect(page.getByTestId("user-detail-page")).toBeVisible();
    await expect(page.getByTestId("field-userId")).toBeVisible();
    await expect(page.getByTestId("user-email-detail")).toBeVisible();
  });

  test("/positions lists tenant positions and clickable PIP detail", async ({ page }) => {
    await page.goto("/positions");

    await expect(page.getByTestId("positions-page")).toBeVisible();
    await expect(page.getByTestId("positions-count")).toContainText(/\d+\s+totali/);
    const rows = page.getByTestId("positions-row");
    await expect(rows.first()).toBeVisible();
    expect(await rows.count()).toBeGreaterThanOrEqual(5);

    await page.getByTestId("position-link").first().click();
    await page.waitForURL(/\/positions\/[0-9a-f-]+$/);
    await expect(page.getByTestId("position-detail-page")).toBeVisible();
    await expect(page.getByTestId("position-title")).toBeVisible();
    await expect(page.getByTestId("position-code")).toBeVisible();
  });
});
